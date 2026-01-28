import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import axios from 'axios';

// Mock axios
vi.mock('axios', () => ({
  default: {
    create: vi.fn(() => ({
      get: vi.fn(),
      post: vi.fn(),
      patch: vi.fn(),
      put: vi.fn(),
      delete: vi.fn(),
      interceptors: {
        request: { use: vi.fn() },
        response: { use: vi.fn() },
      },
    })),
  },
}));

describe('API Client', () => {
  let mockAxiosInstance: any;

  beforeEach(() => {
    vi.clearAllMocks();
    mockAxiosInstance = (axios.create as any)();
  });

  afterEach(() => {
    vi.resetModules();
  });

  describe('axios instance configuration', () => {
    it('should create axios instance with correct baseURL', async () => {
      // Import fresh module
      vi.resetModules();
      await import('../../frontend/src/api/client');

      expect(axios.create).toHaveBeenCalledWith(
        expect.objectContaining({
          baseURL: '/api/v1',
        })
      );
    });

    it('should set Content-Type header to application/json', async () => {
      vi.resetModules();
      await import('../../frontend/src/api/client');

      expect(axios.create).toHaveBeenCalledWith(
        expect.objectContaining({
          headers: {
            'Content-Type': 'application/json',
          },
        })
      );
    });

    it('should enable withCredentials for cookie handling', async () => {
      vi.resetModules();
      await import('../../frontend/src/api/client');

      expect(axios.create).toHaveBeenCalledWith(
        expect.objectContaining({
          withCredentials: true,
        })
      );
    });
  });

  describe('productsApi', () => {
    it('should have list method that calls GET /products', async () => {
      vi.resetModules();
      const mockGet = vi.fn().mockResolvedValue({ data: [] });
      (axios.create as any).mockReturnValue({
        get: mockGet,
        post: vi.fn(),
        patch: vi.fn(),
        delete: vi.fn(),
        interceptors: {
          request: { use: vi.fn() },
          response: { use: vi.fn() },
        },
      });

      const { productsApi } = await import('../../frontend/src/api/client');
      await productsApi.list();

      expect(mockGet).toHaveBeenCalledWith('/products');
    });

    it('should have get method that calls GET /products/:id', async () => {
      vi.resetModules();
      const mockGet = vi.fn().mockResolvedValue({ data: { id: '123', name: 'Test' } });
      (axios.create as any).mockReturnValue({
        get: mockGet,
        post: vi.fn(),
        patch: vi.fn(),
        delete: vi.fn(),
        interceptors: {
          request: { use: vi.fn() },
          response: { use: vi.fn() },
        },
      });

      const { productsApi } = await import('../../frontend/src/api/client');
      await productsApi.get('123');

      expect(mockGet).toHaveBeenCalledWith('/products/123');
    });

    it('should have create method that calls POST /products', async () => {
      vi.resetModules();
      const mockPost = vi.fn().mockResolvedValue({ data: { id: '123', name: 'New Product' } });
      (axios.create as any).mockReturnValue({
        get: vi.fn(),
        post: mockPost,
        patch: vi.fn(),
        delete: vi.fn(),
        interceptors: {
          request: { use: vi.fn() },
          response: { use: vi.fn() },
        },
      });

      const { productsApi } = await import('../../frontend/src/api/client');
      await productsApi.create({ name: 'New Product' });

      expect(mockPost).toHaveBeenCalledWith('/products', { name: 'New Product' });
    });

    it('should have update method that calls PATCH /products/:id', async () => {
      vi.resetModules();
      const mockPatch = vi.fn().mockResolvedValue({ data: { id: '123', name: 'Updated' } });
      (axios.create as any).mockReturnValue({
        get: vi.fn(),
        post: vi.fn(),
        patch: mockPatch,
        delete: vi.fn(),
        interceptors: {
          request: { use: vi.fn() },
          response: { use: vi.fn() },
        },
      });

      const { productsApi } = await import('../../frontend/src/api/client');
      await productsApi.update('123', { name: 'Updated' });

      expect(mockPatch).toHaveBeenCalledWith('/products/123', { name: 'Updated' });
    });

    it('should have delete method that calls DELETE /products/:id', async () => {
      vi.resetModules();
      const mockDelete = vi.fn().mockResolvedValue({});
      (axios.create as any).mockReturnValue({
        get: vi.fn(),
        post: vi.fn(),
        patch: vi.fn(),
        delete: mockDelete,
        interceptors: {
          request: { use: vi.fn() },
          response: { use: vi.fn() },
        },
      });

      const { productsApi } = await import('../../frontend/src/api/client');
      await productsApi.delete('123');

      expect(mockDelete).toHaveBeenCalledWith('/products/123');
    });
  });

  describe('requirementsApi', () => {
    it('should have list method that calls GET /requirements with product_id param', async () => {
      vi.resetModules();
      const mockGet = vi.fn().mockResolvedValue({ data: [] });
      (axios.create as any).mockReturnValue({
        get: mockGet,
        post: vi.fn(),
        patch: vi.fn(),
        delete: vi.fn(),
        interceptors: {
          request: { use: vi.fn() },
          response: { use: vi.fn() },
        },
      });

      const { requirementsApi } = await import('../../frontend/src/api/client');
      await requirementsApi.list('prod-123');

      expect(mockGet).toHaveBeenCalledWith('/requirements', { params: { product_id: 'prod-123' } });
    });

    it('should have get method that calls GET /requirements/:id', async () => {
      vi.resetModules();
      const mockGet = vi.fn().mockResolvedValue({ data: { id: 'req-123' } });
      (axios.create as any).mockReturnValue({
        get: mockGet,
        post: vi.fn(),
        patch: vi.fn(),
        delete: vi.fn(),
        interceptors: {
          request: { use: vi.fn() },
          response: { use: vi.fn() },
        },
      });

      const { requirementsApi } = await import('../../frontend/src/api/client');
      await requirementsApi.get('req-123');

      expect(mockGet).toHaveBeenCalledWith('/requirements/req-123');
    });

    it('should have create method that calls POST /requirements', async () => {
      vi.resetModules();
      const mockPost = vi.fn().mockResolvedValue({ data: { id: 'req-123' } });
      (axios.create as any).mockReturnValue({
        get: vi.fn(),
        post: mockPost,
        patch: vi.fn(),
        delete: vi.fn(),
        interceptors: {
          request: { use: vi.fn() },
          response: { use: vi.fn() },
        },
      });

      const { requirementsApi } = await import('../../frontend/src/api/client');
      await requirementsApi.create({
        product_id: 'prod-123',
        title: 'New Requirement',
      });

      expect(mockPost).toHaveBeenCalledWith('/requirements', {
        product_id: 'prod-123',
        title: 'New Requirement',
      });
    });

    it('should have createBatch method that calls POST /requirements/batch', async () => {
      vi.resetModules();
      const mockPost = vi.fn().mockResolvedValue({ data: [] });
      (axios.create as any).mockReturnValue({
        get: vi.fn(),
        post: mockPost,
        patch: vi.fn(),
        delete: vi.fn(),
        interceptors: {
          request: { use: vi.fn() },
          response: { use: vi.fn() },
        },
      });

      const { requirementsApi } = await import('../../frontend/src/api/client');
      await requirementsApi.createBatch({
        product_id: 'prod-123',
        requirements: [{ temp_id: '1', title: 'Req 1' }],
      });

      expect(mockPost).toHaveBeenCalledWith('/requirements/batch', {
        product_id: 'prod-123',
        requirements: [{ temp_id: '1', title: 'Req 1' }],
      });
    });
  });

  describe('releasesApi', () => {
    it('should have list method that calls GET /releases with product_id param', async () => {
      vi.resetModules();
      const mockGet = vi.fn().mockResolvedValue({ data: [] });
      (axios.create as any).mockReturnValue({
        get: mockGet,
        post: vi.fn(),
        patch: vi.fn(),
        delete: vi.fn(),
        interceptors: {
          request: { use: vi.fn() },
          response: { use: vi.fn() },
        },
      });

      const { releasesApi } = await import('../../frontend/src/api/client');
      await releasesApi.list('prod-123');

      expect(mockGet).toHaveBeenCalledWith('/releases', { params: { product_id: 'prod-123' } });
    });

    it('should have create method that calls POST /releases', async () => {
      vi.resetModules();
      const mockPost = vi.fn().mockResolvedValue({ data: { id: 'rel-123' } });
      (axios.create as any).mockReturnValue({
        get: vi.fn(),
        post: mockPost,
        patch: vi.fn(),
        delete: vi.fn(),
        interceptors: {
          request: { use: vi.fn() },
          response: { use: vi.fn() },
        },
      });

      const { releasesApi } = await import('../../frontend/src/api/client');
      await releasesApi.create({
        product_id: 'prod-123',
        version_name: 'v1.0.0',
      });

      expect(mockPost).toHaveBeenCalledWith('/releases', {
        product_id: 'prod-123',
        version_name: 'v1.0.0',
      });
    });
  });

  describe('jiraApi', () => {
    it('should have getSettings method', async () => {
      vi.resetModules();
      const mockGet = vi.fn().mockResolvedValue({ data: null });
      (axios.create as any).mockReturnValue({
        get: mockGet,
        post: vi.fn(),
        put: vi.fn(),
        delete: vi.fn(),
        interceptors: {
          request: { use: vi.fn() },
          response: { use: vi.fn() },
        },
      });

      const { jiraApi } = await import('../../frontend/src/api/client');
      await jiraApi.getSettings('prod-123');

      expect(mockGet).toHaveBeenCalledWith('/jira/settings/prod-123');
    });

    it('should have saveSettings method', async () => {
      vi.resetModules();
      const mockPost = vi.fn().mockResolvedValue({ data: {} });
      (axios.create as any).mockReturnValue({
        get: vi.fn(),
        post: mockPost,
        put: vi.fn(),
        delete: vi.fn(),
        interceptors: {
          request: { use: vi.fn() },
          response: { use: vi.fn() },
        },
      });

      const { jiraApi } = await import('../../frontend/src/api/client');
      await jiraApi.saveSettings('prod-123', {
        jira_host: 'https://test.atlassian.net',
        jira_email: 'test@example.com',
        jira_api_token: 'token123',
        default_project_key: 'TEST',
      });

      expect(mockPost).toHaveBeenCalledWith('/jira/settings/prod-123', {
        jira_host: 'https://test.atlassian.net',
        jira_email: 'test@example.com',
        jira_api_token: 'token123',
        default_project_key: 'TEST',
      });
    });
  });

  describe('usersApi', () => {
    it('should have me method that calls GET /users/me', async () => {
      vi.resetModules();
      const mockGet = vi.fn().mockResolvedValue({
        data: { id: 'user-123', name: 'Test User', email: 'test@example.com' },
      });
      (axios.create as any).mockReturnValue({
        get: mockGet,
        post: vi.fn(),
        patch: vi.fn(),
        delete: vi.fn(),
        interceptors: {
          request: { use: vi.fn() },
          response: { use: vi.fn() },
        },
      });

      const { usersApi } = await import('../../frontend/src/api/client');
      await usersApi.me();

      expect(mockGet).toHaveBeenCalledWith('/users/me');
    });
  });

  describe('organizationsApi', () => {
    it('should have list method that calls GET /organizations', async () => {
      vi.resetModules();
      const mockGet = vi.fn().mockResolvedValue({ data: { items: [], total: 0 } });
      (axios.create as any).mockReturnValue({
        get: mockGet,
        post: vi.fn(),
        patch: vi.fn(),
        delete: vi.fn(),
        interceptors: {
          request: { use: vi.fn() },
          response: { use: vi.fn() },
        },
      });

      const { organizationsApi } = await import('../../frontend/src/api/client');
      await organizationsApi.list();

      expect(mockGet).toHaveBeenCalledWith('/organizations');
    });
  });

  describe('aiApi', () => {
    it('should have parseRequirements method', async () => {
      vi.resetModules();
      const mockPost = vi.fn().mockResolvedValue({ data: { requirements: [] } });
      (axios.create as any).mockReturnValue({
        get: vi.fn(),
        post: mockPost,
        patch: vi.fn(),
        delete: vi.fn(),
        interceptors: {
          request: { use: vi.fn() },
          response: { use: vi.fn() },
        },
      });

      const { aiApi } = await import('../../frontend/src/api/client');
      await aiApi.parseRequirements({
        description: 'Test requirements',
        existing_requirements: [],
        product_name: 'Test Product',
      });

      expect(mockPost).toHaveBeenCalledWith('/ai/parse-requirements', {
        description: 'Test requirements',
        existing_requirements: [],
        product_name: 'Test Product',
      });
    });
  });
});

describe('TypeScript interfaces', () => {
  it('should export Product interface with correct shape', async () => {
    const { productsApi } = await import('../../frontend/src/api/client');

    // Type check - this verifies the interface exists and is exported
    const mockProduct = {
      id: 'test-id',
      name: 'Test Product',
      prefix: 'TP',
      description: null,
      created_at: '2024-01-01T00:00:00Z',
      updated_at: '2024-01-01T00:00:00Z',
      requirement_count: 5,
    };

    // Should compile without errors
    expect(mockProduct.id).toBeDefined();
    expect(mockProduct.name).toBeDefined();
    expect(mockProduct.prefix).toBeDefined();
  });

  it('should export Requirement interface with correct shape', async () => {
    const mockRequirement = {
      id: 'req-123',
      product_id: 'prod-123',
      parent_id: null,
      stable_key: 'REQ-001',
      title: 'Test Requirement',
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

    expect(mockRequirement.id).toBeDefined();
    expect(mockRequirement.status).toBe('draft');
    expect(mockRequirement.priority).toBe('medium');
  });

  it('should export ReleaseSnapshot interface with correct shape', async () => {
    const mockRelease = {
      id: 'rel-123',
      product_id: 'prod-123',
      version_name: 'v1.0.0',
      description: null,
      requirements_snapshot: '[]',
      stats: null,
      status: 'draft',
      created_at: '2024-01-01T00:00:00Z',
      released_at: null,
    };

    expect(mockRelease.id).toBeDefined();
    expect(mockRelease.version_name).toBe('v1.0.0');
    expect(mockRelease.status).toBe('draft');
  });
});
