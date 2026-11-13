import { DynamicModule, Module } from '@nestjs/common';
import { APP_BOOTSTRAP, AppBootstrap } from '../../../../shared/bootstrap';
import { ServiceRegistry } from '../../../../shared/service-registry';
import { HealthController } from './health.controller';
import { ProductController } from './product.controller';
import { ProductService } from './product.service';

@Module({})
export class AppModule {
  static register(config: AppBootstrap): DynamicModule {
    return {
      module: AppModule,
      controllers: [HealthController, ProductController],
      providers: [
        { provide: APP_BOOTSTRAP, useValue: config },
        ProductService,
        ServiceRegistry,
      ],
    };
  }
}
