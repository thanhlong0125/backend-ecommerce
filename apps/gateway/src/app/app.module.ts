import { DynamicModule, Module } from '@nestjs/common';
import { APP_BOOTSTRAP, AppBootstrap } from '../../../shared/bootstrap';
import { ServiceRegistry } from '../../../shared/service-registry';
import { AppController } from './app.controller';
import { GatewayService } from './gateway.service';
import { HealthController } from './health.controller';

@Module({})
export class AppModule {
  static register(config: AppBootstrap): DynamicModule {
    if (!config.consul.url) {
      throw new Error('Gateway bootstrap requires a Consul URL');
    }

    return {
      module: AppModule,
      controllers: [HealthController, AppController],
      providers: [
        { provide: APP_BOOTSTRAP, useValue: config },
        ServiceRegistry,
        GatewayService,
      ],
    };
  }
}
