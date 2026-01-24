import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { releaseSnapshots, requirements, products } from '@/lib/db/schema';
import { eq, desc, sql } from 'drizzle-orm';
import { v4 as uuidv4 } from 'uuid';

export async function GET() {
  try {
    const releases = await db
      .select()
      .from(releaseSnapshots)
      .orderBy(desc(releaseSnapshots.createdAt));

    return NextResponse.json(releases);
  } catch (error) {
    console.error('Error fetching releases:', error);
    return NextResponse.json({ error: 'Failed to fetch releases' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { productId, versionName, description } = body;

    if (!productId || !versionName) {
      return NextResponse.json(
        { error: 'productId and versionName are required' },
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

    // Get all requirements for snapshot
    const productRequirements = await db
      .select()
      .from(requirements)
      .where(eq(requirements.productId, productId));

    // Calculate stats
    const total = productRequirements.length;
    const verified = productRequirements.filter((r) => r.status === 'verified').length;
    const implemented = productRequirements.filter((r) => r.status === 'implemented').length;
    const draft = productRequirements.filter((r) => r.status === 'draft').length;

    const now = new Date().toISOString();
    const newRelease = {
      id: uuidv4(),
      productId,
      versionName: versionName.trim(),
      description: description?.trim() || null,
      requirementsSnapshot: JSON.stringify(productRequirements),
      stats: JSON.stringify({ total, verified, implemented, draft }),
      status: 'draft',
      createdAt: now,
      releasedAt: null,
    };

    await db.insert(releaseSnapshots).values(newRelease);

    return NextResponse.json(newRelease, { status: 201 });
  } catch (error) {
    console.error('Error creating release:', error);
    return NextResponse.json({ error: 'Failed to create release' }, { status: 500 });
  }
}
