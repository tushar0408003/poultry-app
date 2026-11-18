import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import type { ClientSession, Model, Types } from 'mongoose';
import { SupplierPayment } from './supplier-payment.schema';

export interface SupplierPaymentTotals {
  _id: Types.ObjectId;
  count: number;
  totalPaise: number;
}

@Injectable()
export class SupplierPaymentsRepository {
  constructor(@InjectModel(SupplierPayment.name) private readonly model: Model<SupplierPayment>) {}

  async create(data: Omit<SupplierPayment, '_id' | 'createdAt' | 'updatedAt'>, session?: ClientSession): Promise<SupplierPayment> {
    const [doc] = await this.model.create([data], { session });
    return doc.toObject();
  }

  findById(id: Types.ObjectId): Promise<SupplierPayment | null> {
    return this.model.findById(id).lean<SupplierPayment>().exec();
  }

  /** Newest first. */
  findBySupplier(supplierId: Types.ObjectId): Promise<SupplierPayment[]> {
    return this.model.find({ supplierId }).sort({ paymentDate: -1, createdAt: -1 }).lean<SupplierPayment[]>().exec();
  }

  async deleteById(id: Types.ObjectId): Promise<boolean> {
    const res = await this.model.deleteOne({ _id: id }).exec();
    return res.deletedCount === 1;
  }

  async deleteBySupplier(supplierId: Types.ObjectId, session?: ClientSession): Promise<number> {
    const res = await this.model.deleteMany({ supplierId }, { session }).exec();
    return res.deletedCount;
  }

  totals(supplierIds: Types.ObjectId[], session?: ClientSession): Promise<SupplierPaymentTotals[]> {
    return this.model
      .aggregate<SupplierPaymentTotals>([
        { $match: { supplierId: { $in: supplierIds } } },
        { $group: { _id: '$supplierId', count: { $sum: 1 }, totalPaise: { $sum: '$amountPaise' } } },
      ])
      .session(session ?? null)
      .exec();
  }
}
