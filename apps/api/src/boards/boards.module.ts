import { Module } from '@nestjs/common';
import { BoardsController, WorkspaceBoardsController } from './boards.controller';
import { BoardsService } from './boards.service';

@Module({
  controllers: [WorkspaceBoardsController, BoardsController],
  providers: [BoardsService],
  exports: [BoardsService],
})
export class BoardsModule {}
