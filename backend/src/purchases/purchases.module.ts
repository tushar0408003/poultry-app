import { Module } from '@nestjs/common';
import { PurchasesController } from './purchases.controller';
import { PurchasesService } from './purchases.service';

/** Purchase and supplier repositories come from the global DatabaseModule. */
@Module({
  controllers: [PurchasesController],
  providers: [PurchasesService],
})
export class PurchasesModule {}
