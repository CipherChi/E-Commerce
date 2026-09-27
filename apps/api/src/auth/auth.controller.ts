import { Body, Controller, Get, Post, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Request } from 'express';
import { AuthService } from './auth.service';
import { JwtAuthGuard } from './jwt-auth.guard';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { RefreshDto } from './dto/refresh.dto';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(private auth: AuthService) {}
  @Post('register') register(@Body() dto: RegisterDto) {
    return this.auth.register(dto);
  }
  @Post('login') login(@Body() dto: LoginDto) {
    return this.auth.login(dto);
  }
  @Post('refresh') refresh(@Body() body: RefreshDto) {
    const [header, payload, signature] = body.refreshToken.split('.');
    if (!header || !payload || !signature) return this.auth.refresh('', body.refreshToken);
    try {
      return this.auth.refresh(
        JSON.parse(Buffer.from(payload, 'base64url').toString()).sub,
        body.refreshToken,
      );
    } catch {
      return this.auth.refresh('', body.refreshToken);
    }
  }
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Get('me')
  me(@Req() req: Request & { user: { sub: string } }) {
    return this.auth.me(req.user.sub);
  }
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Post('logout')
  logout(@Req() req: Request & { user: { sub: string } }) {
    return this.auth.logout(req.user.sub);
  }
}
