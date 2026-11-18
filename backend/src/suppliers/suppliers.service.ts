import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Types } from 'mongoose';
import { BusinessClock } from '../common/business-clock.service';
import { formatDateOnly, parseDateOnly } from '../common/dates';
import { formatInr, gramsToKg, kgToGrams, paiseToRupees, rupeesToPaise } from '../common/money';
import { TransactionService } from '../database/transaction.service';
import { PaymentMode } from '../payments/payment.schema';
import { PurchasesRepository } from '../purchases/purchases.repository';
import { CreateSupplierPaymentDto } from './dto/supplier-payment.dto';
import { CreateSupplierDto, UpdateSupplierDto } from './dto/supplier.dto';
import { SupplierPaymentsRepository } from './supplier-payments.repository';
import { supplierBalancePaise, toSupplierPaymentResponse, toSupplierResponse } from './supplier.mapper';
import type { Supplier } from './supplier.schema';
import type {
  SupplierLedgerEntry,
  SupplierLedgerResponse,
  SupplierPaymentResponse,
  SupplierResponse,
} from './suppliers.interfaces';
import { SuppliersRepository } from './suppliers.repository';

const MODE_LABEL: Record<PaymentMode, string> = { [PaymentMode.CASH]: 'Cash', [PaymentMode.ONLINE]: 'Online' };

@Injectable()
export class SuppliersService {
  constructor(
    private readonly suppliers: SuppliersRepository,
    private readonly purchases: PurchasesRepository,
    private readonly payments: SupplierPaymentsRepository,
    private readonly tx: TransactionService,
    private readonly clock: BusinessClock,
  ) {}

  async create(dto: CreateSupplierDto): Promise<SupplierResponse> {
    const created = await this.suppliers.create({
      ownerName: dto.ownerName,
      phone: dto.phone ?? '',
      address: dto.address ?? '',
      outstandingPaise: rupeesToPaise(dto.outstanding),
      ratePaise: rupeesToPaise(dto.rate),
      weightGrams: kgToGrams(dto.weight ?? 0),
    });
    return toSupplierResponse(created);
  }

  /** All suppliers with their purchase/payment totals and the balance still owed to them. */
  async list(search?: string): Promise<SupplierResponse[]> {
    const suppliers = await this.suppliers.list(search);
    if (suppliers.length === 0) return [];
    const ids = suppliers.map((s) => s._id);
    const [stats, payments] = await Promise.all([this.purchases.supplierStats(ids), this.payments.totals(ids)]);
    const statsById = new Map(stats.map((s) => [s._id.toString(), s]));
    const paymentsById = new Map(payments.map((p) => [p._id.toString(), p]));
    return suppliers.map((s) => toSupplierResponse(s, statsById.get(s._id.toString()), paymentsById.get(s._id.toString())));
  }

  async get(id: Types.ObjectId): Promise<SupplierResponse> {
    return this.withStats(await this.findOrThrow(id));
  }

  /** Changing the rate only affects new purchases; old ones keep the rate they were made at. */
  async update(id: Types.ObjectId, dto: UpdateSupplierDto): Promise<SupplierResponse> {
    const set: Partial<Supplier> = {};
    if (dto.ownerName !== undefined) set.ownerName = dto.ownerName;
    if (dto.phone !== undefined) set.phone = dto.phone;
    if (dto.address !== undefined) set.address = dto.address;
    if (dto.outstanding !== undefined) set.outstandingPaise = rupeesToPaise(dto.outstanding);
    if (dto.rate !== undefined) set.ratePaise = rupeesToPaise(dto.rate);
    if (dto.weight !== undefined) set.weightGrams = kgToGrams(dto.weight);

    const updated = await this.suppliers.updateById(id, set);
    if (!updated) throw new NotFoundException('Supplier not found');
    return this.withStats(updated);
  }

  /**
   * Deletes the supplier together with all of their purchases and payments,
   * atomically, so nothing is left pointing at a missing supplier.
   */
  async remove(id: Types.ObjectId): Promise<{ deleted: true; purchasesDeleted: number; paymentsDeleted: number }> {
    return this.tx.run(async (session) => {
      if (!(await this.suppliers.findById(id, session))) throw new NotFoundException('Supplier not found');
      const purchasesDeleted = await this.purchases.deleteBySupplier(id, session);
      const paymentsDeleted = await this.payments.deleteBySupplier(id, session);
      await this.suppliers.deleteById(id, session);
      return { deleted: true as const, purchasesDeleted, paymentsDeleted };
    });
  }

  // ---------- payments ----------

  async listPayments(supplierId: Types.ObjectId): Promise<SupplierPaymentResponse[]> {
    await this.findOrThrow(supplierId);
    return (await this.payments.findBySupplier(supplierId)).map(toSupplierPaymentResponse);
  }

  /** Records money paid to the supplier. It cannot be more than the balance owed. */
  async addPayment(supplierId: Types.ObjectId, dto: CreateSupplierPaymentDto): Promise<SupplierPaymentResponse> {
    const paymentDate = dto.paymentDate ? parseDateOnly(dto.paymentDate) : this.clock.today();
    if (this.clock.isFuture(paymentDate)) throw new BadRequestException('Payment date cannot be in the future');
    const amountPaise = rupeesToPaise(dto.amount);

    const payment = await this.tx.run(async (session) => {
      const supplier = await this.suppliers.findById(supplierId, session);
      if (!supplier) throw new NotFoundException('Supplier not found');
      const [[stats], [paid]] = await Promise.all([
        this.purchases.supplierStats([supplierId], session),
        this.payments.totals([supplierId], session),
      ]);
      const balancePaise = supplierBalancePaise(supplier.outstandingPaise ?? 0, stats, paid);
      if (amountPaise > balancePaise) {
        throw new BadRequestException(
          `Amount (${formatInr(amountPaise)}) cannot be more than the balance to pay (${formatInr(Math.max(balancePaise, 0))})`,
        );
      }
      return this.payments.create(
        {
          supplierId,
          paymentDate,
          amountPaise,
          paymentMode: dto.paymentMode,
          transactionReference: dto.paymentMode === PaymentMode.ONLINE ? (dto.transactionReference ?? '') : '',
          notes: dto.notes ?? '',
        },
        session,
      );
    });
    return toSupplierPaymentResponse(payment);
  }

  async removePayment(supplierId: Types.ObjectId, paymentId: Types.ObjectId): Promise<{ deleted: true }> {
    const payment = await this.payments.findById(paymentId);
    if (!payment || !payment.supplierId.equals(supplierId)) throw new NotFoundException('Payment not found');
    await this.payments.deleteById(paymentId);
    return { deleted: true };
  }

  // ---------- balance sheet ----------

  /**
   * Every money movement with the supplier, oldest first, with a running balance:
   * old dues, then purchases (debit; any amount paid with the purchase is credited on
   * the same line) and later payments (credit). Same-day purchases come before payments.
   */
  async ledger(supplierId: Types.ObjectId): Promise<SupplierLedgerResponse> {
    const supplier = await this.findOrThrow(supplierId);
    const [purchases, payments] = await Promise.all([
      this.purchases.findAllBySupplier(supplierId),
      this.payments.findBySupplier(supplierId),
    ]);

    type Line = Omit<SupplierLedgerEntry, 'balance' | 'debit' | 'credit'> & { at: Date; order: number; debitPaise: number; creditPaise: number };
    const lines: Line[] = [
      ...purchases.map((p) => {
        const paid = p.cashPaidPaise + p.onlinePaidPaise;
        const how = [p.cashPaidPaise && 'cash', p.onlinePaidPaise && 'online'].filter(Boolean).join(' + ');
        return {
          id: p._id.toString(),
          type: 'PURCHASE' as const,
          date: formatDateOnly(p.purchaseDate),
          description: paid > 0 ? `Purchase (paid ${how})` : 'Purchase',
          weight: gramsToKg(p.weightGrams),
          rate: paiseToRupees(p.ratePaise),
          at: p.purchaseDate,
          order: 0,
          debitPaise: p.totalPaise,
          creditPaise: paid,
        };
      }),
      ...payments.map((p) => ({
        id: p._id.toString(),
        type: 'PAYMENT' as const,
        date: formatDateOnly(p.paymentDate),
        description: `Payment, ${MODE_LABEL[p.paymentMode]}${p.transactionReference ? ` (${p.transactionReference})` : ''}`,
        weight: null,
        rate: null,
        at: p.paymentDate,
        order: 1,
        debitPaise: 0,
        creditPaise: p.amountPaise,
      })),
    ];
    lines.sort((a, b) => a.at.getTime() - b.at.getTime() || a.order - b.order);

    const openingPaise = supplier.outstandingPaise ?? 0;
    let balancePaise = openingPaise;
    let purchasesPaise = 0;
    let paidPaise = 0;
    const entries: SupplierLedgerEntry[] = [
      {
        id: 'opening',
        type: 'OPENING',
        date: null,
        description: 'Old dues (before the app)',
        weight: null,
        rate: null,
        debit: paiseToRupees(openingPaise),
        credit: 0,
        balance: paiseToRupees(openingPaise),
      },
    ];
    for (const { at: _at, order: _order, debitPaise, creditPaise, ...line } of lines) {
      balancePaise += debitPaise - creditPaise;
      purchasesPaise += debitPaise;
      paidPaise += creditPaise;
      entries.push({ ...line, debit: paiseToRupees(debitPaise), credit: paiseToRupees(creditPaise), balance: paiseToRupees(balancePaise) });
    }

    return {
      supplierId: supplier._id.toString(),
      ownerName: supplier.ownerName,
      openingBalance: paiseToRupees(openingPaise),
      totalPurchases: paiseToRupees(purchasesPaise),
      totalPaid: paiseToRupees(paidPaise),
      closingBalance: paiseToRupees(balancePaise),
      entries,
    };
  }

  private async findOrThrow(id: Types.ObjectId): Promise<Supplier> {
    const supplier = await this.suppliers.findById(id);
    if (!supplier) throw new NotFoundException('Supplier not found');
    return supplier;
  }

  private async withStats(supplier: Supplier): Promise<SupplierResponse> {
    const [[stats], [payments]] = await Promise.all([
      this.purchases.supplierStats([supplier._id]),
      this.payments.totals([supplier._id]),
    ]);
    return toSupplierResponse(supplier, stats, payments);
  }
}
