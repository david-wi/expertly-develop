import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { products } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { writeFile, mkdir, unlink } from 'fs/promises';
import path from 'path';

const MAX_SIZE = 5 * 1024 * 1024; // 5MB
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File | null;
    const productId = formData.get('productId') as string | null;

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }

    if (!productId) {
      return NextResponse.json({ error: 'No productId provided' }, { status: 400 });
    }

    // Verify product exists
    const product = await db
      .select()
      .from(products)
      .where(eq(products.id, productId))
      .limit(1);

    if (product.length === 0) {
      return NextResponse.json({ error: 'Product not found' }, { status: 404 });
    }

    // Validate file type
    if (!ALLOWED_TYPES.includes(file.type)) {
      return NextResponse.json(
        { error: 'File type not allowed. Supported: JPEG, PNG, GIF, WebP' },
        { status: 400 }
      );
    }

    // Validate file size
    if (file.size > MAX_SIZE) {
      return NextResponse.json(
        { error: 'File too large. Maximum size is 5MB' },
        { status: 400 }
      );
    }

    // Create uploads directory if it doesn't exist
    const uploadsDir = path.join(process.cwd(), 'data', 'uploads', 'avatars');
    await mkdir(uploadsDir, { recursive: true });

    // Generate filename and save
    const ext = path.extname(file.name) || getExtFromMime(file.type);
    const filename = `avatar-${productId}-${Date.now()}${ext}`;
    const storagePath = path.join('uploads', 'avatars', filename);
    const fullPath = path.join(process.cwd(), 'data', storagePath);

    // Save file
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    await writeFile(fullPath, buffer);

    // Delete old avatar if exists
    const oldAvatarUrl = product[0].avatarUrl;
    if (oldAvatarUrl && oldAvatarUrl.startsWith('/api/avatars/')) {
      const oldFilename = oldAvatarUrl.split('/').pop();
      if (oldFilename) {
        const oldPath = path.join(process.cwd(), 'data', 'uploads', 'avatars', oldFilename);
        try {
          await unlink(oldPath);
        } catch {
          // File might not exist, ignore
        }
      }
    }

    // Update product with new avatar URL
    const avatarUrl = `/api/avatars/${filename}`;
    const now = new Date().toISOString();
    await db
      .update(products)
      .set({
        avatarUrl,
        updatedAt: now,
      })
      .where(eq(products.id, productId));

    return NextResponse.json({
      success: true,
      avatarUrl,
    });
  } catch (error) {
    console.error('Error uploading avatar:', error);
    return NextResponse.json(
      { error: 'Failed to upload avatar' },
      { status: 500 }
    );
  }
}

function getExtFromMime(mimeType: string): string {
  const map: Record<string, string> = {
    'image/jpeg': '.jpg',
    'image/png': '.png',
    'image/gif': '.gif',
    'image/webp': '.webp',
  };
  return map[mimeType] || '.png';
}
