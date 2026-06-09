import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { sendEmail } from '@/lib/mail';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { name, email, phone, password } = body;

    if (!email || !password || !name) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const existing = await db.user.findUnique({
      where: { email },
    });

    if (existing) {
      return NextResponse.json({ error: 'User with this email already exists' }, { status: 409 });
    }

    const newUser = await db.user.create({
      data: {
        name,
        email,
        phone,
        password, // stored plain text for simplicity as per seed config
        role: 'USER',
      },
    });

    // Send welcome email (non-blocking)
    try {
      await sendEmail({
        to: newUser.email,
        subject: 'Welcome to AURA Luxury Real Estate',
        title: 'Welcome to the World of AURA',
        message: `Dear ${newUser.name},\n\nWe are delighted to welcome you to AURA Luxury Real Estate. Your account has been successfully created. We look forward to matching you with the world's most exceptional residences.\n\nUse your dashboard to track your private property visits, save properties of interest, and compare penthouses and estates.`,
      });
    } catch (mailErr) {
      console.error('Failed to dispatch registration email:', mailErr);
    }

    return NextResponse.json({ success: true, userId: newUser.id });
  } catch (error) {
    console.error('Registration error:', error);
    return NextResponse.json({ error: 'Failed to create user account' }, { status: 500 });
  }
}
