import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { v2 as cloudinary } from 'cloudinary';
import crypto from 'crypto';
import { SecurityEventLogger } from '@/lib/security/event-logger';
import { SecurityEventSeverity, SecurityEventCategory } from '@prisma/client';

// Configure Cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    const role = (session?.user as any)?.role;

    if (!session || role !== 'ADMIN') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const formData = await req.formData();
    const file = formData.get('file') as File;

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }

    const originalName = file.name || 'file';
    
    // 1. Path traversal defense
    const hasPathTraversal = originalName.includes('..') || originalName.includes('/') || originalName.includes('\\');
    
    // 2. Double extension check
    const dotCount = originalName.split('.').length - 1;
    const hasDoubleExt = dotCount > 1;

    // 3. Extension resolution and check
    const lastDotIdx = originalName.lastIndexOf('.');
    const ext = lastDotIdx !== -1 ? originalName.substring(lastDotIdx + 1).toLowerCase() : '';
    const allowedExtensions = ['jpg', 'jpeg', 'png', 'webp', 'pdf', 'mp4'];
    const isAllowedExt = allowedExtensions.includes(ext);

    // 4. Block list checking
    const blockedExtensions = ['exe', 'dll', 'bat', 'cmd', 'ps1', 'php', 'js', 'sh', 'jar'];
    const isBlockedExt = blockedExtensions.includes(ext);

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // 5. Magic Bytes verification
    let isMagicValid = false;
    if (buffer.length >= 4) {
      const hex = buffer.toString('hex').toUpperCase();
      if (ext === 'jpg' || ext === 'jpeg') {
        isMagicValid = hex.startsWith('FFD8FF');
      } else if (ext === 'png') {
        isMagicValid = hex.startsWith('89504E470D0A1A0A');
      } else if (ext === 'webp') {
        isMagicValid = hex.startsWith('52494646') && hex.substring(16, 24) === '57454250';
      } else if (ext === 'pdf') {
        isMagicValid = hex.startsWith('25504446');
      } else if (ext === 'mp4') {
        isMagicValid = hex.substring(8, 16) === '66747970';
      }
    }

    if (hasPathTraversal || hasDoubleExt || isBlockedExt || !isAllowedExt || !isMagicValid) {
      // Log security event MALICIOUS_UPLOAD_BLOCKED
      const callerId = (session?.user as any)?.id;
      const callerEmail = session?.user?.email;
      await SecurityEventLogger.log({
        userId: callerId,
        userEmail: callerEmail || undefined,
        eventType: 'MALICIOUS_UPLOAD_BLOCKED',
        severity: SecurityEventSeverity.HIGH,
        category: SecurityEventCategory.SYSTEM,
        title: 'Malicious File Upload Blocked',
        description: `File upload blocked due to validation violation: Name=${originalName}, Size=${file.size}, PathTraversal=${hasPathTraversal}, DoubleExt=${hasDoubleExt}, AllowedExt=${isAllowedExt}, MagicBytesMatched=${isMagicValid}`,
        metadata: { filename: originalName, ext, hasPathTraversal, hasDoubleExt, isAllowedExt, isMagicValid }
      });

      return NextResponse.json({ 
        error: 'Invalid or malicious file detected. Upload aborted.' 
      }, { status: 400 });
    }

    // 6. Filename sanitization & randomization
    const cleanBaseName = originalName
      .substring(0, lastDotIdx)
      .replace(/[^a-zA-Z0-9]/g, '_')
      .toLowerCase();
    const randomSuffix = crypto.randomBytes(8).toString('hex');
    const sanitizedFilename = `${cleanBaseName}_${randomSuffix}`;

    // Upload to Cloudinary using upload_stream with auto resource type detection
    const uploadResult = await new Promise<any>((resolve, reject) => {
      const uploadStream = cloudinary.uploader.upload_stream(
        {
          folder: 'aura_estates',
          public_id: sanitizedFilename,
          resource_type: 'auto',
        },
        (error, result) => {
          if (error) reject(error);
          else resolve(result);
        }
      );
      uploadStream.end(buffer);
    });

    return NextResponse.json({
      publicId: uploadResult.public_id,
      url: uploadResult.secure_url,
    });
  } catch (error) {
    console.error('Cloudinary upload error:', error);
    return NextResponse.json({ error: 'Failed to upload file' }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    const role = (session?.user as any)?.role;

    if (!session || role !== 'ADMIN') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { searchParams } = new URL(req.url);
    const publicId = searchParams.get('publicId');

    if (!publicId) {
      return NextResponse.json({ error: 'Missing publicId' }, { status: 400 });
    }

    const result = await cloudinary.uploader.destroy(publicId);

    if (result.result !== 'ok' && result.result !== 'not found') {
      return NextResponse.json({ error: 'Failed to delete from Cloudinary' }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Cloudinary delete error:', error);
    return NextResponse.json({ error: 'Failed to delete image' }, { status: 500 });
  }
}
