import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { db } from '@/lib/db';
import { jiraSettings } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { v4 as uuidv4 } from 'uuid';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ productId: string }> }
) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { productId } = await params;

    const settings = await db.query.jiraSettings.findFirst({
      where: eq(jiraSettings.productId, productId),
    });

    if (!settings) {
      return NextResponse.json({ settings: null });
    }

    // Don't expose the full API token - just indicate it's set
    return NextResponse.json({
      settings: {
        id: settings.id,
        productId: settings.productId,
        jiraHost: settings.jiraHost,
        jiraEmail: settings.jiraEmail,
        hasApiToken: !!settings.jiraApiToken,
        defaultProjectKey: settings.defaultProjectKey,
        createdAt: settings.createdAt,
        updatedAt: settings.updatedAt,
      },
    });
  } catch (error) {
    console.error('Error fetching Jira settings:', error);
    return NextResponse.json(
      { error: 'Failed to fetch Jira settings' },
      { status: 500 }
    );
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ productId: string }> }
) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { productId } = await params;
    const body = await request.json();
    const { jiraHost, jiraEmail, jiraApiToken, defaultProjectKey } = body;

    if (!jiraHost || !jiraEmail || !defaultProjectKey) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    const now = new Date().toISOString();

    // Check if settings already exist
    const existing = await db.query.jiraSettings.findFirst({
      where: eq(jiraSettings.productId, productId),
    });

    if (existing) {
      // Update existing settings
      const updateData: any = {
        jiraHost,
        jiraEmail,
        defaultProjectKey,
        updatedAt: now,
      };
      // Only update token if provided
      if (jiraApiToken) {
        updateData.jiraApiToken = jiraApiToken;
      }

      await db
        .update(jiraSettings)
        .set(updateData)
        .where(eq(jiraSettings.id, existing.id));

      return NextResponse.json({ success: true, id: existing.id });
    } else {
      // Create new settings
      if (!jiraApiToken) {
        return NextResponse.json(
          { error: 'API token is required for new settings' },
          { status: 400 }
        );
      }

      const id = uuidv4();
      await db.insert(jiraSettings).values({
        id,
        productId,
        jiraHost,
        jiraEmail,
        jiraApiToken,
        defaultProjectKey,
        createdAt: now,
        updatedAt: now,
      });

      return NextResponse.json({ success: true, id });
    }
  } catch (error) {
    console.error('Error updating Jira settings:', error);
    return NextResponse.json(
      { error: 'Failed to update Jira settings' },
      { status: 500 }
    );
  }
}
