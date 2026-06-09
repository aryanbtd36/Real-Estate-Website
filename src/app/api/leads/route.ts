import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { db } from '@/lib/db';
import { sendEmail } from '@/lib/mail';

// Submit inquiry (public)
export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { name, email, phone, message } = body;

    if (!name || !email || !message) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const lead = await db.lead.create({
      data: {
        name,
        email,
        phone,
        message,
        status: 'PENDING'
      }
    });

    // Send a luxury themed thank you email to the user (non-blocking)
    try {
      await sendEmail({
        to: email,
        subject: 'Inquiry Received - AURA Private Concierge',
        title: 'Thank You for Reaching Out to AURA',
        message: `Dear ${name},\n\nThank you for contacting AURA Private Concierge. We have successfully received your inquiry:\n\n"${message}"\n\nOur client relations partner will review your message and contact you at ${phone || email} within 24 hours.`,
      });
    } catch (mailErr) {
      console.error('Failed to dispatch inquiry notification email:', mailErr);
    }

    return NextResponse.json({ success: true, lead });
  } catch (error) {
    console.error('Create lead error:', error);
    return NextResponse.json({ error: 'Failed to submit inquiry' }, { status: 500 });
  }
}

// Get all leads (admin only)
export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    const role = (session?.user as any)?.role;

    if (!session || role !== 'ADMIN') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const leads = await db.lead.findMany({
      orderBy: { createdAt: 'desc' }
    });

    return NextResponse.json(leads);
  } catch (error) {
    console.error('Fetch leads error:', error);
    return NextResponse.json({ error: 'Failed to fetch inquiries' }, { status: 500 });
  }
}

// Update lead status (admin only)
export async function PUT(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    const role = (session?.user as any)?.role;

    if (!session || role !== 'ADMIN') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body = await req.json();
    const { id, status } = body;

    if (!id || !status) {
      return NextResponse.json({ error: 'Missing lead ID or status' }, { status: 400 });
    }

    const updated = await db.lead.update({
      where: { id },
      data: { status }
    });

    return NextResponse.json({ success: true, lead: updated });
  } catch (error) {
    console.error('Update lead status error:', error);
    return NextResponse.json({ error: 'Failed to update inquiry status' }, { status: 500 });
  }
}

// Delete lead (admin only)
export async function DELETE(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    const role = (session?.user as any)?.role;

    if (!session || role !== 'ADMIN') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'Missing lead ID' }, { status: 400 });
    }

    await db.lead.delete({
      where: { id }
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Delete lead error:', error);
    return NextResponse.json({ error: 'Failed to delete inquiry' }, { status: 500 });
  }
}
