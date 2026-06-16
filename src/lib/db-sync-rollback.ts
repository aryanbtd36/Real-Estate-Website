import dns from 'dns';
dns.setDefaultResultOrder('ipv4first');
import fs from 'fs';
import path from 'path';

// Load .env
try {
  const envPath = path.resolve(process.cwd(), '.env');
  if (fs.existsSync(envPath)) {
    const envFile = fs.readFileSync(envPath, 'utf8');
    envFile.split('\n').forEach((line) => {
      const cleanLine = line.replace('\r', '').trim();
      const parts = cleanLine.split('=');
      if (parts.length >= 2) {
        const key = parts[0].trim();
        const value = parts.slice(1).join('=').trim().replace(/^["']|["']$/g, '');
        if (key && !key.startsWith('#')) {
          process.env[key] = value;
        }
      }
    });
  }
} catch (err) {
  console.error('Failed to load .env file manually:', err);
}

// Override DATABASE_URL for local execution to ensure we use the direct connection if pooling is saturated
const originalUrl = process.env.DATABASE_URL;
if (originalUrl && originalUrl.includes('pooler.supabase.com')) {
  process.env.DATABASE_URL = "postgresql://postgres.fmajzxxsqmemgqqlnaik:AryanMishra3662@13.239.87.90:5432/postgres?sslmode=no-verify";
  console.log('Detected pooler URL. Using direct database URL for script execution:', process.env.DATABASE_URL);
}

async function run() {
  const { db } = await import('./db');
  console.log('Starting DB sync/rollback for UserRole -> SUPER_ADMIN...');

  try {
    // 1. Add SUPER_ADMIN to UserRole enum if not present
    try {
      await db.$executeRawUnsafe(`ALTER TYPE "UserRole" ADD VALUE 'SUPER_ADMIN';`);
      console.log('Added value SUPER_ADMIN to UserRole enum in DB.');
    } catch (err: any) {
      if (err.message && (err.message.includes('already exists') || err.message.includes('42710'))) {
        console.log('Enum value SUPER_ADMIN already exists.');
      } else {
        console.error('Failed to add SUPER_ADMIN to enum:', err.message);
      }
    }

    // 2. Set role = SUPER_ADMIN for all primary accounts and legacy roles
    console.log('Updating user roles to SUPER_ADMIN...');
    await db.$executeRawUnsafe(`
      UPDATE "User"
      SET "role" = 'SUPER_ADMIN', "isFounder" = true, "governanceLocked" = true
      WHERE LOWER("email") = 'aryanmishra8113@gmail.com';
    `);

    await db.$executeRawUnsafe(`
      UPDATE "User"
      SET "role" = 'SUPER_ADMIN', "isPrimarySA" = true
      WHERE LOWER("email") = 'mishraaryan3662@gmail.com';
    `);

    await db.$executeRawUnsafe(`
      UPDATE "User"
      SET "role" = 'SUPER_ADMIN'
      WHERE "role"::text IN ('PRIMARY_SUPER_ADMIN', 'FOUNDER_SUPER_ADMIN');
    `);

    // 3. Update GovernanceHistory records
    console.log('Updating GovernanceHistory records...');
    await db.$executeRawUnsafe(`
      UPDATE "GovernanceHistory"
      SET "previousRole" = 'SUPER_ADMIN'
      WHERE "previousRole"::text IN ('PRIMARY_SUPER_ADMIN', 'FOUNDER_SUPER_ADMIN');
    `);

    await db.$executeRawUnsafe(`
      UPDATE "GovernanceHistory"
      SET "newRole" = 'SUPER_ADMIN'
      WHERE "newRole"::text IN ('PRIMARY_SUPER_ADMIN', 'FOUNDER_SUPER_ADMIN');
    `);

    console.log('DB rollback completed successfully!');
  } catch (err: any) {
    console.error('DB rollback failed:', err);
    process.exit(1);
  } finally {
    await db.$disconnect();
    process.exit(0);
  }
}

run();
