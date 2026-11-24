import type { ArgumentsHost } from '@nestjs/common';
import { PrismaExceptionFilter } from './prisma-exception.filter.js';
import { Prisma } from '../../generated/prisma/client.js';

function run(code: string) {
  const json = vi.fn();
  const status = vi.fn().mockReturnValue({ json });
  const host = {
    switchToHttp: () => ({ getResponse: () => ({ status }) }),
  } as unknown as ArgumentsHost;
  const error = new Prisma.PrismaClientKnownRequestError('boom', {
    code,
    clientVersion: 'test',
  });

  new PrismaExceptionFilter().catch(error, host);
  return { status, json };
}

describe('PrismaExceptionFilter', () => {
  it.each([
    ['P2002', 409],
    ['P2025', 404],
    ['P2003', 409],
    ['P9999', 500],
  ])('maps %s to HTTP %i', (code, expected) => {
    const { status, json } = run(code);
    expect(status).toHaveBeenCalledWith(expected);
    expect(json).toHaveBeenCalledWith(
      expect.objectContaining({ statusCode: expected }),
    );
  });

  it('does not leak the original error message on unknown codes', () => {
    const { json } = run('P9999');
    expect(JSON.stringify(json.mock.calls[0][0])).not.toContain('boom');
  });
});
