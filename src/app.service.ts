import { TypedConfigService } from '@interloid/config';
import { Injectable } from '@nestjs/common';
import { AppConfig } from './config/env.schema';

@Injectable()
export class AppService {
  constructor(private readonly config: TypedConfigService<AppConfig>) {}
  getHello() {
    return { data: { pong: true, environment: this.config.get('NODE_ENV') } };
  }
}
