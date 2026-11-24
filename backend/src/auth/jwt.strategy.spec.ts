import { UnauthorizedException } from '@nestjs/common';
import type { ConfigService } from '@nestjs/config';
import { JwtStrategy } from './jwt.strategy.js';
import type { UsersService } from '../users/users.service.js';

describe('JwtStrategy', () => {
  const findById = vi.fn();
  const config = {
    get: () => 'x'.repeat(32),
  } as unknown as ConfigService<never, true>;
  const strategy = new JwtStrategy(config, {
    findById,
  } as unknown as UsersService);

  beforeEach(() => {
    vi.resetAllMocks();
  });

  it('returns only id, name and email of the token user', async () => {
    findById.mockResolvedValue({
      id: 'u1',
      name: 'Ana',
      email: 'ana@example.com',
      password: 'hash',
      createdAt: new Date(),
    });

    await expect(strategy.validate({ sub: 'u1' })).resolves.toEqual({
      id: 'u1',
      name: 'Ana',
      email: 'ana@example.com',
    });
    expect(findById).toHaveBeenCalledWith('u1');
  });

  it('rejects a token whose user no longer exists', async () => {
    findById.mockResolvedValue(null);

    await expect(strategy.validate({ sub: 'gone' })).rejects.toThrow(
      UnauthorizedException,
    );
  });
});
