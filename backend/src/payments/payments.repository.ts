import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import type { ClientSession, Model, QueryFilter, Types } from 'mongoose';
import type { DateRange } from '../common/dates';
import type { CustomerRef } from '../sales/sales.repository';
import { Payment, PaymentMode, PaymentSource } from './payment.schema';

export type PaymentWithCustomer = Omit<Payment, 'customerId'> & { customerId: CustomerRef | null };

export interface CollectionTotals {
  count: number;
  cashPaise: number;
  onlinePaise: number;
}

export interface CollectionBucket {
  _id: string;
  cashPaise: number;
  onlinePaise: number;
}

const byMode = (mode: PaymentMode) => ({ $sum: { $cond: [{ $eq: ['$paymentMode', mode] }, '$amountPaise', 0] } });

@Injectable()
export class PaymentsRepository {
  constructor(@InjectModel(Payment.name) private readonly model: Model<Payment>) {}

  async insertMany(docs: Omit<Payment, '_id' | 'createdAt'>[], session?: ClientSession): Promise<Payment[]> {
    if (docs.length === 0) return [];
    // `ordered` keeps insertion deterministic; validation runs per document.
    const created = await this.model.insertMany(docs, { session, ordered: true });
    return created.map((d) => d.toObject() as Payment);
  }

  findById(id: Types.ObjectId, session?: ClientSession): Promise<Payment | null> {
    return this.model.findById(id).session(session ?? null).lean<Payment>().exec();
  }

  findBySale(saleId: Types.ObjectId, session?: ClientSession): Promise<Payment[]> {
    return this.model
      .find({ saleId })
      .sort({ paymentDate: 1, createdAt: 1, _id: 1 })
      .session(session ?? null)
      .lean<Payment[]>()
      .exec();
  }

  async list(filter: QueryFilter<Payment>, page: number, limit: number): Promise<[PaymentWithCustomer[], number]> {
    const [items, total] = await Promise.all([
      this.model
        .find(filter)
        .sort({ paymentDate: -1, createdAt: -1, _id: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .populate('customerId', 'shopName ownerName phone')
        .lean<PaymentWithCustomer[]>()
        .exec(),
      this.model.countDocuments(filter).exec(),
    ]);
    return [items, total];
  }

  /** Recomputes cash/online totals of a sale from its payment records. */
  async totalsForSale(saleId: Types.ObjectId, session?: ClientSession): Promise<{ cashPaise: number; onlinePaise: number }> {
    const [row] = await this.model
      .aggregate<{ cashPaise: number; onlinePaise: number }>([
        { $match: { saleId } },
        { $group: { _id: null, cashPaise: byMode(PaymentMode.CASH), onlinePaise: byMode(PaymentMode.ONLINE) } },
      ])
      .session(session ?? null)
      .exec();
    return { cashPaise: row?.cashPaise ?? 0, onlinePaise: row?.onlinePaise ?? 0 };
  }

  async deleteById(id: Types.ObjectId, session?: ClientSession): Promise<void> {
    await this.model.deleteOne({ _id: id }, { session }).exec();
  }

  async deleteBySale(saleId: Types.ObjectId, session?: ClientSession): Promise<number> {
    const res = await this.model.deleteMany({ saleId }, { session }).exec();
    return res.deletedCount;
  }

  async deleteSaleEntryPayments(saleId: Types.ObjectId, mode: PaymentMode, session?: ClientSession): Promise<void> {
    await this.model.deleteMany({ saleId, source: PaymentSource.SALE_ENTRY, paymentMode: mode }, { session }).exec();
  }

  async reassignCustomer(saleId: Types.ObjectId, customerId: Types.ObjectId, session?: ClientSession): Promise<void> {
    await this.model.updateMany({ saleId }, { $set: { customerId } }, { session }).exec();
  }

  async moveSaleEntryDate(saleId: Types.ObjectId, paymentDate: Date, session?: ClientSession): Promise<void> {
    await this.model
      .updateMany({ saleId, source: PaymentSource.SALE_ENTRY }, { $set: { paymentDate } }, { session })
      .exec();
  }

  /** Money collected in the range, by payment date (not sale date). */
  async totalsForRange(range: DateRange): Promise<CollectionTotals> {
    const [row] = await this.model
      .aggregate<CollectionTotals>([
        { $match: { paymentDate: { $gte: range.from, $lt: range.toExclusive } } },
        {
          $group: {
            _id: null,
            count: { $sum: 1 },
            cashPaise: byMode(PaymentMode.CASH),
            onlinePaise: byMode(PaymentMode.ONLINE),
          },
        },
        { $project: { _id: 0 } },
      ])
      .exec();
    return row ?? { count: 0, cashPaise: 0, onlinePaise: 0 };
  }

  series(range: DateRange, format: '%Y-%m-%d' | '%Y-%m'): Promise<CollectionBucket[]> {
    return this.model
      .aggregate<CollectionBucket>([
        { $match: { paymentDate: { $gte: range.from, $lt: range.toExclusive } } },
        {
          $group: {
            _id: { $dateToString: { date: '$paymentDate', format, timezone: 'UTC' } },
            cashPaise: byMode(PaymentMode.CASH),
            onlinePaise: byMode(PaymentMode.ONLINE),
          },
        },
      ])
      .exec();
  }

  recent(onOrBefore: Date, limit: number): Promise<PaymentWithCustomer[]> {
    return this.model
      .find({ paymentDate: { $lte: onOrBefore } })
      .sort({ paymentDate: -1, createdAt: -1, _id: -1 })
      .limit(limit)
      .populate('customerId', 'shopName ownerName phone')
      .lean<PaymentWithCustomer[]>()
      .exec();
  }
}
