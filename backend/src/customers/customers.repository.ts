import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import type { ClientSession, Model, QueryFilter, Types } from 'mongoose';
import { escapeRegex } from '../common/regex';
import { Customer } from './customer.schema';

@Injectable()
export class CustomersRepository {
  constructor(@InjectModel(Customer.name) private readonly model: Model<Customer>) {}

  async create(data: Omit<Customer, '_id' | 'createdAt' | 'updatedAt'>): Promise<Customer> {
    const doc = await this.model.create(data);
    return doc.toObject();
  }

  findById(id: Types.ObjectId, session?: ClientSession): Promise<Customer | null> {
    return this.model.findById(id).session(session ?? null).lean<Customer>().exec();
  }

  async existsByShopNameKey(shopNameKey: string, excludeId?: Types.ObjectId): Promise<boolean> {
    const filter: QueryFilter<Customer> = { shopNameKey };
    if (excludeId) filter._id = { $ne: excludeId };
    return (await this.model.exists(filter)) !== null;
  }

  findByIds(ids: Types.ObjectId[]): Promise<Customer[]> {
    return this.model.find({ _id: { $in: ids } }).lean<Customer[]>().exec();
  }

  list(search?: string): Promise<Customer[]> {
    return this.model.find(this.searchFilter(search)).sort({ shopNameKey: 1 }).lean<Customer[]>().exec();
  }

  async findIdsBySearch(search: string): Promise<Types.ObjectId[]> {
    const docs = await this.model.find(this.searchFilter(search), { _id: 1 }).lean<Pick<Customer, '_id'>[]>().exec();
    return docs.map((d) => d._id);
  }

  updateById(id: Types.ObjectId, set: Partial<Customer>): Promise<Customer | null> {
    return this.model
      .findByIdAndUpdate(id, { $set: set }, { returnDocument: 'after', runValidators: true })
      .lean<Customer>()
      .exec();
  }

  async deleteById(id: Types.ObjectId): Promise<boolean> {
    const res = await this.model.deleteOne({ _id: id }).exec();
    return res.deletedCount === 1;
  }

  private searchFilter(search?: string): QueryFilter<Customer> {
    const term = search?.trim();
    if (!term) return {};
    const re = new RegExp(escapeRegex(term), 'i');
    return { $or: [{ shopName: re }, { ownerName: re }, { phone: re }] };
  }
}
