import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { ClientSession, QueryFilter, Types } from 'mongoose';
import { BusinessClock } from '../common/business-clock.service';
import { addDays, formatDateOnly, parseDateOnly } from '../common/dates';
import { formatInr, paiseToRupees, rupeesToPaise } from '../common/money';
import { paginated, Paginated, PaginationQueryDto } from '../common/pagination.dto';
import { CustomersRepository } from '../customers/customers.repository';
import { TransactionService } from '../database/transaction.service';
import { SaleLedger } from '../sales/sale-ledger.service';
import { toSaleResponse } from '../sales/sale.mapper';
import { SalesRepository } from '../sales/sales.repository';
import { AllocatePaymentDto, CreatePaymentDto, ListPaymentsQueryDto } from './dto/payment.dto';
import { toPaymentResponse } from './payment.mapper';
import { Payment, PaymentSource } from './payment.schema';
import { PaymentsRepository } from './payments.repository';
import type { SaleResponse } from '../sales/sales.interfaces';
import type { PaymentResponse } from './payments.interfaces';

@Injectable()
export class PaymentsService {
  constructor(
    private readonly payments: PaymentsRepository,
    private readonly sales: SalesRepository,
    private readonly customers: CustomersRepository,
    private readonly ledger: SaleLedger,
    private readonly tx: TransactionService,
    private readonly clock: BusinessClock,
  ) {}

  /**
   * Records a new payment against a sale. Previous payments are never changed;
   * the sale's paid/remaining amounts are recalculated from all its payments.
   */
  async create(dto: CreatePaymentDto): Promise<{ payment: PaymentResponse; sale: SaleResponse }> {
    const saleId = new Types.ObjectId(dto.saleId);
    const amountPaise = rupeesToPaise(dto.amount);
    const paymentDate = this.paymentDate(dto.paymentDate);

    const paymentId = await this.tx.run(async (session) => {
      const sale = await this.sales.findById(saleId, session);
      if (!sale) throw new NotFoundException('Sale not found');
      if (paymentDate < sale.saleDate) {
        throw new BadRequestException(
          `Payment date cannot be before the sale date (${formatDateOnly(sale.saleDate)})`,
        );
      }
      if (sale.remainingPaise <= 0) throw new BadRequestException('This sale is already fully paid');
      if (amountPaise > sale.remainingPaise) {
        throw new BadRequestException(
          `Amount (${formatInr(amountPaise)}) is more than the balance due (${formatInr(sale.remainingPaise)})`,
        );
      }
      const [payment] = await this.payments.insertMany(
        [this.newPayment(dto, sale._id, sale.customerId, amountPaise, paymentDate)],
        session,
      );
      await this.ledger.sync(sale._id, sale.totalAmountPaise, session);
      return payment._id;
    });

    return this.paymentWithSale(paymentId);
  }

  /** Splits a lump-sum payment across the customer's oldest unpaid sales. */
  async allocate(dto: AllocatePaymentDto): Promise<{ payments: PaymentResponse[]; totalAllocated: number }> {
    const customerId = new Types.ObjectId(dto.customerId);
    const amountPaise = rupeesToPaise(dto.amount);
    const paymentDate = this.paymentDate(dto.paymentDate);

    const ids = await this.tx.run(async (session) => {
      if (!(await this.customers.findById(customerId, session))) throw new NotFoundException('Customer not found');
      // Only sales made on or before the payment date can receive it.
      const open = (await this.sales.findOutstandingForCustomer(customerId, session)).filter(
        (s) => s.saleDate <= paymentDate,
      );
      const due = open.reduce((sum, s) => sum + s.remainingPaise, 0);
      if (due === 0) throw new BadRequestException('This customer has no balance due on or before this date');
      if (amountPaise > due) {
        throw new BadRequestException(
          `Amount (${formatInr(amountPaise)}) is more than the balance due (${formatInr(due)})`,
        );
      }

      const docs: Omit<Payment, '_id' | 'createdAt'>[] = [];
      let left = amountPaise;
      for (const sale of open) {
        if (left === 0) break;
        const part = Math.min(left, sale.remainingPaise);
        docs.push(this.newPayment(dto, sale._id, customerId, part, paymentDate));
        left -= part;
      }
      const created = await this.payments.insertMany(docs, session);
      for (const sale of open.slice(0, docs.length)) {
        await this.ledger.sync(sale._id, sale.totalAmountPaise, session);
      }
      return created.map((p) => p._id);
    });

    const payments = await Promise.all(ids.map((id) => this.payments.findById(id)));
    return {
      payments: payments.filter((p): p is Payment => p !== null).map(toPaymentResponse),
      totalAllocated: paiseToRupees(amountPaise),
    };
  }

  /** Removes a wrongly entered payment and restores the sale's balance. */
  async remove(id: Types.ObjectId): Promise<{ deleted: true; sale: SaleResponse }> {
    const saleId = await this.tx.run(async (session: ClientSession | undefined) => {
      const payment = await this.payments.findById(id, session);
      if (!payment) throw new NotFoundException('Payment not found');
      const sale = await this.sales.findById(payment.saleId, session);
      await this.payments.deleteById(id, session);
      if (sale) await this.ledger.sync(sale._id, sale.totalAmountPaise, session);
      return payment.saleId;
    });
    const sale = await this.sales.findByIdWithCustomer(saleId);
    if (!sale) throw new NotFoundException('Sale not found');
    return { deleted: true, sale: toSaleResponse(sale) };
  }

  async list(query: ListPaymentsQueryDto): Promise<Paginated<PaymentResponse>> {
    const filter: QueryFilter<Payment> = {};
    if (query.customerId) filter.customerId = new Types.ObjectId(query.customerId);
    if (query.paymentMode) filter.paymentMode = query.paymentMode;
    if (query.date) {
      const day = parseDateOnly(query.date);
      filter.paymentDate = { $gte: day, $lt: addDays(day, 1) };
    } else if (query.from || query.to) {
      const range: { $gte?: Date; $lt?: Date } = {};
      if (query.from) range.$gte = parseDateOnly(query.from);
      if (query.to) range.$lt = addDays(parseDateOnly(query.to), 1);
      filter.paymentDate = range;
    }
    const [items, total] = await this.payments.list(filter, query.page, query.limit);
    return paginated(items.map(toPaymentResponse), total, query.page, query.limit);
  }

  async listBySale(saleId: Types.ObjectId): Promise<PaymentResponse[]> {
    if (!(await this.sales.findById(saleId))) throw new NotFoundException('Sale not found');
    return (await this.payments.findBySale(saleId)).map(toPaymentResponse);
  }

  async listByCustomer(customerId: Types.ObjectId, page: PaginationQueryDto): Promise<Paginated<PaymentResponse>> {
    if (!(await this.customers.findById(customerId))) throw new NotFoundException('Customer not found');
    const [items, total] = await this.payments.list({ customerId }, page.page, page.limit);
    return paginated(items.map(toPaymentResponse), total, page.page, page.limit);
  }

  private paymentDate(value?: string): Date {
    const date = value ? parseDateOnly(value) : this.clock.today();
    if (this.clock.isFuture(date)) throw new BadRequestException('Payment date cannot be in the future');
    return date;
  }

  private newPayment(
    dto: CreatePaymentDto | AllocatePaymentDto,
    saleId: Types.ObjectId,
    customerId: Types.ObjectId,
    amountPaise: number,
    paymentDate: Date,
  ): Omit<Payment, '_id' | 'createdAt'> {
    return {
      saleId,
      customerId,
      amountPaise,
      paymentMode: dto.paymentMode,
      paymentDate,
      transactionReference: dto.transactionReference ?? '',
      source: PaymentSource.COLLECTION,
    };
  }

  private async paymentWithSale(paymentId: Types.ObjectId): Promise<{ payment: PaymentResponse; sale: SaleResponse }> {
    const payment = await this.payments.findById(paymentId);
    if (!payment) throw new NotFoundException('Payment not found');
    const sale = await this.sales.findByIdWithCustomer(payment.saleId);
    if (!sale) throw new NotFoundException('Sale not found');
    return { payment: toPaymentResponse(payment), sale: toSaleResponse(sale) };
  }
}
