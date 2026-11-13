import { Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import * as bcrypt from 'bcryptjs';
import { PrismaService } from '../../../../../shared/prisma.service';
import { RegisterSchema } from '../../../../../../db/authschema/register.schema';

@Injectable()
export class AuthSeedService implements OnApplicationBootstrap {
  private readonly logger = new Logger(AuthSeedService.name);

  constructor(private readonly prisma: PrismaService) {}

  async onApplicationBootstrap(): Promise<void> {
    if ((process.env['NODE_ENV'] ?? 'development') !== 'development') {
      return;
    }

    const email = process.env['SEED_USER_EMAIL']?.trim();
    const password = process.env['SEED_USER_PASSWORD'];
    const displayName = process.env['SEED_USER_DISPLAY_NAME']?.trim();

    if (!email && !password) {
      this.logger.log('No development seed user configured; skipping');
      return;
    }
    if (!email || !password) {
      throw new Error(
        'SEED_USER_EMAIL and SEED_USER_PASSWORD must both be configured'
      );
    }

    const result = RegisterSchema.safeParse({
      email,
      password,
      ...(displayName ? { displayName } : {}),
    });
    if (!result.success) {
      throw new Error(
        `Invalid development seed user configuration: ${result.error.message}`
      );
    }

    const existingUser = await this.prisma.user.findFirst({
      select: { id: true },
    });
    if (existingUser) {
      this.logger.log('User collection is not empty; skipping seed user');
      return;
    }

    const passwordHash = await bcrypt.hash(result.data.password, 12);
    await this.prisma.user.create({
      data: {
        email: result.data.email,
        passwordHash,
        displayName: result.data.displayName,
      },
    });
    this.logger.log('Created development seed user');
  }
}
