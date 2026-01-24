import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requirements, requirementVersions, codeLinks, testLinks, deliveryLinks } from '@/lib/db/schema';
import { eq, desc } from 'drizzle-orm';
import { v4 as uuidv4 } from 'uuid';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const requirement = await db
      .select()
      .from(requirements)
      .where(eq(requirements.id, id))
      .limit(1);

    if (requirement.length === 0) {
      return NextResponse.json({ error: 'Requirement not found' }, { status: 404 });
    }

    // Get versions
    const versions = await db
      .select()
      .from(requirementVersions)
      .where(eq(requirementVersions.requirementId, id))
      .orderBy(desc(requirementVersions.versionNumber));

    // Get code links
    const codeLinkList = await db
      .select()
      .from(codeLinks)
      .where(eq(codeLinks.requirementId, id));

    // Get test links
    const testLinkList = await db
      .select()
      .from(testLinks)
      .where(eq(testLinks.requirementId, id));

    // Get delivery links
    const deliveryLinkList = await db
      .select()
      .from(deliveryLinks)
      .where(eq(deliveryLinks.requirementId, id));

    // Get children
    const children = await db
      .select()
      .from(requirements)
      .where(eq(requirements.parentId, id))
      .orderBy(requirements.orderIndex);

    return NextResponse.json({
      ...requirement[0],
      versions,
      codeLinks: codeLinkList,
      testLinks: testLinkList,
      deliveryLinks: deliveryLinkList,
      children,
    });
  } catch (error) {
    console.error('Error fetching requirement:', error);
    return NextResponse.json({ error: 'Failed to fetch requirement' }, { status: 500 });
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const {
      title,
      whatThisDoes,
      whyThisExists,
      notIncluded,
      acceptanceCriteria,
      status,
      priority,
      tags,
      changeSummary,
      changedBy = 'User',
    } = body;

    // Get current requirement
    const current = await db
      .select()
      .from(requirements)
      .where(eq(requirements.id, id))
      .limit(1);

    if (current.length === 0) {
      return NextResponse.json({ error: 'Requirement not found' }, { status: 404 });
    }

    const currentReq = current[0];
    const now = new Date().toISOString();
    const newVersion = currentReq.currentVersion + 1;

    // Update requirement
    const updates: any = {
      updatedAt: now,
      currentVersion: newVersion,
    };

    if (title !== undefined) updates.title = title.trim();
    if (whatThisDoes !== undefined) updates.whatThisDoes = whatThisDoes?.trim() || null;
    if (whyThisExists !== undefined) updates.whyThisExists = whyThisExists?.trim() || null;
    if (notIncluded !== undefined) updates.notIncluded = notIncluded ? JSON.stringify(notIncluded) : null;
    if (acceptanceCriteria !== undefined) updates.acceptanceCriteria = acceptanceCriteria ? JSON.stringify(acceptanceCriteria) : null;
    if (status !== undefined) updates.status = status;
    if (priority !== undefined) updates.priority = priority;
    if (tags !== undefined) updates.tags = tags ? JSON.stringify(tags) : null;

    await db
      .update(requirements)
      .set(updates)
      .where(eq(requirements.id, id));

    // Mark previous version as superseded
    await db
      .update(requirementVersions)
      .set({ status: 'superseded' })
      .where(eq(requirementVersions.requirementId, id));

    // Get updated requirement
    const updated = await db
      .select()
      .from(requirements)
      .where(eq(requirements.id, id))
      .limit(1);

    // Create new version
    const versionId = uuidv4();
    await db.insert(requirementVersions).values({
      id: versionId,
      requirementId: id,
      versionNumber: newVersion,
      snapshot: JSON.stringify(updated[0]),
      changeSummary: changeSummary || 'Updated',
      changedBy,
      changedAt: now,
      status: 'active',
    });

    return NextResponse.json(updated[0]);
  } catch (error) {
    console.error('Error updating requirement:', error);
    return NextResponse.json({ error: 'Failed to update requirement' }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    await db.delete(requirements).where(eq(requirements.id, id));
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting requirement:', error);
    return NextResponse.json({ error: 'Failed to delete requirement' }, { status: 500 });
  }
}
