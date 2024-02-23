import {
  Body,
  Controller,
  Get,
  NotFoundException,
  Param,
  Post,
  Query,
} from '@nestjs/common';

import { AppEnvironment } from '../../config/config.constants';
import { ConfigService } from '../../config/config.module';
import { SeederService } from './seeder.service';

@Controller(`/test/seeder`)
export class SeederController {
  constructor(
    private seederService: SeederService,
    private config: ConfigService,
  ) {}

  private shouldExposeEndpoint() {
    return [AppEnvironment.DEV, AppEnvironment.TEST].includes(
      this.config.get('env')!,
    );
  }

  @Get('/:id')
  async fineOne(@Param('id') id: string) {
    if (!this.shouldExposeEndpoint())
      throw new NotFoundException('Route Not found');
    return { data: { id } };
  }

  @Get('/')
  async fineMany(@Query() query: any) {
    if (!this.shouldExposeEndpoint())
      throw new NotFoundException('Route Not found');
    return { data: { items: [], query } };
  }

  @Post('/')
  async create(@Body() payload: any) {
    if (!this.shouldExposeEndpoint())
      throw new NotFoundException('Route Not found');
    return { data: payload };
  }
}
