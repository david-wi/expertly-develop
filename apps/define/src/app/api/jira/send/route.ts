import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { db } from '@/lib/db';
import { jiraStoryDrafts, jiraSettings, deliveryLinks } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
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

  // Map priority names to Jira priority IDs (these may vary by Jira instance)
  const priorityMap: Record<string, string> = {
    Highest: '1',
    High: '2',
    Medium: '3',
    Low: '4',
    Lowest: '5',
  };

  const labels = draft.labels ? JSON.parse(draft.labels) : [];

  // Build the issue fields
  const fields: any = {
    project: { key: settings.defaultProjectKey },
    summary: draft.summary,
    issuetype: { name: draft.issueType },
    priority: { id: priorityMap[draft.priority] || '3' },
    labels: labels,
  };

  // Add description if present (using Atlassian Document Format)
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

  // Add story points if present (field name varies by Jira configuration)
  // Common field names: customfield_10016, customfield_10026, story points, etc.
  // For now, we'll skip this as it requires knowing the custom field ID

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
      console.error('Jira API error:', response.status, errorText);
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
    console.error('Error calling Jira API:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

// POST - Send a single draft to Jira
export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { draftId } = body;

    if (!draftId) {
      return NextResponse.json(
        { error: 'draftId is required' },
        { status: 400 }
      );
    }

    // Fetch the draft
    const draft = await db.query.jiraStoryDrafts.findFirst({
      where: eq(jiraStoryDrafts.id, draftId),
    });

    if (!draft) {
      return NextResponse.json({ error: 'Draft not found' }, { status: 404 });
    }

    if (draft.status === 'sent') {
      return NextResponse.json(
        { error: 'This draft has already been sent to Jira' },
        { status: 400 }
      );
    }

    // Fetch Jira settings for this product
    const settings = await db.query.jiraSettings.findFirst({
      where: eq(jiraSettings.productId, draft.productId),
    });

    if (!settings) {
      return NextResponse.json(
        { error: 'Jira settings not configured for this product' },
        { status: 400 }
      );
    }

    // Create the issue in Jira
    const result = await createJiraIssue(settings, draft);
    const now = new Date().toISOString();

    if (result.success) {
      // Update draft status
      await db
        .update(jiraStoryDrafts)
        .set({
          status: 'sent',
          jiraIssueKey: result.key,
          jiraUrl: result.url,
          errorMessage: null,
          updatedAt: now,
        })
        .where(eq(jiraStoryDrafts.id, draftId));

      // If this draft has an associated requirement, create a delivery link
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

      return NextResponse.json({
        success: true,
        jiraIssueKey: result.key,
        jiraUrl: result.url,
      });
    } else {
      // Update draft with error
      await db
        .update(jiraStoryDrafts)
        .set({
          status: 'failed',
          errorMessage: result.error,
          updatedAt: now,
        })
        .where(eq(jiraStoryDrafts.id, draftId));

      return NextResponse.json(
        { error: result.error },
        { status: 500 }
      );
    }
  } catch (error) {
    console.error('Error sending to Jira:', error);
    return NextResponse.json(
      { error: 'Failed to send to Jira' },
      { status: 500 }
    );
  }
}
