import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';

// Mock the API client
vi.mock('../../../frontend/src/api/client', () => ({
  productsApi: {
    list: vi.fn(),
  },
}));

import Dashboard from '../../../frontend/src/pages/Dashboard';
import { productsApi } from '../../../frontend/src/api/client';

const mockProductsApi = productsApi as {
  list: ReturnType<typeof vi.fn>;
};

function renderWithRouter(component: React.ReactNode) {
  return render(<BrowserRouter>{component}</BrowserRouter>);
}

describe('Dashboard Page', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  describe('loading state', () => {
    it('should show loading spinner initially', () => {
      mockProductsApi.list.mockImplementation(() => new Promise(() => {})); // Never resolves

      renderWithRouter(<Dashboard />);

      // Loading spinner uses Loader2 with animate-spin class
      const loader = document.querySelector('.animate-spin');
      expect(loader).toBeInTheDocument();
    });
  });

  describe('empty state', () => {
    it('should show welcome message when no products exist', async () => {
      mockProductsApi.list.mockResolvedValue([]);

      renderWithRouter(<Dashboard />);

      await waitFor(() => {
        expect(screen.getByText('Welcome to Expertly Define')).toBeInTheDocument();
      });
    });

    it('should show call to action to create a product when empty', async () => {
      mockProductsApi.list.mockResolvedValue([]);

      renderWithRouter(<Dashboard />);

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /create a product/i })).toBeInTheDocument();
      });
    });

    it('should have link to products page in empty state', async () => {
      mockProductsApi.list.mockResolvedValue([]);

      renderWithRouter(<Dashboard />);

      await waitFor(() => {
        const link = screen.getByRole('link', { name: /create a product/i });
        expect(link).toHaveAttribute('href', '/products');
      });
    });
  });

  describe('with products', () => {
    const mockProducts = [
      {
        id: 'prod-1',
        name: 'Product One',
        prefix: 'P1',
        description: 'First product description',
        created_at: '2024-01-01T00:00:00Z',
        updated_at: '2024-01-01T00:00:00Z',
        requirement_count: 5,
      },
      {
        id: 'prod-2',
        name: 'Product Two',
        prefix: 'P2',
        description: null,
        created_at: '2024-01-02T00:00:00Z',
        updated_at: '2024-01-02T00:00:00Z',
        requirement_count: 3,
      },
    ];

    it('should display products count in stats', async () => {
      mockProductsApi.list.mockResolvedValue(mockProducts);

      renderWithRouter(<Dashboard />);

      await waitFor(() => {
        expect(screen.getByText('2')).toBeInTheDocument(); // 2 products
      });
    });

    it('should display total requirements count', async () => {
      mockProductsApi.list.mockResolvedValue(mockProducts);

      renderWithRouter(<Dashboard />);

      await waitFor(() => {
        expect(screen.getByText('8')).toBeInTheDocument(); // 5 + 3 requirements
      });
    });

    it('should display product names', async () => {
      mockProductsApi.list.mockResolvedValue(mockProducts);

      renderWithRouter(<Dashboard />);

      await waitFor(() => {
        expect(screen.getByText('Product One')).toBeInTheDocument();
        expect(screen.getByText('Product Two')).toBeInTheDocument();
      });
    });

    it('should display product prefixes', async () => {
      mockProductsApi.list.mockResolvedValue(mockProducts);

      renderWithRouter(<Dashboard />);

      await waitFor(() => {
        expect(screen.getByText('P1')).toBeInTheDocument();
        expect(screen.getByText('P2')).toBeInTheDocument();
      });
    });

    it('should display requirement counts per product', async () => {
      mockProductsApi.list.mockResolvedValue(mockProducts);

      renderWithRouter(<Dashboard />);

      await waitFor(() => {
        expect(screen.getByText('5 requirements')).toBeInTheDocument();
        expect(screen.getByText('3 requirements')).toBeInTheDocument();
      });
    });

    it('should have links to product detail pages', async () => {
      mockProductsApi.list.mockResolvedValue(mockProducts);

      renderWithRouter(<Dashboard />);

      await waitFor(() => {
        const productLinks = screen.getAllByRole('link');
        const productOneLink = productLinks.find((link) => link.getAttribute('href') === '/products/prod-1');
        const productTwoLink = productLinks.find((link) => link.getAttribute('href') === '/products/prod-2');

        expect(productOneLink).toBeInTheDocument();
        expect(productTwoLink).toBeInTheDocument();
      });
    });

    it('should show Quick Actions section', async () => {
      mockProductsApi.list.mockResolvedValue(mockProducts);

      renderWithRouter(<Dashboard />);

      await waitFor(() => {
        expect(screen.getByText('Quick Actions')).toBeInTheDocument();
      });
    });

    it('should have Products quick action button', async () => {
      mockProductsApi.list.mockResolvedValue(mockProducts);

      renderWithRouter(<Dashboard />);

      await waitFor(() => {
        const productsButton = screen.getByRole('link', { name: /products/i });
        expect(productsButton).toHaveAttribute('href', '/products');
      });
    });

    it('should have Releases quick action button', async () => {
      mockProductsApi.list.mockResolvedValue(mockProducts);

      renderWithRouter(<Dashboard />);

      await waitFor(() => {
        const releasesButton = screen.getByRole('link', { name: /releases/i });
        expect(releasesButton).toHaveAttribute('href', '/releases');
      });
    });

    it('should display "Your Products" section', async () => {
      mockProductsApi.list.mockResolvedValue(mockProducts);

      renderWithRouter(<Dashboard />);

      await waitFor(() => {
        expect(screen.getByText('Your Products')).toBeInTheDocument();
      });
    });

    it('should have "View all" link in products section', async () => {
      mockProductsApi.list.mockResolvedValue(mockProducts);

      renderWithRouter(<Dashboard />);

      await waitFor(() => {
        const viewAllLink = screen.getByRole('link', { name: /view all/i });
        expect(viewAllLink).toHaveAttribute('href', '/products');
      });
    });

    it('should limit displayed products to 6', async () => {
      const manyProducts = Array.from({ length: 10 }, (_, i) => ({
        id: `prod-${i}`,
        name: `Product ${i}`,
        prefix: `P${i}`,
        description: null,
        created_at: '2024-01-01T00:00:00Z',
        updated_at: '2024-01-01T00:00:00Z',
        requirement_count: i,
      }));

      mockProductsApi.list.mockResolvedValue(manyProducts);

      renderWithRouter(<Dashboard />);

      await waitFor(() => {
        // Should only show 6 products
        expect(screen.getByText('Product 0')).toBeInTheDocument();
        expect(screen.getByText('Product 5')).toBeInTheDocument();
        expect(screen.queryByText('Product 6')).not.toBeInTheDocument();
      });
    });
  });

  describe('error handling', () => {
    it('should handle API errors gracefully', async () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      mockProductsApi.list.mockRejectedValue(new Error('Network error'));

      renderWithRouter(<Dashboard />);

      await waitFor(() => {
        // Should still render (empty state after error)
        expect(screen.getByText('Dashboard')).toBeInTheDocument();
      });

      expect(consoleSpy).toHaveBeenCalled();
      consoleSpy.mockRestore();
    });
  });

  describe('accessibility', () => {
    it('should have proper heading structure', async () => {
      mockProductsApi.list.mockResolvedValue([]);

      renderWithRouter(<Dashboard />);

      await waitFor(() => {
        expect(screen.getByRole('heading', { level: 1, name: 'Dashboard' })).toBeInTheDocument();
      });
    });
  });
});
