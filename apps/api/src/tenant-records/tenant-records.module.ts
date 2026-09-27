import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { TenantRecordsController } from './tenant-records.controller';
import { TenantRecordsService } from './tenant-records.service';

@Module({
  imports: [AuthModule],
  controllers: [TenantRecordsController],
  providers: [TenantRecordsService],
})
export class TenantRecordsModule {}
