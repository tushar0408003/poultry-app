import { Global, Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { BusinessClock } from '../common/business-clock.service';
import { Customer, CustomerSchema } from '../customers/customer.schema';
import { CustomersRepository } from '../customers/customers.repository';
import { Payment, PaymentSchema } from '../payments/payment.schema';
import { PaymentsRepository } from '../payments/payments.repository';
import { Purchase, PurchaseSchema } from '../purchases/purchase.schema';
import { PurchasesRepository } from '../purchases/purchases.repository';
import { Sale, SaleSchema } from '../sales/sale.schema';
import { SalesRepository } from '../sales/sales.repository';
import { SaleLedger } from '../sales/sale-ledger.service';
import { SupplierPayment, SupplierPaymentSchema } from '../suppliers/supplier-payment.schema';
import { SupplierPaymentsRepository } from '../suppliers/supplier-payments.repository';
import { Supplier, SupplierSchema } from '../suppliers/supplier.schema';
import { SuppliersRepository } from '../suppliers/suppliers.repository';
import { TransactionService } from './transaction.service';

/**
 * Registers the business collections and their repositories once, so that the
 * sales, payments, customers, suppliers, purchases and reports modules can share them without
 * circular module imports (a sale creates payments; a payment updates a sale; a supplier's
 * totals come from purchases and a purchase needs its supplier).
 *
 * Collections: customers, sales, payments, suppliers, purchases, supplierPayments
 * (+ users, registered by AuthModule). Nothing else.
 */
@Global()
@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Customer.name, schema: CustomerSchema },
      { name: Sale.name, schema: SaleSchema },
      { name: Payment.name, schema: PaymentSchema },
      { name: Supplier.name, schema: SupplierSchema },
      { name: Purchase.name, schema: PurchaseSchema },
      { name: SupplierPayment.name, schema: SupplierPaymentSchema },
    ]),
  ],
  providers: [
    CustomersRepository,
    SalesRepository,
    PaymentsRepository,
    SuppliersRepository,
    PurchasesRepository,
    SupplierPaymentsRepository,
    SaleLedger,
    TransactionService,
    BusinessClock,
  ],
  exports: [
    CustomersRepository,
    SalesRepository,
    PaymentsRepository,
    SuppliersRepository,
    PurchasesRepository,
    SupplierPaymentsRepository,
    SaleLedger,
    TransactionService,
    BusinessClock,
  ],
})
export class DatabaseModule {}
