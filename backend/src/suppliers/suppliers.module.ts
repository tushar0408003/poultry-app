import { Module } from '@nestjs/common';
import { SuppliersController } from './suppliers.controller';
import { SuppliersService } from './suppliers.service';

/** Supplier and purchase repositories come from the global DatabaseModule. */
@Module({
  controllers: [SuppliersController],
  providers: [SuppliersService],
})
export class SuppliersModule {}
