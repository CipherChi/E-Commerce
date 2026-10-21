import { JwtService } from '@nestjs/jwt';
import { PrismaClient } from '@prisma/client';
import { ActivityLogsController } from '../activity-logs/activity-logs.controller';
import { AuthService } from '../auth/auth.service';
import { BookingsController } from '../bookings/bookings.controller';
import { BookingsService } from '../bookings/bookings.service';
import { BusinessesController } from '../businesses/businesses.controller';
import { BusinessesService } from '../businesses/businesses.service';
import { CatalogController } from '../catalog/catalog.controller';
import { CatalogService } from '../catalog/catalog.service';
import { CustomersController } from '../customers/customers.controller';
import { CustomersService } from '../customers/customers.service';
import { DashboardController } from '../dashboard/dashboard.controller';
import { DashboardService } from '../dashboard/dashboard.service';
import { ExpensesController } from '../expenses/expenses.controller';
import { ExpensesService } from '../expenses/expenses.service';
import { InventoryController } from '../inventory/inventory.controller';
import { InventoryService } from '../inventory/inventory.service';
import { PaymentsController } from '../payments/payments.controller';
import { PaymentsService } from '../payments/payments.service';
import { PropertiesController } from '../properties/properties.controller';
import { PropertiesService } from '../properties/properties.service';
import { ReceiptsController } from '../receipts/receipts.controller';
import { ReceiptsService } from '../receipts/receipts.service';
import { RoomsController } from '../rooms/rooms.controller';
import { RoomsService } from '../rooms/rooms.service';
import { SalesController } from '../sales/sales.controller';
import { SalesService } from '../sales/sales.service';
import { TenantRecordsController } from '../tenant-records/tenant-records.controller';
import { TenantRecordsService } from '../tenant-records/tenant-records.service';

export function createContainer(env: NodeJS.ProcessEnv) {
  const prisma = new PrismaClient();
  const jwt = new JwtService();
  const config = { getOrThrow: (key: string) => env[key] } as never;
  const auth = new AuthService(prisma as never, jwt, config);
  const catalog = new CatalogService(prisma as never);
  const services = {
    properties: new PropertiesService(prisma as never),
    rooms: new RoomsService(prisma as never),
    customers: new CustomersService(prisma as never),
    businesses: new BusinessesService(prisma as never),
    tenantRecords: new TenantRecordsService(prisma as never),
    catalog,
    inventory: new InventoryService(prisma as never, catalog),
    sales: new SalesService(prisma as never),
    expenses: new ExpensesService(prisma as never),
    dashboard: new DashboardService(prisma as never),
    receipts: new ReceiptsService(prisma as never),
    bookings: new BookingsService(prisma as never),
    payments: new PaymentsService(prisma as never),
  };
  const controllers = {
    properties: new PropertiesController(services.properties),
    rooms: new RoomsController(services.rooms),
    customers: new CustomersController(services.customers),
    businesses: new BusinessesController(services.businesses),
    tenantRecords: new TenantRecordsController(services.tenantRecords),
    catalog: new CatalogController(services.catalog),
    inventory: new InventoryController(services.inventory),
    sales: new SalesController(services.sales),
    expenses: new ExpensesController(services.expenses),
    dashboard: new DashboardController(services.dashboard),
    receipts: new ReceiptsController(services.receipts),
    bookings: new BookingsController(services.bookings),
    payments: new PaymentsController(services.payments),
    activity: new ActivityLogsController(prisma as never),
  };
  return { prisma, jwt, auth, controllers };
}

export type ApiContainer = ReturnType<typeof createContainer>;
