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

async function run() {
  const { db } = await import('./db');
  console.log('Starting DB migration for Wave 6...');

  try {
    // 1. Create UserRole Enum
    await db.$executeRawUnsafe(`
      DO $$
      BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'UserRole') THEN
          CREATE TYPE "UserRole" AS ENUM ('USER', 'ADMIN', 'SUPER_ADMIN');
        END IF;
      END
      $$;
    `);
    console.log('Enum UserRole verified/created.');

    // 2. Create Permission Enum
    await db.$executeRawUnsafe(`
      DO $$
      BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'Permission') THEN
          CREATE TYPE "Permission" AS ENUM (
            'MANAGE_PROPERTIES', 'MANAGE_LEADS', 'MANAGE_APPOINTMENTS',
            'MANAGE_USERS', 'VIEW_ANALYTICS', 'EXPORT_DATA',
            'MANAGE_CONTENT', 'MANAGE_SETTINGS', 'MANAGE_ADMINS',
            'VIEW_SECURITY', 'VIEW_AUDITS', 'VIEW_FINANCIALS'
          );
        END IF;
      END
      $$;
    `);
    console.log('Enum Permission verified/created.');

    // 3. Create AlertSeverity Enum
    await db.$executeRawUnsafe(`
      DO $$
      BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'AlertSeverity') THEN
          CREATE TYPE "AlertSeverity" AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL');
        END IF;
      END
      $$;
    `);
    console.log('Enum AlertSeverity verified/created.');

    // 4. Update User table role column
    // Convert current role string values to UserRole enum values
    await db.$executeRawUnsafe(`
      ALTER TABLE "User" ALTER COLUMN "role" DROP DEFAULT;
      ALTER TABLE "User" ALTER COLUMN "role" TYPE "UserRole" USING "role"::"UserRole";
      ALTER TABLE "User" ALTER COLUMN "role" SET DEFAULT 'USER';
    `);
    console.log('Altered User.role column to UserRole enum.');

    // 5. Create AdminPermission table
    await db.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "AdminPermission" (
        "id" TEXT NOT NULL,
        "userId" TEXT NOT NULL,
        "permission" "Permission" NOT NULL,
        "grantedById" TEXT,
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT "AdminPermission_pkey" PRIMARY KEY ("id"),
        CONSTRAINT "AdminPermission_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE,
        CONSTRAINT "AdminPermission_grantedById_fkey" FOREIGN KEY ("grantedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE
      );
    `);
    await db.$executeRawUnsafe(`
      CREATE UNIQUE INDEX IF NOT EXISTS "AdminPermission_userId_permission_key" ON "AdminPermission"("userId", "permission");
      CREATE INDEX IF NOT EXISTS "AdminPermission_userId_idx" ON "AdminPermission"("userId");
    `);
    console.log('Table AdminPermission verified/created.');

    // 6. Create AdminSession table
    await db.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "AdminSession" (
        "id" TEXT NOT NULL,
        "userId" TEXT NOT NULL,
        "ipAddress" TEXT,
        "browser" TEXT,
        "device" TEXT,
        "operatingSystem" TEXT,
        "country" TEXT,
        "city" TEXT,
        "loginAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "lastActivityAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "logoutAt" TIMESTAMP(3),
        "isActive" BOOLEAN NOT NULL DEFAULT TRUE,
        CONSTRAINT "AdminSession_pkey" PRIMARY KEY ("id"),
        CONSTRAINT "AdminSession_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE
      );
    `);
    await db.$executeRawUnsafe(`
      CREATE INDEX IF NOT EXISTS "AdminSession_userId_idx" ON "AdminSession"("userId");
      CREATE INDEX IF NOT EXISTS "AdminSession_isActive_idx" ON "AdminSession"("isActive");
    `);
    console.log('Table AdminSession verified/created.');

    // 7. Create SecurityAlert table
    await db.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "SecurityAlert" (
        "id" TEXT NOT NULL,
        "adminId" TEXT,
        "type" TEXT NOT NULL,
        "severity" "AlertSeverity" NOT NULL,
        "description" TEXT NOT NULL,
        "details" JSONB,
        "resolved" BOOLEAN NOT NULL DEFAULT FALSE,
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT "SecurityAlert_pkey" PRIMARY KEY ("id"),
        CONSTRAINT "SecurityAlert_adminId_fkey" FOREIGN KEY ("adminId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE
      );
    `);
    await db.$executeRawUnsafe(`
      CREATE INDEX IF NOT EXISTS "SecurityAlert_adminId_idx" ON "SecurityAlert"("adminId");
      CREATE INDEX IF NOT EXISTS "SecurityAlert_resolved_idx" ON "SecurityAlert"("resolved");
    `);
    console.log('Table SecurityAlert verified/created.');

    // 8. Create AdminReview table
    await db.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "AdminReview" (
        "id" TEXT NOT NULL,
        "adminId" TEXT NOT NULL,
        "reviewedById" TEXT,
        "rating" INTEGER NOT NULL,
        "notes" TEXT,
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT "AdminReview_pkey" PRIMARY KEY ("id"),
        CONSTRAINT "AdminReview_adminId_fkey" FOREIGN KEY ("adminId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE,
        CONSTRAINT "AdminReview_reviewedById_fkey" FOREIGN KEY ("reviewedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE
      );
    `);
    await db.$executeRawUnsafe(`
      CREATE INDEX IF NOT EXISTS "AdminReview_adminId_idx" ON "AdminReview"("adminId");
    `);
    console.log('Table AdminReview verified/created.');

    // 9. Add values to ActivityAction
    const newActions = [
      'ADMIN_CREATED',
      'ADMIN_PROMOTED',
      'ADMIN_REVOKED',
      'ADMIN_SUSPENDED',
      'ADMIN_RESTORED',
      'PERMISSION_GRANTED',
      'PERMISSION_REVOKED',
      'SESSION_CREATED',
      'SESSION_TERMINATED',
      'SECURITY_ALERT',
      'ADMIN_REVIEW'
    ];

    for (const act of newActions) {
      try {
        await db.$executeRawUnsafe(`ALTER TYPE "ActivityAction" ADD VALUE '${act}';`);
        console.log(`Added value ${act} to ActivityAction enum.`);
      } catch (err: any) {
        if (err.message && (err.message.includes('already exists') || err.message.includes('42710'))) {
          // ignore already exists
        } else {
          console.error(`Failed to add ${act}:`, err.message);
        }
      }
    }

    console.log('Migration completed successfully!');
  } catch (err: any) {
    console.error('Migration crashed:', err);
    process.exit(1);
  } finally {
    const { db } = await import('./db');
    await db.$disconnect();
    process.exit(0);
  }
}

run();
