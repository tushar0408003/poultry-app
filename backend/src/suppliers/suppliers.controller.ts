import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { Types } from 'mongoose';
import { ParseObjectIdPipe } from '../common/pipes/parse-object-id.pipe';
import { CreateSupplierPaymentDto } from './dto/supplier-payment.dto';
import { CreateSupplierDto, ListSuppliersQueryDto, UpdateSupplierDto } from './dto/supplier.dto';
import { SuppliersService } from './suppliers.service';

@Controller('suppliers')
export class SuppliersController {
  constructor(private readonly service: SuppliersService) {}

  @Post()
  create(@Body() dto: CreateSupplierDto) {
    return this.service.create(dto);
  }

  @Get()
  list(@Query() query: ListSuppliersQueryDto) {
    return this.service.list(query.search);
  }

  @Get(':id')
  get(@Param('id', ParseObjectIdPipe) id: Types.ObjectId) {
    return this.service.get(id);
  }

  @Patch(':id')
  update(@Param('id', ParseObjectIdPipe) id: Types.ObjectId, @Body() dto: UpdateSupplierDto) {
    return this.service.update(id, dto);
  }

  @Delete(':id')
  remove(@Param('id', ParseObjectIdPipe) id: Types.ObjectId) {
    return this.service.remove(id);
  }

  /** Balance sheet: old dues, purchases and payments with a running balance. */
  @Get(':id/ledger')
  ledger(@Param('id', ParseObjectIdPipe) id: Types.ObjectId) {
    return this.service.ledger(id);
  }

  @Get(':id/payments')
  listPayments(@Param('id', ParseObjectIdPipe) id: Types.ObjectId) {
    return this.service.listPayments(id);
  }

  @Post(':id/payments')
  addPayment(@Param('id', ParseObjectIdPipe) id: Types.ObjectId, @Body() dto: CreateSupplierPaymentDto) {
    return this.service.addPayment(id, dto);
  }

  @Delete(':id/payments/:paymentId')
  removePayment(
    @Param('id', ParseObjectIdPipe) id: Types.ObjectId,
    @Param('paymentId', ParseObjectIdPipe) paymentId: Types.ObjectId,
  ) {
    return this.service.removePayment(id, paymentId);
  }
}
