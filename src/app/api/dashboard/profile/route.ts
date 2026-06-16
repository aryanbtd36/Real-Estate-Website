import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { db } from '@/lib/db';
import bcrypt from 'bcryptjs';

export async function PUT(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    const userId = (session?.user as any)?.id;

    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const { name, phone, email, password } = body;

    if (!email || !name) {
      return NextResponse.json({ error: 'Name and Email are required' }, { status: 400 });
    }

    const user = await db.user.findUnique({ where: { id: userId } });
    if (!user || user.deletedAt !== null) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Check Immortal Protection
    const { checkImmortalProtection } = await import('@/lib/governance');
    try {
      await checkImmortalProtection({
        targetUserId: userId,
        actorId: userId,
        action: `Update Profile (name: ${name}, email: ${email})`,
      });
    } catch (err: any) {
      return NextResponse.json({ error: err.message }, { status: 403 });
    }

    // Prevent changing Founder email to preserve hardcoded references
    if (user.isFounder || user.email.toLowerCase() === 'aryanmishra8113@gmail.com') {
      if (email.toLowerCase() !== 'aryanmishra8113@gmail.com') {
        return NextResponse.json({ error: 'Email changes are not allowed for the Founder account' }, { status: 400 });
      }
    }

    // Check email uniqueness if email changed
    const existing = await db.user.findFirst({
      where: {
        email,
        NOT: { id: userId },
      },
    });

    if (existing) {
      return NextResponse.json({ error: 'Email already in use by another user' }, { status: 409 });
    }

    const updateData: any = { name, phone, email };
    if (password) {
      updateData.password = await bcrypt.hash(password, 10);
    }

    const updatedUser = await db.user.update({
      where: { id: userId },
      data: updateData,
    });

    return NextResponse.json({
      success: true,
      user: {
        id: updatedUser.id,
        name: updatedUser.name,
        email: updatedUser.email,
        phone: updatedUser.phone,
      },
    });
  } catch (error) {
    console.error('Profile update error:', error);
    return NextResponse.json({ error: 'Failed to update profile' }, { status: 500 });
  }
}
