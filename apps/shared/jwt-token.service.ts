import { Inject, Injectable } from '@nestjs/common';
import * as jwt from 'jsonwebtoken';
import { z } from 'zod';
import { APP_BOOTSTRAP, AppBootstrap } from './bootstrap';

const TokenPayloadSchema = z.object({
  sub: z.string().min(1),
  email: z.string().email(),
});

export interface LocalJwtUser {
  id: string;
  email: string;
  authSource: 'local';
}

@Injectable()
export class JwtTokenService {
  private readonly secret: string;

  constructor(@Inject(APP_BOOTSTRAP) config: AppBootstrap) {
    if (!config.auth?.jwtSecret) {
      throw new Error('auth.jwtSecret must be configured');
    }
    this.secret = config.auth.jwtSecret;
  }

  sign(user: { id: string; email: string }): string {
    return jwt.sign({ email: user.email }, this.secret, {
      algorithm: 'HS256',
      expiresIn: '1h',
      subject: user.id,
    });
  }

  verify(token: string): LocalJwtUser | null {
    let payload: string | jwt.JwtPayload;
    try {
      payload = jwt.verify(token, this.secret, {
        algorithms: ['HS256'],
      });
    } catch (error) {
      if (error instanceof jwt.JsonWebTokenError) {
        return null;
      }
      throw error;
    }

    const result = TokenPayloadSchema.safeParse(payload);
    if (!result.success) {
      return null;
    }

    return {
      id: result.data.sub,
      email: result.data.email,
      authSource: 'local',
    };
  }
}
