import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { products } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { writeFile, mkdir, unlink } from 'fs/promises';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import OpenAI from 'openai';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { productId, productName, productDescription } = body;

    if (!productId || !productName) {
      return NextResponse.json(
        { error: 'productId and productName are required' },
        { status: 400 }
      );
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

    // Build the prompt for DALL-E
    let prompt = `A modern, minimal app icon for "${productName}".`;
    if (productDescription) {
      prompt += ` ${productDescription}.`;
    }
    prompt += ' Clean design, suitable for a software product logo. No text. Simple geometric shapes, flat design, professional color palette.';

    // Generate image with DALL-E 3
    const response = await openai.images.generate({
      model: 'dall-e-3',
      prompt,
      n: 1,
      size: '1024x1024',
      quality: 'standard',
      response_format: 'b64_json',
    });

    if (!response.data || !response.data[0]?.b64_json) {
      return NextResponse.json(
        { error: 'Failed to generate image' },
        { status: 500 }
      );
    }
    const imageData = response.data[0].b64_json;

    // Create uploads directory if it doesn't exist
    const uploadsDir = path.join(process.cwd(), 'data', 'uploads', 'avatars');
    await mkdir(uploadsDir, { recursive: true });

    // Generate filename and save
    const filename = `avatar-${productId}-${Date.now()}.png`;
    const storagePath = path.join('uploads', 'avatars', filename);
    const fullPath = path.join(process.cwd(), 'data', storagePath);

    // Convert base64 to buffer and save
    const buffer = Buffer.from(imageData, 'base64');
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
    console.error('Error generating avatar:', error);
    return NextResponse.json(
      { error: 'Failed to generate avatar' },
      { status: 500 }
    );
  }
}
