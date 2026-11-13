import {
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import * as bcrypt from 'bcryptjs';
import { AuthenticatedUser } from '../../../../shared/jwt-auth.guard';
import { JwtTokenService } from '../../../../shared/jwt-token.service';
import { PrismaService } from '../../../../shared/prisma.service';
import { ChangePasswordRequest } from './change-password.schema';
import { UpdateUserRequest } from './update-user.schema';

@Injectable()
export class UserService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtTokens: JwtTokenService
  ) {}

  async getUserProfile(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        displayName: true,
        phoneNumber: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    if (!user) {
      throw new NotFoundException('User was not found');
    }

    return {
      id: user.id,
      email: user.email,
      displayName: user.displayName,
      phoneNumber: user.phoneNumber,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    };
  }

  async updateUser(userId: string, data: UpdateUserRequest) {
    try {
      return await this.prisma.user.update({
        where: { id: userId },
        data,
        select: {
          id: true,
          email: true,
          displayName: true,
          phoneNumber: true,
          createdAt: true,
          updatedAt: true,
        },
      });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2025'
      ) {
        throw new NotFoundException('User was not found');
      }
      throw error;
    }
  }

  async changePassword(
    authenticatedUser: AuthenticatedUser,
    data: ChangePasswordRequest
  ) {
    const user = await this.prisma.user.findUnique({
      where: { id: authenticatedUser.id },
    });
    if (!user) {
      throw new NotFoundException('User not found');
    }

    const passwordMatches = await bcrypt.compare(
      data.currentPassword,
      user.passwordHash
    );
    if (!passwordMatches) {
      throw new UnauthorizedException('Current password is incorrect');
    }

    const passwordHash = await bcrypt.hash(data.newPassword, 12);
    await this.prisma.user.update({
      where: { id: user.id },
      data: { passwordHash },
    });

    return {
      message: 'Password changed successfully',
      access_token: this.jwtTokens.sign({ id: user.id, email: user.email }),
      expires_in: 3600,
      token_type: 'Bearer',
    };
  }
}