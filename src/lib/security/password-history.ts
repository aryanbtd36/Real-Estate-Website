import bcrypt from 'bcryptjs';
import { db } from '../db';

export async function isPasswordInHistory(userId: string, plaintext: string): Promise<boolean> {
  // Fetch user to check current password
  const user = await db.user.findUnique({
    where: { id: userId },
    select: { password: true },
  });
  if (user && user.password) {
    const matchesCurrent = await bcrypt.compare(plaintext, user.password);
    if (matchesCurrent) return true;
  }

  // Fetch past 5 password hashes
  const history = await db.passwordHistory.findMany({
    where: { userId },
    orderBy: { createdAt: 'desc' },
    take: 5,
  });

  for (const record of history) {
    const match = await bcrypt.compare(plaintext, record.hash);
    if (match) return true;
  }

  return false;
}

export async function addPasswordToHistory(userId: string, oldHash: string): Promise<void> {
  // Add new history record
  await db.passwordHistory.create({
    data: {
      userId,
      hash: oldHash,
    },
  });

  // Keep only latest 5 records
  const history = await db.passwordHistory.findMany({
    where: { userId },
    orderBy: { createdAt: 'desc' },
  });

  if (history.length > 5) {
    const toDelete = history.slice(5);
    await db.passwordHistory.deleteMany({
      where: {
        id: { in: toDelete.map((h) => h.id) },
      },
    });
  }
}
