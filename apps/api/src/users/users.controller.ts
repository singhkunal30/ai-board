import { Controller, Get, NotFoundException } from '@nestjs/common';
import { PublicUser } from '@ai-board/shared';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { UsersService } from './users.service';

@Controller('users')
export class UsersController {
  constructor(private readonly users: UsersService) {}

  /** Returns the authenticated user's profile. */
  @Get('me')
  async me(@CurrentUser('id') userId: string): Promise<PublicUser> {
    const user = await this.users.findById(userId);
    if (!user) throw new NotFoundException('User not found');
    return UsersService.toPublic(user);
  }
}
