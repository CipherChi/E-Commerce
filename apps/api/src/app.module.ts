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

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    PrismaModule,
    AuthModule,
    PropertiesModule,
    RoomsModule,
    CustomersModule,
    BusinessesModule,
    TenantRecordsModule,
  ],
  controllers: [HealthController],
})
export class AppModule {}
