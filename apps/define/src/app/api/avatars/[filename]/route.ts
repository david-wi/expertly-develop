import { NextRequest, NextResponse } from 'next/server';
import { readFile } from 'fs/promises';
import path from 'path';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ filename: string }> }
) {
  try {
    const { filename } = await params;

    // Validate filename to prevent path traversal
    if (!filename || filename.includes('..') || filename.includes('/')) {
      return NextResponse.json({ error: 'Invalid filename' }, { status: 400 });
    }

    const fullPath = path.join(process.cwd(), 'data', 'uploads', 'avatars', filename);

    try {
      const fileBuffer = await readFile(fullPath);

      // Determine content type based on extension
      const ext = path.extname(filename).toLowerCase();
      const contentType = ext === '.png' ? 'image/png' :
                         ext === '.jpg' || ext === '.jpeg' ? 'image/jpeg' :
                         ext === '.webp' ? 'image/webp' : 'application/octet-stream';

      return new NextResponse(fileBuffer, {
        status: 200,
        headers: {
          'Content-Type': contentType,
          'Cache-Control': 'public, max-age=31536000, immutable',
        },
      });
    } catch (fileError) {
      return NextResponse.json({ error: 'Avatar not found' }, { status: 404 });
    }
  } catch (error) {
    console.error('Error serving avatar:', error);
    return NextResponse.json({ error: 'Failed to serve avatar' }, { status: 500 });
  }
}
