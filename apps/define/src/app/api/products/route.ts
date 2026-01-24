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

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { name, description } = body;

    if (!name || typeof name !== 'string') {
      return NextResponse.json({ error: 'Name is required' }, { status: 400 });
    }

    const now = new Date().toISOString();
    const newProduct = {
      id: uuidv4(),
      name: name.trim(),
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
