import { Body, Controller, HttpCode, Post, Req } from '@nestjs/common';
import { FastifyRequest } from 'fastify';
import {
  AuthTokens,
  LoginInput,
  loginSchema,
  RefreshInput,
  refreshSchema,
  RegisterInput,
  registerSchema,
} from '@ai-board/shared';
import { Public } from '../common/decorators/public.decorator';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe';
import { AuthResult, AuthService } from './auth.service';
import { SessionContext } from './token.service';

@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Public()
  @Post('register')
  register(
    @Body(new ZodValidationPipe(registerSchema)) dto: RegisterInput,
    @Req() req: FastifyRequest,
  ): Promise<AuthResult> {
    return this.auth.register(dto, sessionContext(req));
  }

  @Public()
  @HttpCode(200)
  @Post('login')
  login(
    @Body(new ZodValidationPipe(loginSchema)) dto: LoginInput,
    @Req() req: FastifyRequest,
  ): Promise<AuthResult> {
    return this.auth.login(dto, sessionContext(req));
  }

  @Public()
  @HttpCode(200)
  @Post('refresh')
  refresh(
    @Body(new ZodValidationPipe(refreshSchema)) dto: RefreshInput,
    @Req() req: FastifyRequest,
  ): Promise<AuthTokens> {
    return this.auth.refresh(dto.refreshToken, sessionContext(req));
  }

  @Public()
  @HttpCode(204)
  @Post('logout')
  async logout(
    @Body(new ZodValidationPipe(refreshSchema)) dto: RefreshInput,
  ): Promise<void> {
    await this.auth.logout(dto.refreshToken);
  }
}

function sessionContext(req: FastifyRequest): SessionContext {
  const ua = req.headers['user-agent'];
  return {
    userAgent: Array.isArray(ua) ? ua[0] : ua,
    ipAddress: req.ip,
  };
}
