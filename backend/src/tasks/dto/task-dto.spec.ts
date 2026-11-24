import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { CreateTaskDto } from './create-task.dto.js';
import { UpdateTaskDto } from './update-task.dto.js';

async function check<T extends object>(
  cls: new () => T,
  input: Record<string, unknown>,
) {
  const dto = plainToInstance(cls, input);
  const errors = await validate(dto);
  return { dto, invalid: errors.map((e) => e.property) };
}

describe('CreateTaskDto', () => {
  it('accepts just a title', async () => {
    const { invalid } = await check(CreateTaskDto, { title: 'Tarea' });
    expect(invalid).toEqual([]);
  });

  it('trims the title and rejects one made only of spaces', async () => {
    const ok = await check(CreateTaskDto, { title: '  Tarea  ' });
    expect(ok.dto.title).toBe('Tarea');

    const blank = await check(CreateTaskDto, { title: '   ' });
    expect(blank.invalid).toEqual(['title']);
  });

  it('rejects a title over 200 characters', async () => {
    const { invalid } = await check(CreateTaskDto, { title: 'a'.repeat(201) });
    expect(invalid).toEqual(['title']);
  });

  it.each(['LOW', 'MEDIUM', 'HIGH'])(
    'accepts priority %s',
    async (priority) => {
      const { invalid } = await check(CreateTaskDto, { title: 'T', priority });
      expect(invalid).toEqual([]);
    },
  );

  it('rejects an unknown priority', async () => {
    const { invalid } = await check(CreateTaskDto, {
      title: 'T',
      priority: 'URGENT',
    });
    expect(invalid).toEqual(['priority']);
  });

  it.each(['2026-12-31', '2026-12-31T10:30:00Z'])(
    'accepts the ISO date %s',
    async (dueDate) => {
      const { invalid } = await check(CreateTaskDto, { title: 'T', dueDate });
      expect(invalid).toEqual([]);
    },
  );

  it.each(['mañana', '31/12/2026', '2026-13-45'])(
    'rejects the date %s',
    async (dueDate) => {
      const { invalid } = await check(CreateTaskDto, { title: 'T', dueDate });
      expect(invalid).toEqual(['dueDate']);
    },
  );

  it('rejects an assigneeId that is not a UUID', async () => {
    const { invalid } = await check(CreateTaskDto, {
      title: 'T',
      assigneeId: 'pablo',
    });
    expect(invalid).toEqual(['assigneeId']);
  });
});

describe('UpdateTaskDto', () => {
  it('accepts an empty body', async () => {
    const { invalid } = await check(UpdateTaskDto, {});
    expect(invalid).toEqual([]);
  });

  it('accepts null to clear description, dueDate and assignee', async () => {
    const { invalid } = await check(UpdateTaskDto, {
      description: null,
      dueDate: null,
      assigneeId: null,
    });
    expect(invalid).toEqual([]);
  });

  it.each(['TODO', 'IN_PROGRESS', 'DONE'])(
    'accepts status %s',
    async (status) => {
      const { invalid } = await check(UpdateTaskDto, { status });
      expect(invalid).toEqual([]);
    },
  );

  it('rejects an unknown status', async () => {
    const { invalid } = await check(UpdateTaskDto, { status: 'BLOCKED' });
    expect(invalid).toEqual(['status']);
  });

  it('still rejects a blank title when one is sent', async () => {
    const { invalid } = await check(UpdateTaskDto, { title: '  ' });
    expect(invalid).toEqual(['title']);
  });

  it('trims the title', async () => {
    const { dto, invalid } = await check(UpdateTaskDto, { title: '  Nuevo ' });
    expect(invalid).toEqual([]);
    expect(dto.title).toBe('Nuevo');
  });

  it.each(['title', 'priority', 'status'])(
    'rejects null for %s (it is not clearable)',
    async (field) => {
      const { invalid } = await check(UpdateTaskDto, { [field]: null });
      expect(invalid).toEqual([field]);
    },
  );
});

describe('null on non-nullable fields at creation', () => {
  it('rejects a null priority', async () => {
    const { invalid } = await check(CreateTaskDto, {
      title: 'T',
      priority: null,
    });
    expect(invalid).toEqual(['priority']);
  });
});
