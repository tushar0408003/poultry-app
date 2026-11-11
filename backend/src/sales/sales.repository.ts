import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import type { ClientSession, Model, PipelineStage, QueryFilter, Types } from 'mongoose';
import type { DateRange } from '../common/dates';
import { Sale } from './sale.schema';
import type { CustomerSalesStats, SaleWithCustomer, SalesTotals, SeriesBucket } from './sales.interfaces';

const CUSTOMER_FIELDS = 'ownerName phone';
const EMPTY_TOTALS: SalesTotals = { count: 0, weight: 0, totalAmount: 0, totalPaid: 0, remaining: 0 };

const totalsGroup = {
  count: { $sum: 1 },
  weight: { $sum: '$weightGrams' },
  totalAmount: { $sum: '$totalAmountPaise' },
  totalPaid: { $sum: '$totalPaid' },
  remaining: { $sum: '$remaining' },
};

@Injectable()
export class SalesRepository {
  constructor(@InjectModel(Sale.name) private readonly model: Model<Sale>) {}

  async create(data: Omit<Sale, '_id' | 'createdAt' | 'updatedAt'>, session?: ClientSession): Promise<Sale> {
    const [doc] = await this.model.create([data], { session });
    return doc.toObject();
  }

  findById(id: Types.ObjectId, session?: ClientSession): Promise<Sale | null> {
    return this.model.findById(id).session(session ?? null).lean<Sale>().exec();
  }

  findByIdWithCustomer(id: Types.ObjectId, session?: ClientSession): Promise<SaleWithCustomer | null> {
    return this.model
      .findById(id)
      .session(session ?? null)
      .populate('customerId', CUSTOMER_FIELDS)
      .lean<SaleWithCustomer>()
      .exec();
  }

  async list(filter: QueryFilter<Sale>, page: number, limit: number): Promise<[SaleWithCustomer[], number]> {
    const [items, total] = await Promise.all([
      this.model
        .find(filter)
        .sort({ saleDate: -1, createdAt: -1, _id: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .populate('customerId', CUSTOMER_FIELDS)
        .lean<SaleWithCustomer[]>()
        .exec(),
      this.model.countDocuments(filter).exec(),
    ]);
    return [items, total];
  }

  /** Outstanding sales of a customer, oldest first (for FIFO payment allocation). */
  findOutstandingForCustomer(customerId: Types.ObjectId, session?: ClientSession): Promise<Sale[]> {
    return this.model
      .find({ customerId, remaining: { $gt: 0 } })
      .sort({ saleDate: 1, createdAt: 1, _id: 1 })
      .session(session ?? null)
      .lean<Sale[]>()
      .exec();
  }

  async updateById(id: Types.ObjectId, set: Partial<Sale>, session?: ClientSession): Promise<void> {
    await this.model.updateOne({ _id: id }, { $set: set }, { session, runValidators: true }).exec();
  }

  async deleteById(id: Types.ObjectId, session?: ClientSession): Promise<void> {
    await this.model.deleteOne({ _id: id }, { session }).exec();
  }

  async existsForCustomer(customerId: Types.ObjectId): Promise<boolean> {
    return (await this.model.exists({ customerId })) !== null;
  }

  /** Lifetime purchase/payment totals per customer. */
  customerStats(customerIds?: Types.ObjectId[]): Promise<CustomerSalesStats[]> {
    const pipeline: PipelineStage[] = [];
    if (customerIds) pipeline.push({ $match: { customerId: { $in: customerIds } } });
    pipeline.push(
      {
        $group: {
          _id: '$customerId',
          ...totalsGroup,
          cashPaidPaise: { $sum: '$cashPaid' },
          onlinePaidPaise: { $sum: '$onlinePaid' },
          lastSaleDate: { $max: '$saleDate' },
        },
      },
      { $addFields: { customerId: '$_id' } },
      { $project: { _id: 0 } },
    );
    return this.model.aggregate<CustomerSalesStats>(pipeline).exec();
  }

  /** Totals of sales whose saleDate falls in the range. */
  async totalsForRange(range: DateRange): Promise<SalesTotals> {
    const [row] = await this.model
      .aggregate<SalesTotals>([
        { $match: { saleDate: { $gte: range.from, $lt: range.toExclusive } } },
        { $group: { _id: null, ...totalsGroup } },
        { $project: { _id: 0 } },
      ])
      .exec();
    return row ?? EMPTY_TOTALS;
  }

  /** Current unpaid amount across ALL sales, regardless of date. */
  async currentOutstanding(): Promise<{ remainingPaise: number; customers: number; sales: number }> {
    const [row] = await this.model
      .aggregate<{ remainingPaise: number; customers: number; sales: number }>([
        { $match: { remaining: { $gt: 0 } } },
        { $group: { _id: null, remainingPaise: { $sum: '$remaining' }, sales: { $sum: 1 }, c: { $addToSet: '$customerId' } } },
        { $project: { _id: 0, remainingPaise: 1, sales: 1, customers: { $size: '$c' } } },
      ])
      .exec();
    return row ?? { remainingPaise: 0, customers: 0, sales: 0 };
  }

  /** Per-day ("%Y-%m-%d") or per-month ("%Y-%m") sales buckets. */
  series(range: DateRange, format: '%Y-%m-%d' | '%Y-%m'): Promise<SeriesBucket[]> {
    return this.model
      .aggregate<SeriesBucket>([
        { $match: { saleDate: { $gte: range.from, $lt: range.toExclusive } } },
        {
          $group: {
            _id: { $dateToString: { date: '$saleDate', format, timezone: 'UTC' } },
            weightGrams: { $sum: '$weightGrams' },
            totalAmountPaise: { $sum: '$totalAmountPaise' },
          },
        },
      ])
      .exec();
  }

  recent(onOrBefore: Date, limit: number): Promise<SaleWithCustomer[]> {
    return this.model
      .find({ saleDate: { $lte: onOrBefore } })
      .sort({ saleDate: -1, createdAt: -1, _id: -1 })
      .limit(limit)
      .populate('customerId', CUSTOMER_FIELDS)
      .lean<SaleWithCustomer[]>()
      .exec();
  }
}
