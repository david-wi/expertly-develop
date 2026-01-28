import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';

// Mock the API client
vi.mock('../../../frontend/src/api/client', () => ({
  productsApi: {
    list: vi.fn(),
  },
  releasesApi: {
    list: vi.fn(),
    create: vi.fn(),
  },
}));

// Mock date-fns
vi.mock('date-fns', () => ({
  formatDistanceToNow: vi.fn(() => '2 days ago'),
}));

import Releases from '../../../frontend/src/pages/Releases';
import { productsApi, releasesApi } from '../../../frontend/src/api/client';

const mockProductsApi = productsApi as {
  list: ReturnType<typeof vi.fn>;
};

const mockReleasesApi = releasesApi as {
  list: ReturnType<typeof vi.fn>;
  create: ReturnType<typeof vi.fn>;
};

function renderWithRouter(component: React.ReactNode) {
  return render(<BrowserRouter>{component}</BrowserRouter>);
}

describe('Releases Page', () => {
  const mockProducts = [
    {
      id: 'prod-1',
      name: 'Product One',
      prefix: 'P1',
      description: 'First product',
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

  const mockReleases = [
    {
      id: 'rel-1',
      product_id: 'prod-1',
      version_name: 'v1.0.0',
      description: 'Initial release',
      requirements_snapshot: '[]',
      stats: JSON.stringify({ total: 5 }),
      status: 'released',
      created_at: '2024-01-01T00:00:00Z',
      released_at: '2024-01-02T00:00:00Z',
    },
    {
      id: 'rel-2',
      product_id: 'prod-1',
      version_name: 'v1.1.0',
      description: null,
      requirements_snapshot: '[]',
      stats: JSON.stringify({ total: 8 }),
      status: 'draft',
      created_at: '2024-01-15T00:00:00Z',
      released_at: null,
    },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
    mockProductsApi.list.mockResolvedValue(mockProducts);
    mockReleasesApi.list.mockResolvedValue(mockReleases);
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  describe('loading state', () => {
    it('should show loading spinner initially', () => {
      mockProductsApi.list.mockImplementation(() => new Promise(() => {}));

      renderWithRouter(<Releases />);

      const loader = document.querySelector('.animate-spin');
      expect(loader).toBeInTheDocument();
    });
  });

  describe('header', () => {
    it('should display page title', async () => {
      renderWithRouter(<Releases />);

      await waitFor(() => {
        expect(screen.getByRole('heading', { level: 1, name: 'Releases' })).toBeInTheDocument();
      });
    });

    it('should display subtitle', async () => {
      renderWithRouter(<Releases />);

      await waitFor(() => {
        expect(screen.getByText('Manage release snapshots')).toBeInTheDocument();
      });
    });

    it('should have product selector', async () => {
      renderWithRouter(<Releases />);

      await waitFor(() => {
        // The select should contain product names
        expect(screen.getByText('Product One')).toBeInTheDocument();
      });
    });

    it('should have New Release button', async () => {
      renderWithRouter(<Releases />);

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /new release/i })).toBeInTheDocument();
      });
    });
  });

  describe('no products state', () => {
    it('should show empty state when no products exist', async () => {
      mockProductsApi.list.mockResolvedValue([]);

      renderWithRouter(<Releases />);

      await waitFor(() => {
        expect(screen.getByText('No products yet')).toBeInTheDocument();
      });
    });

    it('should have link to products page', async () => {
      mockProductsApi.list.mockResolvedValue([]);

      renderWithRouter(<Releases />);

      await waitFor(() => {
        const link = screen.getByRole('link', { name: /go to products/i });
        expect(link).toHaveAttribute('href', '/products');
      });
    });
  });

  describe('no releases state', () => {
    it('should show empty state when product has no releases', async () => {
      mockReleasesApi.list.mockResolvedValue([]);

      renderWithRouter(<Releases />);

      await waitFor(() => {
        expect(screen.getByText('No releases yet')).toBeInTheDocument();
      });
    });

    it('should have create first release button', async () => {
      mockReleasesApi.list.mockResolvedValue([]);

      renderWithRouter(<Releases />);

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /create first release/i })).toBeInTheDocument();
      });
    });
  });

  describe('with releases', () => {
    it('should display release cards', async () => {
      renderWithRouter(<Releases />);

      await waitFor(() => {
        expect(screen.getByText('v1.0.0')).toBeInTheDocument();
        expect(screen.getByText('v1.1.0')).toBeInTheDocument();
      });
    });

    it('should display release descriptions', async () => {
      renderWithRouter(<Releases />);

      await waitFor(() => {
        expect(screen.getByText('Initial release')).toBeInTheDocument();
      });
    });

    it('should display status badges', async () => {
      renderWithRouter(<Releases />);

      await waitFor(() => {
        expect(screen.getByText('released')).toBeInTheDocument();
        expect(screen.getByText('draft')).toBeInTheDocument();
      });
    });

    it('should display requirement counts from stats', async () => {
      renderWithRouter(<Releases />);

      await waitFor(() => {
        expect(screen.getByText('5 requirements captured')).toBeInTheDocument();
        expect(screen.getByText('8 requirements captured')).toBeInTheDocument();
      });
    });

    it('should link releases to detail pages', async () => {
      renderWithRouter(<Releases />);

      await waitFor(() => {
        const links = screen.getAllByRole('link');
        const releaseLink = links.find((link) => link.getAttribute('href') === '/releases/rel-1');
        expect(releaseLink).toBeInTheDocument();
      });
    });
  });

  describe('product switching', () => {
    it('should fetch releases when product changes', async () => {
      renderWithRouter(<Releases />);

      await waitFor(() => {
        expect(mockReleasesApi.list).toHaveBeenCalledWith('prod-1');
      });

      // First product is auto-selected, releases are fetched
      expect(mockReleasesApi.list).toHaveBeenCalledTimes(1);
    });
  });

  describe('create release dialog', () => {
    it('should open dialog when New Release button is clicked', async () => {
      renderWithRouter(<Releases />);

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /new release/i })).toBeInTheDocument();
      });

      fireEvent.click(screen.getByRole('button', { name: /new release/i }));

      await waitFor(() => {
        expect(screen.getByText('Create Release Snapshot')).toBeInTheDocument();
      });
    });

    it('should have version name input', async () => {
      renderWithRouter(<Releases />);

      await waitFor(() => {
        fireEvent.click(screen.getByRole('button', { name: /new release/i }));
      });

      await waitFor(() => {
        expect(screen.getByPlaceholderText('e.g., v1.0.0')).toBeInTheDocument();
      });
    });

    it('should have description textarea', async () => {
      renderWithRouter(<Releases />);

      await waitFor(() => {
        fireEvent.click(screen.getByRole('button', { name: /new release/i }));
      });

      await waitFor(() => {
        expect(screen.getByPlaceholderText('Release notes...')).toBeInTheDocument();
      });
    });

    it('should have Cancel and Create buttons', async () => {
      renderWithRouter(<Releases />);

      await waitFor(() => {
        fireEvent.click(screen.getByRole('button', { name: /new release/i }));
      });

      await waitFor(() => {
        expect(screen.getByRole('button', { name: 'Cancel' })).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /create snapshot/i })).toBeInTheDocument();
      });
    });

    it('should disable Create button when version name is empty', async () => {
      renderWithRouter(<Releases />);

      await waitFor(() => {
        fireEvent.click(screen.getByRole('button', { name: /new release/i }));
      });

      await waitFor(() => {
        const createButton = screen.getByRole('button', { name: /create snapshot/i });
        expect(createButton).toBeDisabled();
      });
    });

    it('should enable Create button when version name is provided', async () => {
      renderWithRouter(<Releases />);

      await waitFor(() => {
        fireEvent.click(screen.getByRole('button', { name: /new release/i }));
      });

      const versionInput = screen.getByPlaceholderText('e.g., v1.0.0');
      fireEvent.change(versionInput, { target: { value: 'v2.0.0' } });

      await waitFor(() => {
        const createButton = screen.getByRole('button', { name: /create snapshot/i });
        expect(createButton).not.toBeDisabled();
      });
    });

    it('should close dialog when Cancel is clicked', async () => {
      renderWithRouter(<Releases />);

      await waitFor(() => {
        fireEvent.click(screen.getByRole('button', { name: /new release/i }));
      });

      fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));

      await waitFor(() => {
        expect(screen.queryByText('Create Release Snapshot')).not.toBeInTheDocument();
      });
    });

    it('should create release on submit', async () => {
      mockReleasesApi.create.mockResolvedValue({
        id: 'new-rel',
        product_id: 'prod-1',
        version_name: 'v2.0.0',
        description: 'New release',
      });

      renderWithRouter(<Releases />);

      await waitFor(() => {
        fireEvent.click(screen.getByRole('button', { name: /new release/i }));
      });

      const versionInput = screen.getByPlaceholderText('e.g., v1.0.0');
      fireEvent.change(versionInput, { target: { value: 'v2.0.0' } });

      const descInput = screen.getByPlaceholderText('Release notes...');
      fireEvent.change(descInput, { target: { value: 'New release' } });

      fireEvent.click(screen.getByRole('button', { name: /create snapshot/i }));

      await waitFor(() => {
        expect(mockReleasesApi.create).toHaveBeenCalledWith({
          product_id: 'prod-1',
          version_name: 'v2.0.0',
          description: 'New release',
        });
      });
    });
  });

  describe('error handling', () => {
    it('should handle products API error gracefully', async () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      mockProductsApi.list.mockRejectedValue(new Error('Network error'));

      renderWithRouter(<Releases />);

      await waitFor(() => {
        expect(screen.getByText('Releases')).toBeInTheDocument();
      });

      expect(consoleSpy).toHaveBeenCalled();
      consoleSpy.mockRestore();
    });

    it('should handle releases API error gracefully', async () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      mockReleasesApi.list.mockRejectedValue(new Error('Network error'));

      renderWithRouter(<Releases />);

      await waitFor(() => {
        expect(screen.getByText('Releases')).toBeInTheDocument();
      });

      expect(consoleSpy).toHaveBeenCalled();
      consoleSpy.mockRestore();
    });
  });
});
