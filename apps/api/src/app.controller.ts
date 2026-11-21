import { Controller, Get } from '@nestjs/common';
import { AppService } from './app.service';
import { Public } from './auth/public.decorator';

@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  // Liveness check: answers without a signed-in user.
  @Public()
  @Get()
  getHello(): string {
    return this.appService.getHello();
  }
}
