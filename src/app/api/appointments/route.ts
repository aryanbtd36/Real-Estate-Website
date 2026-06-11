import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { db } from '@/lib/db';
import { sendEmail } from '@/lib/mail';
import { verifyTurnstile } from '@/lib/turnstile';
import bcrypt from 'bcryptjs';

export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    const body = await req.json();
    const { name, email, phone, propertyId, date, time, message, specialRequests, turnstileToken } = body;

    // 1. Enforce global Turnstile validation rule
    const isTurnstileValid = await verifyTurnstile(turnstileToken);
    if (!isTurnstileValid) {
      return NextResponse.json(
        { error: 'Turnstile verification failed. Please try again.' },
        { status: 403 }
      );
    }

    if (!name || !email || !phone || !propertyId || !date || !time) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    let userId = (session?.user as any)?.id;

    if (!userId) {
      // Find or create a user for guest booking
      let guestUser = await db.user.findUnique({ where: { email } });
      if (!guestUser) {
        const hashedGuestPassword = await bcrypt.hash('guestpassword123', 10);
        guestUser = await db.user.create({
          data: {
            name,
            email,
            phone,
            password: hashedGuestPassword,
            role: 'USER',
          },
        });
      }
      userId = guestUser.id;
    }

    // Fetch property details for email communication
    const property = await db.property.findUnique({
      where: { id: propertyId }
    });

    const appointment = await db.appointment.create({
      data: {
        userId,
        propertyId,
        name,
        email,
        phone,
        date,
        time,
        message,
        specialRequests,
        status: 'PENDING',
      },
    });

    // Mark corresponding slot as booked if configured
    try {
      const slot = await db.availableSlot.findFirst({
        where: { date, time, isBooked: false }
      });
      if (slot) {
        await db.availableSlot.update({
          where: { id: slot.id },
          data: { isBooked: true }
        });
      }
    } catch (slotErr) {
      console.error('Failed to mark available slot as booked:', slotErr);
    }

    // Send confirmation email (non-blocking)
    try {
      await sendEmail({
        to: email,
        subject: `Property Visit Booked: ${property?.name || 'AURA'} - Pending Confirmation`,
        title: 'Your Property Visit Request Has Been Received',
        propertyName: property?.name,
        location: property?.location,
        date,
        time,
        status: 'PENDING',
        message: `Dear ${name},\n\nWe have successfully received your request to schedule a private viewing. Our concierge relations team is verifying details. You will receive an update shortly once the visit is confirmed and synced to your schedule.\n\nSpecial Requests: ${specialRequests || 'None'}`,
      });
    } catch (mailErr) {
      console.error('Failed to dispatch booking notification email:', mailErr);
    }

    return NextResponse.json({ success: true, appointment });
  } catch (error) {
    console.error('Appointment booking error:', error);
    return NextResponse.json({ error: 'Failed to book appointment' }, { status: 500 });
  }
}
