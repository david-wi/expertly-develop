import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { db } from '@/lib/db';
import { jiraStoryDrafts, requirements } from '@/lib/db/schema';
import { eq, and } from 'drizzle-orm';
import { v4 as uuidv4 } from 'uuid';
import { anthropic } from '@ai-sdk/anthropic';
import { generateText } from 'ai';

// AI config types
interface AIUseCaseConfig {
  use_case: string;
  model_id: string;
  max_tokens: number;
  temperature: number;
}

interface AIConfigResponse {
  use_cases: AIUseCaseConfig[];
}

// Cache for AI config
let aiConfigCache: AIConfigResponse | null = null;
let aiConfigCacheTime = 0;
const AI_CONFIG_CACHE_TTL = 5 * 60 * 1000; // 5 minutes

async function getAIConfig(): Promise<AIConfigResponse> {
  const now = Date.now();
  if (aiConfigCache && now - aiConfigCacheTime < AI_CONFIG_CACHE_TTL) {
    return aiConfigCache;
  }

  const adminApiUrl = process.env.ADMIN_API_URL || 'https://admin-api.ai.devintensive.com';
  try {
    const response = await fetch(`${adminApiUrl}/api/public/ai-config`, {
      next: { revalidate: 300 },
    });
    if (response.ok) {
      aiConfigCache = await response.json();
      aiConfigCacheTime = now;
      return aiConfigCache!;
    }
  } catch (error) {
    console.warn('Failed to fetch AI config from Admin API:', error);
  }

  // Fallback to defaults
  return {
    use_cases: [
      { use_case: 'jira_generation', model_id: 'claude-sonnet-4-0-latest', max_tokens: 4096, temperature: 0.5 },
    ],
  };
}

async function getModelForUseCase(useCase: string): Promise<AIUseCaseConfig> {
  const config = await getAIConfig();
  const useCaseConfig = config.use_cases.find((uc) => uc.use_case === useCase);
  if (useCaseConfig) {
    return useCaseConfig;
  }
  // Default fallback
  return { use_case: useCase, model_id: 'claude-sonnet-4-0-latest', max_tokens: 4096, temperature: 0.7 };
}

// GET - List all drafts for a product
export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const productId = searchParams.get('productId');

    if (!productId) {
      return NextResponse.json(
        { error: 'productId is required' },
        { status: 400 }
      );
    }

    const drafts = await db.query.jiraStoryDrafts.findMany({
      where: eq(jiraStoryDrafts.productId, productId),
    });

    // Get associated requirements for each draft
    const draftsWithRequirements = await Promise.all(
      drafts.map(async (draft) => {
        let requirement = null;
        if (draft.requirementId) {
          requirement = await db.query.requirements.findFirst({
            where: eq(requirements.id, draft.requirementId),
          });
        }
        return {
          ...draft,
          labels: draft.labels ? JSON.parse(draft.labels) : [],
          requirement: requirement
            ? {
                id: requirement.id,
                stableKey: requirement.stableKey,
                title: requirement.title,
              }
            : null,
        };
      })
    );

    return NextResponse.json({ drafts: draftsWithRequirements });
  } catch (error) {
    console.error('Error fetching Jira drafts:', error);
    return NextResponse.json(
      { error: 'Failed to fetch Jira drafts' },
      { status: 500 }
    );
  }
}

// POST - Generate new drafts from a requirement using AI
export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { requirementId, productId } = body;

    if (!requirementId || !productId) {
      return NextResponse.json(
        { error: 'requirementId and productId are required' },
        { status: 400 }
      );
    }

    // Fetch the requirement
    const requirement = await db.query.requirements.findFirst({
      where: eq(requirements.id, requirementId),
    });

    if (!requirement) {
      return NextResponse.json(
        { error: 'Requirement not found' },
        { status: 404 }
      );
    }

    // Use AI to generate Jira stories
    const systemPrompt = `You are an expert at converting software requirements into well-structured Jira stories for agile development teams.

When creating Jira stories:
1. Each story should be a deliverable piece of work that can be completed in a sprint
2. Break down large requirements into multiple smaller stories if needed
3. Write clear, actionable story summaries (titles)
4. Include comprehensive descriptions with:
   - Context and background
   - Acceptance criteria (use Jira's standard format)
   - Technical notes if applicable
5. Estimate story points based on complexity (1, 2, 3, 5, 8, 13)
6. Suggest appropriate labels based on the requirement type

Respond ONLY with a valid JSON array of stories. No explanation or markdown.`;

    const userPrompt = `Convert this requirement into Jira stories:

**Requirement ID:** ${requirement.stableKey}
**Title:** ${requirement.title}

**What this does:**
${requirement.whatThisDoes || 'Not specified'}

**Why this exists:**
${requirement.whyThisExists || 'Not specified'}

**Not included:**
${requirement.notIncluded || 'Not specified'}

**Acceptance Criteria:**
${requirement.acceptanceCriteria || 'Not specified'}

**Priority:** ${requirement.priority}
**Tags:** ${requirement.tags || 'None'}

Generate Jira stories as a JSON array with this structure:
[
  {
    "summary": "Story title - clear and actionable",
    "description": "Full description with context, acceptance criteria, and technical notes formatted for Jira",
    "issueType": "Story",
    "priority": "Medium",
    "labels": ["label1", "label2"],
    "storyPoints": 3
  }
]

Priority mapping: critical -> Highest, high -> High, medium -> Medium, low -> Low

Return ONLY the JSON array.`;

    // Get model configuration from Admin API
    const modelConfig = await getModelForUseCase('jira_generation');

    const { text } = await generateText({
      model: anthropic(modelConfig.model_id),
      system: systemPrompt,
      prompt: userPrompt,
    });

    // Parse the JSON response
    const jsonMatch = text.match(/\[[\s\S]*\]/);
    if (!jsonMatch) {
      console.error('Failed to parse AI response:', text);
      return NextResponse.json(
        { error: 'Failed to generate stories from AI' },
        { status: 500 }
      );
    }

    const generatedStories = JSON.parse(jsonMatch[0]);
    const now = new Date().toISOString();

    // Create drafts in database
    const createdDrafts = [];
    for (const story of generatedStories) {
      const id = uuidv4();
      await db.insert(jiraStoryDrafts).values({
        id,
        productId,
        requirementId,
        summary: story.summary,
        description: story.description,
        issueType: story.issueType || 'Story',
        priority: story.priority || 'Medium',
        labels: JSON.stringify(story.labels || []),
        storyPoints: story.storyPoints || null,
        status: 'draft',
        createdAt: now,
        updatedAt: now,
      });

      createdDrafts.push({
        id,
        ...story,
        status: 'draft',
        requirementId,
        requirement: {
          id: requirement.id,
          stableKey: requirement.stableKey,
          title: requirement.title,
        },
      });
    }

    return NextResponse.json({ drafts: createdDrafts });
  } catch (error) {
    console.error('Error generating Jira drafts:', error);
    return NextResponse.json(
      { error: 'Failed to generate Jira drafts' },
      { status: 500 }
    );
  }
}
