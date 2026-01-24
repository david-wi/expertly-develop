import { NextRequest, NextResponse } from 'next/server';
import { anthropic } from '@ai-sdk/anthropic';
import { generateText } from 'ai';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { type, context, productName } = body;

    if (!type || !context) {
      return NextResponse.json({ error: 'type and context are required' }, { status: 400 });
    }

    let prompt = '';

    switch (type) {
      case 'requirement':
        prompt = `You are helping create requirements for a product called "${productName || 'the product'}".

Based on this input: "${context}"

Generate a well-structured requirement with:
1. A clear title (short, actionable)
2. "What this does" - a single sentence starting with "Users can..."
3. "Why this exists" - 1-2 sentences explaining the value
4. "Not included" - 2-3 bullet points of scope exclusions
5. "Acceptance criteria" - 3-5 testable criteria

Respond in JSON format:
{
  "title": "...",
  "whatThisDoes": "Users can...",
  "whyThisExists": "...",
  "notIncluded": ["...", "..."],
  "acceptanceCriteria": ["...", "...", "..."]
}`;
        break;

      case 'acceptance_criteria':
        prompt = `For a requirement about: "${context}"

Suggest 5 acceptance criteria that are:
- Testable and specific
- Cover happy path and edge cases
- Include at least one negative case

Respond in JSON format:
{
  "criteria": ["...", "...", "...", "...", "..."]
}`;
        break;

      case 'subtree':
        prompt = `You are helping break down a feature into sub-requirements for "${productName || 'the product'}".

Feature description: "${context}"

Generate a tree of requirements with a parent and 3-5 children. Each should have:
- title
- whatThisDoes (starting with "Users can...")
- priority (critical, high, medium, or low)

Respond in JSON format:
{
  "parent": {
    "title": "...",
    "whatThisDoes": "...",
    "priority": "..."
  },
  "children": [
    { "title": "...", "whatThisDoes": "...", "priority": "..." }
  ]
}`;
        break;

      default:
        return NextResponse.json({ error: 'Invalid suggestion type' }, { status: 400 });
    }

    const { text } = await generateText({
      model: anthropic('claude-sonnet-4-20250514'),
      prompt,
    });

    // Parse the JSON response
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      return NextResponse.json({ error: 'Failed to parse AI response' }, { status: 500 });
    }

    const suggestion = JSON.parse(jsonMatch[0]);
    return NextResponse.json(suggestion);
  } catch (error) {
    console.error('Error generating suggestion:', error);
    return NextResponse.json({ error: 'Failed to generate suggestion' }, { status: 500 });
  }
}
