import { DynamicModule, Module } from '@nestjs/common';
import {
  APP_BOOTSTRAP,
  AppBootstrap,
} from '../../../../shared/bootstrap';
import { JwtTokenService } from '../../../../shared/jwt-token.service';
import { PrismaService } from '../../../../shared/prisma.service';
import { ServiceRegistry } from '../../../../shared/service-registry';
import { AuthController } from './auth/auth.controller';
import { AuthSeedService } from './auth/auth-seed.service';
import { AuthService } from './auth/auth.service';
import { HealthController } from './health.controller';

@Module({})
export class AppModule {
  static register(config: AppBootstrap): DynamicModule {
    if (!config.database?.url || !config.auth?.jwtSecret) {
      throw new Error('Auth bootstrap requires MongoDB and JWT configuration');
    }

    return {
      module: AppModule,
      controllers: [AuthController, HealthController],
      providers: [
        { provide: APP_BOOTSTRAP, useValue: config },
        ServiceRegistry,
        PrismaService,
        JwtTokenService,
        AuthSeedService,
        AuthService,
      ],
    };
  }
}
