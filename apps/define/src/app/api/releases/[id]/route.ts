import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { releaseSnapshots } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const release = await db
      .select()
      .from(releaseSnapshots)
      .where(eq(releaseSnapshots.id, id))
      .limit(1);

    if (release.length === 0) {
      return NextResponse.json({ error: 'Release not found' }, { status: 404 });
    }

    return NextResponse.json(release[0]);
  } catch (error) {
    console.error('Error fetching release:', error);
    return NextResponse.json({ error: 'Failed to fetch release' }, { status: 500 });
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { status, description } = body;

    const updates: any = {};
    if (status !== undefined) {
      updates.status = status;
      if (status === 'released') {
        updates.releasedAt = new Date().toISOString();
      }
    }
    if (description !== undefined) {
      updates.description = description;
    }

    await db
      .update(releaseSnapshots)
      .set(updates)
      .where(eq(releaseSnapshots.id, id));

    const updated = await db
      .select()
      .from(releaseSnapshots)
      .where(eq(releaseSnapshots.id, id))
      .limit(1);

    return NextResponse.json(updated[0]);
  } catch (error) {
    console.error('Error updating release:', error);
    return NextResponse.json({ error: 'Failed to update release' }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    await db.delete(releaseSnapshots).where(eq(releaseSnapshots.id, id));
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting release:', error);
    return NextResponse.json({ error: 'Failed to delete release' }, { status: 500 });
  }
}
