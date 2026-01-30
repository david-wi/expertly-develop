import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Badge } from '../../../frontend/src/components/ui/badge';

describe('Badge Component', () => {
  describe('rendering', () => {
    it('should render children correctly', () => {
      render(<Badge>Test Badge</Badge>);
      expect(screen.getByText('Test Badge')).toBeInTheDocument();
    });

    it('should render with default variant', () => {
      render(<Badge>Default</Badge>);
      const badge = screen.getByText('Default');
      expect(badge.className).toContain('bg-primary-100');
      expect(badge.className).toContain('text-primary-800');
    });

    it('should apply base styles', () => {
      render(<Badge>Base</Badge>);
      const badge = screen.getByText('Base');
      expect(badge.className).toContain('inline-flex');
      expect(badge.className).toContain('items-center');
      expect(badge.className).toContain('rounded-full');
      expect(badge.className).toContain('px-2.5');
      expect(badge.className).toContain('py-0.5');
      expect(badge.className).toContain('text-xs');
      expect(badge.className).toContain('font-semibold');
    });

    it('should apply custom className', () => {
      render(<Badge className="custom-badge">Custom</Badge>);
      expect(screen.getByText('Custom')).toHaveClass('custom-badge');
    });
  });

  describe('variants', () => {
    it('should render default variant', () => {
      render(<Badge variant="default">Default</Badge>);
      const badge = screen.getByText('Default');
      expect(badge.className).toContain('bg-primary-100');
      expect(badge.className).toContain('text-primary-800');
    });

    it('should render secondary variant', () => {
      render(<Badge variant="secondary">Secondary</Badge>);
      const badge = screen.getByText('Secondary');
      expect(badge.className).toContain('bg-gray-100');
      expect(badge.className).toContain('text-gray-800');
    });

    it('should render outline variant', () => {
      render(<Badge variant="outline">Outline</Badge>);
      const badge = screen.getByText('Outline');
      expect(badge.className).toContain('border');
      expect(badge.className).toContain('border-gray-300');
      expect(badge.className).toContain('text-gray-700');
    });

    it('should render success variant', () => {
      render(<Badge variant="success">Success</Badge>);
      const badge = screen.getByText('Success');
      expect(badge.className).toContain('bg-green-100');
      expect(badge.className).toContain('text-green-800');
    });

    it('should render warning variant', () => {
      render(<Badge variant="warning">Warning</Badge>);
      const badge = screen.getByText('Warning');
      expect(badge.className).toContain('bg-yellow-100');
      expect(badge.className).toContain('text-yellow-800');
    });

    it('should render danger variant', () => {
      render(<Badge variant="danger">Danger</Badge>);
      const badge = screen.getByText('Danger');
      expect(badge.className).toContain('bg-red-100');
      expect(badge.className).toContain('text-red-800');
    });
  });

  describe('HTML attributes', () => {
    it('should pass through data attributes', () => {
      render(<Badge data-testid="test-badge">Test</Badge>);
      expect(screen.getByTestId('test-badge')).toBeInTheDocument();
    });

    it('should pass through id attribute', () => {
      render(<Badge id="unique-badge">Test</Badge>);
      expect(document.getElementById('unique-badge')).toBeInTheDocument();
    });

    it('should pass through role attribute', () => {
      render(<Badge role="status">Status</Badge>);
      expect(screen.getByRole('status')).toBeInTheDocument();
    });
  });

  describe('use cases', () => {
    it('should work for status indicators', () => {
      render(
        <div>
          <Badge variant="success">Active</Badge>
          <Badge variant="secondary">Inactive</Badge>
          <Badge variant="warning">Pending</Badge>
          <Badge variant="danger">Error</Badge>
        </div>
      );

      expect(screen.getByText('Active')).toBeInTheDocument();
      expect(screen.getByText('Inactive')).toBeInTheDocument();
      expect(screen.getByText('Pending')).toBeInTheDocument();
      expect(screen.getByText('Error')).toBeInTheDocument();
    });

    it('should work for priority labels', () => {
      render(
        <div>
          <Badge variant="danger">Critical</Badge>
          <Badge variant="warning">High</Badge>
          <Badge variant="secondary">Medium</Badge>
          <Badge variant="secondary">Low</Badge>
        </div>
      );

      expect(screen.getByText('Critical')).toBeInTheDocument();
      expect(screen.getByText('High')).toBeInTheDocument();
      expect(screen.getByText('Medium')).toBeInTheDocument();
      expect(screen.getByText('Low')).toBeInTheDocument();
    });

    it('should work for tags/labels', () => {
      render(
        <div>
          <Badge variant="outline">REQ-001</Badge>
          <Badge variant="outline">REQ-002</Badge>
        </div>
      );

      expect(screen.getByText('REQ-001')).toBeInTheDocument();
      expect(screen.getByText('REQ-002')).toBeInTheDocument();
    });
  });
});
