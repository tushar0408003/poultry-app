import { Global, Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { AuditLog, AuditLogSchema } from '../audit/audit-log.schema';
import { AuditService } from '../audit/audit.service';
import { BusinessClock } from '../common/business-clock.service';
import { Customer, CustomerSchema } from '../customers/customer.schema';
import { CustomersRepository } from '../customers/customers.repository';
import { InventoryLedger } from '../inventory/inventory-ledger.service';
import { InventoryTransaction, InventoryTransactionSchema } from '../inventory/inventory-transaction.schema';
import { Payment, PaymentSchema } from '../payments/payment.schema';
import { PaymentsRepository } from '../payments/payments.repository';
import { Sale, SaleSchema } from '../sales/sale.schema';
import { SalesRepository } from '../sales/sales.repository';
import { SaleLedger } from '../sales/sale-ledger.service';
import { TransactionService } from './transaction.service';

/**
 * Registers the shared collections (ledger, inventory, audit) and their services once, so that the
 * sales, payments, customers and reports modules can share them without
 * circular module imports (a sale creates payments; a payment updates a sale).
 */
@Global()
@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Customer.name, schema: CustomerSchema },
      { name: Sale.name, schema: SaleSchema },
      { name: Payment.name, schema: PaymentSchema },
      { name: InventoryTransaction.name, schema: InventoryTransactionSchema },
      { name: AuditLog.name, schema: AuditLogSchema },
    ]),
  ],
  providers: [
    CustomersRepository,
    SalesRepository,
    PaymentsRepository,
    SaleLedger,
    InventoryLedger,
    AuditService,
    TransactionService,
    BusinessClock,
  ],
  exports: [
    CustomersRepository,
    SalesRepository,
    PaymentsRepository,
    SaleLedger,
    InventoryLedger,
    AuditService,
    TransactionService,
    BusinessClock,
  ],
})
export class DatabaseModule {}
