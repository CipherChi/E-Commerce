import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AuthModule } from './auth/auth.module';
import { HealthController } from './health.controller';
import { PrismaModule } from './prisma/prisma.module';
import { PropertiesModule } from './properties/properties.module';
import { RoomsModule } from './rooms/rooms.module';
import { CustomersModule } from './customers/customers.module';
import { BusinessesModule } from './businesses/businesses.module';
import { TenantRecordsModule } from './tenant-records/tenant-records.module';
import { CatalogModule } from './catalog/catalog.module';
import { InventoryModule } from './inventory/inventory.module';
import { SalesModule } from './sales/sales.module';
import { ExpensesModule } from './expenses/expenses.module';
import { DashboardModule } from './dashboard/dashboard.module';
import { ReceiptsModule } from './receipts/receipts.module';
import { BookingsModule } from './bookings/bookings.module';
import { validateEnvironment } from './config/env.validation';
import { ActivityLogsModule } from './activity-logs/activity-logs.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, validate: validateEnvironment }),
    PrismaModule,
    AuthModule,
    PropertiesModule,
    RoomsModule,
    CustomersModule,
    BusinessesModule,
    TenantRecordsModule,
    CatalogModule,
    InventoryModule,
    SalesModule,
    ExpensesModule,
    DashboardModule,
    ReceiptsModule,
    BookingsModule,
    ActivityLogsModule,
  ],
  controllers: [HealthController],
})
export class AppModule {}
