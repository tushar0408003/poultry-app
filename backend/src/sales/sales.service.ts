import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { QueryFilter, Types } from 'mongoose';
import { BusinessClock } from '../common/business-clock.service';
import { addDays, formatDateOnly, parseDateOnly } from '../common/dates';
import { computeSaleAmount, formatInr, kgToGrams, rupeesToPaise } from '../common/money';
import { paginated, Paginated } from '../common/pagination.dto';
import { CustomersRepository } from '../customers/customers.repository';
import { TransactionService } from '../database/transaction.service';
import { toPaymentResponse } from '../payments/payment.mapper';
import { Payment, PaymentMode, PaymentSource } from '../payments/payment.schema';
import { PaymentsRepository } from '../payments/payments.repository';
import { CreateSaleDto, ListSalesQueryDto, UpdateSaleDto } from './dto/sale.dto';
import { computeTotals, SaleLedger } from './sale-ledger.service';
import { toSaleResponse } from './sale.mapper';
import { Sale } from './sale.schema';
import { SalesRepository } from './sales.repository';
import type { SaleDetailResponse, SaleResponse } from './sales.interfaces';

@Injectable()
export class SalesService {
  constructor(
    private readonly sales: SalesRepository,
    private readonly payments: PaymentsRepository,
    private readonly customers: CustomersRepository,
    private readonly ledger: SaleLedger,
    private readonly tx: TransactionService,
    private readonly clock: BusinessClock,
  ) {}

  /**
   * Creates the sale and, in the same transaction, one payment record per
   * non-zero amount received at the time of sale (cash and/or online).
   */
  async create(dto: CreateSaleDto): Promise<SaleDetailResponse> {
    const customerId = new Types.ObjectId(dto.customerId);
    const saleDate = dto.saleDate ? parseDateOnly(dto.saleDate) : this.clock.today();
    this.assertNotFuture(saleDate, 'Sale date');

    const weightGrams = kgToGrams(dto.weight);
    const ratePaise = rupeesToPaise(dto.ratePerKg);
    const totalAmountPaise = this.saleAmount(weightGrams, ratePaise);
    const cashPaise = rupeesToPaise(dto.cashReceived ?? 0);
    const onlinePaise = rupeesToPaise(dto.onlineReceived ?? 0);
    assertNotOverpaid(cashPaise + onlinePaise, totalAmountPaise);

    const saleId = await this.tx.run(async (session) => {
      if (!(await this.customers.findById(customerId, session))) throw new NotFoundException('Customer not found');
      const sale = await this.sales.create(
        {
          customerId,
          saleDate,
          weightGrams,
          ratePaise,
          totalAmountPaise,
          ...computeTotals(totalAmountPaise, cashPaise, onlinePaise),
          notes: dto.notes ?? '',
        },
        session,
      );
      await this.payments.insertMany(
        [
          ...saleEntryPayment(sale, PaymentMode.CASH, cashPaise),
          ...saleEntryPayment(sale, PaymentMode.ONLINE, onlinePaise, dto.onlineReference),
        ],
        session,
      );
      return sale._id;
    });
    return this.get(saleId);
  }

  async get(id: Types.ObjectId): Promise<SaleDetailResponse> {
    const [sale, payments] = await Promise.all([this.sales.findByIdWithCustomer(id), this.payments.findBySale(id)]);
    if (!sale) throw new NotFoundException('Sale not found');
    return { ...toSaleResponse(sale), payments: payments.map(toPaymentResponse) };
  }

  async list(query: ListSalesQueryDto): Promise<Paginated<SaleResponse>> {
    const filter: QueryFilter<Sale> = {};

    if (query.customerId) filter.customerId = new Types.ObjectId(query.customerId);
    if (query.search?.trim()) {
      const ids = await this.customers.findIdsBySearch(query.search);
      filter.customerId = query.customerId
        ? { $in: ids.filter((i) => i.equals(query.customerId!)) }
        : { $in: ids };
    }

    if (query.date) {
      const day = parseDateOnly(query.date);
      filter.saleDate = { $gte: day, $lt: addDays(day, 1) };
    } else if (query.from || query.to) {
      const range: { $gte?: Date; $lt?: Date } = {};
      if (query.from) range.$gte = parseDateOnly(query.from);
      if (query.to) range.$lt = addDays(parseDateOnly(query.to), 1);
      filter.saleDate = range;
    }

    if (query.status === 'PAID') filter.remaining = 0;
    if (query.status === 'UNPAID') Object.assign(filter, { totalPaid: 0, remaining: { $gt: 0 } });
    if (query.status === 'PARTIAL') Object.assign(filter, { totalPaid: { $gt: 0 }, remaining: { $gt: 0 } });

    const [items, total] = await this.sales.list(filter, query.page, query.limit);
    return paginated(items.map(toSaleResponse), total, query.page, query.limit);
  }

  /**
   * Edits a sale and recalculates its balance.
   * - Changing customer moves all of the sale's payments to the new customer.
   * - Changing the date moves the "received at sale" payments with it; later
   *   collections must not end up dated before the sale.
   * - cashReceived / onlineReceived replace the amounts received at sale time;
   *   later collections are untouched.
   * Everything is validated before the first write.
   */
  async update(id: Types.ObjectId, dto: UpdateSaleDto): Promise<SaleDetailResponse> {
    await this.tx.run(async (session) => {
      const sale = await this.sales.findById(id, session);
      if (!sale) throw new NotFoundException('Sale not found');

      const customerId = dto.customerId ? new Types.ObjectId(dto.customerId) : sale.customerId;
      const customerChanged = !customerId.equals(sale.customerId);
      if (customerChanged && !(await this.customers.findById(customerId, session))) {
        throw new NotFoundException('Customer not found');
      }

      const saleDate = dto.saleDate ? parseDateOnly(dto.saleDate) : sale.saleDate;
      const dateChanged = saleDate.getTime() !== sale.saleDate.getTime();
      if (dateChanged) this.assertNotFuture(saleDate, 'Sale date');

      const weightGrams = dto.weight !== undefined ? kgToGrams(dto.weight) : sale.weightGrams;
      const ratePaise = dto.ratePerKg !== undefined ? rupeesToPaise(dto.ratePerKg) : sale.ratePaise;
      const totalAmountPaise = this.saleAmount(weightGrams, ratePaise);

      const replace = {
        [PaymentMode.CASH]: dto.cashReceived !== undefined ? rupeesToPaise(dto.cashReceived) : undefined,
        [PaymentMode.ONLINE]: dto.onlineReceived !== undefined ? rupeesToPaise(dto.onlineReceived) : undefined,
      };

      const existing = await this.payments.findBySale(id, session);
      const early = existing.find((p) => p.source === PaymentSource.COLLECTION && p.paymentDate < saleDate);
      if (early) {
        throw new BadRequestException(
          `A payment dated ${formatDateOnly(early.paymentDate)} exists for this sale. ` +
            'The sale date cannot be after a payment date.',
        );
      }

      // Paid amount after the edit = kept payments + replaced sale-entry amounts.
      let paidAfter = 0;
      for (const p of existing) {
        const replaced = p.source === PaymentSource.SALE_ENTRY && replace[p.paymentMode] !== undefined;
        if (!replaced) paidAfter += p.amountPaise;
      }
      paidAfter += (replace.CASH ?? 0) + (replace.ONLINE ?? 0);
      assertNotOverpaid(paidAfter, totalAmountPaise);

      // --- validated, now write ---
      if (customerChanged) await this.payments.reassignCustomer(id, customerId, session);
      if (dateChanged) await this.payments.moveSaleEntryDate(id, saleDate, session);

      const updatedSale = { ...sale, customerId, saleDate };
      for (const mode of [PaymentMode.CASH, PaymentMode.ONLINE]) {
        const amount = replace[mode];
        if (amount === undefined) continue;
        const oldRef = existing.find((p) => p.source === PaymentSource.SALE_ENTRY && p.paymentMode === mode)
          ?.transactionReference;
        await this.payments.deleteSaleEntryPayments(id, mode, session);
        await this.payments.insertMany(saleEntryPayment(updatedSale, mode, amount, dto.onlineReference ?? oldRef), session);
      }

      await this.sales.updateById(
        id,
        {
          customerId,
          saleDate,
          weightGrams,
          ratePaise,
          totalAmountPaise,
          ...(dto.notes !== undefined && { notes: dto.notes }),
        },
        session,
      );
      await this.ledger.sync(id, totalAmountPaise, session);
    });
    return this.get(id);
  }

  /** Deletes the sale together with all of its payment records, atomically. */
  async remove(id: Types.ObjectId): Promise<{ deleted: true; paymentsDeleted: number }> {
    return this.tx.run(async (session) => {
      const sale = await this.sales.findById(id, session);
      if (!sale) throw new NotFoundException('Sale not found');
      const paymentsDeleted = await this.payments.deleteBySale(id, session);
      await this.sales.deleteById(id, session);
      return { deleted: true as const, paymentsDeleted };
    });
  }

  private saleAmount(weightGrams: number, ratePaise: number): number {
    const total = computeSaleAmount(weightGrams, ratePaise);
    if (total <= 0) throw new BadRequestException('Sale amount must be at least ₹0.01');
    return total;
  }

  private assertNotFuture(date: Date, label: string): void {
    if (this.clock.isFuture(date)) throw new BadRequestException(`${label} cannot be in the future`);
  }
}

function assertNotOverpaid(paidPaise: number, totalPaise: number): void {
  if (paidPaise > totalPaise) {
    throw new BadRequestException(
      `Total payment (${formatInr(paidPaise)}) cannot be more than the sale amount (${formatInr(totalPaise)})`,
    );
  }
}

function saleEntryPayment(
  sale: Pick<Sale, '_id' | 'customerId' | 'saleDate'>,
  mode: PaymentMode,
  amountPaise: number,
  reference?: string,
): Omit<Payment, '_id' | 'createdAt'>[] {
  if (amountPaise <= 0) return [];
  return [
    {
      saleId: sale._id,
      customerId: sale.customerId,
      amountPaise,
      paymentMode: mode,
      paymentDate: sale.saleDate,
      transactionReference: mode === PaymentMode.ONLINE ? (reference ?? '') : '',
      source: PaymentSource.SALE_ENTRY,
    },
  ];
}
