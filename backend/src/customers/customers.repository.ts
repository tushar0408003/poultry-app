import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import type { ClientSession, Model, QueryFilter, Types } from 'mongoose';
import { escapeRegex } from '../common/regex';
import { Customer } from './customer.schema';

/** Indexes from when customers had a shop name; the unique one would block every customer after the first. */
const LEGACY_INDEXES = ['shopNameKey_1', 'shopNameKey_unique_nonempty', 'shopName_1'];

@Injectable()
export class CustomersRepository implements OnModuleInit {
  constructor(@InjectModel(Customer.name) private readonly model: Model<Customer>) {}

  /** One-time cleanup after shop name was removed; a no-op once done. */
  async onModuleInit(): Promise<void> {
    const logger = new Logger(CustomersRepository.name);
    for (const name of LEGACY_INDEXES) {
      if (!(await this.model.collection.indexExists(name).catch(() => false))) continue;
      await this.model.collection.dropIndex(name);
      logger.log(`Dropped legacy index ${name}`);
    }
    // Old customers with only a shop name keep it as their name. Old shop names stay in the DB, unused.
    const res = await this.model.collection.updateMany(
      { $or: [{ ownerName: '' }, { ownerName: { $exists: false } }], shopName: { $gt: '' } },
      [{ $set: { ownerName: '$shopName' } }],
    );
    if (res.modifiedCount) logger.log(`Copied shop name into owner name for ${res.modifiedCount} customer(s)`);
  }

  async create(data: Omit<Customer, '_id' | 'createdAt' | 'updatedAt'>): Promise<Customer> {
    const doc = await this.model.create(data);
    return doc.toObject();
  }

  findById(id: Types.ObjectId, session?: ClientSession): Promise<Customer | null> {
    return this.model.findById(id).session(session ?? null).lean<Customer>().exec();
  }

  findByIds(ids: Types.ObjectId[]): Promise<Customer[]> {
    return this.model.find({ _id: { $in: ids } }).lean<Customer[]>().exec();
  }

  list(search?: string): Promise<Customer[]> {
    return this.model.find(this.searchFilter(search)).sort({ ownerName: 1 }).lean<Customer[]>().exec();
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
    return { $or: [{ ownerName: re }, { phone: re }] };
  }
}
