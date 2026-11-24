import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { RegisterDto } from './register.dto.js';

async function check(overrides: Record<string, unknown>) {
  const dto = plainToInstance(RegisterDto, {
    name: 'Ana',
    email: 'ana@example.com',
    password: 'Password1',
    ...overrides,
  });
  const errors = await validate(dto);
  return {
    dto,
    messages: errors.flatMap((e) => Object.values(e.constraints ?? {})),
  };
}

describe('RegisterDto', () => {
  it('accepts a valid registration', async () => {
    const { messages } = await check({});
    expect(messages).toEqual([]);
  });

  describe('name', () => {
    it('trims surrounding whitespace', async () => {
      const { dto, messages } = await check({ name: '  Ana García  ' });
      expect(messages).toEqual([]);
      expect(dto.name).toBe('Ana García');
    });

    it('rejects a name made only of spaces', async () => {
      const { messages } = await check({ name: '   ' });
      expect(messages).not.toEqual([]);
    });
  });

  describe('password', () => {
    it.each(['abcdefgh', 'Abcdefgh', 'abcdefg1', 'Ab1'])(
      'rejects %s',
      async (password) => {
        const { messages } = await check({ password });
        expect(messages).not.toEqual([]);
      },
    );

    it('reports the missing uppercase/number rule even when the password is also short', async () => {
      const { messages } = await check({ password: 'abc' });
      expect(messages).toContain(
        'La contraseña debe tener al menos una mayúscula y un número',
      );
    });

    it('accepts 8+ chars with an uppercase letter and a number', async () => {
      const { messages } = await check({ password: 'ABCDEFG1' });
      expect(messages).toEqual([]);
    });
  });
});
