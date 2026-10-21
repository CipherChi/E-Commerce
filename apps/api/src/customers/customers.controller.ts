

import { Request } from 'express';




import { CreateCustomerDto } from './dto/create-customer.dto';
import { UpdateCustomerDto } from './dto/update-customer.dto';
import { ListCustomersDto } from './dto/list-customers.dto';
import { CustomersService } from './customers.service';





export class CustomersController {
  constructor(private readonly customers: CustomersService) {}


  list( req: Request & { user: { businessId: string } },  query: ListCustomersDto) {
    return this.customers.list(req.user.businessId, query);
  }

  get( req: Request & { user: { businessId: string } },  id: string) {
    return this.customers.get(req.user.businessId, id);
  }

  create( req: Request & { user: { businessId: string } },  dto: CreateCustomerDto) {
    return this.customers.create(req.user.businessId, dto);
  }

  update(
     req: Request & { user: { businessId: string } },
     id: string,
     dto: UpdateCustomerDto,
  ) {
    return this.customers.update(req.user.businessId, id, dto);
  }

  remove( req: Request & { user: { businessId: string } },  id: string) {
    return this.customers.remove(req.user.businessId, id);
  }
}
