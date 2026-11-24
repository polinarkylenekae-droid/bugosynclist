import { PrismaClient } from '@prisma/client';

declare global {
  // eslint-disable-next-line no-var
  var __bugoPrisma: PrismaClient | undefined;
}

export function isMySqlConfigured(): boolean {
  const url = process.env.DATABASE_URL?.trim() || '';
  return url.startsWith('mysql://') || url.startsWith('mysqls://');
}

export function getPrismaClient(): PrismaClient | null {
  if (!isMySqlConfigured()) {
    return null;
  }

  if (!globalThis.__bugoPrisma) {
    globalThis.__bugoPrisma = new PrismaClient({
      log: process.env.NODE_ENV === 'production' ? ['error'] : ['warn', 'error'],
    });
  }

  return globalThis.__bugoPrisma;
}

export async function checkDatabaseHealth(): Promise<{
  mode: 'mysql-prisma' | 'json-local';
  connected: boolean;
  latencyMs?: number;
  error?: string;
}> {
  const prisma = getPrismaClient();
  if (!prisma) {
    return {
      mode: 'json-local',
      connected: true,
    };
  }

  const startedAt = Date.now();
  try {
    await prisma.$queryRaw`SELECT 1`;
    return {
      mode: 'mysql-prisma',
      connected: true,
      latencyMs: Date.now() - startedAt,
    };
  } catch (err: any) {
    return {
      mode: 'mysql-prisma',
      connected: false,
      latencyMs: Date.now() - startedAt,
      error: err?.message || 'MySQL connection check failed',
    };
  }
}

export async function disconnectPrisma(): Promise<void> {
  if (globalThis.__bugoPrisma) {
    await globalThis.__bugoPrisma.$disconnect();
    globalThis.__bugoPrisma = undefined;
  }
}
