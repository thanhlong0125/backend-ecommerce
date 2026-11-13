import { NotFoundException, UnauthorizedException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import * as bcrypt from 'bcryptjs';
import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { JwtTokenService } from '../../../../shared/jwt-token.service';
import { PrismaService } from '../../../../shared/prisma.service';
import { UserService } from './user.service';

describe('UserService', () => {
  const user = {
    id: 'user-1',
    email: 'user@example.com',
    displayName: 'Test User',
    phoneNumber: '+1234567890',
    passwordHash: 'old-hash',
    createdAt: new Date('2025-01-01T00:00:00.000Z'),
    updatedAt: new Date('2025-01-02T00:00:00.000Z'),
  };
  const findUnique = jest.fn<(args: unknown) => Promise<unknown>>();
  const update = jest.fn<(args: unknown) => Promise<unknown>>();
  const sign = jest.fn<(user: { id: string; email: string }) => string>();
  const prisma = {
    user: {
      findUnique,
      update,
    },
  } as unknown as PrismaService;
  const jwtTokens = {
    sign,
  } as unknown as JwtTokenService;
  let service: UserService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new UserService(prisma, jwtTokens);
  });

  describe('getUserProfile', () => {
    it('returns the profile without exposing the password hash', async () => {
      findUnique.mockResolvedValue(user);

      await expect(service.getUserProfile(user.id)).resolves.toEqual({
        id: user.id,
        email: user.email,
        displayName: user.displayName,
        phoneNumber: user.phoneNumber,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt,
      });
      expect(findUnique).toHaveBeenCalledWith({
        where: { id: user.id },
        select: {
          id: true,
          email: true,
          displayName: true,
          phoneNumber: true,
          createdAt: true,
          updatedAt: true,
        },
      });
    });

    it('throws NotFoundException when the profile does not exist', async () => {
      findUnique.mockResolvedValue(null);

      await expect(service.getUserProfile(user.id)).rejects.toBeInstanceOf(
        NotFoundException
      );
    });
  });

  describe('updateUser', () => {
    it('updates and returns the selected user fields', async () => {
      const data = { displayName: 'Updated User' };
      const updatedUser = { ...user, ...data };
      update.mockResolvedValue(updatedUser);

      await expect(service.updateUser(user.id, data)).resolves.toEqual(
        updatedUser
      );
      expect(update).toHaveBeenCalledWith({
        where: { id: user.id },
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
    });

    it('translates a missing record error to NotFoundException', async () => {
      const error = new Prisma.PrismaClientKnownRequestError(
        'Record to update not found.',
        { code: 'P2025', clientVersion: 'test' }
      );
      update.mockRejectedValue(error);

      await expect(
        service.updateUser(user.id, { displayName: 'Updated User' })
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it('rethrows errors other than a missing record error', async () => {
      const error = new Error('Database unavailable');
      update.mockRejectedValue(error);

      await expect(
        service.updateUser(user.id, { displayName: 'Updated User' })
      ).rejects.toBe(error);
    });
  });

  describe('changePassword', () => {
    const authenticatedUser = {
      id: user.id,
      email: user.email,
      authSource: 'local' as const,
    };
    const passwordChange = {
      currentPassword: 'current-password',
      newPassword: 'new-password',
    };

    it('throws NotFoundException when the user does not exist', async () => {
      findUnique.mockResolvedValue(null);

      await expect(
        service.changePassword(authenticatedUser, passwordChange)
      ).rejects.toBeInstanceOf(NotFoundException);
      expect(update).not.toHaveBeenCalled();
    });

    it('rejects an incorrect current password without updating the user', async () => {
      const passwordHash = await bcrypt.hash('different-password', 4);
      findUnique.mockResolvedValue({ ...user, passwordHash });

      await expect(
        service.changePassword(authenticatedUser, passwordChange)
      ).rejects.toBeInstanceOf(UnauthorizedException);
      expect(update).not.toHaveBeenCalled();
      expect(sign).not.toHaveBeenCalled();
    });

    it('hashes the new password, updates the user, and returns a token', async () => {
      const passwordHash = await bcrypt.hash(passwordChange.currentPassword, 4);
      findUnique.mockResolvedValue({ ...user, passwordHash });
      update.mockResolvedValue({
        ...user,
        passwordHash: 'unused',
      });
      sign.mockReturnValue('new-token');

      await expect(
        service.changePassword(authenticatedUser, passwordChange)
      ).resolves.toEqual({
        message: 'Password changed successfully',
        access_token: 'new-token',
        expires_in: 3600,
        token_type: 'Bearer',
      });
      expect(update).toHaveBeenCalledWith({
        where: { id: user.id },
        data: { passwordHash: expect.any(String) },
      });
      const updateArgs = update.mock.calls[0][0] as {
        data: { passwordHash: string };
      };
      expect(bcrypt.getRounds(updateArgs.data.passwordHash)).toBe(12);
      await expect(
        bcrypt.compare(passwordChange.newPassword, updateArgs.data.passwordHash)
      ).resolves.toBe(true);
      expect(sign).toHaveBeenCalledWith({
        id: user.id,
        email: user.email,
      });
    });
  });
});
