import { PrismaClient } from '@prisma/client';
import { PrismaLibSQL } from '@prisma/adapter-libsql';

const dbUrl = process.env.DATABASE_URL || 'file:./db/custom.db';

function createPrismaClient(): PrismaClient {
  if (dbUrl.startsWith('libsql://')) {
    const adapter = new PrismaLibSQL({
      url: dbUrl,
      authToken: process.env.DATABASE_AUTH_TOKEN,
    });
    return new PrismaClient({ adapter });
  }
  return new PrismaClient();
}

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient };
export const db = globalForPrisma.prisma || createPrismaClient();
if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = db;