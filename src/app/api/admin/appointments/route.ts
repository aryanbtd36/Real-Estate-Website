import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { db } from '@/lib/db';
import { eventEmitter, EVENTS } from '@/lib/events';

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    const role = (session?.user as any)?.role;

    if (!session || (role !== 'ADMIN' && role !== 'SUPER_ADMIN')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const appointments = await db.appointment.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        property: true,
        user: true,
        notes: {
          include: {
            createdBy: { select: { id: true, name: true, email: true } },
          },
          orderBy: { createdAt: 'desc' },
        },
        admin: {
          select: { id: true, name: true, email: true },
        },
        lead: true,
      },
    });

    return NextResponse.json(appointments);
  } catch (error) {
    return NextResponse.json({ error: 'Failed to fetch appointments' }, { status: 500 });
  }
}

export async function PUT(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    const role = (session?.user as any)?.role;

    if (!session || (role !== 'ADMIN' && role !== 'SUPER_ADMIN')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body = await req.json();
    const { id, status, date, time } = body;

    if (!id || !status) {
      return NextResponse.json({ error: 'Missing required parameters' }, { status: 400 });
    }

    // Fetch appointment before updating to ensure properties exist
    const appointment = await db.appointment.findUnique({
      where: { id },
      include: { property: true }
    });

    if (!appointment) {
      return NextResponse.json({ error: 'Appointment not found' }, { status: 404 });
    }

    const updateData: any = { status };
    if (status === 'RESCHEDULED') {
      if (date) updateData.date = date;
      if (time) updateData.time = time;
    }

    const updated = await db.appointment.update({
      where: { id },
      data: updateData,
      include: { property: true, user: true },
    });

    // Logging & Notification (Decoupled events emit)
    const adminId = (session?.user as any)?.id;
    eventEmitter.emit(EVENTS.APPOINTMENT_UPDATED, {
      actorId: adminId,
      targetUserId: updated.userId,
      appointmentId: id,
      propertyName: updated.property.name,
      clientName: updated.name,
      status,
      date: updated.date,
      time: updated.time,
    });

    // Import mail helpers (kept inline for dynamic/non-blocking resolve)
    const { sendEmail, generateGoogleCalendarLink } = await import('@/lib/mail');

    // Send status update emails
    try {
      if (status === 'APPROVED' || status === 'CONFIRMED') {
        const link = generateGoogleCalendarLink(updated.property.name, updated.property.location, updated.date, updated.time);
        await sendEmail({
          to: updated.email,
          subject: `Property Visit Confirmed: ${updated.property.name} - AURA`,
          title: 'Your Property Visit Has Been Confirmed',
          propertyName: updated.property.name,
          location: updated.property.location,
          date: updated.date,
          time: updated.time,
          status: 'APPROVED',
          calendarLink: link,
          icsLink: `http://localhost:3000/api/appointments/ics?id=${updated.id}`,
          message: `Dear ${updated.name},\n\nWe are pleased to confirm your private viewing of ${updated.property.name}. A private concierge host has been assigned to guide you.\n\nUse the link below to sync this viewing to your Google Calendar or download the invite file. You can also monitor your schedule via the client dashboard.`,
        });
      } else if (status === 'REJECTED' || status === 'CANCELLED') {
        await sendEmail({
          to: updated.email,
          subject: `Property Visit Update: Request Declined - AURA`,
          title: 'Property Visit Request Declined',
          propertyName: updated.property.name,
          location: updated.property.location,
          date: updated.date,
          time: updated.time,
          status: 'REJECTED',
          message: `Dear ${updated.name},\n\nWe regret to inform you that we are unable to accommodate your requested private viewing slot for ${updated.property.name} at this time.\n\nPlease select another date/time slot on the platform or contact our private concierge office.`,
        });
      } else if (status === 'RESCHEDULED') {
        const link = generateGoogleCalendarLink(updated.property.name, updated.property.location, updated.date, updated.time);
        await sendEmail({
          to: updated.email,
          subject: `Property Visit Rescheduled: ${updated.property.name} - AURA`,
          title: 'Your Property Visit Has Been Rescheduled',
          propertyName: updated.property.name,
          location: updated.property.location,
          date: updated.date,
          time: updated.time,
          status: 'RESCHEDULED',
          calendarLink: link,
          icsLink: `http://localhost:3000/api/appointments/ics?id=${updated.id}`,
          message: `Dear ${updated.name},\n\nYour private viewing of ${updated.property.name} has been rescheduled by our administrator to ${updated.date} at ${updated.time}.\n\nPlease accept the new date/time or coordinate with our private concierge team if you require another adjustment.`,
        });
      }
    } catch (mailErr) {
      console.error('Failed to send status update email:', mailErr);
    }

    return NextResponse.json({ success: true, appointment: updated });
  } catch (error) {
    console.error('Update appointment status error:', error);
    return NextResponse.json({ error: 'Failed to update appointment status' }, { status: 500 });
  }
}
