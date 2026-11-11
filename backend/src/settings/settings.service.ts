import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import type { ClientSession, Model } from 'mongoose';
import { AuditAction } from '../audit/audit-log.schema';
import { AuditService } from '../audit/audit.service';
import { paiseToRupees, rupeesToPaise } from '../common/money';
import { TransactionService } from '../database/transaction.service';
import { UpdateSettingsDto } from './dto/settings.dto';
import { Settings, SETTINGS_KEY } from './settings.schema';
import type { SettingsResponse } from './settings.interfaces';

@Injectable()
export class SettingsService {
  constructor(
    @InjectModel(Settings.name) private readonly model: Model<Settings>,
    private readonly tx: TransactionService,
    private readonly audit: AuditService,
  ) {}

  async get(): Promise<SettingsResponse> {
    return toResponse(await this.ensure());
  }

  async update(dto: UpdateSettingsDto): Promise<SettingsResponse> {
    const set: Partial<Settings> = {};
    if (dto.businessName !== undefined) set.businessName = dto.businessName;
    if (dto.defaultPurchaseRate !== undefined) set.defaultPurchaseRatePaise = rupeesToPaise(dto.defaultPurchaseRate);
    if (dto.defaultSaleRate !== undefined) set.defaultSaleRatePaise = rupeesToPaise(dto.defaultSaleRate);

    const updated = await this.tx.run(async (session) => {
      const before = await this.ensure(session);
      const after = await this.model
        .findOneAndUpdate({ key: SETTINGS_KEY }, { $set: set }, { returnDocument: 'after', runValidators: true, session })
        .lean<Settings>()
        .exec();
      await this.audit.record({ entity: 'settings', entityId: before._id, action: AuditAction.UPDATE, before, after }, session);
      return after!;
    });
    return toResponse(updated);
  }

  /** Returns the settings document, creating it with defaults on first use. */
  private async ensure(session?: ClientSession): Promise<Settings> {
    const doc = await this.model
      .findOneAndUpdate(
        { key: SETTINGS_KEY },
        { $setOnInsert: { key: SETTINGS_KEY } },
        { upsert: true, returnDocument: 'after', setDefaultsOnInsert: true, session },
      )
      .lean<Settings>()
      .exec();
    return doc!;
  }
}

function toResponse(s: Settings): SettingsResponse {
  return {
    businessName: s.businessName,
    defaultPurchaseRate: paiseToRupees(s.defaultPurchaseRatePaise),
    defaultSaleRate: paiseToRupees(s.defaultSaleRatePaise),
    updatedAt: s.updatedAt ?? null,
  };
}
