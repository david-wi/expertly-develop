import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';

interface FetchedContent {
  success: boolean;
  url: string;
  title?: string;
  content?: string;
  error?: string;
}

// Extract title from HTML
function extractTitle(html: string): string {
  const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
  if (titleMatch) {
    return decodeHtmlEntities(titleMatch[1].trim());
  }

  // Try og:title as fallback
  const ogTitleMatch = html.match(/<meta[^>]*property=["']og:title["'][^>]*content=["']([^"']+)["']/i);
  if (ogTitleMatch) {
    return decodeHtmlEntities(ogTitleMatch[1].trim());
  }

  return '';
}

// Decode HTML entities
function decodeHtmlEntities(text: string): string {
  return text
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, ' ');
}

// Extract main content from HTML, stripping scripts, styles, and HTML tags
function extractMainContent(html: string): string {
  // Remove script and style elements
  let content = html
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
    .replace(/<noscript[^>]*>[\s\S]*?<\/noscript>/gi, '')
    .replace(/<!--[\s\S]*?-->/g, '');

  // Try to find main content areas
  const mainContentPatterns = [
    /<main[^>]*>([\s\S]*?)<\/main>/i,
    /<article[^>]*>([\s\S]*?)<\/article>/i,
    /<div[^>]*class=["'][^"']*content[^"']*["'][^>]*>([\s\S]*?)<\/div>/i,
    /<div[^>]*id=["'][^"']*content[^"']*["'][^>]*>([\s\S]*?)<\/div>/i,
  ];

  for (const pattern of mainContentPatterns) {
    const match = content.match(pattern);
    if (match && match[1] && match[1].length > 200) {
      content = match[1];
      break;
    }
  }

  // If we didn't find a main content area, use the body
  const bodyMatch = content.match(/<body[^>]*>([\s\S]*?)<\/body>/i);
  if (bodyMatch) {
    content = bodyMatch[1];
  }

  // Remove all remaining HTML tags
  content = content.replace(/<[^>]+>/g, ' ');

  // Decode HTML entities
  content = decodeHtmlEntities(content);

  // Normalize whitespace
  content = content
    .replace(/\s+/g, ' ')
    .replace(/\n\s*\n/g, '\n')
    .trim();

  // Truncate if too long (keep first ~10k characters for context)
  if (content.length > 10000) {
    content = content.substring(0, 10000) + '... (content truncated)';
  }

  return content;
}

export async function POST(request: NextRequest) {
  try {
    // Verify authentication
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { url } = body as { url: string };

    if (!url || !url.trim()) {
      return NextResponse.json(
        { error: 'URL is required' },
        { status: 400 }
      );
    }

    // Validate URL format
    let parsedUrl: URL;
    try {
      parsedUrl = new URL(url);
      if (!['http:', 'https:'].includes(parsedUrl.protocol)) {
        throw new Error('Invalid protocol');
      }
    } catch {
      return NextResponse.json(
        { error: 'Invalid URL format' },
        { status: 400 }
      );
    }

    // Fetch the URL content
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Expertly-Define/1.0 (Requirements Management Tool)',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      },
      signal: AbortSignal.timeout(15000), // 15 second timeout
    });

    if (!response.ok) {
      const result: FetchedContent = {
        success: false,
        url,
        error: `Failed to fetch: ${response.status} ${response.statusText}`,
      };
      return NextResponse.json(result);
    }

    const contentType = response.headers.get('content-type') || '';

    // Handle different content types
    if (contentType.includes('application/json')) {
      // JSON content - stringify it
      const json = await response.json();
      const result: FetchedContent = {
        success: true,
        url,
        title: parsedUrl.hostname,
        content: JSON.stringify(json, null, 2).substring(0, 10000),
      };
      return NextResponse.json(result);
    } else if (contentType.includes('text/plain')) {
      // Plain text
      const text = await response.text();
      const result: FetchedContent = {
        success: true,
        url,
        title: parsedUrl.hostname,
        content: text.substring(0, 10000),
      };
      return NextResponse.json(result);
    } else {
      // Assume HTML
      const html = await response.text();
      const title = extractTitle(html) || parsedUrl.hostname;
      const content = extractMainContent(html);

      const result: FetchedContent = {
        success: true,
        url,
        title,
        content,
      };
      return NextResponse.json(result);
    }
  } catch (error) {
    console.error('Error fetching URL:', error);

    let errorMessage = 'Failed to fetch URL';
    if (error instanceof Error) {
      if (error.name === 'TimeoutError' || error.name === 'AbortError') {
        errorMessage = 'Request timed out';
      } else if (error.message.includes('ENOTFOUND')) {
        errorMessage = 'Could not resolve host';
      } else {
        errorMessage = error.message;
      }
    }

    return NextResponse.json({
      success: false,
      url: '',
      error: errorMessage
    });
  }
}
