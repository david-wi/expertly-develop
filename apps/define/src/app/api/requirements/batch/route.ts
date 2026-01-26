import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { db } from '@/lib/db';
import { requirements, requirementVersions, products } from '@/lib/db/schema';
import { eq, sql, and, isNull } from 'drizzle-orm';
import { v4 as uuidv4 } from 'uuid';

interface BatchRequirement {
  tempId: string;
  title: string;
  whatThisDoes?: string;
  whyThisExists?: string;
  notIncluded?: string;
  acceptanceCriteria?: string;
  status?: string;
  priority?: string;
  tags?: string[];
  parentRef?: string; // Either existing requirement ID or another tempId
}

// Generate stable key for a product using its prefix
async function generateStableKey(productId: string, productPrefix: string, offset: number = 0): Promise<string> {
  const result = await db
    .select({ count: sql<number>`count(*)` })
    .from(requirements)
    .where(eq(requirements.productId, productId));

  const count = (result[0]?.count || 0) + offset;
  return `${productPrefix}-${String(count + 1).padStart(3, '0')}`;
}

export async function POST(request: NextRequest) {
  try {
    // Verify authentication
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { productId, requirements: reqList } = body as {
      productId: string;
      requirements: BatchRequirement[];
    };

    if (!productId || !reqList || !Array.isArray(reqList) || reqList.length === 0) {
      return NextResponse.json(
        { error: 'productId and requirements array are required' },
        { status: 400 }
      );
    }

    // Verify product exists and get its prefix
    const product = await db
      .select()
      .from(products)
      .where(eq(products.id, productId))
      .limit(1);

    if (product.length === 0) {
      return NextResponse.json({ error: 'Product not found' }, { status: 404 });
    }

    const productPrefix = product[0].prefix;
    const now = new Date().toISOString();
    const changedBy = user.name || user.email || 'User';

    // Map tempId -> real ID for parent references
    const tempIdMap = new Map<string, string>();

    // Get existing requirement IDs to distinguish between tempIds and real IDs
    const existingReqs = await db
      .select({ id: requirements.id })
      .from(requirements)
      .where(eq(requirements.productId, productId));
    const existingIds = new Set(existingReqs.map((r) => r.id));

    // Track created requirements for response
    const createdRequirements: any[] = [];

    // Process requirements in order (assumes parent refs come before children)
    for (let i = 0; i < reqList.length; i++) {
      const req = reqList[i];

      // Generate IDs
      const requirementId = uuidv4();
      tempIdMap.set(req.tempId, requirementId);

      const stableKey = await generateStableKey(productId, productPrefix, i);

      // Resolve parent ID
      let parentId: string | null = null;
      if (req.parentRef) {
        if (existingIds.has(req.parentRef)) {
          // It's an existing requirement ID
          parentId = req.parentRef;
        } else if (tempIdMap.has(req.parentRef)) {
          // It's a tempId from a previously created requirement in this batch
          parentId = tempIdMap.get(req.parentRef)!;
        }
        // If neither, parentRef is invalid - treat as root level
      }

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

      const newRequirement = {
        id: requirementId,
        productId,
        parentId,
        stableKey,
        title: req.title.trim(),
        whatThisDoes: req.whatThisDoes?.trim() || null,
        whyThisExists: req.whyThisExists?.trim() || null,
        notIncluded: req.notIncluded?.trim() || null,
        acceptanceCriteria: req.acceptanceCriteria?.trim() || null,
        status: req.status || 'draft',
        priority: req.priority || 'medium',
        tags: req.tags ? JSON.stringify(req.tags) : null,
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
        changeSummary: 'Bulk import creation',
        changedBy,
        changedAt: now,
        status: 'active',
      });

      createdRequirements.push({
        ...newRequirement,
        tempId: req.tempId,
      });
    }

    // Return created requirements with ID mapping
    return NextResponse.json({
      created: createdRequirements,
      idMapping: Object.fromEntries(tempIdMap),
    }, { status: 201 });
  } catch (error) {
    console.error('Error creating requirements batch:', error);
    return NextResponse.json({ error: 'Failed to create requirements' }, { status: 500 });
  }
}
