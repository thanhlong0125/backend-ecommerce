import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Request } from 'express';
import { JwtTokenService, LocalJwtUser } from './jwt-token.service';

export type AuthenticatedUser = LocalJwtUser;

export interface AuthenticatedRequest extends Request {
  user?: AuthenticatedUser;
}

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(private readonly jwtTokens: JwtTokenService) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const authorization = request.headers.authorization;
    const match =
      typeof authorization === 'string'
        ? authorization.match(/^Bearer\s+([^\s]+)$/i)
        : null;

    if (!match) {
      throw new UnauthorizedException('Bearer token is required');
    }

    const user = this.jwtTokens.verify(match[1]);
    if (!user) {
      throw new UnauthorizedException('Invalid or expired access token');
    }

    request.user = user;
    return true;
  }
}
