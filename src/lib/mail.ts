import fs from 'fs';
import path from 'path';

interface EmailParams {
  to: string;
  subject: string;
  title: string;
  propertyName?: string;
  location?: string;
  date?: string;
  time?: string;
  status?: string;
  calendarLink?: string;
  icsLink?: string;
  contactInfo?: string;
  message?: string;
}

// Generates Google Calendar link
export function generateGoogleCalendarLink(propertyName: string, location: string, dateStr: string, timeStr: string) {
  try {
    // Parse Date: YYYY-MM-DD
    // Parse Time: HH:MM or HH:MM AM/PM
    const cleanTime = timeStr.trim().toUpperCase();
    let hours = 0;
    let minutes = 0;

    if (cleanTime.includes('AM') || cleanTime.includes('PM')) {
      const match = cleanTime.match(/(\d+):(\d+)\s*(AM|PM)/);
      if (match) {
        hours = parseInt(match[1]);
        minutes = parseInt(match[2]);
        const ampm = match[3];
        if (ampm === 'PM' && hours < 12) hours += 12;
        if (ampm === 'AM' && hours === 12) hours = 0;
      }
    } else {
      const parts = cleanTime.split(':');
      hours = parseInt(parts[0]) || 0;
      minutes = parseInt(parts[1]) || 0;
    }

    const startDateTime = new Date(`${dateStr}T${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:00`);
    const endDateTime = new Date(startDateTime.getTime() + 60 * 60 * 1000); // 1 hour visit

    const formatToGoogleDate = (date: Date) => {
      return date.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
    };

    const startISO = formatToGoogleDate(startDateTime);
    const endISO = formatToGoogleDate(endDateTime);

    return `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${encodeURIComponent(`AURA Property Visit: ${propertyName}`)}&dates=${startISO}/${endISO}&details=${encodeURIComponent(`Luxury property visit scheduled with AURA Real Estate.\nLocation: ${location}\nDate: ${dateStr}\nTime: ${timeStr}`)}&location=${encodeURIComponent(location)}`;
  } catch (err) {
    console.error('Failed to generate Google Calendar link:', err);
    return 'https://calendar.google.com';
  }
}

// Generates raw ICS file string
export function generateICSString(id: string, propertyName: string, location: string, dateStr: string, timeStr: string): string {
  try {
    const cleanTime = timeStr.trim().toUpperCase();
    let hours = 0;
    let minutes = 0;

    if (cleanTime.includes('AM') || cleanTime.includes('PM')) {
      const match = cleanTime.match(/(\d+):(\d+)\s*(AM|PM)/);
      if (match) {
        hours = parseInt(match[1]);
        minutes = parseInt(match[2]);
        const ampm = match[3];
        if (ampm === 'PM' && hours < 12) hours += 12;
        if (ampm === 'AM' && hours === 12) hours = 0;
      }
    } else {
      const parts = cleanTime.split(':');
      hours = parseInt(parts[0]) || 0;
      minutes = parseInt(parts[1]) || 0;
    }

    const startDateTime = new Date(`${dateStr}T${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:00`);
    const endDateTime = new Date(startDateTime.getTime() + 60 * 60 * 1000);

    const formatToICS = (date: Date) => {
      return date.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
    };

    const startISO = formatToICS(startDateTime);
    const endISO = formatToICS(endDateTime);
    const nowISO = formatToICS(new Date());

    return [
      'BEGIN:VCALENDAR',
      'VERSION:2.0',
      'PRODID:-//AURA Luxury Real Estate//NONSGML Property Visit//EN',
      'CALSCALE:GREGORIAN',
      'METHOD:REQUEST',
      'BEGIN:VEVENT',
      `DTSTART:${startISO}`,
      `DTEND:${endISO}`,
      `DTSTAMP:${nowISO}`,
      `UID:${id}@aura-luxury.com`,
      `SUMMARY:AURA Property Visit - ${propertyName}`,
      `DESCRIPTION:Scheduled visit to ${propertyName}.`,
      `LOCATION:${location}`,
      'STATUS:CONFIRMED',
      'SEQUENCE:0',
      'TRANSP:OPAQUE',
      'END:VEVENT',
      'END:VCALENDAR'
    ].join('\r\n');
  } catch (err) {
    console.error('Error generating ICS string:', err);
    return '';
  }
}

export async function sendEmail(params: EmailParams) {
  const {
    to,
    subject,
    title,
    propertyName,
    location,
    date,
    time,
    status,
    calendarLink,
    icsLink,
    contactInfo = '+1 (555) AURA-LXS (014-9821)',
    message
  } = params;

  // Render Premium Luxury Branded HTML Template
  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${subject}</title>
  <style>
    body {
      background-color: #0b0b0b;
      color: #eaeaea;
      font-family: 'Montserrat', 'Helvetica Neue', Helvetica, Arial, sans-serif;
      margin: 0;
      padding: 0;
      -webkit-font-smoothing: antialiased;
    }
    .container {
      max-width: 600px;
      margin: 40px auto;
      background-color: #111111;
      border: 1px solid #1a1a1a;
      border-radius: 8px;
      overflow: hidden;
      box-shadow: 0 10px 30px rgba(0, 0, 0, 0.5);
    }
    .header {
      background: linear-gradient(135deg, #161616 0%, #080808 100%);
      padding: 40px 20px;
      text-align: center;
      border-bottom: 1px solid #222;
    }
    .logo {
      font-size: 28px;
      font-weight: 700;
      letter-spacing: 4px;
      color: #d4af37;
      text-transform: uppercase;
      margin: 0;
    }
    .subtitle {
      font-size: 11px;
      letter-spacing: 2px;
      color: #888888;
      text-transform: uppercase;
      margin-top: 5px;
    }
    .content {
      padding: 40px 30px;
    }
    .title {
      font-size: 22px;
      color: #d4af37;
      margin-top: 0;
      margin-bottom: 20px;
      font-weight: 500;
      border-bottom: 1px solid #222;
      padding-bottom: 15px;
    }
    .text {
      font-size: 15px;
      line-height: 1.6;
      color: #cccccc;
      margin-bottom: 25px;
    }
    .details-box {
      background-color: #161616;
      border: 1px solid #222222;
      border-radius: 6px;
      padding: 20px;
      margin-bottom: 30px;
    }
    .detail-row {
      display: flex;
      justify-content: space-between;
      padding: 8px 0;
      border-bottom: 1px solid #222;
      font-size: 14px;
    }
    .detail-row:last-child {
      border-bottom: none;
    }
    .detail-label {
      color: #888888;
      font-weight: 500;
    }
    .detail-value {
      color: #ffffff;
      font-weight: 600;
      text-align: right;
    }
    .btn-gold {
      display: inline-block;
      background: linear-gradient(135deg, #d4af37 0%, #aa7c11 100%);
      color: #000000 !important;
      text-decoration: none;
      padding: 14px 28px;
      font-size: 14px;
      font-weight: 700;
      letter-spacing: 1px;
      border-radius: 4px;
      text-transform: uppercase;
      text-align: center;
      box-shadow: 0 4px 15px rgba(212, 175, 55, 0.2);
      transition: all 0.3s ease;
    }
    .btn-gold:hover {
      box-shadow: 0 6px 20px rgba(212, 175, 55, 0.4);
    }
    .footer {
      background-color: #0c0c0c;
      padding: 30px;
      text-align: center;
      font-size: 12px;
      color: #555555;
      border-top: 1px solid #1a1a1a;
    }
    .footer a {
      color: #d4af37;
      text-decoration: none;
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <div class="logo">A U R A</div>
      <div class="subtitle">Luxury Real Estate</div>
    </div>
    <div class="content">
      <div class="title">${title}</div>
      <div class="text">
        Dear Client,<br><br>
        ${message || 'We are pleased to communicate details regarding your relationship with AURA.'}
      </div>
      
      ${propertyName ? `
      <div class="details-box">
        <div class="detail-row">
          <span class="detail-label">Residence:</span>
          <span class="detail-value">${propertyName}</span>
        </div>
        ${location ? `
        <div class="detail-row">
          <span class="detail-label">Location:</span>
          <span class="detail-value">${location}</span>
        </div>
        ` : ''}
        ${date ? `
        <div class="detail-row">
          <span class="detail-label">Scheduled Date:</span>
          <span class="detail-value">${date}</span>
        </div>
        ` : ''}
        ${time ? `
        <div class="detail-row">
          <span class="detail-label">Scheduled Time:</span>
          <span class="detail-value">${time}</span>
        </div>
        ` : ''}
        ${status ? `
        <div class="detail-row">
          <span class="detail-label">Status:</span>
          <span class="detail-value" style="color: ${status === 'APPROVED' || status === 'CONFIRMED' ? '#10B981' : status === 'REJECTED' || status === 'CANCELLED' ? '#EF4444' : '#F59E0B'}">${status}</span>
        </div>
        ` : ''}
        ${contactInfo ? `
        <div class="detail-row">
          <span class="detail-label">Concierge Contact:</span>
          <span class="detail-value">${contactInfo}</span>
        </div>
        ` : ''}
      </div>
      ` : ''}

      ${(calendarLink || icsLink) ? `
      <div style="text-align: center; margin: 35px 0 15px 0;">
        ${calendarLink ? `<a href="${calendarLink}" target="_blank" class="btn-gold" style="margin: 0 10px; display: inline-block;">Add to Google Calendar</a>` : ''}
        ${icsLink ? `<a href="${icsLink}" class="btn-gold" style="background: transparent; border: 1px solid #d4af37; color: #d4af37 !important; margin: 0 10px; display: inline-block;">Download Invite (.ics)</a>` : ''}
      </div>
      ` : ''}
    </div>
    <div class="footer">
      <p>&copy; ${new Date().getFullYear()} AURA Luxury Real Estate. All rights reserved.</p>
      <p>This is a simulated luxury notification system. Local preview files written to the server workspace.</p>
    </div>
  </div>
</body>
</html>
  `;

  // 1. Log to console
  console.log('========================================================================');
  console.log(`[SIMULATED EMAIL DISPATCH]`);
  console.log(`To: ${to}`);
  console.log(`Subject: ${subject}`);
  console.log(`Title: ${title}`);
  if (propertyName) {
    console.log(`Details: ${propertyName} | ${location} | ${date} @ ${time}`);
    console.log(`Status: ${status}`);
  }
  if (calendarLink) {
    console.log(`Calendar Link: ${calendarLink}`);
  }
  if (icsLink) {
    console.log(`ICS Link: ${icsLink}`);
  }
  console.log('========================================================================');

  // 2. Write to local preview file
  try {
    const dir = path.join(process.cwd(), 'sent_emails');
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    const filename = `email-${Date.now()}-${to.replace(/[@.]/g, '_')}.html`;
    const filePath = path.join(dir, filename);
    fs.writeFileSync(filePath, html, 'utf8');
    console.log(`[PREVIEW SAVED] Local email preview written to: file:///${filePath.replace(/\\/g, '/')}`);
  } catch (err) {
    console.error('Failed to write local email preview file:', err);
  }
}
