import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CreateGuestDto } from './dto/create-guest.dto';
import { UpdateGuestDto } from './dto/update-guest.dto';
import { GuestsService } from './guests.service';

@ApiTags('guests')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('guests')
export class GuestsController {
  constructor(private readonly guests: GuestsService) {}
  @Get() list(@Query('q') query?: string) {
    return this.guests.list(query);
  }
  @Post() create(@Body() dto: CreateGuestDto) {
    return this.guests.create(dto);
  }
  @Patch(':id') update(@Param('id') id: string, @Body() dto: UpdateGuestDto) {
    return this.guests.update(id, dto);
  }
  @Delete(':id') remove(@Param('id') id: string) {
    return this.guests.remove(id);
  }
}
