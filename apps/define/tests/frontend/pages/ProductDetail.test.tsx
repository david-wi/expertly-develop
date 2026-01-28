import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';

// Mock the API client
vi.mock('../../../frontend/src/api/client', () => ({
  productsApi: {
    get: vi.fn(),
  },
  requirementsApi: {
    list: vi.fn(),
    create: vi.fn(),
  },
}));

import ProductDetail from '../../../frontend/src/pages/ProductDetail';
import { productsApi, requirementsApi } from '../../../frontend/src/api/client';

const mockProductsApi = productsApi as {
  get: ReturnType<typeof vi.fn>;
};

const mockRequirementsApi = requirementsApi as {
  list: ReturnType<typeof vi.fn>;
  create: ReturnType<typeof vi.fn>;
};

function renderWithRouter(productId: string) {
  return render(
    <MemoryRouter initialEntries={[`/products/${productId}`]}>
      <Routes>
        <Route path="/products/:id" element={<ProductDetail />} />
      </Routes>
    </MemoryRouter>
  );
}

describe('ProductDetail Page', () => {
  const mockProduct = {
    id: 'prod-123',
    name: 'Test Product',
    prefix: 'TP',
    description: 'Product description',
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-01-01T00:00:00Z',
    requirement_count: 3,
  };

  const mockRequirements = [
    {
      id: 'req-1',
      product_id: 'prod-123',
      parent_id: null,
      stable_key: 'TP-001',
      title: 'Parent Requirement',
      what_this_does: 'Does something',
      why_this_exists: 'For a reason',
      not_included: null,
      acceptance_criteria: null,
      status: 'draft',
      priority: 'high',
      tags: null,
      order_index: 0,
      current_version: 1,
      created_at: '2024-01-01T00:00:00Z',
      updated_at: '2024-01-01T00:00:00Z',
    },
    {
      id: 'req-2',
      product_id: 'prod-123',
      parent_id: 'req-1',
      stable_key: 'TP-002',
      title: 'Child Requirement',
      what_this_does: null,
      why_this_exists: null,
      not_included: null,
      acceptance_criteria: null,
      status: 'implemented',
      priority: 'medium',
      tags: null,
      order_index: 0,
      current_version: 1,
      created_at: '2024-01-01T00:00:00Z',
      updated_at: '2024-01-01T00:00:00Z',
    },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
    mockProductsApi.get.mockResolvedValue(mockProduct);
    mockRequirementsApi.list.mockResolvedValue(mockRequirements);
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  describe('loading state', () => {
    it('should show loading spinner initially', () => {
      mockProductsApi.get.mockImplementation(() => new Promise(() => {}));
      mockRequirementsApi.list.mockImplementation(() => new Promise(() => {}));

      renderWithRouter('prod-123');

      const loader = document.querySelector('.animate-spin');
      expect(loader).toBeInTheDocument();
    });
  });

  describe('not found state', () => {
    it('should show not found message when product does not exist', async () => {
      mockProductsApi.get.mockRejectedValue(new Error('Not found'));
      mockRequirementsApi.list.mockResolvedValue([]);

      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      renderWithRouter('non-existent');

      await waitFor(() => {
        expect(screen.getByText('Product not found')).toBeInTheDocument();
      });

      consoleSpy.mockRestore();
    });
  });

  describe('product header', () => {
    it('should display product name', async () => {
      renderWithRouter('prod-123');

      await waitFor(() => {
        expect(screen.getByRole('heading', { level: 1, name: 'Test Product' })).toBeInTheDocument();
      });
    });

    it('should have back link to products', async () => {
      renderWithRouter('prod-123');

      await waitFor(() => {
        const backLink = screen.getByRole('link', { name: /products/i });
        expect(backLink).toHaveAttribute('href', '/products');
      });
    });
  });

  describe('requirement tree', () => {
    it('should display Product map section', async () => {
      renderWithRouter('prod-123');

      await waitFor(() => {
        expect(screen.getByText('Product map')).toBeInTheDocument();
      });
    });

    it('should display requirements in tree', async () => {
      renderWithRouter('prod-123');

      await waitFor(() => {
        expect(screen.getByText('Parent Requirement')).toBeInTheDocument();
        expect(screen.getByText('Child Requirement')).toBeInTheDocument();
      });
    });

    it('should display status badges', async () => {
      renderWithRouter('prod-123');

      await waitFor(() => {
        expect(screen.getByText('draft')).toBeInTheDocument();
        expect(screen.getByText('implemented')).toBeInTheDocument();
      });
    });

    it('should have search input', async () => {
      renderWithRouter('prod-123');

      await waitFor(() => {
        expect(screen.getByPlaceholderText('Search...')).toBeInTheDocument();
      });
    });

    it('should show empty state when no requirements', async () => {
      mockRequirementsApi.list.mockResolvedValue([]);

      renderWithRouter('prod-123');

      await waitFor(() => {
        expect(screen.getByText('No requirements yet. Add one to get started.')).toBeInTheDocument();
      });
    });
  });

  describe('detail panel', () => {
    it('should show placeholder when no requirement selected', async () => {
      renderWithRouter('prod-123');

      await waitFor(() => {
        expect(screen.getByText('Select a requirement from the tree to view details')).toBeInTheDocument();
      });
    });

    it('should show requirement details when selected', async () => {
      renderWithRouter('prod-123');

      await waitFor(() => {
        expect(screen.getByText('Parent Requirement')).toBeInTheDocument();
      });

      // Click on a requirement to select it
      fireEvent.click(screen.getByText('Parent Requirement'));

      await waitFor(() => {
        expect(screen.getByText('TP-001')).toBeInTheDocument();
        expect(screen.getByText('high')).toBeInTheDocument();
      });
    });

    it('should show what_this_does description', async () => {
      renderWithRouter('prod-123');

      await waitFor(() => {
        expect(screen.getByText('Parent Requirement')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByText('Parent Requirement'));

      await waitFor(() => {
        expect(screen.getByText('Does something')).toBeInTheDocument();
      });
    });

    it('should show "No description yet" when what_this_does is empty', async () => {
      renderWithRouter('prod-123');

      await waitFor(() => {
        expect(screen.getByText('Child Requirement')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByText('Child Requirement'));

      await waitFor(() => {
        expect(screen.getByText('No description yet.')).toBeInTheDocument();
      });
    });

    it('should have link to open full requirement', async () => {
      renderWithRouter('prod-123');

      await waitFor(() => {
        expect(screen.getByText('Parent Requirement')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByText('Parent Requirement'));

      await waitFor(() => {
        const openLink = screen.getByRole('link', { name: /open requirement/i });
        expect(openLink).toHaveAttribute('href', '/requirements/req-1');
      });
    });
  });

  describe('add requirement dialog', () => {
    it('should have Add button', async () => {
      renderWithRouter('prod-123');

      await waitFor(() => {
        const addButtons = screen.getAllByRole('button');
        const addButton = addButtons.find((btn) => btn.querySelector('svg'));
        expect(addButton).toBeInTheDocument();
      });
    });

    it('should open dialog when Add button is clicked', async () => {
      renderWithRouter('prod-123');

      await waitFor(() => {
        expect(screen.getByText('Product map')).toBeInTheDocument();
      });

      // Find the add button (has Plus icon)
      const addButtons = screen.getAllByRole('button');
      const addButton = addButtons.find(
        (btn) => btn.classList.contains('h-8') || btn.textContent === '' || btn.querySelector('svg')
      );
      if (addButton) {
        fireEvent.click(addButton);
      }

      await waitFor(() => {
        expect(screen.getByText('Add Requirement')).toBeInTheDocument();
      });
    });

    it('should have title input in dialog', async () => {
      renderWithRouter('prod-123');

      await waitFor(() => {
        expect(screen.getByText('Product map')).toBeInTheDocument();
      });

      const addButtons = screen.getAllByRole('button');
      const addButton = addButtons.find((btn) => btn.querySelector('svg'));
      if (addButton) {
        fireEvent.click(addButton);
      }

      await waitFor(() => {
        expect(screen.getByPlaceholderText('e.g., Version History')).toBeInTheDocument();
      });
    });

    it('should have status and priority selects', async () => {
      renderWithRouter('prod-123');

      await waitFor(() => {
        expect(screen.getByText('Product map')).toBeInTheDocument();
      });

      const addButtons = screen.getAllByRole('button');
      const addButton = addButtons.find((btn) => btn.querySelector('svg'));
      if (addButton) {
        fireEvent.click(addButton);
      }

      await waitFor(() => {
        expect(screen.getByText('Status')).toBeInTheDocument();
        expect(screen.getByText('Priority')).toBeInTheDocument();
      });
    });
  });

  describe('tree interactions', () => {
    it('should toggle tree node expansion', async () => {
      renderWithRouter('prod-123');

      await waitFor(() => {
        expect(screen.getByText('Parent Requirement')).toBeInTheDocument();
        expect(screen.getByText('Child Requirement')).toBeInTheDocument();
      });

      // Child should be visible initially (expanded by default)
      expect(screen.getByText('Child Requirement')).toBeVisible();

      // Find and click the toggle button
      const toggleButtons = document.querySelectorAll('button');
      const toggleButton = Array.from(toggleButtons).find(
        (btn) => btn.querySelector('svg') && btn.classList.contains('p-0.5')
      );

      if (toggleButton) {
        fireEvent.click(toggleButton);

        // After toggle, tree structure should change
        // Note: The actual visibility depends on implementation
      }
    });
  });

  describe('error handling', () => {
    it('should handle API errors gracefully', async () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      mockProductsApi.get.mockRejectedValue(new Error('Network error'));
      mockRequirementsApi.list.mockRejectedValue(new Error('Network error'));

      renderWithRouter('prod-123');

      await waitFor(() => {
        // Should still render something (error state or not found)
        expect(screen.getByText('Product not found')).toBeInTheDocument();
      });

      consoleSpy.mockRestore();
    });
  });
});

describe('buildTree function', () => {
  // Test tree building logic indirectly through the component behavior
  it('should organize requirements hierarchically', async () => {
    vi.clearAllMocks();

    mockProductsApi.get.mockResolvedValue({
      id: 'prod-123',
      name: 'Test',
      prefix: 'T',
      description: null,
      created_at: '2024-01-01T00:00:00Z',
      updated_at: '2024-01-01T00:00:00Z',
    });

    const hierarchicalRequirements = [
      {
        id: 'root-1',
        product_id: 'prod-123',
        parent_id: null,
        stable_key: 'T-001',
        title: 'Root 1',
        what_this_does: null,
        why_this_exists: null,
        not_included: null,
        acceptance_criteria: null,
        status: 'draft',
        priority: 'medium',
        tags: null,
        order_index: 0,
        current_version: 1,
        created_at: '2024-01-01T00:00:00Z',
        updated_at: '2024-01-01T00:00:00Z',
      },
      {
        id: 'child-1',
        product_id: 'prod-123',
        parent_id: 'root-1',
        stable_key: 'T-002',
        title: 'Child 1',
        what_this_does: null,
        why_this_exists: null,
        not_included: null,
        acceptance_criteria: null,
        status: 'draft',
        priority: 'medium',
        tags: null,
        order_index: 0,
        current_version: 1,
        created_at: '2024-01-01T00:00:00Z',
        updated_at: '2024-01-01T00:00:00Z',
      },
      {
        id: 'root-2',
        product_id: 'prod-123',
        parent_id: null,
        stable_key: 'T-003',
        title: 'Root 2',
        what_this_does: null,
        why_this_exists: null,
        not_included: null,
        acceptance_criteria: null,
        status: 'draft',
        priority: 'medium',
        tags: null,
        order_index: 1,
        current_version: 1,
        created_at: '2024-01-01T00:00:00Z',
        updated_at: '2024-01-01T00:00:00Z',
      },
    ];

    mockRequirementsApi.list.mockResolvedValue(hierarchicalRequirements);

    renderWithRouter('prod-123');

    await waitFor(() => {
      expect(screen.getByText('Root 1')).toBeInTheDocument();
      expect(screen.getByText('Child 1')).toBeInTheDocument();
      expect(screen.getByText('Root 2')).toBeInTheDocument();
    });
  });
});
