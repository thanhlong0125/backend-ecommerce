import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  jest,
} from '@jest/globals';
import * as bcrypt from 'bcryptjs';
import { PrismaService } from '../../../../../shared/prisma.service';
import { AuthSeedService } from './auth-seed.service';

describe('AuthSeedService', () => {
  const findFirst = jest.fn<(args: unknown) => Promise<unknown>>();
  const create = jest.fn<(args: unknown) => Promise<unknown>>();
  const prisma = {
    user: {
      findFirst,
      create,
    },
  } as unknown as PrismaService;
  const originalEnvironment = {
    nodeEnv: process.env['NODE_ENV'],
    email: process.env['SEED_USER_EMAIL'],
    password: process.env['SEED_USER_PASSWORD'],
    displayName: process.env['SEED_USER_DISPLAY_NAME'],
  };
  let service: AuthSeedService;

  beforeEach(() => {
    jest.clearAllMocks();
    process.env['NODE_ENV'] = 'development';
    process.env['SEED_USER_EMAIL'] = 'demo@example.com';
    process.env['SEED_USER_PASSWORD'] = 'development-password';
    process.env['SEED_USER_DISPLAY_NAME'] = 'Demo User';
    service = new AuthSeedService(prisma);
  });

  afterEach(() => {
    const environment = {
      NODE_ENV: originalEnvironment.nodeEnv,
      SEED_USER_EMAIL: originalEnvironment.email,
      SEED_USER_PASSWORD: originalEnvironment.password,
      SEED_USER_DISPLAY_NAME: originalEnvironment.displayName,
    };
    for (const [key, value] of Object.entries(environment)) {
      if (value === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = value;
      }
    }
  });

  it('creates a hashed seed user when the collection is empty', async () => {
    findFirst.mockResolvedValue(null);
    create.mockResolvedValue({});

    await service.onApplicationBootstrap();

    expect(findFirst).toHaveBeenCalledWith({ select: { id: true } });
    expect(create).toHaveBeenCalledWith({
      data: {
        email: 'demo@example.com',
        passwordHash: expect.any(String),
        displayName: 'Demo User',
      },
    });
    const createArgs = create.mock.calls[0][0] as {
      data: { passwordHash: string };
    };
    expect(bcrypt.getRounds(createArgs.data.passwordHash)).toBe(12);
    await expect(
      bcrypt.compare('development-password', createArgs.data.passwordHash)
    ).resolves.toBe(true);
  });

  it('does not create another user when the collection is not empty', async () => {
    findFirst.mockResolvedValue({ id: 'existing-user' });

    await service.onApplicationBootstrap();

    expect(create).not.toHaveBeenCalled();
  });

  it('does not seed users outside development', async () => {
    process.env['NODE_ENV'] = 'production';

    await service.onApplicationBootstrap();

    expect(findFirst).not.toHaveBeenCalled();
    expect(create).not.toHaveBeenCalled();
  });

  it('fails startup when only part of the seed credentials is configured', async () => {
    delete process.env['SEED_USER_PASSWORD'];

    await expect(service.onApplicationBootstrap()).rejects.toThrow(
      'SEED_USER_EMAIL and SEED_USER_PASSWORD must both be configured'
    );
    expect(findFirst).not.toHaveBeenCalled();
  });
});
