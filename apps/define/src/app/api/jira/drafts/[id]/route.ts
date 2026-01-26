import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { db } from '@/lib/db';
import { jiraStoryDrafts } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';

// GET - Get a single draft
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;

    const draft = await db.query.jiraStoryDrafts.findFirst({
      where: eq(jiraStoryDrafts.id, id),
    });

    if (!draft) {
      return NextResponse.json({ error: 'Draft not found' }, { status: 404 });
    }

    return NextResponse.json({
      draft: {
        ...draft,
        labels: draft.labels ? JSON.parse(draft.labels) : [],
      },
    });
  } catch (error) {
    console.error('Error fetching draft:', error);
    return NextResponse.json(
      { error: 'Failed to fetch draft' },
      { status: 500 }
    );
  }
}

// PUT - Update a draft
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    const body = await request.json();
    const { summary, description, issueType, priority, labels, storyPoints } = body;

    const existing = await db.query.jiraStoryDrafts.findFirst({
      where: eq(jiraStoryDrafts.id, id),
    });

    if (!existing) {
      return NextResponse.json({ error: 'Draft not found' }, { status: 404 });
    }

    // Only allow updates on drafts that haven't been sent
    if (existing.status === 'sent') {
      return NextResponse.json(
        { error: 'Cannot modify a draft that has been sent to Jira' },
        { status: 400 }
      );
    }

    const now = new Date().toISOString();

    await db
      .update(jiraStoryDrafts)
      .set({
        summary: summary ?? existing.summary,
        description: description ?? existing.description,
        issueType: issueType ?? existing.issueType,
        priority: priority ?? existing.priority,
        labels: labels ? JSON.stringify(labels) : existing.labels,
        storyPoints: storyPoints !== undefined ? storyPoints : existing.storyPoints,
        updatedAt: now,
      })
      .where(eq(jiraStoryDrafts.id, id));

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error updating draft:', error);
    return NextResponse.json(
      { error: 'Failed to update draft' },
      { status: 500 }
    );
  }
}

// DELETE - Delete a draft
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;

    const existing = await db.query.jiraStoryDrafts.findFirst({
      where: eq(jiraStoryDrafts.id, id),
    });

    if (!existing) {
      return NextResponse.json({ error: 'Draft not found' }, { status: 404 });
    }

    await db.delete(jiraStoryDrafts).where(eq(jiraStoryDrafts.id, id));

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting draft:', error);
    return NextResponse.json(
      { error: 'Failed to delete draft' },
      { status: 500 }
    );
  }
}
