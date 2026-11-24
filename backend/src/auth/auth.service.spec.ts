import { UnauthorizedException } from '@nestjs/common';
import type { JwtService } from '@nestjs/jwt';
import bcrypt from 'bcrypt';
import { AuthService } from './auth.service.js';
import type { UsersService } from '../users/users.service.js';

describe('AuthService', () => {
  const create = vi.fn();
  const findByEmail = vi.fn();
  const signAsync = vi.fn();
  const service = new AuthService(
    { create, findByEmail } as unknown as UsersService,
    { signAsync } as unknown as JwtService,
  );

  const createdAt = new Date('2026-01-01');

  beforeEach(() => {
    vi.resetAllMocks();
    signAsync.mockResolvedValue('signed.jwt.token');
  });

  describe('register', () => {
    const dto = {
      name: 'Ana',
      email: 'ana@example.com',
      password: 'Password1',
    };

    it('stores a bcrypt hash, never the plain password', async () => {
      create.mockImplementation(async (data) => ({
        id: 'u1',
        createdAt,
        ...data,
      }));

      await service.register(dto);

      const saved = create.mock.calls[0][0];
      expect(saved.password).not.toBe(dto.password);
      await expect(bcrypt.compare(dto.password, saved.password)).resolves.toBe(
        true,
      );
    });

    it('returns a token plus the user without password', async () => {
      create.mockImplementation(async (data) => ({
        id: 'u1',
        createdAt,
        ...data,
      }));

      const result = await service.register(dto);

      expect(create.mock.calls[0][0].name).toBe('Ana');
      expect(signAsync).toHaveBeenCalledWith({ sub: 'u1' });
      expect(result.accessToken).toBe('signed.jwt.token');
      expect(result.user).toEqual({
        id: 'u1',
        name: 'Ana',
        email: 'ana@example.com',
        createdAt,
      });
      expect(result.user).not.toHaveProperty('password');
    });

    it('propagates the error when the email is already registered', async () => {
      const error = new Error('El email ya está registrado');
      create.mockRejectedValue(error);

      await expect(service.register(dto)).rejects.toBe(error);
      expect(signAsync).not.toHaveBeenCalled();
    });
  });

  describe('login', () => {
    const dto = { email: 'ana@example.com', password: 'Password1' };

    it('returns a token and the user without password on valid credentials', async () => {
      findByEmail.mockResolvedValue({
        id: 'u1',
        name: 'Ana',
        email: dto.email,
        password: await bcrypt.hash(dto.password, 4),
        createdAt,
      });

      const result = await service.login(dto);

      expect(signAsync).toHaveBeenCalledWith({ sub: 'u1' });
      expect(result.accessToken).toBe('signed.jwt.token');
      expect(result.user).not.toHaveProperty('password');
      expect(result.user.id).toBe('u1');
    });

    it('rejects an unknown email', async () => {
      findByEmail.mockResolvedValue(null);

      await expect(service.login(dto)).rejects.toThrow(UnauthorizedException);
      expect(signAsync).not.toHaveBeenCalled();
    });

    it('rejects a wrong password with the same error as an unknown email', async () => {
      findByEmail.mockResolvedValue({
        id: 'u1',
        email: dto.email,
        password: await bcrypt.hash('OtraPassword9', 4),
      });

      await expect(service.login(dto)).rejects.toThrow(
        'Credenciales inválidas',
      );
      expect(signAsync).not.toHaveBeenCalled();
    });
  });
});
