import { db } from './db';

async function main() {
  const emails = ['aryanmishra8113@gmail.com', 'mishraaryan3662@gmail.com'];
  const users = await db.user.findMany({
    where: { email: { in: emails } }
  });
  console.log('--- USERS IN DATABASE ---');
  console.log(JSON.stringify(users, null, 2));
}

main().catch(console.error);
