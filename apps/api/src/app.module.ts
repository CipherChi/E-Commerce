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

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      validate: (env: Record<string, string | undefined>) => {
        const missing = ['DATABASE_URL', 'JWT_ACCESS_SECRET', 'JWT_REFRESH_SECRET'].filter(
          (key) => !env[key]?.trim(),
        );
        if (missing.length) {
          throw new Error(`Missing required API environment variables: ${missing.join(', ')}`);
        }
        if (env.JWT_ACCESS_SECRET === env.JWT_REFRESH_SECRET) {
          throw new Error('JWT_ACCESS_SECRET and JWT_REFRESH_SECRET must be different values');
        }
        return env;
      },
    }),
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
  ],
  controllers: [HealthController],
})
export class AppModule {}
