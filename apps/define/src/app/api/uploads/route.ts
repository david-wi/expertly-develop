import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { attachments, requirements } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { v4 as uuidv4 } from 'uuid';
import { writeFile, mkdir } from 'fs/promises';
import path from 'path';

// Max file sizes
const MAX_IMAGE_SIZE = 5 * 1024 * 1024; // 5MB
const MAX_DOC_SIZE = 10 * 1024 * 1024; // 10MB

// Allowed mime types
const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
const ALLOWED_DOC_TYPES = [
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
];

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File | null;
    const requirementId = formData.get('requirementId') as string | null;

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }

    if (!requirementId) {
      return NextResponse.json({ error: 'No requirementId provided' }, { status: 400 });
    }

    // Verify requirement exists
    const requirement = await db
      .select()
      .from(requirements)
      .where(eq(requirements.id, requirementId))
      .limit(1);

    if (requirement.length === 0) {
      return NextResponse.json({ error: 'Requirement not found' }, { status: 404 });
    }

    const mimeType = file.type;
    const isImage = ALLOWED_IMAGE_TYPES.includes(mimeType);
    const isDoc = ALLOWED_DOC_TYPES.includes(mimeType);

    if (!isImage && !isDoc) {
      return NextResponse.json(
        { error: 'File type not allowed. Supported: images (JPEG, PNG, GIF, WebP) and documents (PDF, Word)' },
        { status: 400 }
      );
    }

    // Check file size
    const maxSize = isImage ? MAX_IMAGE_SIZE : MAX_DOC_SIZE;
    if (file.size > maxSize) {
      const maxMB = maxSize / (1024 * 1024);
      return NextResponse.json(
        { error: `File too large. Maximum size is ${maxMB}MB` },
        { status: 400 }
      );
    }

    // Generate unique filename
    const ext = path.extname(file.name) || getExtFromMime(mimeType);
    const id = uuidv4();
    const filename = `${id}${ext}`;

    // Create uploads directory if it doesn't exist
    const uploadsDir = path.join(process.cwd(), 'data', 'uploads');
    await mkdir(uploadsDir, { recursive: true });

    // Save file
    const storagePath = path.join('uploads', filename);
    const fullPath = path.join(process.cwd(), 'data', storagePath);

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    await writeFile(fullPath, buffer);

    // Save to database
    const now = new Date().toISOString();
    await db.insert(attachments).values({
      id,
      requirementId,
      filename,
      originalFilename: file.name,
      mimeType,
      sizeBytes: file.size,
      storagePath,
      createdAt: now,
    });

    // Return URL for accessing the file
    const url = `/api/uploads/${id}`;

    return NextResponse.json({
      id,
      url,
      filename: file.name,
      mimeType,
      size: file.size,
    });
  } catch (error) {
    console.error('Error uploading file:', error);
    return NextResponse.json({ error: 'Failed to upload file' }, { status: 500 });
  }
}

function getExtFromMime(mimeType: string): string {
  const map: Record<string, string> = {
    'image/jpeg': '.jpg',
    'image/png': '.png',
    'image/gif': '.gif',
    'image/webp': '.webp',
    'application/pdf': '.pdf',
    'application/msword': '.doc',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document': '.docx',
  };
  return map[mimeType] || '';
}
