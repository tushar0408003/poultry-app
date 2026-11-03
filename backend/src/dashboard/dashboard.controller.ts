import { Controller, Get, Query } from '@nestjs/common';
import { DateQueryDto } from '../reports/dto/report-query.dto';
import { DashboardService } from './dashboard.service';

@Controller('dashboard')
export class DashboardController {
  constructor(private readonly service: DashboardService) {}

  @Get('summary')
  summary(@Query() q: DateQueryDto) {
    return this.service.summary(q.date);
  }
}
