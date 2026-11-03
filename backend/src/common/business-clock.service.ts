import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { formatDateOnly, todayInBusinessTz } from './dates';

/** Answers "what calendar date is it now?" in the business timezone. */
@Injectable()
export class BusinessClock {
  private readonly offsetMinutes: number;

  constructor(config: ConfigService) {
    this.offsetMinutes = Number(config.get('BUSINESS_TZ_OFFSET_MINUTES') ?? 330);
  }

  today(): Date {
    return todayInBusinessTz(this.offsetMinutes);
  }

  todayString(): string {
    return formatDateOnly(this.today());
  }

  isFuture(date: Date): boolean {
    return date.getTime() > this.today().getTime();
  }
}
