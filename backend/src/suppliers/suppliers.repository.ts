import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import type { ClientSession, Model, QueryFilter, Types } from 'mongoose';
import { escapeRegex } from '../common/regex';
import { Supplier } from './supplier.schema';

@Injectable()
export class SuppliersRepository {
  constructor(@InjectModel(Supplier.name) private readonly model: Model<Supplier>) {}

  async create(data: Omit<Supplier, '_id' | 'createdAt' | 'updatedAt'>): Promise<Supplier> {
    const doc = await this.model.create(data);
    return doc.toObject();
  }

  findById(id: Types.ObjectId, session?: ClientSession): Promise<Supplier | null> {
    return this.model.findById(id).session(session ?? null).lean<Supplier>().exec();
  }

  list(search?: string): Promise<Supplier[]> {
    return this.model.find(this.searchFilter(search)).sort({ ownerName: 1 }).lean<Supplier[]>().exec();
  }

  updateById(id: Types.ObjectId, set: Partial<Supplier>): Promise<Supplier | null> {
    return this.model
      .findByIdAndUpdate(id, { $set: set }, { returnDocument: 'after', runValidators: true })
      .lean<Supplier>()
      .exec();
  }

  async deleteById(id: Types.ObjectId, session?: ClientSession): Promise<boolean> {
    const res = await this.model.deleteOne({ _id: id }, { session }).exec();
    return res.deletedCount === 1;
  }

  private searchFilter(search?: string): QueryFilter<Supplier> {
    const term = search?.trim();
    if (!term) return {};
    const re = new RegExp(escapeRegex(term), 'i');
    return { $or: [{ ownerName: re }, { phone: re }] };
  }
}
