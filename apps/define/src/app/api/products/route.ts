import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { products, requirements } from '@/lib/db/schema';
import { eq, sql } from 'drizzle-orm';
import { v4 as uuidv4 } from 'uuid';

export async function GET() {
  try {
    const productList = await db
      .select({
        id: products.id,
        name: products.name,
        prefix: products.prefix,
        description: products.description,
        createdAt: products.createdAt,
        updatedAt: products.updatedAt,
        requirementCount: sql<number>`count(${requirements.id})`.as('requirement_count'),
      })
      .from(products)
      .leftJoin(requirements, eq(products.id, requirements.productId))
      .groupBy(products.id)
      .orderBy(products.name);

    return NextResponse.json(productList);
  } catch (error) {
    console.error('Error fetching products:', error);
    return NextResponse.json({ error: 'Failed to fetch products' }, { status: 500 });
  }
}

// Generate a suggested prefix from product name (e.g., "Expertly Define" -> "ED")
function generatePrefix(name: string): string {
  const words = name.trim().split(/\s+/);
  if (words.length === 1) {
    // Single word: take first 3 letters
    return words[0].substring(0, 3).toUpperCase();
  }
  // Multiple words: take first letter of each word (up to 4)
  return words
    .slice(0, 4)
    .map((w) => w[0])
    .join('')
    .toUpperCase();
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { name, prefix, description } = body;

    if (!name || typeof name !== 'string') {
      return NextResponse.json({ error: 'Name is required' }, { status: 400 });
    }

    // Use provided prefix or generate one
    const finalPrefix = prefix?.trim().toUpperCase() || generatePrefix(name);

    // Check if prefix is already in use
    const existing = await db
      .select({ id: products.id })
      .from(products)
      .where(eq(products.prefix, finalPrefix))
      .limit(1);

    if (existing.length > 0) {
      return NextResponse.json({ error: `Prefix "${finalPrefix}" is already in use` }, { status: 400 });
    }

    const now = new Date().toISOString();
    const newProduct = {
      id: uuidv4(),
      name: name.trim(),
      prefix: finalPrefix,
      description: description?.trim() || null,
      createdAt: now,
      updatedAt: now,
    };

    await db.insert(products).values(newProduct);

    return NextResponse.json(newProduct, { status: 201 });
  } catch (error) {
    console.error('Error creating product:', error);
    return NextResponse.json({ error: 'Failed to create product' }, { status: 500 });
  }
}
