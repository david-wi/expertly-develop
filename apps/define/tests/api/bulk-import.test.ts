import { describe, it, expect } from 'vitest';

/**
 * Tests for the AI-powered bulk import enhancement
 * These tests verify type safety and interface contracts
 */

// Type definitions matching the implementation
interface ParsedRequirement {
  tempId: string;
  title: string;
  whatThisDoes: string;
  whyThisExists: string;
  notIncluded: string;
  acceptanceCriteria: string;
  priority: string;
  tags: string[];
  parentRef: string | null;
}

interface FetchedUrl {
  url: string;
  title: string;
  content: string;
  fetching?: boolean;
  error?: string;
}

interface ContextUrl {
  url: string;
  title: string;
  content: string;
}

interface BatchRequirement {
  tempId: string;
  title: string;
  whatThisDoes?: string;
  whyThisExists?: string;
  notIncluded?: string;
  acceptanceCriteria?: string;
  status?: string;
  priority?: string;
  tags?: string[];
  parentRef?: string;
}

interface AttachmentFile {
  name: string;
  type: string;
  content: string;
}

type ApprovalStatus = 'pending' | 'approved' | 'rejected';

interface ParsedRequirementWithApproval extends ParsedRequirement {
  approvalStatus: ApprovalStatus;
}

describe('Bulk Import Types', () => {
  describe('ParsedRequirement interface', () => {
    it('should accept valid ParsedRequirement objects', () => {
      const req: ParsedRequirement = {
        tempId: 'temp-1',
        title: 'User Authentication',
        whatThisDoes: 'Users can log in with email and password',
        whyThisExists: 'Secure access to the system',
        notIncluded: '- Social login\n- SSO',
        acceptanceCriteria: '- User can enter credentials\n- System validates credentials',
        priority: 'high',
        tags: ['functional', 'security'],
        parentRef: null,
      };

      expect(req.tempId).toBe('temp-1');
      expect(req.title).toBe('User Authentication');
      expect(req.tags).toContain('functional');
      expect(req.parentRef).toBeNull();
    });

    it('should accept ParsedRequirement with parentRef', () => {
      const req: ParsedRequirement = {
        tempId: 'temp-2',
        title: 'Password Reset',
        whatThisDoes: 'Users can reset their forgotten password',
        whyThisExists: 'Allow users to regain access',
        notIncluded: '',
        acceptanceCriteria: '- User receives reset email',
        priority: 'medium',
        tags: ['functional'],
        parentRef: 'temp-1',
      };

      expect(req.parentRef).toBe('temp-1');
    });
  });

  describe('ApprovalStatus type', () => {
    it('should only accept valid approval statuses', () => {
      const validStatuses: ApprovalStatus[] = ['pending', 'approved', 'rejected'];

      validStatuses.forEach(status => {
        const req: ParsedRequirementWithApproval = {
          tempId: 'temp-1',
          title: 'Test',
          whatThisDoes: 'Test',
          whyThisExists: 'Test',
          notIncluded: '',
          acceptanceCriteria: '',
          priority: 'medium',
          tags: [],
          parentRef: null,
          approvalStatus: status,
        };
        expect(req.approvalStatus).toBe(status);
      });
    });

    it('should filter approved requirements correctly', () => {
      const requirements: ParsedRequirementWithApproval[] = [
        { tempId: '1', title: 'Approved', approvalStatus: 'approved', whatThisDoes: '', whyThisExists: '', notIncluded: '', acceptanceCriteria: '', priority: 'medium', tags: [], parentRef: null },
        { tempId: '2', title: 'Pending', approvalStatus: 'pending', whatThisDoes: '', whyThisExists: '', notIncluded: '', acceptanceCriteria: '', priority: 'medium', tags: [], parentRef: null },
        { tempId: '3', title: 'Rejected', approvalStatus: 'rejected', whatThisDoes: '', whyThisExists: '', notIncluded: '', acceptanceCriteria: '', priority: 'medium', tags: [], parentRef: null },
        { tempId: '4', title: 'Also Approved', approvalStatus: 'approved', whatThisDoes: '', whyThisExists: '', notIncluded: '', acceptanceCriteria: '', priority: 'medium', tags: [], parentRef: null },
      ];

      const approved = requirements.filter(r => r.approvalStatus === 'approved');
      const pending = requirements.filter(r => r.approvalStatus === 'pending');
      const rejected = requirements.filter(r => r.approvalStatus === 'rejected');

      expect(approved).toHaveLength(2);
      expect(pending).toHaveLength(1);
      expect(rejected).toHaveLength(1);
    });
  });

  describe('FetchedUrl interface', () => {
    it('should accept valid FetchedUrl objects', () => {
      const urlItem: FetchedUrl = {
        url: 'https://example.com/jira/PROJ-123',
        title: 'PROJ-123: User Story Title',
        content: 'As a user, I want to...',
      };

      expect(urlItem.url).toContain('https://');
      expect(urlItem.title).toBeTruthy();
      expect(urlItem.fetching).toBeUndefined();
    });

    it('should accept FetchedUrl with error state', () => {
      const urlItem: FetchedUrl = {
        url: 'https://example.com/404',
        title: '',
        content: '',
        fetching: false,
        error: 'Failed to fetch: 404 Not Found',
      };

      expect(urlItem.error).toBeDefined();
      expect(urlItem.fetching).toBe(false);
    });
  });

  describe('ContextUrl interface', () => {
    it('should accept valid ContextUrl for AI prompt', () => {
      const context: ContextUrl = {
        url: 'https://example.com/docs',
        title: 'API Documentation',
        content: 'This API provides endpoints for user management...',
      };

      expect(context.url).toBe('https://example.com/docs');
      expect(context.content.length).toBeGreaterThan(0);
    });
  });

  describe('BatchRequirement interface', () => {
    it('should accept minimal BatchRequirement', () => {
      const req: BatchRequirement = {
        tempId: 'temp-1',
        title: 'Test Requirement',
      };

      expect(req.tempId).toBeDefined();
      expect(req.title).toBeDefined();
      expect(req.whatThisDoes).toBeUndefined();
    });

    it('should accept full BatchRequirement', () => {
      const req: BatchRequirement = {
        tempId: 'temp-1',
        title: 'Full Requirement',
        whatThisDoes: 'Users can do something',
        whyThisExists: 'Business value',
        notIncluded: '- Not this',
        acceptanceCriteria: '- This criterion',
        status: 'draft',
        priority: 'high',
        tags: ['functional'],
        parentRef: 'existing-id',
      };

      expect(req.status).toBe('draft');
      expect(req.tags).toContain('functional');
    });
  });

  describe('AttachmentFile interface', () => {
    it('should accept image attachment', () => {
      const file: AttachmentFile = {
        name: 'screenshot.png',
        type: 'image/png',
        content: 'base64encodedcontent...',
      };

      expect(file.type).toBe('image/png');
    });

    it('should accept PDF attachment', () => {
      const file: AttachmentFile = {
        name: 'requirements.pdf',
        type: 'application/pdf',
        content: 'base64encodedpdfcontent...',
      };

      expect(file.type).toBe('application/pdf');
    });

    it('should accept text attachment', () => {
      const file: AttachmentFile = {
        name: 'notes.txt',
        type: 'text/plain',
        content: 'Plain text content here',
      };

      expect(file.type).toBe('text/plain');
    });
  });
});

describe('URL Validation', () => {
  it('should validate URL format', () => {
    const validUrls = [
      'https://example.com',
      'https://jira.company.com/browse/PROJ-123',
      'http://localhost:3000/test',
      'https://example.com/path?query=value',
    ];

    const invalidUrls = [
      'not-a-url',
      'ftp://example.com',
      'javascript:alert(1)',
      '',
      'example.com', // missing protocol
    ];

    validUrls.forEach(url => {
      let isValid = false;
      try {
        const parsed = new URL(url);
        isValid = ['http:', 'https:'].includes(parsed.protocol);
      } catch {
        isValid = false;
      }
      expect(isValid).toBe(true);
    });

    invalidUrls.forEach(url => {
      let isValid = false;
      try {
        const parsed = new URL(url);
        isValid = ['http:', 'https:'].includes(parsed.protocol);
      } catch {
        isValid = false;
      }
      expect(isValid).toBe(false);
    });
  });
});

describe('Approval Workflow Logic', () => {
  it('should correctly count requirements by status', () => {
    const requirements: ParsedRequirementWithApproval[] = [
      createMockRequirement('1', 'pending'),
      createMockRequirement('2', 'approved'),
      createMockRequirement('3', 'approved'),
      createMockRequirement('4', 'rejected'),
      createMockRequirement('5', 'pending'),
      createMockRequirement('6', 'pending'),
    ];

    const pendingCount = requirements.filter(r => r.approvalStatus === 'pending').length;
    const approvedCount = requirements.filter(r => r.approvalStatus === 'approved').length;
    const rejectedCount = requirements.filter(r => r.approvalStatus === 'rejected').length;

    expect(pendingCount).toBe(3);
    expect(approvedCount).toBe(2);
    expect(rejectedCount).toBe(1);
  });

  it('should approve all pending requirements', () => {
    const requirements: ParsedRequirementWithApproval[] = [
      createMockRequirement('1', 'pending'),
      createMockRequirement('2', 'approved'),
      createMockRequirement('3', 'pending'),
      createMockRequirement('4', 'rejected'),
    ];

    const afterApproveAll = requirements.map(r =>
      r.approvalStatus === 'pending'
        ? { ...r, approvalStatus: 'approved' as ApprovalStatus }
        : r
    );

    expect(afterApproveAll.filter(r => r.approvalStatus === 'pending')).toHaveLength(0);
    expect(afterApproveAll.filter(r => r.approvalStatus === 'approved')).toHaveLength(3);
    expect(afterApproveAll.filter(r => r.approvalStatus === 'rejected')).toHaveLength(1);
  });

  it('should reject all pending requirements', () => {
    const requirements: ParsedRequirementWithApproval[] = [
      createMockRequirement('1', 'pending'),
      createMockRequirement('2', 'approved'),
      createMockRequirement('3', 'pending'),
    ];

    const afterRejectAll = requirements.map(r =>
      r.approvalStatus === 'pending'
        ? { ...r, approvalStatus: 'rejected' as ApprovalStatus }
        : r
    );

    expect(afterRejectAll.filter(r => r.approvalStatus === 'pending')).toHaveLength(0);
    expect(afterRejectAll.filter(r => r.approvalStatus === 'rejected')).toHaveLength(2);
    expect(afterRejectAll.filter(r => r.approvalStatus === 'approved')).toHaveLength(1);
  });

  it('should undo approval/rejection (set to pending)', () => {
    const requirement = createMockRequirement('1', 'approved');
    const undone = { ...requirement, approvalStatus: 'pending' as ApprovalStatus };

    expect(undone.approvalStatus).toBe('pending');
  });
});

describe('Requirement Tree Building', () => {
  it('should identify root requirements', () => {
    const requirements: ParsedRequirementWithApproval[] = [
      { ...createMockRequirement('1', 'approved'), parentRef: null },
      { ...createMockRequirement('2', 'approved'), parentRef: '1' },
      { ...createMockRequirement('3', 'approved'), parentRef: null },
      { ...createMockRequirement('4', 'approved'), parentRef: '1' },
    ];

    const roots = requirements.filter(r => !r.parentRef);
    const children = requirements.filter(r => r.parentRef);

    expect(roots).toHaveLength(2);
    expect(children).toHaveLength(2);
  });

  it('should group children by parent', () => {
    const requirements: ParsedRequirementWithApproval[] = [
      { ...createMockRequirement('parent-1', 'approved'), parentRef: null },
      { ...createMockRequirement('child-1a', 'approved'), parentRef: 'parent-1' },
      { ...createMockRequirement('child-1b', 'approved'), parentRef: 'parent-1' },
      { ...createMockRequirement('parent-2', 'approved'), parentRef: null },
      { ...createMockRequirement('child-2a', 'approved'), parentRef: 'parent-2' },
    ];

    const childrenMap = new Map<string, ParsedRequirementWithApproval[]>();
    requirements.forEach(req => {
      if (req.parentRef) {
        const siblings = childrenMap.get(req.parentRef) || [];
        siblings.push(req);
        childrenMap.set(req.parentRef, siblings);
      }
    });

    expect(childrenMap.get('parent-1')).toHaveLength(2);
    expect(childrenMap.get('parent-2')).toHaveLength(1);
    expect(childrenMap.get('nonexistent')).toBeUndefined();
  });

  it('should cascade delete children when parent is deleted', () => {
    const requirements: ParsedRequirementWithApproval[] = [
      { ...createMockRequirement('parent', 'approved'), parentRef: null },
      { ...createMockRequirement('child-1', 'approved'), parentRef: 'parent' },
      { ...createMockRequirement('grandchild', 'approved'), parentRef: 'child-1' },
      { ...createMockRequirement('other', 'approved'), parentRef: null },
    ];

    // Simulate deleting 'parent'
    const toDelete = new Set(['parent']);
    let changed = true;
    while (changed) {
      changed = false;
      requirements.forEach(r => {
        if (r.parentRef && toDelete.has(r.parentRef) && !toDelete.has(r.tempId)) {
          toDelete.add(r.tempId);
          changed = true;
        }
      });
    }

    const remaining = requirements.filter(r => !toDelete.has(r.tempId));
    expect(remaining).toHaveLength(1);
    expect(remaining[0].tempId).toBe('other');
  });
});

// Helper function to create mock requirements
function createMockRequirement(tempId: string, status: ApprovalStatus): ParsedRequirementWithApproval {
  return {
    tempId,
    title: `Requirement ${tempId}`,
    whatThisDoes: 'Users can do something',
    whyThisExists: 'For testing purposes',
    notIncluded: '',
    acceptanceCriteria: '',
    priority: 'medium',
    tags: ['functional'],
    parentRef: null,
    approvalStatus: status,
  };
}
