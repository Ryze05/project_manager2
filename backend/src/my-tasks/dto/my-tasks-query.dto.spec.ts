import { ValidationPipe } from '@nestjs/common';
import { MyTasksQueryDto } from './my-tasks-query.dto.js';

describe('MyTasksQueryDto', () => {
  // Same options as the global pipe, including implicit conversion.
  const pipe = new ValidationPipe({
    whitelist: true,
    forbidNonWhitelisted: true,
    transform: true,
    transformOptions: { enableImplicitConversion: true },
  });
  const parse = (query: object) =>
    pipe.transform(query, { type: 'query', metatype: MyTasksQueryDto });

  it('is optional', async () => {
    expect((await parse({})).includeDone).toBeUndefined();
  });

  it('reads "true" and "false" as real booleans ("false" is not true)', async () => {
    expect((await parse({ includeDone: 'true' })).includeDone).toBe(true);
    expect((await parse({ includeDone: 'false' })).includeDone).toBe(false);
  });

  it.each(['yes', '1', '0', '', 'TRUE', 'null'])(
    'rejects %j (400)',
    async (value) => {
      await expect(parse({ includeDone: value })).rejects.toThrow();
    },
  );

  it('rejects unknown query parameters', async () => {
    await expect(parse({ foo: 'x' })).rejects.toThrow();
  });
});
