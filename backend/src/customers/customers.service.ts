import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Types } from 'mongoose';
import { SalesRepository } from '../sales/sales.repository';
import { normaliseShopName } from './customer.schema';
import { CustomerResponse, toCustomerResponse } from './customer.mapper';
import { CustomersRepository } from './customers.repository';
import { CreateCustomerDto, UpdateCustomerDto } from './dto/customer.dto';

@Injectable()
export class CustomersService {
  constructor(
    private readonly customers: CustomersRepository,
    private readonly sales: SalesRepository,
  ) {}

  async create(dto: CreateCustomerDto): Promise<CustomerResponse> {
    await this.assertUniqueName(dto.shopName);
    const created = await this.customers.create({
      shopName: dto.shopName.replace(/\s+/g, ' '),
      shopNameKey: normaliseShopName(dto.shopName),
      ownerName: dto.ownerName ?? '',
      phone: dto.phone ?? '',
      address: dto.address ?? '',
    });
    return toCustomerResponse(created);
  }

  /** All customers with their lifetime totals and current outstanding balance. */
  async list(search?: string): Promise<CustomerResponse[]> {
    const customers = await this.customers.list(search);
    if (customers.length === 0) return [];
    const stats = await this.sales.customerStats(customers.map((c) => c._id));
    const byId = new Map(stats.map((s) => [s.customerId.toString(), s]));
    return customers.map((c) => toCustomerResponse(c, byId.get(c._id.toString())));
  }

  async get(id: Types.ObjectId): Promise<CustomerResponse> {
    const customer = await this.customers.findById(id);
    if (!customer) throw new NotFoundException('Customer not found');
    const [stats] = await this.sales.customerStats([id]);
    return toCustomerResponse(customer, stats);
  }

  async update(id: Types.ObjectId, dto: UpdateCustomerDto): Promise<CustomerResponse> {
    const set: Record<string, string> = {};
    if (dto.shopName !== undefined) {
      await this.assertUniqueName(dto.shopName, id);
      set.shopName = dto.shopName.replace(/\s+/g, ' ');
      set.shopNameKey = normaliseShopName(dto.shopName);
    }
    if (dto.ownerName !== undefined) set.ownerName = dto.ownerName;
    if (dto.phone !== undefined) set.phone = dto.phone;
    if (dto.address !== undefined) set.address = dto.address;

    const updated = await this.customers.updateById(id, set);
    if (!updated) throw new NotFoundException('Customer not found');
    const [stats] = await this.sales.customerStats([id]);
    return toCustomerResponse(updated, stats);
  }

  /** Customers with sales history cannot be deleted, so no sale is ever orphaned. */
  async remove(id: Types.ObjectId): Promise<{ deleted: true }> {
    if (await this.sales.existsForCustomer(id)) {
      throw new ConflictException('This customer has sales. Delete their sales first, or keep the customer.');
    }
    if (!(await this.customers.deleteById(id))) throw new NotFoundException('Customer not found');
    return { deleted: true };
  }

  /** Friendly check; the unique index on shopNameKey still guards against races. */
  private async assertUniqueName(shopName: string, excludeId?: Types.ObjectId): Promise<void> {
    if (await this.customers.existsByShopNameKey(normaliseShopName(shopName), excludeId)) {
      throw new ConflictException(`A customer named "${shopName.trim()}" already exists`);
    }
  }
}
