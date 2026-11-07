import { Controller, Get } from '@nestjs/common';
import { Public } from './auth/decorators';
import { AppService } from './app.service';

@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  /** Health check (used by Cloud Run and to wake the API up). */
  @Public()
  @Get()
  getHello(): string {
    return this.appService.getHello();
  }
}
