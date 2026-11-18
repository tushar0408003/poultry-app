import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { Types } from 'mongoose';
import { ParseObjectIdPipe } from '../common/pipes/parse-object-id.pipe';
import { CreatePurchaseDto, ListPurchasesQueryDto, UpdatePurchaseDto } from './dto/purchase.dto';
import { PurchasesService } from './purchases.service';

@Controller('purchases')
export class PurchasesController {
  constructor(private readonly service: PurchasesService) {}

  @Post()
  create(@Body() dto: CreatePurchaseDto) {
    return this.service.create(dto);
  }

  @Get()
  list(@Query() query: ListPurchasesQueryDto) {
    return this.service.list(query);
  }

  @Get(':id')
  get(@Param('id', ParseObjectIdPipe) id: Types.ObjectId) {
    return this.service.get(id);
  }

  @Patch(':id')
  update(@Param('id', ParseObjectIdPipe) id: Types.ObjectId, @Body() dto: UpdatePurchaseDto) {
    return this.service.update(id, dto);
  }

  @Delete(':id')
  remove(@Param('id', ParseObjectIdPipe) id: Types.ObjectId) {
    return this.service.remove(id);
  }
}
