import { Controller, Get } from '@nestjs/common';
import { listTemplates, TemplateInfo } from './templates';

/** Lists the built-in board templates available when creating a board. */
@Controller('templates')
export class TemplatesController {
  @Get()
  list(): TemplateInfo[] {
    return listTemplates();
  }
}
