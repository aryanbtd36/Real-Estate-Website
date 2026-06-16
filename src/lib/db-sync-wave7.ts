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
  console.log('Starting DB migration for Wave 7...');

  try {
    // 1. Add UserRole enum values
    const newRoles = ['PRIMARY_SUPER_ADMIN', 'FOUNDER_SUPER_ADMIN'];
    for (const role of newRoles) {
      try {
        await db.$executeRawUnsafe(`ALTER TYPE "UserRole" ADD VALUE '${role}';`);
        console.log(`Added value ${role} to UserRole enum.`);
      } catch (err: any) {
        if (err.message && (err.message.includes('already exists') || err.message.includes('42710'))) {
          console.log(`Enum role value ${role} already exists in database.`);
        } else {
          console.error(`Failed to add role ${role}:`, err.message);
        }
      }
    }

    // 2. Add ActivityAction enum values
    const newActions = [
      'FOUNDER_ACCESS',
      'FOUNDER_PROMOTION',
      'FOUNDER_DEMOTION',
      'SUPER_ADMIN_CREATED',
      'SUPER_ADMIN_REMOVED',
      'GOVERNANCE_OVERRIDE',
      'IMMORTAL_ACCESS',
      'IMMORTAL_LOCKDOWN',
      'IMMORTAL_OVERRIDE',
      'PROTECTED_ACCOUNT_ACCESS_ATTEMPT',
      'OWNERSHIP_TRANSFER'
    ];

    for (const act of newActions) {
      try {
        await db.$executeRawUnsafe(`ALTER TYPE "ActivityAction" ADD VALUE '${act}';`);
        console.log(`Added value ${act} to ActivityAction enum.`);
      } catch (err: any) {
        if (err.message && (err.message.includes('already exists') || err.message.includes('42710'))) {
          // ignore already exists
        } else {
          console.error(`Failed to add action ${act}:`, err.message);
        }
      }
    }

    // 3. Add User columns
    console.log('Adding new columns to User table...');
    await db.$executeRawUnsafe(`
      ALTER TABLE "User" 
      ADD COLUMN IF NOT EXISTS "isFounder" BOOLEAN DEFAULT false,
      ADD COLUMN IF NOT EXISTS "isPrimarySA" BOOLEAN DEFAULT false,
      ADD COLUMN IF NOT EXISTS "promotedById" TEXT,
      ADD COLUMN IF NOT EXISTS "promotedAt" TIMESTAMP(3),
      ADD COLUMN IF NOT EXISTS "governanceLocked" BOOLEAN DEFAULT false;
    `);

    // 4. Add constraint for promotedById
    try {
      await db.$executeRawUnsafe(`
        ALTER TABLE "User" 
        ADD CONSTRAINT "User_promotedById_fkey" 
        FOREIGN KEY ("promotedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
      `);
      console.log('Added foreign key constraint User_promotedById_fkey.');
    } catch (err: any) {
      console.log('Foreign key constraint might already exist.');
    }

    // 5. Create GovernanceHistory table
    console.log('Creating GovernanceHistory table...');
    await db.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "GovernanceHistory" (
        "id" TEXT NOT NULL,
        "targetUserId" TEXT NOT NULL,
        "actorId" TEXT NOT NULL,
        "previousRole" "UserRole",
        "newRole" "UserRole" NOT NULL,
        "reason" TEXT,
        "metadata" JSONB,
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT "GovernanceHistory_pkey" PRIMARY KEY ("id")
      );
    `);
    await db.$executeRawUnsafe(`
      CREATE INDEX IF NOT EXISTS "GovernanceHistory_targetUserId_idx" ON "GovernanceHistory"("targetUserId");
      CREATE INDEX IF NOT EXISTS "GovernanceHistory_actorId_idx" ON "GovernanceHistory"("actorId");
      CREATE INDEX IF NOT EXISTS "GovernanceHistory_createdAt_idx" ON "GovernanceHistory"("createdAt");
    `);

    // 6. Create SystemSetting table
    console.log('Creating SystemSetting table...');
    await db.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "SystemSetting" (
        "key" TEXT NOT NULL,
        "value" TEXT NOT NULL,
        CONSTRAINT "SystemSetting_pkey" PRIMARY KEY ("key")
      );
    `);

    // 7. Migrate existing SUPER_ADMIN role entries to PRIMARY_SUPER_ADMIN or FOUNDER_SUPER_ADMIN
    console.log('Migrating user roles...');
    // We update aryanmishra8113@gmail.com to FOUNDER_SUPER_ADMIN
    await db.$executeRawUnsafe(`
      UPDATE "User" 
      SET "role" = 'FOUNDER_SUPER_ADMIN', "isFounder" = true, "governanceLocked" = true 
      WHERE LOWER("email") = 'aryanmishra8113@gmail.com';
    `);

    // We update mishraaryan3662@gmail.com to PRIMARY_SUPER_ADMIN
    await db.$executeRawUnsafe(`
      UPDATE "User" 
      SET "role" = 'PRIMARY_SUPER_ADMIN', "isPrimarySA" = true 
      WHERE LOWER("email") = 'mishraaryan3662@gmail.com';
    `);

    // Any other leftover SUPER_ADMIN roles are migrated to PRIMARY_SUPER_ADMIN
    await db.$executeRawUnsafe(`
      UPDATE "User" 
      SET "role" = 'PRIMARY_SUPER_ADMIN' 
      WHERE "role"::text = 'SUPER_ADMIN';
    `);

    console.log('Migration completed successfully!');
  } catch (err: any) {
    console.error('Migration crashed:', err);
    process.exit(1);
  } finally {
    await db.$disconnect();
    process.exit(0);
  }
}

run();
