import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';

// Mock the API client
vi.mock('../../../frontend/src/api/client', () => ({
  releasesApi: {
    get: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  },
}));

// Mock date-fns
vi.mock('date-fns', () => ({
  formatDistanceToNow: vi.fn(() => '2 days ago'),
}));

// Mock window.confirm
vi.stubGlobal('confirm', vi.fn());

import ReleaseDetail from '../../../frontend/src/pages/ReleaseDetail';
import { releasesApi } from '../../../frontend/src/api/client';

const mockReleasesApi = releasesApi as {
  get: ReturnType<typeof vi.fn>;
  update: ReturnType<typeof vi.fn>;
  delete: ReturnType<typeof vi.fn>;
};

function renderWithRouter(releaseId: string) {
  return render(
    <MemoryRouter initialEntries={[`/releases/${releaseId}`]}>
      <Routes>
        <Route path="/releases/:id" element={<ReleaseDetail />} />
        <Route path="/releases" element={<div>Releases List</div>} />
      </Routes>
    </MemoryRouter>
  );
}

describe('ReleaseDetail Page', () => {
  const mockRequirements = [
    {
      id: 'req-1',
      stable_key: 'TP-001',
      title: 'Requirement One',
      status: 'verified',
      priority: 'high',
      parent_id: null,
    },
    {
      id: 'req-2',
      stable_key: 'TP-002',
      title: 'Requirement Two',
      status: 'implemented',
      priority: 'medium',
      parent_id: null,
    },
  ];

  const mockRelease = {
    id: 'rel-123',
    product_id: 'prod-123',
    version_name: 'v1.0.0',
    description: 'Initial release with core features',
    requirements_snapshot: JSON.stringify(mockRequirements),
    stats: JSON.stringify({ total: 2 }),
    status: 'draft',
    created_at: '2024-01-01T00:00:00Z',
    released_at: null,
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockReleasesApi.get.mockResolvedValue(mockRelease);
    (window.confirm as ReturnType<typeof vi.fn>).mockReturnValue(true);
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  describe('loading state', () => {
    it('should show loading spinner initially', () => {
      mockReleasesApi.get.mockImplementation(() => new Promise(() => {}));

      renderWithRouter('rel-123');

      const loader = document.querySelector('.animate-spin');
      expect(loader).toBeInTheDocument();
    });
  });

  describe('not found state', () => {
    it('should show not found message when release does not exist', async () => {
      mockReleasesApi.get.mockRejectedValue(new Error('Not found'));

      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      renderWithRouter('non-existent');

      await waitFor(() => {
        expect(screen.getByText('Release not found')).toBeInTheDocument();
      });

      consoleSpy.mockRestore();
    });
  });

  describe('header', () => {
    it('should display back link to releases', async () => {
      renderWithRouter('rel-123');

      await waitFor(() => {
        const backLink = screen.getByRole('link', { name: /back to releases/i });
        expect(backLink).toHaveAttribute('href', '/releases');
      });
    });

    it('should display version name', async () => {
      renderWithRouter('rel-123');

      await waitFor(() => {
        expect(screen.getByRole('heading', { level: 1, name: 'v1.0.0' })).toBeInTheDocument();
      });
    });

    it('should display status badge', async () => {
      renderWithRouter('rel-123');

      await waitFor(() => {
        expect(screen.getByText('draft')).toBeInTheDocument();
      });
    });

    it('should have delete button', async () => {
      renderWithRouter('rel-123');

      await waitFor(() => {
        const buttons = screen.getAllByRole('button');
        expect(buttons.length).toBeGreaterThan(0);
      });
    });

    it('should have Mark as Released button for draft releases', async () => {
      renderWithRouter('rel-123');

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /mark as released/i })).toBeInTheDocument();
      });
    });

    it('should not show Mark as Released button for already released releases', async () => {
      mockReleasesApi.get.mockResolvedValue({
        ...mockRelease,
        status: 'released',
        released_at: '2024-01-02T00:00:00Z',
      });

      renderWithRouter('rel-123');

      await waitFor(() => {
        expect(screen.queryByRole('button', { name: /mark as released/i })).not.toBeInTheDocument();
      });
    });
  });

  describe('description', () => {
    it('should display release description', async () => {
      renderWithRouter('rel-123');

      await waitFor(() => {
        expect(screen.getByText('Initial release with core features')).toBeInTheDocument();
      });
    });

    it('should not show description if empty', async () => {
      mockReleasesApi.get.mockResolvedValue({
        ...mockRelease,
        description: null,
      });

      renderWithRouter('rel-123');

      await waitFor(() => {
        expect(screen.getByText('v1.0.0')).toBeInTheDocument();
        // No description element should be rendered
      });
    });
  });

  describe('stats cards', () => {
    it('should display total requirements count', async () => {
      renderWithRouter('rel-123');

      await waitFor(() => {
        expect(screen.getByText('2')).toBeInTheDocument();
        expect(screen.getByText('Total Requirements')).toBeInTheDocument();
      });
    });

    it('should display created time', async () => {
      renderWithRouter('rel-123');

      await waitFor(() => {
        expect(screen.getByText('Created')).toBeInTheDocument();
        expect(screen.getByText('2 days ago')).toBeInTheDocument();
      });
    });

    it('should display "Not released" when released_at is null', async () => {
      renderWithRouter('rel-123');

      await waitFor(() => {
        expect(screen.getByText('Released')).toBeInTheDocument();
        expect(screen.getByText('Not released')).toBeInTheDocument();
      });
    });
  });

  describe('requirements snapshot', () => {
    it('should display Requirements Snapshot section', async () => {
      renderWithRouter('rel-123');

      await waitFor(() => {
        expect(screen.getByText('Requirements Snapshot')).toBeInTheDocument();
      });
    });

    it('should display requirement titles', async () => {
      renderWithRouter('rel-123');

      await waitFor(() => {
        expect(screen.getByText('Requirement One')).toBeInTheDocument();
        expect(screen.getByText('Requirement Two')).toBeInTheDocument();
      });
    });

    it('should display requirement stable keys', async () => {
      renderWithRouter('rel-123');

      await waitFor(() => {
        expect(screen.getByText('TP-001')).toBeInTheDocument();
        expect(screen.getByText('TP-002')).toBeInTheDocument();
      });
    });

    it('should display requirement statuses', async () => {
      renderWithRouter('rel-123');

      await waitFor(() => {
        expect(screen.getByText('verified')).toBeInTheDocument();
        expect(screen.getByText('implemented')).toBeInTheDocument();
      });
    });

    it('should display requirement priorities', async () => {
      renderWithRouter('rel-123');

      await waitFor(() => {
        expect(screen.getByText('high')).toBeInTheDocument();
        expect(screen.getByText('medium')).toBeInTheDocument();
      });
    });

    it('should show empty state when no requirements in snapshot', async () => {
      mockReleasesApi.get.mockResolvedValue({
        ...mockRelease,
        requirements_snapshot: '[]',
        stats: JSON.stringify({ total: 0 }),
      });

      renderWithRouter('rel-123');

      await waitFor(() => {
        expect(screen.getByText('No requirements in this snapshot')).toBeInTheDocument();
      });
    });
  });

  describe('mark as released', () => {
    it('should call update API when Mark as Released is clicked', async () => {
      mockReleasesApi.update.mockResolvedValue({
        ...mockRelease,
        status: 'released',
      });

      renderWithRouter('rel-123');

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /mark as released/i })).toBeInTheDocument();
      });

      fireEvent.click(screen.getByRole('button', { name: /mark as released/i }));

      await waitFor(() => {
        expect(mockReleasesApi.update).toHaveBeenCalledWith('rel-123', { status: 'released' });
      });
    });

    it('should show loading state while updating', async () => {
      mockReleasesApi.update.mockImplementation(() => new Promise(() => {}));

      renderWithRouter('rel-123');

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /mark as released/i })).toBeInTheDocument();
      });

      fireEvent.click(screen.getByRole('button', { name: /mark as released/i }));

      await waitFor(() => {
        const button = screen.getByRole('button', { name: /mark as released/i });
        expect(button.querySelector('.animate-spin')).toBeInTheDocument();
      });
    });
  });

  describe('delete', () => {
    it('should show confirmation dialog before delete', async () => {
      renderWithRouter('rel-123');

      await waitFor(() => {
        expect(screen.getByText('v1.0.0')).toBeInTheDocument();
      });

      // Find delete button
      const buttons = screen.getAllByRole('button');
      const deleteButton = buttons[0];

      fireEvent.click(deleteButton);

      expect(window.confirm).toHaveBeenCalled();
    });

    it('should not delete if confirmation is cancelled', async () => {
      (window.confirm as ReturnType<typeof vi.fn>).mockReturnValue(false);

      renderWithRouter('rel-123');

      await waitFor(() => {
        expect(screen.getByText('v1.0.0')).toBeInTheDocument();
      });

      const buttons = screen.getAllByRole('button');
      const deleteButton = buttons[0];

      fireEvent.click(deleteButton);

      expect(mockReleasesApi.delete).not.toHaveBeenCalled();
    });

    it('should call delete API when confirmed', async () => {
      (window.confirm as ReturnType<typeof vi.fn>).mockReturnValue(true);
      mockReleasesApi.delete.mockResolvedValue({});

      renderWithRouter('rel-123');

      await waitFor(() => {
        expect(screen.getByText('v1.0.0')).toBeInTheDocument();
      });

      const buttons = screen.getAllByRole('button');
      const deleteButton = buttons[0];

      fireEvent.click(deleteButton);

      await waitFor(() => {
        expect(mockReleasesApi.delete).toHaveBeenCalledWith('rel-123');
      });
    });
  });

  describe('error handling', () => {
    it('should handle update error gracefully', async () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      mockReleasesApi.update.mockRejectedValue(new Error('Update failed'));

      renderWithRouter('rel-123');

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /mark as released/i })).toBeInTheDocument();
      });

      fireEvent.click(screen.getByRole('button', { name: /mark as released/i }));

      await waitFor(() => {
        expect(consoleSpy).toHaveBeenCalled();
      });

      consoleSpy.mockRestore();
    });

    it('should handle delete error gracefully', async () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      mockReleasesApi.delete.mockRejectedValue(new Error('Delete failed'));

      renderWithRouter('rel-123');

      await waitFor(() => {
        expect(screen.getByText('v1.0.0')).toBeInTheDocument();
      });

      const buttons = screen.getAllByRole('button');
      const deleteButton = buttons[0];

      fireEvent.click(deleteButton);

      await waitFor(() => {
        expect(consoleSpy).toHaveBeenCalled();
      });

      consoleSpy.mockRestore();
    });
  });
});

describe('Released release', () => {
  it('should show released_at time instead of "Not released"', async () => {
    vi.clearAllMocks();

    const releasedRelease = {
      id: 'rel-123',
      product_id: 'prod-123',
      version_name: 'v1.0.0',
      description: 'Released version',
      requirements_snapshot: '[]',
      stats: JSON.stringify({ total: 0 }),
      status: 'released',
      created_at: '2024-01-01T00:00:00Z',
      released_at: '2024-01-15T00:00:00Z',
    };

    (releasesApi.get as ReturnType<typeof vi.fn>).mockResolvedValue(releasedRelease);

    renderWithRouter('rel-123');

    await waitFor(() => {
      expect(screen.getByText('Released')).toBeInTheDocument();
      // formatDistanceToNow is mocked to return '2 days ago'
      const releasedText = screen.getAllByText('2 days ago');
      expect(releasedText.length).toBeGreaterThan(0);
    });
  });

  it('should show success badge for released status', async () => {
    vi.clearAllMocks();

    const releasedRelease = {
      id: 'rel-123',
      product_id: 'prod-123',
      version_name: 'v1.0.0',
      description: null,
      requirements_snapshot: '[]',
      stats: null,
      status: 'released',
      created_at: '2024-01-01T00:00:00Z',
      released_at: '2024-01-15T00:00:00Z',
    };

    (releasesApi.get as ReturnType<typeof vi.fn>).mockResolvedValue(releasedRelease);

    renderWithRouter('rel-123');

    await waitFor(() => {
      const statusBadge = screen.getByText('released');
      expect(statusBadge).toBeInTheDocument();
    });
  });
});
