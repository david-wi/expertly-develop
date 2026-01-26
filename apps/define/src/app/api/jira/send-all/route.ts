import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { db } from '@/lib/db';
import { jiraStoryDrafts, jiraSettings, deliveryLinks } from '@/lib/db/schema';
import { eq, and } from 'drizzle-orm';
import { v4 as uuidv4 } from 'uuid';

interface JiraCreateIssueResponse {
  id: string;
  key: string;
  self: string;
}

async function createJiraIssue(
  settings: {
    jiraHost: string;
    jiraEmail: string;
    jiraApiToken: string;
    defaultProjectKey: string;
  },
  draft: {
    summary: string;
    description: string | null;
    issueType: string;
    priority: string;
    labels: string | null;
    storyPoints: number | null;
  }
): Promise<{ success: true; key: string; url: string } | { success: false; error: string }> {
  const auth = Buffer.from(`${settings.jiraEmail}:${settings.jiraApiToken}`).toString('base64');

  const priorityMap: Record<string, string> = {
    Highest: '1',
    High: '2',
    Medium: '3',
    Low: '4',
    Lowest: '5',
  };

  const labels = draft.labels ? JSON.parse(draft.labels) : [];

  const fields: any = {
    project: { key: settings.defaultProjectKey },
    summary: draft.summary,
    issuetype: { name: draft.issueType },
    priority: { id: priorityMap[draft.priority] || '3' },
    labels: labels,
  };

  if (draft.description) {
    fields.description = {
      type: 'doc',
      version: 1,
      content: [
        {
          type: 'paragraph',
          content: [
            {
              type: 'text',
              text: draft.description,
            },
          ],
        },
      ],
    };
  }

  try {
    const response = await fetch(
      `https://${settings.jiraHost}/rest/api/3/issue`,
      {
        method: 'POST',
        headers: {
          Authorization: `Basic ${auth}`,
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify({ fields }),
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      return {
        success: false,
        error: `Jira API error: ${response.status} - ${errorText}`,
      };
    }

    const data: JiraCreateIssueResponse = await response.json();
    return {
      success: true,
      key: data.key,
      url: `https://${settings.jiraHost}/browse/${data.key}`,
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

// POST - Send all pending drafts to Jira
export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { productId } = body;

    if (!productId) {
      return NextResponse.json(
        { error: 'productId is required' },
        { status: 400 }
      );
    }

    // Fetch Jira settings
    const settings = await db.query.jiraSettings.findFirst({
      where: eq(jiraSettings.productId, productId),
    });

    if (!settings) {
      return NextResponse.json(
        { error: 'Jira settings not configured for this product' },
        { status: 400 }
      );
    }

    // Fetch all pending drafts (status = 'draft' or 'failed')
    const drafts = await db.query.jiraStoryDrafts.findMany({
      where: and(
        eq(jiraStoryDrafts.productId, productId),
        eq(jiraStoryDrafts.status, 'draft')
      ),
    });

    if (drafts.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'No pending drafts to send',
        results: [],
      });
    }

    const results: Array<{
      draftId: string;
      summary: string;
      success: boolean;
      jiraIssueKey?: string;
      jiraUrl?: string;
      error?: string;
    }> = [];

    for (const draft of drafts) {
      const result = await createJiraIssue(settings, draft);
      const now = new Date().toISOString();

      if (result.success) {
        await db
          .update(jiraStoryDrafts)
          .set({
            status: 'sent',
            jiraIssueKey: result.key,
            jiraUrl: result.url,
            errorMessage: null,
            updatedAt: now,
          })
          .where(eq(jiraStoryDrafts.id, draft.id));

        // Create delivery link if requirement is associated
        if (draft.requirementId) {
          const linkId = uuidv4();
          await db.insert(deliveryLinks).values({
            id: linkId,
            requirementId: draft.requirementId,
            externalId: result.key,
            externalSystem: 'jira',
            intent: 'implements',
            title: draft.summary,
            url: result.url,
          });
        }

        results.push({
          draftId: draft.id,
          summary: draft.summary,
          success: true,
          jiraIssueKey: result.key,
          jiraUrl: result.url,
        });
      } else {
        await db
          .update(jiraStoryDrafts)
          .set({
            status: 'failed',
            errorMessage: result.error,
            updatedAt: now,
          })
          .where(eq(jiraStoryDrafts.id, draft.id));

        results.push({
          draftId: draft.id,
          summary: draft.summary,
          success: false,
          error: result.error,
        });
      }
    }

    const successCount = results.filter((r) => r.success).length;
    const failCount = results.filter((r) => !r.success).length;

    return NextResponse.json({
      success: failCount === 0,
      message: `Sent ${successCount} of ${results.length} stories to Jira${
        failCount > 0 ? ` (${failCount} failed)` : ''
      }`,
      results,
    });
  } catch (error) {
    console.error('Error sending all to Jira:', error);
    return NextResponse.json(
      { error: 'Failed to send stories to Jira' },
      { status: 500 }
    );
  }
}
