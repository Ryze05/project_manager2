import { ConflictException, Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import type { User } from '../generated/prisma/client.js';

export interface CreateUserData {
  name: string;
  email: string;
  password: string;
}

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  findByEmail(email: string): Promise<User | null> {
    return this.prisma.user.findUnique({
      where: { email: email.trim().toLowerCase() },
    });
  }

  findById(id: string): Promise<User | null> {
    return this.prisma.user.findUnique({ where: { id } });
  }

  async create(data: CreateUserData): Promise<User> {
    const email = data.email.trim().toLowerCase();
    if (await this.findByEmail(email)) {
      throw new ConflictException('El email ya está registrado');
    }
    return this.prisma.user.create({ data: { ...data, email } });
  }
}
