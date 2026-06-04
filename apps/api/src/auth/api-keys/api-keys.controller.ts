import { Body, Controller, Delete, Get, HttpCode, Param, Post } from '@nestjs/common';
import { z } from 'zod';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import { ApiKeysService } from './api-keys.service';

const createSchema = z.object({
  name: z.string().trim().min(1).max(120),
  expiresInDays: z.number().int().positive().max(3650).optional(),
});

@Controller('api-keys')
export class ApiKeysController {
  constructor(private readonly apiKeys: ApiKeysService) {}

  /** Create a personal access token. The plaintext token is returned ONCE. */
  @Post()
  create(
    @CurrentUser('id') userId: string,
    @Body(new ZodValidationPipe(createSchema)) dto: z.infer<typeof createSchema>,
  ) {
    return this.apiKeys.create(userId, dto.name, dto.expiresInDays);
  }

  @Get()
  list(@CurrentUser('id') userId: string) {
    return this.apiKeys.list(userId);
  }

  @Delete(':id')
  @HttpCode(204)
  async revoke(@CurrentUser('id') userId: string, @Param('id') id: string): Promise<void> {
    await this.apiKeys.revoke(userId, id);
  }
}
