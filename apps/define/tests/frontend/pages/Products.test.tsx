import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';

// Mock the API client
vi.mock('../../../frontend/src/api/client', () => ({
  productsApi: {
    list: vi.fn(),
    create: vi.fn(),
  },
}));

import Products from '../../../frontend/src/pages/Products';
import { productsApi } from '../../../frontend/src/api/client';

const mockProductsApi = productsApi as {
  list: ReturnType<typeof vi.fn>;
  create: ReturnType<typeof vi.fn>;
};

function renderWithRouter(component: React.ReactNode) {
  return render(<BrowserRouter>{component}</BrowserRouter>);
}

describe('Products Page', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  describe('loading state', () => {
    it('should show loading spinner initially', () => {
      mockProductsApi.list.mockImplementation(() => new Promise(() => {}));

      renderWithRouter(<Products />);

      const loader = document.querySelector('.animate-spin');
      expect(loader).toBeInTheDocument();
    });
  });

  describe('header', () => {
    it('should display page title', async () => {
      mockProductsApi.list.mockResolvedValue([]);

      renderWithRouter(<Products />);

      await waitFor(() => {
        expect(screen.getByRole('heading', { level: 1, name: 'Products' })).toBeInTheDocument();
      });
    });

    it('should display subtitle', async () => {
      mockProductsApi.list.mockResolvedValue([]);

      renderWithRouter(<Products />);

      await waitFor(() => {
        expect(screen.getByText('Manage your product requirements')).toBeInTheDocument();
      });
    });

    it('should have New Product button', async () => {
      mockProductsApi.list.mockResolvedValue([]);

      renderWithRouter(<Products />);

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /new product/i })).toBeInTheDocument();
      });
    });
  });

  describe('empty state', () => {
    it('should show empty state message when no products', async () => {
      mockProductsApi.list.mockResolvedValue([]);

      renderWithRouter(<Products />);

      await waitFor(() => {
        expect(screen.getByText('No products yet')).toBeInTheDocument();
      });
    });

    it('should show create product button in empty state', async () => {
      mockProductsApi.list.mockResolvedValue([]);

      renderWithRouter(<Products />);

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /create a product/i })).toBeInTheDocument();
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
        requirement_count: 0,
      },
    ];

    it('should display product cards', async () => {
      mockProductsApi.list.mockResolvedValue(mockProducts);

      renderWithRouter(<Products />);

      await waitFor(() => {
        expect(screen.getByText('Product One')).toBeInTheDocument();
        expect(screen.getByText('Product Two')).toBeInTheDocument();
      });
    });

    it('should display product descriptions', async () => {
      mockProductsApi.list.mockResolvedValue(mockProducts);

      renderWithRouter(<Products />);

      await waitFor(() => {
        expect(screen.getByText('First product description')).toBeInTheDocument();
      });
    });

    it('should display requirement counts', async () => {
      mockProductsApi.list.mockResolvedValue(mockProducts);

      renderWithRouter(<Products />);

      await waitFor(() => {
        expect(screen.getByText('5 requirements')).toBeInTheDocument();
        expect(screen.getByText('0 requirements')).toBeInTheDocument();
      });
    });

    it('should link products to detail pages', async () => {
      mockProductsApi.list.mockResolvedValue(mockProducts);

      renderWithRouter(<Products />);

      await waitFor(() => {
        const links = screen.getAllByRole('link');
        const productLink = links.find((link) => link.getAttribute('href') === '/products/prod-1');
        expect(productLink).toBeInTheDocument();
      });
    });
  });

  describe('create product dialog', () => {
    it('should open dialog when New Product button is clicked', async () => {
      mockProductsApi.list.mockResolvedValue([]);

      renderWithRouter(<Products />);

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /new product/i })).toBeInTheDocument();
      });

      fireEvent.click(screen.getByRole('button', { name: /new product/i }));

      await waitFor(() => {
        expect(screen.getByText('Create New Product')).toBeInTheDocument();
      });
    });

    it('should have product name input', async () => {
      mockProductsApi.list.mockResolvedValue([]);

      renderWithRouter(<Products />);

      await waitFor(() => {
        fireEvent.click(screen.getByRole('button', { name: /new product/i }));
      });

      await waitFor(() => {
        expect(screen.getByPlaceholderText('e.g., Automation Designer')).toBeInTheDocument();
      });
    });

    it('should have prefix input', async () => {
      mockProductsApi.list.mockResolvedValue([]);

      renderWithRouter(<Products />);

      await waitFor(() => {
        fireEvent.click(screen.getByRole('button', { name: /new product/i }));
      });

      await waitFor(() => {
        expect(screen.getByPlaceholderText('e.g., AD')).toBeInTheDocument();
      });
    });

    it('should have description textarea', async () => {
      mockProductsApi.list.mockResolvedValue([]);

      renderWithRouter(<Products />);

      await waitFor(() => {
        fireEvent.click(screen.getByRole('button', { name: /new product/i }));
      });

      await waitFor(() => {
        expect(screen.getByPlaceholderText('What does this product do?')).toBeInTheDocument();
      });
    });

    it('should auto-generate prefix from name', async () => {
      mockProductsApi.list.mockResolvedValue([]);

      renderWithRouter(<Products />);

      await waitFor(() => {
        fireEvent.click(screen.getByRole('button', { name: /new product/i }));
      });

      const nameInput = screen.getByPlaceholderText('e.g., Automation Designer');
      fireEvent.change(nameInput, { target: { value: 'Test Product Name' } });

      await waitFor(() => {
        const prefixInput = screen.getByPlaceholderText('e.g., AD') as HTMLInputElement;
        expect(prefixInput.value).toBe('TPN');
      });
    });

    it('should have Cancel and Create buttons', async () => {
      mockProductsApi.list.mockResolvedValue([]);

      renderWithRouter(<Products />);

      await waitFor(() => {
        fireEvent.click(screen.getByRole('button', { name: /new product/i }));
      });

      await waitFor(() => {
        expect(screen.getByRole('button', { name: 'Cancel' })).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /create product/i })).toBeInTheDocument();
      });
    });

    it('should disable Create button when name or prefix is empty', async () => {
      mockProductsApi.list.mockResolvedValue([]);

      renderWithRouter(<Products />);

      await waitFor(() => {
        fireEvent.click(screen.getByRole('button', { name: /new product/i }));
      });

      await waitFor(() => {
        const createButton = screen.getByRole('button', { name: /create product/i });
        expect(createButton).toBeDisabled();
      });
    });

    it('should enable Create button when name and prefix are provided', async () => {
      mockProductsApi.list.mockResolvedValue([]);

      renderWithRouter(<Products />);

      await waitFor(() => {
        fireEvent.click(screen.getByRole('button', { name: /new product/i }));
      });

      const nameInput = screen.getByPlaceholderText('e.g., Automation Designer');
      fireEvent.change(nameInput, { target: { value: 'Test Product' } });

      await waitFor(() => {
        const createButton = screen.getByRole('button', { name: /create product/i });
        expect(createButton).not.toBeDisabled();
      });
    });

    it('should close dialog when Cancel is clicked', async () => {
      mockProductsApi.list.mockResolvedValue([]);

      renderWithRouter(<Products />);

      await waitFor(() => {
        fireEvent.click(screen.getByRole('button', { name: /new product/i }));
      });

      fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));

      await waitFor(() => {
        expect(screen.queryByText('Create New Product')).not.toBeInTheDocument();
      });
    });

    it('should create product and refresh list on submit', async () => {
      mockProductsApi.list.mockResolvedValueOnce([]).mockResolvedValueOnce([
        {
          id: 'new-prod',
          name: 'New Product',
          prefix: 'NP',
          description: 'Description',
          created_at: '2024-01-01T00:00:00Z',
          updated_at: '2024-01-01T00:00:00Z',
          requirement_count: 0,
        },
      ]);
      mockProductsApi.create.mockResolvedValue({
        id: 'new-prod',
        name: 'New Product',
        prefix: 'NP',
      });

      renderWithRouter(<Products />);

      await waitFor(() => {
        fireEvent.click(screen.getByRole('button', { name: /new product/i }));
      });

      const nameInput = screen.getByPlaceholderText('e.g., Automation Designer');
      fireEvent.change(nameInput, { target: { value: 'New Product' } });

      const descInput = screen.getByPlaceholderText('What does this product do?');
      fireEvent.change(descInput, { target: { value: 'Description' } });

      fireEvent.click(screen.getByRole('button', { name: /create product/i }));

      await waitFor(() => {
        expect(mockProductsApi.create).toHaveBeenCalledWith({
          name: 'New Product',
          prefix: 'NP',
          description: 'Description',
        });
      });
    });
  });

  describe('error handling', () => {
    it('should handle API errors gracefully', async () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      mockProductsApi.list.mockRejectedValue(new Error('Network error'));

      renderWithRouter(<Products />);

      await waitFor(() => {
        expect(screen.getByText('Products')).toBeInTheDocument();
      });

      expect(consoleSpy).toHaveBeenCalled();
      consoleSpy.mockRestore();
    });
  });
});

describe('suggestPrefix function', () => {
  // Test the prefix suggestion logic indirectly through the component
  it('should generate 3-letter prefix for single word', async () => {
    mockProductsApi.list.mockResolvedValue([]);

    renderWithRouter(<Products />);

    await waitFor(() => {
      fireEvent.click(screen.getByRole('button', { name: /new product/i }));
    });

    const nameInput = screen.getByPlaceholderText('e.g., Automation Designer');
    fireEvent.change(nameInput, { target: { value: 'Dashboard' } });

    await waitFor(() => {
      const prefixInput = screen.getByPlaceholderText('e.g., AD') as HTMLInputElement;
      expect(prefixInput.value).toBe('DAS');
    });
  });

  it('should generate acronym for multiple words', async () => {
    mockProductsApi.list.mockResolvedValue([]);

    renderWithRouter(<Products />);

    await waitFor(() => {
      fireEvent.click(screen.getByRole('button', { name: /new product/i }));
    });

    const nameInput = screen.getByPlaceholderText('e.g., Automation Designer');
    fireEvent.change(nameInput, { target: { value: 'Customer Relationship Management' } });

    await waitFor(() => {
      const prefixInput = screen.getByPlaceholderText('e.g., AD') as HTMLInputElement;
      expect(prefixInput.value).toBe('CRM');
    });
  });

  it('should limit acronym to 4 characters for very long names', async () => {
    mockProductsApi.list.mockResolvedValue([]);

    renderWithRouter(<Products />);

    await waitFor(() => {
      fireEvent.click(screen.getByRole('button', { name: /new product/i }));
    });

    const nameInput = screen.getByPlaceholderText('e.g., Automation Designer');
    fireEvent.change(nameInput, { target: { value: 'Customer Relationship Management System Extra' } });

    await waitFor(() => {
      const prefixInput = screen.getByPlaceholderText('e.g., AD') as HTMLInputElement;
      expect(prefixInput.value).toBe('CRMS');
    });
  });
});
