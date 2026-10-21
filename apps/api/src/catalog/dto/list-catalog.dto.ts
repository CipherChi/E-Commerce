import { BusinessModuleType } from '@prisma/client';



export class ListCatalogDto {
    module?: BusinessModuleType;
     category?: string;
    is_stockable?: string;
    is_archived?: string;
     q?: string;
      page = 1;
       pageSize = 25;
}
