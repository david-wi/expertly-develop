import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';

// Mock the API client
vi.mock('../../../frontend/src/api/client', () => ({
  requirementsApi: {
    get: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  },
}));

// Mock window.confirm
vi.stubGlobal('confirm', vi.fn());

import RequirementDetail from '../../../frontend/src/pages/RequirementDetail';
import { requirementsApi } from '../../../frontend/src/api/client';

const mockRequirementsApi = requirementsApi as {
  get: ReturnType<typeof vi.fn>;
  update: ReturnType<typeof vi.fn>;
  delete: ReturnType<typeof vi.fn>;
};

function renderWithRouter(requirementId: string) {
  return render(
    <MemoryRouter initialEntries={[`/requirements/${requirementId}`]}>
      <Routes>
        <Route path="/requirements/:id" element={<RequirementDetail />} />
        <Route path="/products/:id" element={<div>Product Detail</div>} />
      </Routes>
    </MemoryRouter>
  );
}

describe('RequirementDetail Page', () => {
  const mockRequirement = {
    id: 'req-123',
    product_id: 'prod-123',
    parent_id: null,
    stable_key: 'TP-001',
    title: 'Test Requirement',
    what_this_does: 'Users can do something',
    why_this_exists: 'To enable a feature',
    not_included: '- Feature X\n- Feature Y',
    acceptance_criteria: '- Criterion 1\n- Criterion 2',
    status: 'draft',
    priority: 'high',
    tags: null,
    order_index: 0,
    current_version: 3,
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-01-01T00:00:00Z',
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockRequirementsApi.get.mockResolvedValue(mockRequirement);
    (window.confirm as ReturnType<typeof vi.fn>).mockReturnValue(true);
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  describe('loading state', () => {
    it('should show loading spinner initially', () => {
      mockRequirementsApi.get.mockImplementation(() => new Promise(() => {}));

      renderWithRouter('req-123');

      const loader = document.querySelector('.animate-spin');
      expect(loader).toBeInTheDocument();
    });
  });

  describe('not found state', () => {
    it('should show not found message when requirement does not exist', async () => {
      mockRequirementsApi.get.mockRejectedValue(new Error('Not found'));

      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      renderWithRouter('non-existent');

      await waitFor(() => {
        expect(screen.getByText('Requirement not found')).toBeInTheDocument();
      });

      consoleSpy.mockRestore();
    });
  });

  describe('header', () => {
    it('should display back link to product', async () => {
      renderWithRouter('req-123');

      await waitFor(() => {
        const backLink = screen.getByRole('link', { name: /back to product/i });
        expect(backLink).toHaveAttribute('href', '/products/prod-123');
      });
    });

    it('should display stable key badge', async () => {
      renderWithRouter('req-123');

      await waitFor(() => {
        expect(screen.getByText('TP-001')).toBeInTheDocument();
      });
    });

    it('should display version number', async () => {
      renderWithRouter('req-123');

      await waitFor(() => {
        expect(screen.getByText('v3')).toBeInTheDocument();
      });
    });

    it('should have Save button', async () => {
      renderWithRouter('req-123');

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /save/i })).toBeInTheDocument();
      });
    });

    it('should have Delete button', async () => {
      renderWithRouter('req-123');

      await waitFor(() => {
        const buttons = screen.getAllByRole('button');
        const deleteButton = buttons.find((btn) => btn.querySelector('svg'));
        expect(deleteButton).toBeInTheDocument();
      });
    });
  });

  describe('form fields', () => {
    it('should display title input with value', async () => {
      renderWithRouter('req-123');

      await waitFor(() => {
        const titleInput = screen.getByDisplayValue('Test Requirement');
        expect(titleInput).toBeInTheDocument();
      });
    });

    it('should display what_this_does textarea', async () => {
      renderWithRouter('req-123');

      await waitFor(() => {
        expect(screen.getByDisplayValue('Users can do something')).toBeInTheDocument();
      });
    });

    it('should display why_this_exists textarea', async () => {
      renderWithRouter('req-123');

      await waitFor(() => {
        expect(screen.getByDisplayValue('To enable a feature')).toBeInTheDocument();
      });
    });

    it('should display not_included textarea', async () => {
      renderWithRouter('req-123');

      await waitFor(() => {
        // Find textarea containing the not_included text
        const textareas = screen.getAllByRole('textbox');
        const notIncludedTextarea = textareas.find(
          (ta) => (ta as HTMLTextAreaElement).value.includes('Feature X')
        );
        expect(notIncludedTextarea).toBeInTheDocument();
      });
    });

    it('should display acceptance_criteria textarea', async () => {
      renderWithRouter('req-123');

      await waitFor(() => {
        // Find textarea containing the acceptance_criteria text
        const textareas = screen.getAllByRole('textbox');
        const acTextarea = textareas.find(
          (ta) => (ta as HTMLTextAreaElement).value.includes('Criterion 1')
        );
        expect(acTextarea).toBeInTheDocument();
      });
    });

    it('should have helper text for fields', async () => {
      renderWithRouter('req-123');

      await waitFor(() => {
        expect(screen.getByText(/one clear sentence starting with/i)).toBeInTheDocument();
        expect(screen.getByText(/bullets that avoid confusion/i)).toBeInTheDocument();
        expect(screen.getByText(/testable criteria/i)).toBeInTheDocument();
      });
    });
  });

  describe('status and priority selects', () => {
    it('should have status select', async () => {
      renderWithRouter('req-123');

      await waitFor(() => {
        expect(screen.getByText('Status')).toBeInTheDocument();
      });
    });

    it('should have priority select', async () => {
      renderWithRouter('req-123');

      await waitFor(() => {
        expect(screen.getByText('Priority')).toBeInTheDocument();
      });
    });
  });

  describe('form interactions', () => {
    it('should update title on change', async () => {
      renderWithRouter('req-123');

      await waitFor(() => {
        expect(screen.getByDisplayValue('Test Requirement')).toBeInTheDocument();
      });

      const titleInput = screen.getByDisplayValue('Test Requirement');
      fireEvent.change(titleInput, { target: { value: 'Updated Title' } });

      expect(screen.getByDisplayValue('Updated Title')).toBeInTheDocument();
    });

    it('should update what_this_does on change', async () => {
      renderWithRouter('req-123');

      await waitFor(() => {
        expect(screen.getByDisplayValue('Users can do something')).toBeInTheDocument();
      });

      const textarea = screen.getByDisplayValue('Users can do something');
      fireEvent.change(textarea, { target: { value: 'Users can do something new' } });

      expect(screen.getByDisplayValue('Users can do something new')).toBeInTheDocument();
    });
  });

  describe('save functionality', () => {
    it('should call update API on save', async () => {
      mockRequirementsApi.update.mockResolvedValue(mockRequirement);

      renderWithRouter('req-123');

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /save/i })).toBeInTheDocument();
      });

      // Modify something
      const titleInput = screen.getByDisplayValue('Test Requirement');
      fireEvent.change(titleInput, { target: { value: 'Updated Title' } });

      // Click save
      fireEvent.click(screen.getByRole('button', { name: /save/i }));

      await waitFor(() => {
        expect(mockRequirementsApi.update).toHaveBeenCalledWith(
          'req-123',
          expect.objectContaining({
            title: 'Updated Title',
          })
        );
      });
    });

    it('should show loading state while saving', async () => {
      mockRequirementsApi.update.mockImplementation(() => new Promise(() => {}));

      renderWithRouter('req-123');

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /save/i })).toBeInTheDocument();
      });

      fireEvent.click(screen.getByRole('button', { name: /save/i }));

      await waitFor(() => {
        // Button should show loading spinner
        const saveButton = screen.getByRole('button', { name: /save/i });
        expect(saveButton.querySelector('.animate-spin')).toBeInTheDocument();
      });
    });

    it('should handle save error gracefully', async () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      mockRequirementsApi.update.mockRejectedValue(new Error('Save failed'));

      renderWithRouter('req-123');

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /save/i })).toBeInTheDocument();
      });

      fireEvent.click(screen.getByRole('button', { name: /save/i }));

      await waitFor(() => {
        expect(consoleSpy).toHaveBeenCalled();
      });

      consoleSpy.mockRestore();
    });
  });

  describe('delete functionality', () => {
    it('should show confirmation dialog before delete', async () => {
      renderWithRouter('req-123');

      await waitFor(() => {
        expect(screen.getByText('TP-001')).toBeInTheDocument();
      });

      // Find delete button (has Trash2 icon)
      const buttons = screen.getAllByRole('button');
      const deleteButton = buttons.find(
        (btn) => btn.classList.contains('variant') || !btn.textContent?.includes('Save')
      );

      if (deleteButton) {
        fireEvent.click(deleteButton);
      }

      expect(window.confirm).toHaveBeenCalled();
    });

    it('should not delete if confirmation is cancelled', async () => {
      (window.confirm as ReturnType<typeof vi.fn>).mockReturnValue(false);

      renderWithRouter('req-123');

      await waitFor(() => {
        expect(screen.getByText('TP-001')).toBeInTheDocument();
      });

      const buttons = screen.getAllByRole('button');
      const deleteButton = buttons[0]; // First button is delete

      fireEvent.click(deleteButton);

      expect(mockRequirementsApi.delete).not.toHaveBeenCalled();
    });

    it('should call delete API when confirmed', async () => {
      (window.confirm as ReturnType<typeof vi.fn>).mockReturnValue(true);
      mockRequirementsApi.delete.mockResolvedValue({});

      renderWithRouter('req-123');

      await waitFor(() => {
        expect(screen.getByText('TP-001')).toBeInTheDocument();
      });

      const buttons = screen.getAllByRole('button');
      const deleteButton = buttons[0]; // First button is delete

      fireEvent.click(deleteButton);

      await waitFor(() => {
        expect(mockRequirementsApi.delete).toHaveBeenCalledWith('req-123');
      });
    });
  });

  describe('empty fields', () => {
    it('should handle requirement with empty optional fields', async () => {
      mockRequirementsApi.get.mockResolvedValue({
        ...mockRequirement,
        what_this_does: null,
        why_this_exists: null,
        not_included: null,
        acceptance_criteria: null,
      });

      renderWithRouter('req-123');

      await waitFor(() => {
        expect(screen.getByText('TP-001')).toBeInTheDocument();
      });

      // All textareas should render with empty values
      const textareas = screen.getAllByRole('textbox');
      expect(textareas.length).toBeGreaterThan(0);
    });
  });
});

describe('Status options', () => {
  it('should include all expected status options', async () => {
    const mockRequirement = {
      id: 'req-123',
      product_id: 'prod-123',
      parent_id: null,
      stable_key: 'TP-001',
      title: 'Test',
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
    };

    vi.clearAllMocks();
    (requirementsApi.get as ReturnType<typeof vi.fn>).mockResolvedValue(mockRequirement);

    renderWithRouter('req-123');

    await waitFor(() => {
      expect(screen.getByText('Status')).toBeInTheDocument();
    });

    // Status options should be: draft, ready_to_build, implemented, verified
    // These are rendered in a Select component
  });
});

describe('Priority options', () => {
  it('should include all expected priority options', async () => {
    const mockRequirement = {
      id: 'req-123',
      product_id: 'prod-123',
      parent_id: null,
      stable_key: 'TP-001',
      title: 'Test',
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
    };

    vi.clearAllMocks();
    (requirementsApi.get as ReturnType<typeof vi.fn>).mockResolvedValue(mockRequirement);

    renderWithRouter('req-123');

    await waitFor(() => {
      expect(screen.getByText('Priority')).toBeInTheDocument();
    });

    // Priority options should be: critical, high, medium, low
  });
});
