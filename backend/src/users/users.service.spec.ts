import { ConflictException } from '@nestjs/common';
import { UsersService } from './users.service.js';
import type { PrismaService } from '../prisma/prisma.service.js';

describe('UsersService', () => {
  const findUnique = vi.fn();
  const create = vi.fn();
  const service = new UsersService({
    user: { findUnique, create },
  } as unknown as PrismaService);

  beforeEach(() => {
    vi.resetAllMocks();
  });

  describe('findByEmail', () => {
    it('normalizes the email (trim + lowercase) before querying', async () => {
      findUnique.mockResolvedValue(null);
      await service.findByEmail('  Ana@Example.COM ');
      expect(findUnique).toHaveBeenCalledWith({
        where: { email: 'ana@example.com' },
      });
    });
  });

  describe('findById', () => {
    it('queries by id', async () => {
      const user = { id: 'u1' };
      findUnique.mockResolvedValue(user);
      await expect(service.findById('u1')).resolves.toBe(user);
      expect(findUnique).toHaveBeenCalledWith({ where: { id: 'u1' } });
    });
  });

  describe('create', () => {
    const data = { name: 'Ana', email: ' Ana@Example.com ', password: 'hash' };

    it('creates the user with a normalized email', async () => {
      findUnique.mockResolvedValue(null);
      create.mockResolvedValue({ id: 'u1' });

      await service.create(data);

      expect(create).toHaveBeenCalledWith({
        data: { name: 'Ana', email: 'ana@example.com', password: 'hash' },
      });
    });

    it('throws ConflictException when the email is already registered', async () => {
      findUnique.mockResolvedValue({ id: 'existing' });

      await expect(service.create(data)).rejects.toBeInstanceOf(
        ConflictException,
      );
      expect(create).not.toHaveBeenCalled();
    });
  });
});
