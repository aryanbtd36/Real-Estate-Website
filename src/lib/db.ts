import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';
import { bootstrapGovernance } from './governance-bootstrap';

const globalForPrisma = global as unknown as { prisma: PrismaClient };

const createPrismaClient = () => {
  const connStr = process.env.DATABASE_URL;
  const isSupabase = connStr?.includes('supabase');
  const isProd = process.env.NODE_ENV === 'production';
  const sslVal = isSupabase || isProd ? { rejectUnauthorized: false } : false;

  const pool = new Pool({
    connectionString: connStr,
    ssl: sslVal,
  });
  const adapter = new PrismaPg(pool);
  const client = new PrismaClient({ adapter });
  
  // Trigger governance bootstrap check asynchronously on startup
  bootstrapGovernance(client).catch(console.error);

  return client;
};

export const db = globalForPrisma.prisma || createPrismaClient();

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = db;
