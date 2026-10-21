import { BusinessModuleType } from '@prisma/client';


export class CreateCatalogItemDto {
    name!: string;
   module!: BusinessModuleType;
     category?: string;
     costPrice?: string;
     sellingPrice?: string;
     normalRate?: string;
     partyRate?: string;
     monthlyPrice?: string;
     isStockable?: boolean;
      lowStockThreshold?: number;
}
export class UpdateCatalogItemDto {
     name?: string;
    module?: BusinessModuleType;
     category?: string;
     costPrice?: string;
     sellingPrice?: string;
     normalRate?: string;
     partyRate?: string;
     monthlyPrice?: string;
     isStockable?: boolean;
      lowStockThreshold?: number;
}
