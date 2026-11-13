import {
  BadRequestException,
  ConflictException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import * as bcrypt from 'bcryptjs';
import { JwtTokenService } from '../../../../../shared/jwt-token.service';
import { PrismaService } from '../../../../../shared/prisma.service';
import { LoginSchema } from './login.schema';
import { RegisterSchema } from './register.schema';

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtTokens: JwtTokenService
  ) {}

  async login(body: unknown) {
    const result = LoginSchema.safeParse(body);
    if (!result.success) {
      throw new BadRequestException({
        message: 'Invalid login request',
        errors: result.error.flatten().fieldErrors,
      });
    }

    const user = await this.prisma.user.findUnique({
      where: { email: result.data.email },
    });
    if (!user || !(await bcrypt.compare(result.data.password, user.passwordHash))) {
      throw new UnauthorizedException('Invalid email or password');
    }

    return {
      access_token: this.jwtTokens.sign({ id: user.id, email: user.email }),
      expires_in: 3600,
      token_type: 'Bearer',
      user: {
        id: user.id,
        email: user.email,
        displayName: user.displayName,
        phoneNumber: user.phoneNumber,
      },
    };
  }

  async register(body: unknown) {
    const result = RegisterSchema.safeParse(body);
    if (!result.success) {
      throw new BadRequestException({
        message: 'Invalid registration request',
        errors: result.error.flatten().fieldErrors,
      });
    }

    const { email, password, displayName, phoneNumber } = result.data;
    const passwordHash = await bcrypt.hash(password, 12);

    try {
      const user = await this.prisma.user.create({
        data: { email, passwordHash, displayName, phoneNumber },
      });

      return {
        access_token: this.jwtTokens.sign({ id: user.id, email: user.email }),
        expires_in: 3600,
        token_type: 'Bearer',
        user: {
          id: user.id,
          email: user.email,
          displayName: user.displayName,
          phoneNumber: user.phoneNumber,
        },
      };
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new ConflictException('An account with this email already exists');
      }
      throw error;
    }
  }
}
