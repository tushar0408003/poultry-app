import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Types } from 'mongoose';
import { formatDateOnly } from '../common/dates';
import { formatInr, paiseToRupees, rupeesToPaise } from '../common/money';
import { TransactionService } from '../database/transaction.service';
import { PaymentMode, PaymentSource } from '../payments/payment.schema';
import { PaymentsRepository } from '../payments/payments.repository';
import { SalesRepository } from '../sales/sales.repository';
import { Customer } from './customer.schema';
import { toCustomerResponse } from './customer.mapper';
import { CustomersRepository } from './customers.repository';
import { CreateCustomerDto, UpdateCustomerDto } from './dto/customer.dto';
import type { CustomerLedgerEntry, CustomerLedgerResponse, CustomerResponse } from './customers.interfaces';

const MODE_LABEL: Record<PaymentMode, string> = { [PaymentMode.CASH]: 'Cash', [PaymentMode.ONLINE]: 'Online' };

@Injectable()
export class CustomersService {
  constructor(
    private readonly customers: CustomersRepository,
    private readonly sales: SalesRepository,
    private readonly payments: PaymentsRepository,
    private readonly tx: TransactionService,
  ) {}

  async create(dto: CreateCustomerDto): Promise<CustomerResponse> {
    const created = await this.customers.create({
      ownerName: dto.ownerName,
      phone: dto.phone ?? '',
      address: dto.address ?? '',
      outstandingPaise: rupeesToPaise(dto.outstanding),
    });
    return toCustomerResponse(created);
  }

  /** All customers with their lifetime totals and current outstanding balance. */
  async list(search?: string): Promise<CustomerResponse[]> {
    const customers = await this.customers.list(search);
    if (customers.length === 0) return [];
    const ids = customers.map((c) => c._id);
    const [stats, payments] = await Promise.all([
      this.sales.customerStats(ids),
      this.payments.customerPaymentStats(ids),
    ]);
    const salesById = new Map(stats.map((s) => [s.customerId.toString(), s]));
    const paymentsById = new Map(payments.map((p) => [p._id.toString(), p]));
    return customers.map((c) =>
      toCustomerResponse(c, salesById.get(c._id.toString()), paymentsById.get(c._id.toString())),
    );
  }

  async get(id: Types.ObjectId): Promise<CustomerResponse> {
    const customer = await this.customers.findById(id);
    if (!customer) throw new NotFoundException('Customer not found');
    return this.withStats(customer);
  }

  async update(id: Types.ObjectId, dto: UpdateCustomerDto): Promise<CustomerResponse> {
    const set: Record<string, string | number> = {};
    if (dto.ownerName !== undefined) set.ownerName = dto.ownerName;
    if (dto.phone !== undefined) set.phone = dto.phone;
    if (dto.address !== undefined) set.address = dto.address;
    if (dto.outstanding !== undefined) {
      const outstandingPaise = rupeesToPaise(dto.outstanding);
      const [paid] = await this.payments.customerPaymentStats([id]);
      const paidPaise = paid ? paid.cashPaise + paid.onlinePaise : 0;
      if (outstandingPaise < paidPaise) {
        throw new BadRequestException(
          `Outstanding cannot be less than what was already paid against it (${formatInr(paidPaise)})`,
        );
      }
      set.outstandingPaise = outstandingPaise;
    }

    const updated = await this.customers.updateById(id, set);
    if (!updated) throw new NotFoundException('Customer not found');
    return this.withStats(updated);
  }

  /**
   * Deletes the customer together with all of their sales and payments, atomically,
   * so nothing is left pointing at a missing customer.
   */
  async remove(id: Types.ObjectId): Promise<{ deleted: true; salesDeleted: number; paymentsDeleted: number }> {
    return this.tx.run(async (session) => {
      if (!(await this.customers.findById(id, session))) throw new NotFoundException('Customer not found');
      const paymentsDeleted = await this.payments.deleteByCustomer(id, session);
      const salesDeleted = await this.sales.deleteByCustomer(id, session);
      await this.customers.deleteById(id, session);
      return { deleted: true as const, salesDeleted, paymentsDeleted };
    });
  }

  /**
   * Every money movement with the customer, oldest first, with a running balance:
   * old dues, then sales (debit; money received with the sale is credited on the
   * same line) and later payments (credit). Same-day sales come before payments.
   */
  async ledger(id: Types.ObjectId): Promise<CustomerLedgerResponse> {
    const customer = await this.customers.findById(id);
    if (!customer) throw new NotFoundException('Customer not found');
    const [sales, payments] = await Promise.all([this.sales.findAllByCustomer(id), this.payments.findByCustomer(id)]);

    const paidWithSale = new Map<string, { paise: number; modes: Set<PaymentMode> }>();
    const later = payments.filter((p) => {
      if (p.source !== PaymentSource.SALE_ENTRY || !p.saleId) return true;
      const key = p.saleId.toString();
      const e = paidWithSale.get(key) ?? { paise: 0, modes: new Set<PaymentMode>() };
      e.paise += rupeesToPaise(p.amount);
      e.modes.add(p.paymentMode);
      paidWithSale.set(key, e);
      return false;
    });

    type Line = Omit<CustomerLedgerEntry, 'balance' | 'debit' | 'credit'> & { at: Date; order: number; debitPaise: number; creditPaise: number };
    const lines: Line[] = [
      ...sales.map((s) => {
        const paid = paidWithSale.get(s._id.toString());
        const how = paid ? [...paid.modes].map((m) => MODE_LABEL[m].toLowerCase()).join(' + ') : '';
        return {
          id: s._id.toString(),
          type: 'SALE' as const,
          date: formatDateOnly(s.saleDate),
          description: paid ? `Sale (received ${how})` : 'Sale',
          weight: s.weight,
          at: s.saleDate,
          order: 0,
          debitPaise: rupeesToPaise(s.totalAmount),
          creditPaise: paid?.paise ?? 0,
        };
      }),
      ...later.map((p) => ({
        id: p._id.toString(),
        type: 'PAYMENT' as const,
        date: formatDateOnly(p.paymentDate),
        description: `Payment, ${MODE_LABEL[p.paymentMode]}${p.transactionReference ? ` (${p.transactionReference})` : ''}`,
        weight: null,
        at: p.paymentDate,
        order: 1,
        debitPaise: 0,
        creditPaise: rupeesToPaise(p.amount),
      })),
    ];
    lines.sort((a, b) => a.at.getTime() - b.at.getTime() || a.order - b.order);

    const openingPaise = customer.outstandingPaise ?? 0;
    let balancePaise = openingPaise;
    let salesPaise = 0;
    let receivedPaise = 0;
    const entries: CustomerLedgerEntry[] = [
      {
        id: 'opening',
        type: 'OPENING',
        date: null,
        description: 'Old dues (before the app)',
        weight: null,
        debit: paiseToRupees(openingPaise),
        credit: 0,
        balance: paiseToRupees(openingPaise),
      },
    ];
    for (const { at: _at, order: _order, debitPaise, creditPaise, ...line } of lines) {
      balancePaise += debitPaise - creditPaise;
      salesPaise += debitPaise;
      receivedPaise += creditPaise;
      entries.push({ ...line, debit: paiseToRupees(debitPaise), credit: paiseToRupees(creditPaise), balance: paiseToRupees(balancePaise) });
    }

    return {
      customerId: customer._id.toString(),
      ownerName: customer.ownerName,
      openingBalance: paiseToRupees(openingPaise),
      totalSales: paiseToRupees(salesPaise),
      totalReceived: paiseToRupees(receivedPaise),
      closingBalance: paiseToRupees(balancePaise),
      entries,
    };
  }

  private async withStats(customer: Customer): Promise<CustomerResponse> {
    const [[stats], [payments]] = await Promise.all([
      this.sales.customerStats([customer._id]),
      this.payments.customerPaymentStats([customer._id]),
    ]);
    return toCustomerResponse(customer, stats, payments);
  }
}
