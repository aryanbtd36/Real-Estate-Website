import dns from 'dns';
dns.setDefaultResultOrder('ipv4first');
import fs from 'fs';
import path from 'path';

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
  try {
    console.log('Synchronizing ActivityAction enum in database...');
    const { db } = await import('./db');
    // Add enum value MAP_CURRENT_LOCATION_USED
    await db.$executeRawUnsafe(`ALTER TYPE "ActivityAction" ADD VALUE 'MAP_CURRENT_LOCATION_USED';`);
    console.log('Success: MAP_CURRENT_LOCATION_USED added to ActivityAction enum.');
  } catch (err: any) {
    if (err.message && (err.message.includes('already exists') || err.message.includes('42710'))) {
      console.log('Enum value MAP_CURRENT_LOCATION_USED already exists in database.');
    } else {
      console.error('Error synchronizing database enum:', err);
    }
  } finally {
    try {
      const { db } = await import('./db');
      await db.$disconnect();
    } catch {}
    process.exit(0);
  }
}

run();

