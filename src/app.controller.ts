import { Controller, Get } from '@nestjs/common';
import { AppService } from './app.service';
import { SkipCsrf, StrictThrottle } from '@interloid/security';
import { /*CurrentUser,*/ Public } from '@interloid/core';
import { cleanupOldLogFiles } from '@interloid/logger';

@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Get('/ping')
  // Skip CSRF validation for this endpoint
  // Useful for public or non-browser-based requests
  @SkipCsrf()

  // Mark this endpoint as publicly accessible
  // Skips authentication/authorization checks
  @Public()

  // Disable throttling for this route
  // Uncomment if rate limiting should be bypassed
  //@SkipThrottle()

  // Apply strict rate limiting:
  // Max 100 requests per 60 seconds for the "ping" throttle group
  @StrictThrottle('ping', 60000, 100)
  async getHello(/*@CurrentUser() user: User // Inject authenticated user details from the request context*/) {
    // Remove log files older than 3 days from the specified directory
    await cleanupOldLogFiles('./', 3);

    return this.appService.getHello();
  }
}
