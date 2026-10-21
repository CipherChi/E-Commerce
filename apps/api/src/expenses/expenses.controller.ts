
 import { Request } from 'express';
    import { ExpensesService } from './expenses.service'; import { CategoryDto, ExpenseDto } from './dto/expense.dto';
type ReqUser=Request&{user:{businessId:string;sub:string}};

export class ExpensesController { constructor(private s:ExpensesService){}
  categories(r:ReqUser){return this.s.categories(r.user.businessId)}
  createCat(r:ReqUser,d:CategoryDto){return this.s.createCategory(r.user.businessId,d)}
  updateCat(r:ReqUser,id:string,d:CategoryDto){return this.s.updateCategory(r.user.businessId,id,d)}
  archiveCat(r:ReqUser,id:string){return this.s.archiveCategory(r.user.businessId,id)}
  summary(r:ReqUser,from?:string,to?:string){return this.s.summary(r.user.businessId,from,to)}
  list(r:ReqUser,categoryId?:string,from?:string,to?:string,archived?:string){return this.s.list(r.user.businessId,{categoryId,from,to,archived})}
  create(r:ReqUser,d:ExpenseDto){return this.s.create(r.user.businessId,r.user.sub,d)}
  update(r:ReqUser,id:string,d:ExpenseDto){return this.s.update(r.user.businessId,id,d)}
  archive(r:ReqUser,id:string){return this.s.archive(r.user.businessId,id)}
}
