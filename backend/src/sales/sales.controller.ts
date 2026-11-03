import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { Types } from 'mongoose';
import { ParseObjectIdPipe } from '../common/pipes/parse-object-id.pipe';
import { CreateSaleDto, ListSalesQueryDto, UpdateSaleDto } from './dto/sale.dto';
import { SalesService } from './sales.service';

@Controller('sales')
export class SalesController {
  constructor(private readonly service: SalesService) {}

  @Post()
  create(@Body() dto: CreateSaleDto) {
    return this.service.create(dto);
  }

  @Get()
  list(@Query() query: ListSalesQueryDto) {
    return this.service.list(query);
  }

  @Get(':id')
  get(@Param('id', ParseObjectIdPipe) id: Types.ObjectId) {
    return this.service.get(id);
  }

  @Patch(':id')
  update(@Param('id', ParseObjectIdPipe) id: Types.ObjectId, @Body() dto: UpdateSaleDto) {
    return this.service.update(id, dto);
  }

  @Delete(':id')
  remove(@Param('id', ParseObjectIdPipe) id: Types.ObjectId) {
    return this.service.remove(id);
  }
}
