import { Controller, Get, Post } from '@nestjs/common';
import { AppService } from './app.service';
import { SkipCsrf, StrictThrottle } from '@interloid/security';
import { Public } from '@interloid/core';

@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Get('/ping')
  @StrictThrottle('global', 100, 60000)
  getHello() {
    return this.appService.getHello();
  }

  // Mark a route as publicly accessible (no auth required):
  @Public()
  @Get('profile')
  getProfile() {
    return { data: { user: 'guest' } };
  }

  // Skip CSRF protection on this endpoint (cookie-session apps only):
  @SkipCsrf()
  @Post('webhook')
  handleWebhook() {
    return { data: { received: true } };
  }

  // Apply stricter rate limits to one route:
  @StrictThrottle() // override the global bucket to 5/min
  @Post('login')
  login() {
    return { data: { logged_in: true } };
  }
}
