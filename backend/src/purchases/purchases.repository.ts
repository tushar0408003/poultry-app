import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import type { ClientSession, Model, QueryFilter, Types } from 'mongoose';
import { Purchase } from './purchase.schema';
import type { PurchaseWithSupplier, SupplierPurchaseStats } from './purchases.interfaces';

const SUPPLIER_FIELDS = 'ownerName phone';

@Injectable()
export class PurchasesRepository {
  constructor(@InjectModel(Purchase.name) private readonly model: Model<Purchase>) {}

  async create(data: Omit<Purchase, '_id' | 'createdAt' | 'updatedAt'>, session?: ClientSession): Promise<Purchase> {
    const [doc] = await this.model.create([data], { session });
    return doc.toObject();
  }

  findById(id: Types.ObjectId, session?: ClientSession): Promise<Purchase | null> {
    return this.model.findById(id).session(session ?? null).lean<Purchase>().exec();
  }

  findByIdWithSupplier(id: Types.ObjectId): Promise<PurchaseWithSupplier | null> {
    return this.model.findById(id).populate('supplierId', SUPPLIER_FIELDS).lean<PurchaseWithSupplier>().exec();
  }

  async list(filter: QueryFilter<Purchase>, page: number, limit: number): Promise<[PurchaseWithSupplier[], number]> {
    const [items, total] = await Promise.all([
      this.model
        .find(filter)
        .sort({ purchaseDate: -1, createdAt: -1, _id: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .populate('supplierId', SUPPLIER_FIELDS)
        .lean<PurchaseWithSupplier[]>()
        .exec(),
      this.model.countDocuments(filter).exec(),
    ]);
    return [items, total];
  }

  updateById(id: Types.ObjectId, set: Partial<Purchase>, session?: ClientSession): Promise<Purchase | null> {
    return this.model
      .findByIdAndUpdate(id, { $set: set }, { returnDocument: 'after', runValidators: true, session })
      .lean<Purchase>()
      .exec();
  }

  async deleteById(id: Types.ObjectId, session?: ClientSession): Promise<boolean> {
    const res = await this.model.deleteOne({ _id: id }, { session }).exec();
    return res.deletedCount === 1;
  }

  /** Every purchase of a supplier, oldest first (for the balance sheet). */
  findAllBySupplier(supplierId: Types.ObjectId): Promise<Purchase[]> {
    return this.model.find({ supplierId }).sort({ purchaseDate: 1, createdAt: 1, _id: 1 }).lean<Purchase[]>().exec();
  }

  async deleteBySupplier(supplierId: Types.ObjectId, session?: ClientSession): Promise<number> {
    const res = await this.model.deleteMany({ supplierId }, { session }).exec();
    return res.deletedCount;
  }

  supplierStats(supplierIds: Types.ObjectId[], session?: ClientSession): Promise<SupplierPurchaseStats[]> {
    return this.model
      .aggregate<SupplierPurchaseStats>([
        { $match: { supplierId: { $in: supplierIds } } },
        {
          $group: {
            _id: '$supplierId',
            count: { $sum: 1 },
            weightGrams: { $sum: '$weightGrams' },
            totalPaise: { $sum: '$totalPaise' },
            paidPaise: { $sum: { $add: ['$cashPaidPaise', '$onlinePaidPaise'] } },
          },
        },
      ])
      .session(session ?? null)
      .exec();
  }
}
