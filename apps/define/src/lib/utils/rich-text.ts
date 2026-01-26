import type { JSONContent } from '@tiptap/react';

/**
 * Check if content is Tiptap JSON format
 */
export function isRichTextJson(content: string | null | undefined): boolean {
  if (!content) return false;

  try {
    const parsed = JSON.parse(content);
    return parsed && typeof parsed === 'object' && parsed.type === 'doc';
  } catch {
    return false;
  }
}

/**
 * Parse content - returns Tiptap JSON if valid, null otherwise
 */
export function parseRichTextJson(content: string | null | undefined): JSONContent | null {
  if (!content) return null;

  try {
    const parsed = JSON.parse(content);
    if (parsed && typeof parsed === 'object' && parsed.type === 'doc') {
      return parsed as JSONContent;
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * Convert plain text to Tiptap JSON format
 */
export function convertPlainTextToTiptap(text: string | null | undefined): JSONContent {
  if (!text) {
    return {
      type: 'doc',
      content: [{ type: 'paragraph' }],
    };
  }

  // Split by newlines and create paragraphs
  const lines = text.split('\n');
  const content: JSONContent[] = lines.map((line) => {
    if (!line.trim()) {
      return { type: 'paragraph' };
    }

    // Check if it's a bullet point
    if (line.trim().startsWith('- ') || line.trim().startsWith('* ') || line.trim().startsWith('• ')) {
      const bulletText = line.trim().slice(2);
      return {
        type: 'bulletList',
        content: [{
          type: 'listItem',
          content: [{
            type: 'paragraph',
            content: bulletText ? [{ type: 'text', text: bulletText }] : [],
          }],
        }],
      };
    }

    return {
      type: 'paragraph',
      content: [{ type: 'text', text: line }],
    };
  });

  // Merge consecutive bullet lists
  const mergedContent: JSONContent[] = [];
  for (const node of content) {
    const lastNode = mergedContent[mergedContent.length - 1];
    if (node.type === 'bulletList' && lastNode?.type === 'bulletList') {
      lastNode.content = [...(lastNode.content || []), ...(node.content || [])];
    } else {
      mergedContent.push(node);
    }
  }

  return {
    type: 'doc',
    content: mergedContent.length > 0 ? mergedContent : [{ type: 'paragraph' }],
  };
}

/**
 * Extract plain text from Tiptap JSON (for search/preview)
 */
export function extractPlainText(content: string | null | undefined): string {
  if (!content) return '';

  // If it's not JSON, return as-is
  if (!isRichTextJson(content)) {
    return content;
  }

  try {
    const parsed = JSON.parse(content) as JSONContent;
    return extractTextFromNode(parsed);
  } catch {
    return content;
  }
}

function extractTextFromNode(node: JSONContent): string {
  let text = '';

  if (node.type === 'text' && node.text) {
    text += node.text;
  }

  if (node.content) {
    for (const child of node.content) {
      text += extractTextFromNode(child);
    }
  }

  // Add newlines after block elements
  if (['paragraph', 'heading', 'listItem'].includes(node.type || '')) {
    text += '\n';
  }

  return text;
}

/**
 * Serialize Tiptap JSON to string for storage
 */
export function serializeRichText(content: JSONContent): string {
  return JSON.stringify(content);
}

/**
 * Get content for editor - auto-converts plain text to Tiptap JSON
 */
export function getEditorContent(content: string | null | undefined): JSONContent {
  if (!content) {
    return {
      type: 'doc',
      content: [{ type: 'paragraph' }],
    };
  }

  const parsed = parseRichTextJson(content);
  if (parsed) {
    return parsed;
  }

  // Convert plain text to Tiptap format
  return convertPlainTextToTiptap(content);
}

/**
 * Check if content is empty (either null, empty string, or empty Tiptap doc)
 */
export function isContentEmpty(content: string | null | undefined): boolean {
  if (!content) return true;

  const parsed = parseRichTextJson(content);
  if (!parsed) {
    return content.trim() === '';
  }

  // Check if Tiptap doc is empty
  if (!parsed.content || parsed.content.length === 0) return true;
  if (parsed.content.length === 1) {
    const firstNode = parsed.content[0];
    if (firstNode.type === 'paragraph' && (!firstNode.content || firstNode.content.length === 0)) {
      return true;
    }
  }

  return false;
}
