import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import type { AnyBulkWriteOperation, ClientSession, Model, Types } from 'mongoose';
import { EMPTY_STOCK, replay, TYPE_ORDER } from './costing';
import { InventoryTransaction } from './inventory-transaction.schema';
import type { MovementData, MovementInput, StockState } from './inventory.interfaces';

const ORDER = { date: 1, typeOrder: 1, createdAt: 1, _id: 1 } as const;

/**
 * Owns the inventoryTransactions collection. Every create/update/delete
 * re-runs the weighted-average replay from the earliest affected date, so
 * back-dated edits correct all later costs. Always call inside the caller's
 * transaction (TransactionService.run) so the record and its stock movement
 * commit together.
 */
@Injectable()
export class InventoryLedger {
  constructor(@InjectModel(InventoryTransaction.name) private readonly model: Model<InventoryTransaction>) {}

  async create(data: MovementData, session?: ClientSession): Promise<InventoryTransaction> {
    const [doc] = await this.model.create(
      [
        {
          type: data.type,
          typeOrder: TYPE_ORDER[data.type],
          date: data.date,
          sourceId: data.sourceId ?? null,
          quantityGrams: data.quantityGrams ?? 0,
          amountPaise: data.amountPaise ?? 0,
          countedGrams: data.countedGrams ?? null,
          reason: data.reason ?? '',
        },
      ],
      { session },
    );
    await this.replayFrom(data.date, session);
    return (await this.findById(doc._id, session))!;
  }

  /** Updates the inputs of a movement (found by id) and replays from the earlier of old/new date. */
  async update(
    id: Types.ObjectId,
    set: Partial<Omit<MovementData, 'type' | 'sourceId'>>,
    session?: ClientSession,
  ): Promise<InventoryTransaction> {
    const existing = await this.findById(id, session);
    if (!existing) throw new NotFoundException('Stock entry not found');
    await this.model.updateOne({ _id: id }, { $set: set }, { session, runValidators: true }).exec();
    const from = set.date && set.date < existing.date ? set.date : existing.date;
    await this.replayFrom(from, session);
    return (await this.findById(id, session))!;
  }

  async updateBySource(
    sourceId: Types.ObjectId,
    set: Partial<Omit<MovementData, 'type' | 'sourceId'>>,
    session?: ClientSession,
  ): Promise<InventoryTransaction> {
    const existing = await this.findBySource(sourceId, session);
    if (!existing) throw new NotFoundException('Stock movement not found');
    return this.update(existing._id, set, session);
  }

  async remove(id: Types.ObjectId, session?: ClientSession): Promise<void> {
    const existing = await this.findById(id, session);
    if (!existing) throw new NotFoundException('Stock entry not found');
    await this.model.deleteOne({ _id: id }, { session }).exec();
    await this.replayFrom(existing.date, session);
  }

  async removeBySource(sourceId: Types.ObjectId, session?: ClientSession): Promise<void> {
    const existing = await this.findBySource(sourceId, session);
    if (existing) await this.remove(existing._id, session);
  }

  findById(id: Types.ObjectId, session?: ClientSession): Promise<InventoryTransaction | null> {
    return this.model.findById(id).session(session ?? null).lean<InventoryTransaction>().exec();
  }

  findBySource(sourceId: Types.ObjectId, session?: ClientSession): Promise<InventoryTransaction | null> {
    return this.model.findOne({ sourceId }).session(session ?? null).lean<InventoryTransaction>().exec();
  }

  findBySources(sourceIds: Types.ObjectId[]): Promise<InventoryTransaction[]> {
    return this.model.find({ sourceId: { $in: sourceIds } }).lean<InventoryTransaction[]>().exec();
  }

  /** Stock at the END of `date` (after every movement dated on or before it). */
  async stockAsOf(date: Date, session?: ClientSession): Promise<StockState> {
    const last = await this.model
      .findOne({ date: { $lte: date } })
      .sort({ date: -1, typeOrder: -1, createdAt: -1, _id: -1 })
      .session(session ?? null)
      .lean<InventoryTransaction>()
      .exec();
    return last ? stateOf(last) : EMPTY_STOCK;
  }

  /**
   * Recomputes the derived columns of every movement dated on/after `from`,
   * starting from the stock at the end of the previous day. Only rows whose
   * values actually change are written.
   */
  async replayFrom(from: Date, session?: ClientSession): Promise<number> {
    const before = await this.model
      .findOne({ date: { $lt: from } })
      .sort({ date: -1, typeOrder: -1, createdAt: -1, _id: -1 })
      .session(session ?? null)
      .lean<InventoryTransaction>()
      .exec();
    const rows = await this.model
      .find({ date: { $gte: from } })
      .sort(ORDER)
      .session(session ?? null)
      .lean<InventoryTransaction[]>()
      .exec();
    if (rows.length === 0) return 0;

    const results = replay(before ? stateOf(before) : EMPTY_STOCK, rows.map(toInput));
    const ops: AnyBulkWriteOperation<InventoryTransaction>[] = [];
    rows.forEach((row, i) => {
      const r = results[i];
      if (
        row.deltaGrams !== r.deltaGrams ||
        row.valuePaise !== r.valuePaise ||
        row.balanceGrams !== r.balanceGrams ||
        row.balanceValuePaise !== r.balanceValuePaise ||
        row.avgRatePaisePerKg !== r.avgRatePaisePerKg
      ) {
        ops.push({ updateOne: { filter: { _id: row._id }, update: { $set: r } } });
      }
    });
    if (ops.length > 0) await this.model.bulkWrite(ops, { session, ordered: true });
    return ops.length;
  }

  /** Full rebuild from the first movement (maintenance / safety net). */
  async rebuild(session?: ClientSession): Promise<number> {
    const first = await this.model.findOne().sort(ORDER).session(session ?? null).lean<InventoryTransaction>().exec();
    return first ? this.replayFrom(first.date, session) : 0;
  }
}

function stateOf(row: InventoryTransaction): StockState {
  return {
    balanceGrams: row.balanceGrams,
    balanceValuePaise: row.balanceValuePaise,
    avgRatePaisePerKg: row.avgRatePaisePerKg,
  };
}

function toInput(row: InventoryTransaction): MovementInput {
  return {
    type: row.type,
    quantityGrams: row.quantityGrams,
    amountPaise: row.amountPaise,
    countedGrams: row.countedGrams ?? undefined,
  };
}
