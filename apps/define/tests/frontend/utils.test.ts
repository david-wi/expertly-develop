import { describe, it, expect } from 'vitest';

// Test the cn utility function behavior
// The cn function combines clsx and tailwind-merge
describe('cn utility', () => {
  it('should merge class names correctly', async () => {
    // Import dynamically to ensure path resolution works in test environment
    const { cn } = await import('../../frontend/src/lib/utils');

    expect(cn('foo', 'bar')).toBe('foo bar');
  });

  it('should handle conditional classes', async () => {
    const { cn } = await import('../../frontend/src/lib/utils');

    expect(cn('foo', false && 'bar', 'baz')).toBe('foo baz');
    expect(cn('foo', true && 'bar', 'baz')).toBe('foo bar baz');
  });

  it('should handle undefined and null values', async () => {
    const { cn } = await import('../../frontend/src/lib/utils');

    expect(cn('foo', undefined, null, 'bar')).toBe('foo bar');
  });

  it('should handle arrays', async () => {
    const { cn } = await import('../../frontend/src/lib/utils');

    expect(cn(['foo', 'bar'])).toBe('foo bar');
  });

  it('should handle objects with boolean values', async () => {
    const { cn } = await import('../../frontend/src/lib/utils');

    expect(cn({ foo: true, bar: false, baz: true })).toBe('foo baz');
  });

  it('should merge tailwind classes correctly', async () => {
    const { cn } = await import('../../frontend/src/lib/utils');

    // tailwind-merge should deduplicate conflicting classes
    expect(cn('px-2', 'px-4')).toBe('px-4');
    expect(cn('text-red-500', 'text-blue-500')).toBe('text-blue-500');
  });
});
