import { DynamicModule, Module } from '@nestjs/common';
import { APP_BOOTSTRAP, AppBootstrap } from '../../../../shared/bootstrap';
import { JwtAuthGuard } from '../../../../shared/jwt-auth.guard';
import { JwtTokenService } from '../../../../shared/jwt-token.service';
import { PrismaService } from '../../../../shared/prisma.service';
import { ServiceRegistry } from '../../../../shared/service-registry';
import { HealthController } from './health.controller';
import { UserController } from './user.controller';
import { UserService } from './user.service';

@Module({})
export class UserModule {
  static register(config: AppBootstrap): DynamicModule {
    if (!config.database?.url || !config.auth?.jwtSecret) {
      throw new Error('User bootstrap requires MongoDB and JWT configuration');
    }

    return {
      module: UserModule,
      controllers: [HealthController, UserController],
      providers: [
        { provide: APP_BOOTSTRAP, useValue: config },
        ServiceRegistry,
        JwtTokenService,
        JwtAuthGuard,
        PrismaService,
        UserService,
      ],
    };
  }
}
