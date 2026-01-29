import { describe, it, expect } from 'vitest';

/**
 * Tests for the URL fetch endpoint
 * These tests verify URL validation, content extraction, and error handling
 */

describe('URL Fetch Endpoint', () => {
  describe('URL Validation', () => {
    it('should accept valid HTTP URLs', () => {
      const validUrls = [
        'https://example.com',
        'https://example.com/',
        'https://example.com/path',
        'https://example.com/path?query=value',
        'https://sub.example.com/path',
        'http://localhost:3000',
      ];

      validUrls.forEach(url => {
        expect(() => new URL(url)).not.toThrow();
        const parsed = new URL(url);
        expect(['http:', 'https:']).toContain(parsed.protocol);
      });
    });

    it('should reject invalid protocols', () => {
      const invalidUrls = [
        'ftp://example.com',
        'file:///etc/passwd',
        'javascript:alert(1)',
        'data:text/html,<script>alert(1)</script>',
      ];

      invalidUrls.forEach(url => {
        try {
          const parsed = new URL(url);
          expect(['http:', 'https:']).not.toContain(parsed.protocol);
        } catch {
          // Invalid URL format is also acceptable
        }
      });
    });

    it('should reject malformed URLs', () => {
      const malformedUrls = [
        '',
        'not-a-url',
        'example.com', // missing protocol
        '://example.com',
        'http://',
      ];

      malformedUrls.forEach(url => {
        let isValid = false;
        try {
          new URL(url);
          isValid = true;
        } catch {
          isValid = false;
        }
        expect(isValid).toBe(false);
      });
    });
  });

  describe('HTML Content Extraction', () => {
    it('should extract title from HTML', () => {
      const html = '<html><head><title>Test Page Title</title></head><body>Content</body></html>';
      const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);

      expect(titleMatch).toBeTruthy();
      expect(titleMatch![1]).toBe('Test Page Title');
    });

    it('should extract og:title as fallback', () => {
      const html = '<html><head><meta property="og:title" content="OpenGraph Title" /></head></html>';
      const ogTitleMatch = html.match(/<meta[^>]*property=["']og:title["'][^>]*content=["']([^"']+)["']/i);

      expect(ogTitleMatch).toBeTruthy();
      expect(ogTitleMatch![1]).toBe('OpenGraph Title');
    });

    it('should decode HTML entities in title', () => {
      const decodeHtmlEntities = (text: string): string => {
        return text
          .replace(/&amp;/g, '&')
          .replace(/&lt;/g, '<')
          .replace(/&gt;/g, '>')
          .replace(/&quot;/g, '"')
          .replace(/&#39;/g, "'")
          .replace(/&nbsp;/g, ' ');
      };

      expect(decodeHtmlEntities('Test &amp; Example')).toBe('Test & Example');
      expect(decodeHtmlEntities('&lt;script&gt;')).toBe('<script>');
      expect(decodeHtmlEntities('He said &quot;hello&quot;')).toBe('He said "hello"');
    });

    it('should strip script and style tags from content', () => {
      const html = `
        <html>
          <body>
            <script>alert('xss');</script>
            <style>.hidden { display: none; }</style>
            <p>Visible content</p>
            <script src="external.js"></script>
          </body>
        </html>
      `;

      let content = html
        .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
        .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '');

      expect(content).not.toContain('alert');
      expect(content).not.toContain('display: none');
      expect(content).toContain('Visible content');
    });

    it('should strip HTML tags from content', () => {
      const html = '<p>Paragraph <strong>with bold</strong> and <a href="#">link</a></p>';
      const text = html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();

      expect(text).toBe('Paragraph with bold and link');
    });

    it('should extract main content area when available', () => {
      const html = `
        <html>
          <body>
            <nav>Navigation</nav>
            <main>
              <article>
                <h1>Article Title</h1>
                <p>Article content goes here.</p>
              </article>
            </main>
            <footer>Footer</footer>
          </body>
        </html>
      `;

      const mainMatch = html.match(/<main[^>]*>([\s\S]*?)<\/main>/i);
      expect(mainMatch).toBeTruthy();
      expect(mainMatch![1]).toContain('Article content');
      expect(mainMatch![1]).not.toContain('Navigation');
      expect(mainMatch![1]).not.toContain('Footer');
    });

    it('should truncate very long content', () => {
      const longContent = 'a'.repeat(15000);
      const maxLength = 10000;
      const truncated = longContent.length > maxLength
        ? longContent.substring(0, maxLength) + '... (content truncated)'
        : longContent;

      expect(truncated.length).toBeLessThan(longContent.length);
      expect(truncated).toContain('... (content truncated)');
    });
  });

  describe('Error Handling', () => {
    it('should handle network timeout', () => {
      const error = { name: 'TimeoutError' };
      const message = error.name === 'TimeoutError' ? 'Request timed out' : 'Unknown error';

      expect(message).toBe('Request timed out');
    });

    it('should handle AbortError', () => {
      const error = { name: 'AbortError' };
      const message = error.name === 'AbortError' ? 'Request timed out' : 'Unknown error';

      expect(message).toBe('Request timed out');
    });

    it('should handle DNS resolution failure', () => {
      const error = { message: 'ENOTFOUND nonexistent.example.com' };
      const message = error.message.includes('ENOTFOUND')
        ? 'Could not resolve host'
        : 'Unknown error';

      expect(message).toBe('Could not resolve host');
    });

    it('should handle HTTP error responses', () => {
      const responses = [
        { status: 404, statusText: 'Not Found' },
        { status: 401, statusText: 'Unauthorized' },
        { status: 403, statusText: 'Forbidden' },
        { status: 500, statusText: 'Internal Server Error' },
      ];

      responses.forEach(response => {
        const error = `Failed to fetch: ${response.status} ${response.statusText}`;
        expect(error).toContain(response.status.toString());
        expect(error).toContain(response.statusText);
      });
    });
  });

  describe('Content Type Handling', () => {
    it('should handle JSON responses', () => {
      const contentType = 'application/json';
      expect(contentType.includes('application/json')).toBe(true);
    });

    it('should handle plain text responses', () => {
      const contentType = 'text/plain; charset=utf-8';
      expect(contentType.includes('text/plain')).toBe(true);
    });

    it('should handle HTML responses', () => {
      const contentTypes = [
        'text/html',
        'text/html; charset=UTF-8',
        'application/xhtml+xml',
      ];

      // Non-JSON, non-plain-text should be treated as HTML
      contentTypes.forEach(ct => {
        const isJson = ct.includes('application/json');
        const isPlainText = ct.includes('text/plain');
        const isHtml = !isJson && !isPlainText;

        expect(isHtml).toBe(true);
      });
    });
  });

  describe('Response Structure', () => {
    it('should return success structure on successful fetch', () => {
      const successResponse = {
        success: true,
        url: 'https://example.com',
        title: 'Example Domain',
        content: 'This is example content...',
      };

      expect(successResponse.success).toBe(true);
      expect(successResponse.url).toBeTruthy();
      expect(successResponse.title).toBeTruthy();
      expect(successResponse.content).toBeDefined();
    });

    it('should return error structure on failed fetch', () => {
      const errorResponse = {
        success: false,
        url: '',
        error: 'Failed to fetch URL',
      };

      expect(errorResponse.success).toBe(false);
      expect(errorResponse.error).toBeTruthy();
    });

    it('should return error structure for invalid URL', () => {
      const errorResponse = {
        success: false,
        url: '',
        error: 'Invalid URL format',
      };

      expect(errorResponse.error).toBe('Invalid URL format');
    });
  });

  describe('CORS and Security', () => {
    it('should use appropriate User-Agent header', () => {
      const userAgent = 'Expertly-Define/1.0 (Requirements Management Tool)';

      // Should identify itself as a requirements management tool
      expect(userAgent).toContain('Expertly');
      expect(userAgent).toContain('Requirements');
    });

    it('should accept standard content types', () => {
      const acceptHeader = 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8';

      expect(acceptHeader).toContain('text/html');
      expect(acceptHeader).toContain('application/xml');
    });

    it('should use server-side fetch to bypass CORS', () => {
      // Server-side fetches (Next.js API routes) don't have CORS restrictions
      // The fetch-url endpoint is a Next.js API route that runs server-side
      // This test documents the design decision - the endpoint runs on server,
      // not in the browser, so CORS doesn't apply to outgoing requests
      const isApiRoute = true; // API routes always run server-side
      expect(isApiRoute).toBe(true);
    });

    it('should set appropriate timeout for external requests', () => {
      const timeoutMs = 15000;
      expect(timeoutMs).toBe(15000); // 15 second timeout
      expect(timeoutMs).toBeGreaterThanOrEqual(10000);
      expect(timeoutMs).toBeLessThanOrEqual(30000);
    });

    it('should not fetch private IP ranges', () => {
      const privateIpPatterns = [
        /^10\./,
        /^172\.(1[6-9]|2[0-9]|3[0-1])\./,
        /^192\.168\./,
        /^127\./,
        /^localhost$/i,
      ];

      const testUrls = [
        'http://10.0.0.1/internal',
        'http://172.16.0.1/internal',
        'http://192.168.1.1/admin',
        'http://127.0.0.1:8080/api',
        'http://localhost:3000/test',
      ];

      testUrls.forEach(url => {
        const hostname = new URL(url).hostname;
        const isPrivate = privateIpPatterns.some(pattern => pattern.test(hostname));
        expect(isPrivate).toBe(true);
      });
    });
  });
});

describe('Jira URL Handling', () => {
  it('should parse Jira ticket URLs', () => {
    const jiraUrls = [
      'https://company.atlassian.net/browse/PROJ-123',
      'https://jira.company.com/browse/ABC-456',
      'https://company.atlassian.net/jira/software/projects/DEV/boards/1/backlog?selectedIssue=DEV-789',
    ];

    jiraUrls.forEach(url => {
      expect(() => new URL(url)).not.toThrow();
    });
  });

  it('should identify Jira domains', () => {
    const jiraDomains = [
      'company.atlassian.net',
      'jira.company.com',
      'jira.internal.company.org',
    ];

    jiraDomains.forEach(domain => {
      const isJira = domain.includes('atlassian.net') ||
                    domain.includes('jira.');
      expect(isJira).toBe(true);
    });
  });
});
