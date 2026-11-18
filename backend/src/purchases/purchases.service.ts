import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { QueryFilter, Types } from 'mongoose';
import { BusinessClock } from '../common/business-clock.service';
import { parseDateOnly } from '../common/dates';
import { formatInr, kgToGrams, rupeesToPaise } from '../common/money';
import { paginated, Paginated } from '../common/pagination.dto';
import { TransactionService } from '../database/transaction.service';
import { SuppliersRepository } from '../suppliers/suppliers.repository';
import { CreatePurchaseDto, ListPurchasesQueryDto, UpdatePurchaseDto } from './dto/purchase.dto';
import { toPurchaseResponse } from './purchase.mapper';
import { Purchase } from './purchase.schema';
import type { PurchaseResponse } from './purchases.interfaces';
import { PurchasesRepository } from './purchases.repository';

/** weight (grams) x rate (paise per kg), rounded to the paisa. */
export const purchaseTotalPaise = (weightGrams: number, ratePaise: number) => Math.round((weightGrams * ratePaise) / 1000);

@Injectable()
export class PurchasesService {
  constructor(
    private readonly purchases: PurchasesRepository,
    private readonly suppliers: SuppliersRepository,
    private readonly tx: TransactionService,
    private readonly clock: BusinessClock,
  ) {}

  /** Creates the purchase at the given rate, or the supplier's current rate. */
  async create(dto: CreatePurchaseDto): Promise<PurchaseResponse> {
    const supplierId = new Types.ObjectId(dto.supplierId);
    const purchaseDate = dto.purchaseDate ? parseDateOnly(dto.purchaseDate) : this.clock.today();
    this.assertNotFuture(purchaseDate);

    const id = await this.tx.run(async (session) => {
      const supplier = await this.suppliers.findById(supplierId, session);
      if (!supplier) throw new NotFoundException('Supplier not found');

      const ratePaise = dto.rate !== undefined ? rupeesToPaise(dto.rate) : supplier.ratePaise;
      if (!ratePaise) throw new BadRequestException(`Set a rate for ${supplier.ownerName} or enter one for this purchase`);
      const weightGrams = kgToGrams(dto.weight);
      const totalPaise = purchaseTotalPaise(weightGrams, ratePaise);
      const cashPaidPaise = rupeesToPaise(dto.cashPaid ?? 0);
      const onlinePaidPaise = rupeesToPaise(dto.onlinePaid ?? 0);
      assertNotOverpaid(cashPaidPaise + onlinePaidPaise, totalPaise);

      const purchase = await this.purchases.create(
        {
          supplierId,
          purchaseDate,
          weightGrams,
          ratePaise,
          totalPaise,
          cashPaidPaise,
          onlinePaidPaise,
          notes: dto.notes ?? '',
        },
        session,
      );
      return purchase._id;
    });
    return this.get(id);
  }

  async get(id: Types.ObjectId): Promise<PurchaseResponse> {
    const purchase = await this.purchases.findByIdWithSupplier(id);
    if (!purchase) throw new NotFoundException('Purchase not found');
    return toPurchaseResponse(purchase);
  }

  async list(query: ListPurchasesQueryDto): Promise<Paginated<PurchaseResponse>> {
    const filter: QueryFilter<Purchase> = {};
    if (query.supplierId) filter.supplierId = new Types.ObjectId(query.supplierId);
    const [items, total] = await this.purchases.list(filter, query.page, query.limit);
    return paginated(items.map(toPurchaseResponse), total, query.page, query.limit);
  }

  async update(id: Types.ObjectId, dto: UpdatePurchaseDto): Promise<PurchaseResponse> {
    await this.tx.run(async (session) => {
      const purchase = await this.purchases.findById(id, session);
      if (!purchase) throw new NotFoundException('Purchase not found');

      const supplierId = dto.supplierId ? new Types.ObjectId(dto.supplierId) : purchase.supplierId;
      if (!supplierId.equals(purchase.supplierId) && !(await this.suppliers.findById(supplierId, session))) {
        throw new NotFoundException('Supplier not found');
      }

      const purchaseDate = dto.purchaseDate ? parseDateOnly(dto.purchaseDate) : purchase.purchaseDate;
      if (purchaseDate.getTime() !== purchase.purchaseDate.getTime()) this.assertNotFuture(purchaseDate);

      const weightGrams = dto.weight !== undefined ? kgToGrams(dto.weight) : purchase.weightGrams;
      const ratePaise = dto.rate !== undefined ? rupeesToPaise(dto.rate) : purchase.ratePaise;
      const totalPaise = purchaseTotalPaise(weightGrams, ratePaise);
      const cashPaidPaise = dto.cashPaid !== undefined ? rupeesToPaise(dto.cashPaid) : purchase.cashPaidPaise;
      const onlinePaidPaise = dto.onlinePaid !== undefined ? rupeesToPaise(dto.onlinePaid) : purchase.onlinePaidPaise;
      assertNotOverpaid(cashPaidPaise + onlinePaidPaise, totalPaise);

      await this.purchases.updateById(
        id,
        {
          supplierId,
          purchaseDate,
          weightGrams,
          ratePaise,
          totalPaise,
          cashPaidPaise,
          onlinePaidPaise,
          ...(dto.notes !== undefined && { notes: dto.notes }),
        },
        session,
      );
    });
    return this.get(id);
  }

  async remove(id: Types.ObjectId): Promise<{ deleted: true }> {
    if (!(await this.purchases.deleteById(id))) throw new NotFoundException('Purchase not found');
    return { deleted: true };
  }

  private assertNotFuture(date: Date): void {
    if (this.clock.isFuture(date)) throw new BadRequestException('Purchase date cannot be in the future');
  }
}

function assertNotOverpaid(paidPaise: number, totalPaise: number): void {
  if (totalPaise < 1) throw new BadRequestException('Purchase amount must be more than ₹0. Check the weight and rate.');
  if (paidPaise > totalPaise) {
    throw new BadRequestException(
      `Amount paid (${formatInr(paidPaise)}) cannot be more than the purchase amount (${formatInr(totalPaise)})`,
    );
  }
}
