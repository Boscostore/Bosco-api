import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Logger,
  Post,
  UseGuards,
} from '@nestjs/common';
import { AuthService } from './auth.service';
import { RequestOtpDto } from './dto/request-otp.dto';
import { VerifyOtpDto } from './dto/verify-otp.dto';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { CurrentAdmin, AdminUser } from './current-admin.decorator';

@Controller('auth')
export class AuthController {
  private readonly logger = new Logger(AuthController.name);

  constructor(private readonly auth: AuthService) {}

  @Post('otp/request')
  @HttpCode(HttpStatus.OK)
  async requestOtp(@Body() dto: RequestOtpDto) {
    // If this line is missing for a request, the body failed DTO validation
    // (400 from the ValidationPipe) or the request never reached the API.
    this.logger.log(`POST otp/request received for: ${dto.email}`);
    await this.auth.requestOtp(dto.email);
    // Always the same response, regardless of allow-list membership.
    return {
      message:
        'Si el correo pertenece a un administrador, se ha enviado un código.',
    };
  }

  @Post('otp/verify')
  @HttpCode(HttpStatus.OK)
  async verifyOtp(@Body() dto: VerifyOtpDto) {
    this.logger.log(`POST otp/verify received for: ${dto.email}`);
    return this.auth.verifyOtp(dto.email, dto.code);
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  me(@CurrentAdmin() admin: AdminUser) {
    return { email: admin.email };
  }
}
