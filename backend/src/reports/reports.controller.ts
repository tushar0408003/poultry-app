import { Controller, Get, Query } from '@nestjs/common';
import { CustomRangeQueryDto, DateQueryDto } from './dto/report-query.dto';
import { ReportsService } from './reports.service';

@Controller('reports')
export class ReportsController {
  constructor(private readonly service: ReportsService) {}

  @Get('daily')
  daily(@Query() q: DateQueryDto) {
    return this.service.daily(q.date);
  }

  @Get('weekly')
  weekly(@Query() q: DateQueryDto) {
    return this.service.weekly(q.date);
  }

  @Get('monthly')
  monthly(@Query() q: DateQueryDto) {
    return this.service.monthly(q.date);
  }

  @Get('custom')
  custom(@Query() q: CustomRangeQueryDto) {
    return this.service.custom(q.from, q.to);
  }
}
