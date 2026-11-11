import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Types } from 'mongoose';
import { formatInr, rupeesToPaise } from '../common/money';
import { PaymentsRepository } from '../payments/payments.repository';
import { SalesRepository } from '../sales/sales.repository';
import { Customer } from './customer.schema';
import { toCustomerResponse } from './customer.mapper';
import { CustomersRepository } from './customers.repository';
import { CreateCustomerDto, UpdateCustomerDto } from './dto/customer.dto';
import type { CustomerResponse } from './customers.interfaces';

@Injectable()
export class CustomersService {
  constructor(
    private readonly customers: CustomersRepository,
    private readonly sales: SalesRepository,
    private readonly payments: PaymentsRepository,
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

  /** Customers with sales history cannot be deleted, so no sale is ever orphaned. */
  async remove(id: Types.ObjectId): Promise<{ deleted: true }> {
    if ((await this.sales.existsForCustomer(id)) || (await this.payments.existsForCustomer(id))) {
      throw new ConflictException('This customer has sales. Delete their sales and payments first, or keep the customer.');
    }
    if (!(await this.customers.deleteById(id))) throw new NotFoundException('Customer not found');
    return { deleted: true };
  }

  private async withStats(customer: Customer): Promise<CustomerResponse> {
    const [[stats], [payments]] = await Promise.all([
      this.sales.customerStats([customer._id]),
      this.payments.customerPaymentStats([customer._id]),
    ]);
    return toCustomerResponse(customer, stats, payments);
  }
}
