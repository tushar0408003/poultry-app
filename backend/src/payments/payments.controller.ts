import { Body, Controller, Delete, Get, Param, Post, Query } from '@nestjs/common';
import { Types } from 'mongoose';
import { PaginationQueryDto } from '../common/pagination.dto';
import { ParseObjectIdPipe } from '../common/pipes/parse-object-id.pipe';
import { AllocatePaymentDto, CreatePaymentDto, ListPaymentsQueryDto } from './dto/payment.dto';
import { PaymentsService } from './payments.service';

@Controller('payments')
export class PaymentsController {
  constructor(private readonly service: PaymentsService) {}

  @Post()
  create(@Body() dto: CreatePaymentDto) {
    return this.service.create(dto);
  }

  @Post('allocate')
  allocate(@Body() dto: AllocatePaymentDto) {
    return this.service.allocate(dto);
  }

  @Get()
  list(@Query() query: ListPaymentsQueryDto) {
    return this.service.list(query);
  }

  // Declared before ':saleId' so "customer" is not parsed as a sale id.
  @Get('customer/:customerId')
  listByCustomer(
    @Param('customerId', ParseObjectIdPipe) customerId: Types.ObjectId,
    @Query() page: PaginationQueryDto,
  ) {
    return this.service.listByCustomer(customerId, page);
  }

  @Get(':saleId')
  listBySale(@Param('saleId', ParseObjectIdPipe) saleId: Types.ObjectId) {
    return this.service.listBySale(saleId);
  }

  @Delete(':id')
  remove(@Param('id', ParseObjectIdPipe) id: Types.ObjectId) {
    return this.service.remove(id);
  }
}
