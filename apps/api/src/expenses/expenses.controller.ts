import { Body, Controller, Delete, Get, Param, Patch, Post, Query, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger'; import { Request } from 'express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard'; import { BusinessContextGuard } from '../auth/business-context.guard'; import { ExpensesService } from './expenses.service'; import { CategoryDto, ExpenseDto } from './dto/expense.dto';
type ReqUser=Request&{user:{businessId:string;sub:string}};
@ApiTags('expenses') @ApiBearerAuth() @UseGuards(JwtAuthGuard,BusinessContextGuard) @Controller('expenses')
export class ExpensesController { constructor(private s:ExpensesService){}
 @Get('categories') categories(@Req()r:ReqUser){return this.s.categories(r.user.businessId)}
 @Post('categories') createCat(@Req()r:ReqUser,@Body()d:CategoryDto){return this.s.createCategory(r.user.businessId,d)}
 @Patch('categories/:id') updateCat(@Req()r:ReqUser,@Param('id')id:string,@Body()d:CategoryDto){return this.s.updateCategory(r.user.businessId,id,d)}
 @Delete('categories/:id') archiveCat(@Req()r:ReqUser,@Param('id')id:string){return this.s.archiveCategory(r.user.businessId,id)}
 @Get('summary') summary(@Req()r:ReqUser,@Query('from')from?:string,@Query('to')to?:string){return this.s.summary(r.user.businessId,from,to)}
 @Get() list(@Req()r:ReqUser,@Query('categoryId')categoryId?:string,@Query('from')from?:string,@Query('to')to?:string,@Query('archived')archived?:string){return this.s.list(r.user.businessId,{categoryId,from,to,archived})}
 @Post() create(@Req()r:ReqUser,@Body()d:ExpenseDto){return this.s.create(r.user.businessId,r.user.sub,d)}
 @Patch(':id') update(@Req()r:ReqUser,@Param('id')id:string,@Body()d:ExpenseDto){return this.s.update(r.user.businessId,id,d)}
 @Delete(':id') archive(@Req()r:ReqUser,@Param('id')id:string){return this.s.archive(r.user.businessId,id)}
}
