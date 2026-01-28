import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Outlet } from 'react-router-dom';

// Mock all page components to simplify routing tests
vi.mock('../../frontend/src/pages/Dashboard', () => ({
  default: () => <div data-testid="dashboard-page">Dashboard Page</div>,
}));

vi.mock('../../frontend/src/pages/Products', () => ({
  default: () => <div data-testid="products-page">Products Page</div>,
}));

vi.mock('../../frontend/src/pages/ProductDetail', () => ({
  default: () => <div data-testid="product-detail-page">Product Detail Page</div>,
}));

vi.mock('../../frontend/src/pages/RequirementDetail', () => ({
  default: () => <div data-testid="requirement-detail-page">Requirement Detail Page</div>,
}));

vi.mock('../../frontend/src/pages/Releases', () => ({
  default: () => <div data-testid="releases-page">Releases Page</div>,
}));

vi.mock('../../frontend/src/pages/ReleaseDetail', () => ({
  default: () => <div data-testid="release-detail-page">Release Detail Page</div>,
}));

// Mock Layout to render Outlet (which renders child routes)
vi.mock('../../frontend/src/components/layout/Layout', () => ({
  default: function MockLayout() {
    return (
      <div data-testid="layout">
        <Outlet />
      </div>
    );
  },
}));

import App from '../../frontend/src/App';

function renderWithRouter(initialRoute: string = '/') {
  return render(
    <MemoryRouter initialEntries={[initialRoute]}>
      <App />
    </MemoryRouter>
  );
}

describe('App Component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('routing', () => {
    it('should render Dashboard on root path', () => {
      renderWithRouter('/');

      expect(screen.getByTestId('dashboard-page')).toBeInTheDocument();
    });

    it('should render Products page on /products path', () => {
      renderWithRouter('/products');

      expect(screen.getByTestId('products-page')).toBeInTheDocument();
    });

    it('should render ProductDetail page on /products/:id path', () => {
      renderWithRouter('/products/123');

      expect(screen.getByTestId('product-detail-page')).toBeInTheDocument();
    });

    it('should render RequirementDetail page on /requirements/:id path', () => {
      renderWithRouter('/requirements/456');

      expect(screen.getByTestId('requirement-detail-page')).toBeInTheDocument();
    });

    it('should render Releases page on /releases path', () => {
      renderWithRouter('/releases');

      expect(screen.getByTestId('releases-page')).toBeInTheDocument();
    });

    it('should render ReleaseDetail page on /releases/:id path', () => {
      renderWithRouter('/releases/789');

      expect(screen.getByTestId('release-detail-page')).toBeInTheDocument();
    });
  });

  describe('layout', () => {
    it('should wrap routes in Layout component', () => {
      renderWithRouter('/');

      expect(screen.getByTestId('layout')).toBeInTheDocument();
    });
  });
});
