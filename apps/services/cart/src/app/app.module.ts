import { DynamicModule, Module } from '@nestjs/common';
import { APP_BOOTSTRAP, AppBootstrap } from '../../../../shared/bootstrap';
import { ServiceRegistry } from '../../../../shared/service-registry';
import { HealthController } from './health.controller';
import { CartController } from './cart.controller';
import { CartService } from './cart.service';

@Module({})
export class AppModule {
  static register(config: AppBootstrap): DynamicModule {
    return {
      module: AppModule,
      controllers: [HealthController, CartController],
      providers: [
        { provide: APP_BOOTSTRAP, useValue: config },
        CartService,
        ServiceRegistry,
      ],
    };
  }
}
