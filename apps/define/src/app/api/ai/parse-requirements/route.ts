import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import Anthropic from '@anthropic-ai/sdk';
import { db } from '@/lib/db';
import { requirements } from '@/lib/db/schema';
import { inArray } from 'drizzle-orm';

// Dynamic import for pdf-parse (it has issues with static imports in Next.js)
async function extractPdfText(base64Content: string): Promise<string> {
  try {
    const pdfParse = (await import('pdf-parse')).default;
    const buffer = Buffer.from(base64Content, 'base64');
    const data = await pdfParse(buffer);
    return data.text;
  } catch (error) {
    console.error('Error extracting PDF text:', error);
    return '[PDF content could not be extracted]';
  }
}

interface ExistingRequirement {
  id: string;
  stableKey: string;
  title: string;
  parentId: string | null;
}

interface FileContent {
  name: string;
  type: string;
  content: string; // base64 for images/PDFs, text for text files
}

interface ContextUrl {
  url: string;
  title: string;
  content: string;
}

interface ParsedRequirement {
  tempId: string;
  title: string;
  whatThisDoes: string;
  whyThisExists: string;
  notIncluded: string;
  acceptanceCriteria: string;
  priority: string;
  tags: string[];
  parentRef: string | null;
}

// Build an indented tree representation of existing requirements
function buildTreeText(requirements: ExistingRequirement[]): string {
  const map = new Map<string, ExistingRequirement[]>();
  const roots: ExistingRequirement[] = [];

  requirements.forEach((req) => {
    if (req.parentId) {
      const children = map.get(req.parentId) || [];
      children.push(req);
      map.set(req.parentId, children);
    } else {
      roots.push(req);
    }
  });

  function render(items: ExistingRequirement[], indent: number): string {
    return items
      .map((item) => {
        const prefix = '  '.repeat(indent);
        const children = map.get(item.id) || [];
        const childText = children.length > 0 ? '\n' + render(children, indent + 1) : '';
        return `${prefix}- [${item.stableKey}] ${item.title} (id: ${item.id})${childText}`;
      })
      .join('\n');
  }

  return roots.length > 0 ? render(roots, 0) : '(No existing requirements)';
}

export async function POST(request: NextRequest) {
  try {
    // Verify authentication
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const {
      description,
      files,
      existingRequirements,
      targetParentId,
      productName,
      contextUrls,
      relatedRequirementIds,
    } = body as {
      description: string;
      files?: FileContent[];
      existingRequirements: ExistingRequirement[];
      targetParentId?: string;
      productName: string;
      contextUrls?: ContextUrl[];
      relatedRequirementIds?: string[];
    };

    if (!description || !description.trim()) {
      return NextResponse.json(
        { error: 'Description is required' },
        { status: 400 }
      );
    }

    // Build context about existing tree structure
    const treeText = buildTreeText(existingRequirements);

    // Process files - extract text from PDFs, prepare images for vision
    let fileContext = '';
    const imageBlocks: Anthropic.ImageBlockParam[] = [];

    if (files && files.length > 0) {
      for (const file of files) {
        if (file.type.startsWith('image/')) {
          // Images will be sent to Claude Vision
          imageBlocks.push({
            type: 'image',
            source: {
              type: 'base64',
              media_type: file.type as 'image/jpeg' | 'image/png' | 'image/gif' | 'image/webp',
              data: file.content,
            },
          });
        } else if (file.type === 'application/pdf') {
          // Extract text from PDF
          const pdfText = await extractPdfText(file.content);
          fileContext += `\n\n--- File: ${file.name} (PDF) ---\n${pdfText}`;
        } else {
          // Plain text files - content is already text
          fileContext += `\n\n--- File: ${file.name} ---\n${file.content}`;
        }
      }
    }

    // Build URL context section
    let urlContext = '';
    if (contextUrls && contextUrls.length > 0) {
      urlContext = '\n\n--- External Context (from URLs) ---';
      for (const urlItem of contextUrls) {
        urlContext += `\n\n[${urlItem.title}] (${urlItem.url})\n${urlItem.content.substring(0, 3000)}`;
        if (urlItem.content.length > 3000) {
          urlContext += '\n... (content truncated)';
        }
      }
    }

    // Build related requirements context section
    let relatedReqsContext = '';
    if (relatedRequirementIds && relatedRequirementIds.length > 0) {
      // Fetch full details of related requirements from database
      const relatedReqs = await db
        .select()
        .from(requirements)
        .where(inArray(requirements.id, relatedRequirementIds));

      if (relatedReqs.length > 0) {
        relatedReqsContext = '\n\n--- Related Requirements for Context ---';
        relatedReqsContext += '\nUse these existing requirements as context to ensure consistency in terminology and avoid duplicating functionality:\n';

        for (const req of relatedReqs) {
          relatedReqsContext += `\n[${req.stableKey}] ${req.title}`;
          if (req.whatThisDoes) {
            relatedReqsContext += `\n  - What it does: ${req.whatThisDoes}`;
          }
          if (req.whyThisExists) {
            relatedReqsContext += `\n  - Why it exists: ${req.whyThisExists}`;
          }
          if (req.acceptanceCriteria) {
            relatedReqsContext += `\n  - Acceptance criteria: ${req.acceptanceCriteria.substring(0, 200)}`;
            if (req.acceptanceCriteria.length > 200) {
              relatedReqsContext += '...';
            }
          }
          relatedReqsContext += '\n';
        }
      }
    }

    // Build the system prompt
    const systemPrompt = `You are an expert requirements analyst. Your job is to parse user descriptions and create well-structured software requirements.

When creating requirements:
1. Each requirement should have a clear, actionable title
2. "whatThisDoes" should be a single sentence starting with "Users can..."
3. "whyThisExists" explains the business value in 1-2 sentences
4. "notIncluded" lists scope exclusions as bullet points (use \\n between bullets)
5. "acceptanceCriteria" lists testable criteria as bullet points (use \\n between bullets)
6. Priority should be: critical, high, medium, or low
7. Tags should be from: functional, nonfunctional, security, performance, usability, invariant

For hierarchical structure:
- Create parent requirements for major features
- Create child requirements for sub-features
- Use parentRef to link children to parents (either an existing ID or a tempId from another requirement you're creating)

When provided with external context (URLs or related requirements):
- Use the terminology and patterns from the context
- Avoid duplicating existing functionality
- Ensure new requirements complement rather than conflict with existing ones
- Reference relevant context when it informs your decisions

Respond ONLY with a valid JSON array of requirements. No explanation or markdown.`;

    const targetInfo = targetParentId
      ? `\nTarget parent: Place new requirements under the requirement with ID "${targetParentId}"`
      : '\nTarget: Create at root level (no parent) unless the structure suggests nesting.';

    const userPromptText = `Product: "${productName}"

Existing requirements tree:
${treeText}
${targetInfo}
${urlContext}
${relatedReqsContext}

User's description of new requirements:
${description}
${fileContext ? `\n\nAdditional context from files:${fileContext}` : ''}
${imageBlocks.length > 0 ? '\n\n(See attached images for additional context)' : ''}

Generate structured requirements based on this input. Return a JSON array with this exact structure:
[
  {
    "tempId": "temp-1",
    "title": "...",
    "whatThisDoes": "Users can...",
    "whyThisExists": "...",
    "notIncluded": "- Point 1\\n- Point 2",
    "acceptanceCriteria": "- Criterion 1\\n- Criterion 2",
    "priority": "medium",
    "tags": ["functional"],
    "parentRef": null
  }
]

For child requirements, set parentRef to either:
- An existing requirement ID from the tree above
- Another tempId from this batch (e.g., "temp-1" if this is a child of the first requirement)

Respond with ONLY the JSON array, no other text.`;

    // Build content blocks for the message
    const contentBlocks: Anthropic.ContentBlockParam[] = [];

    // Add images first if any
    for (const imageBlock of imageBlocks) {
      contentBlocks.push(imageBlock);
    }

    // Add the text prompt
    contentBlocks.push({
      type: 'text',
      text: userPromptText,
    });

    // Initialize Anthropic client and call Claude with multimodal support
    const anthropic = new Anthropic();
    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 4096,
      system: systemPrompt,
      messages: [
        {
          role: 'user',
          content: contentBlocks,
        },
      ],
    });

    // Extract text from response
    const textBlock = response.content.find((block) => block.type === 'text');
    if (!textBlock || textBlock.type !== 'text') {
      return NextResponse.json(
        { error: 'No text response from AI' },
        { status: 500 }
      );
    }

    const text = textBlock.text;

    // Parse the JSON response
    const jsonMatch = text.match(/\[[\s\S]*\]/);
    if (!jsonMatch) {
      console.error('Failed to parse AI response:', text);
      return NextResponse.json(
        { error: 'Failed to parse AI response' },
        { status: 500 }
      );
    }

    try {
      const parsedRequirements: ParsedRequirement[] = JSON.parse(jsonMatch[0]);

      // Validate structure
      if (!Array.isArray(parsedRequirements)) {
        throw new Error('Response is not an array');
      }

      // Ensure each requirement has required fields
      parsedRequirements.forEach((req, index) => {
        if (!req.tempId) {
          req.tempId = `temp-${index + 1}`;
        }
        if (!req.title) {
          throw new Error(`Requirement ${index} missing title`);
        }
        if (!req.priority) {
          req.priority = 'medium';
        }
        if (!req.tags) {
          req.tags = ['functional'];
        }
      });

      return NextResponse.json({ requirements: parsedRequirements });
    } catch (parseError) {
      console.error('JSON parse error:', parseError, 'Raw text:', text);
      return NextResponse.json(
        { error: 'Failed to parse requirements from AI response' },
        { status: 500 }
      );
    }
  } catch (error) {
    console.error('Error parsing requirements:', error);
    return NextResponse.json(
      { error: 'Failed to parse requirements' },
      { status: 500 }
    );
  }
}
