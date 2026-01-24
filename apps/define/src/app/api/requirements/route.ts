import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requirements, requirementVersions, products } from '@/lib/db/schema';
import { eq, sql, and, isNull } from 'drizzle-orm';
import { v4 as uuidv4 } from 'uuid';

// Generate stable key for a product
async function generateStableKey(productId: string): Promise<string> {
  const result = await db
    .select({ count: sql<number>`count(*)` })
    .from(requirements)
    .where(eq(requirements.productId, productId));

  const count = result[0]?.count || 0;
  return `REQ-${String(count + 1).padStart(3, '0')}`;
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const productId = searchParams.get('productId');

    if (!productId) {
      return NextResponse.json({ error: 'productId is required' }, { status: 400 });
    }

    const requirementList = await db
      .select()
      .from(requirements)
      .where(eq(requirements.productId, productId))
      .orderBy(requirements.orderIndex);

    return NextResponse.json(requirementList);
  } catch (error) {
    console.error('Error fetching requirements:', error);
    return NextResponse.json({ error: 'Failed to fetch requirements' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      productId,
      parentId,
      title,
      whatThisDoes,
      whyThisExists,
      notIncluded,
      acceptanceCriteria,
      status = 'draft',
      priority = 'medium',
      tags,
    } = body;

    if (!productId || !title) {
      return NextResponse.json({ error: 'productId and title are required' }, { status: 400 });
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

    const now = new Date().toISOString();
    const stableKey = await generateStableKey(productId);

    // Get max order index for siblings
    const siblings = await db
      .select({ maxOrder: sql<number>`max(${requirements.orderIndex})` })
      .from(requirements)
      .where(
        parentId
          ? and(eq(requirements.productId, productId), eq(requirements.parentId, parentId))
          : and(eq(requirements.productId, productId), isNull(requirements.parentId))
      );

    const orderIndex = (siblings[0]?.maxOrder ?? -1) + 1;

    const requirementId = uuidv4();
    const newRequirement = {
      id: requirementId,
      productId,
      parentId: parentId || null,
      stableKey,
      title: title.trim(),
      whatThisDoes: whatThisDoes?.trim() || null,
      whyThisExists: whyThisExists?.trim() || null,
      notIncluded: notIncluded ? JSON.stringify(notIncluded) : null,
      acceptanceCriteria: acceptanceCriteria ? JSON.stringify(acceptanceCriteria) : null,
      status,
      priority,
      tags: tags ? JSON.stringify(tags) : null,
      orderIndex,
      currentVersion: 1,
      createdAt: now,
      updatedAt: now,
    };

    await db.insert(requirements).values(newRequirement);

    // Create initial version
    const versionId = uuidv4();
    await db.insert(requirementVersions).values({
      id: versionId,
      requirementId,
      versionNumber: 1,
      snapshot: JSON.stringify(newRequirement),
      changeSummary: 'Initial creation',
      changedBy: 'System',
      changedAt: now,
      status: 'active',
    });

    return NextResponse.json(newRequirement, { status: 201 });
  } catch (error) {
    console.error('Error creating requirement:', error);
    return NextResponse.json({ error: 'Failed to create requirement' }, { status: 500 });
  }
}
