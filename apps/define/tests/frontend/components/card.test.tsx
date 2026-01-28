import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
} from '../../../frontend/src/components/ui/card';

describe('Card Components', () => {
  describe('Card', () => {
    it('should render children correctly', () => {
      render(<Card>Card Content</Card>);
      expect(screen.getByText('Card Content')).toBeInTheDocument();
    });

    it('should apply default styles', () => {
      render(<Card data-testid="card">Content</Card>);
      const card = screen.getByTestId('card');
      expect(card.className).toContain('rounded-lg');
      expect(card.className).toContain('border');
      expect(card.className).toContain('border-gray-200');
      expect(card.className).toContain('bg-white');
      expect(card.className).toContain('shadow-sm');
    });

    it('should apply custom className', () => {
      render(<Card className="custom-card" data-testid="card">Content</Card>);
      expect(screen.getByTestId('card')).toHaveClass('custom-card');
    });

    it('should forward ref correctly', () => {
      const ref = { current: null };
      render(<Card ref={ref}>Ref</Card>);
      expect(ref.current).toBeInstanceOf(HTMLDivElement);
    });
  });

  describe('CardHeader', () => {
    it('should render children correctly', () => {
      render(<CardHeader>Header Content</CardHeader>);
      expect(screen.getByText('Header Content')).toBeInTheDocument();
    });

    it('should apply default styles', () => {
      render(<CardHeader data-testid="header">Content</CardHeader>);
      const header = screen.getByTestId('header');
      expect(header.className).toContain('flex');
      expect(header.className).toContain('flex-col');
      expect(header.className).toContain('p-6');
    });

    it('should apply custom className', () => {
      render(<CardHeader className="custom-header">Content</CardHeader>);
      expect(screen.getByText('Content')).toHaveClass('custom-header');
    });

    it('should forward ref correctly', () => {
      const ref = { current: null };
      render(<CardHeader ref={ref}>Ref</CardHeader>);
      expect(ref.current).toBeInstanceOf(HTMLDivElement);
    });
  });

  describe('CardTitle', () => {
    it('should render children correctly', () => {
      render(<CardTitle>Title Text</CardTitle>);
      expect(screen.getByText('Title Text')).toBeInTheDocument();
    });

    it('should render as h3 element', () => {
      render(<CardTitle>Title</CardTitle>);
      expect(screen.getByRole('heading', { level: 3 })).toBeInTheDocument();
    });

    it('should apply default styles', () => {
      render(<CardTitle>Title</CardTitle>);
      const title = screen.getByText('Title');
      expect(title.className).toContain('text-lg');
      expect(title.className).toContain('font-semibold');
      expect(title.className).toContain('leading-none');
      expect(title.className).toContain('tracking-tight');
    });

    it('should apply custom className', () => {
      render(<CardTitle className="custom-title">Title</CardTitle>);
      expect(screen.getByText('Title')).toHaveClass('custom-title');
    });

    it('should forward ref correctly', () => {
      const ref = { current: null };
      render(<CardTitle ref={ref}>Ref</CardTitle>);
      expect(ref.current).toBeInstanceOf(HTMLHeadingElement);
    });
  });

  describe('CardDescription', () => {
    it('should render children correctly', () => {
      render(<CardDescription>Description Text</CardDescription>);
      expect(screen.getByText('Description Text')).toBeInTheDocument();
    });

    it('should render as p element', () => {
      render(<CardDescription>Description</CardDescription>);
      const description = screen.getByText('Description');
      expect(description.tagName).toBe('P');
    });

    it('should apply default styles', () => {
      render(<CardDescription>Description</CardDescription>);
      const description = screen.getByText('Description');
      expect(description.className).toContain('text-sm');
      expect(description.className).toContain('text-gray-500');
    });

    it('should apply custom className', () => {
      render(<CardDescription className="custom-desc">Description</CardDescription>);
      expect(screen.getByText('Description')).toHaveClass('custom-desc');
    });

    it('should forward ref correctly', () => {
      const ref = { current: null };
      render(<CardDescription ref={ref}>Ref</CardDescription>);
      expect(ref.current).toBeInstanceOf(HTMLParagraphElement);
    });
  });

  describe('CardContent', () => {
    it('should render children correctly', () => {
      render(<CardContent>Content Text</CardContent>);
      expect(screen.getByText('Content Text')).toBeInTheDocument();
    });

    it('should apply default styles', () => {
      render(<CardContent data-testid="content">Content</CardContent>);
      const content = screen.getByTestId('content');
      expect(content.className).toContain('p-6');
      expect(content.className).toContain('pt-0');
    });

    it('should apply custom className', () => {
      render(<CardContent className="custom-content">Content</CardContent>);
      expect(screen.getByText('Content')).toHaveClass('custom-content');
    });

    it('should forward ref correctly', () => {
      const ref = { current: null };
      render(<CardContent ref={ref}>Ref</CardContent>);
      expect(ref.current).toBeInstanceOf(HTMLDivElement);
    });
  });

  describe('CardFooter', () => {
    it('should render children correctly', () => {
      render(<CardFooter>Footer Text</CardFooter>);
      expect(screen.getByText('Footer Text')).toBeInTheDocument();
    });

    it('should apply default styles', () => {
      render(<CardFooter data-testid="footer">Footer</CardFooter>);
      const footer = screen.getByTestId('footer');
      expect(footer.className).toContain('flex');
      expect(footer.className).toContain('items-center');
      expect(footer.className).toContain('p-6');
      expect(footer.className).toContain('pt-0');
    });

    it('should apply custom className', () => {
      render(<CardFooter className="custom-footer">Footer</CardFooter>);
      expect(screen.getByText('Footer')).toHaveClass('custom-footer');
    });

    it('should forward ref correctly', () => {
      const ref = { current: null };
      render(<CardFooter ref={ref}>Ref</CardFooter>);
      expect(ref.current).toBeInstanceOf(HTMLDivElement);
    });
  });

  describe('Full Card composition', () => {
    it('should render a complete card with all parts', () => {
      render(
        <Card>
          <CardHeader>
            <CardTitle>Test Card</CardTitle>
            <CardDescription>Card description</CardDescription>
          </CardHeader>
          <CardContent>
            <p>Main content goes here</p>
          </CardContent>
          <CardFooter>
            <button>Action</button>
          </CardFooter>
        </Card>
      );

      expect(screen.getByRole('heading', { name: 'Test Card' })).toBeInTheDocument();
      expect(screen.getByText('Card description')).toBeInTheDocument();
      expect(screen.getByText('Main content goes here')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Action' })).toBeInTheDocument();
    });
  });
});
