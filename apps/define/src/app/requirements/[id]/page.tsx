'use client';

import { useState, useEffect, use } from 'react';
import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { RichTextEditor } from '@/components/ui/rich-text-editor';
import { RichTextViewer } from '@/components/ui/rich-text-viewer';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  ArrowLeft,
  Loader2,
  Edit2,
  Plus,
  CheckCircle2,
  XCircle,
  Clock,
  ExternalLink,
  GitBranch,
} from 'lucide-react';
import { formatDistanceToNow, format } from 'date-fns';

interface Version {
  id: string;
  versionNumber: number;
  changeSummary: string | null;
  changedBy: string | null;
  changedAt: string;
  status: string;
}

interface CodeLink {
  id: string;
  filePath: string;
  description: string | null;
  status: string;
  lastCheckedAt: string | null;
}

interface TestLink {
  id: string;
  testPath: string;
  testType: string;
  description: string | null;
  status: string;
  lastRunAt: string | null;
}

interface DeliveryLink {
  id: string;
  externalId: string;
  externalSystem: string;
  intent: string;
  title: string | null;
  url: string | null;
}

interface Requirement {
  id: string;
  productId: string;
  parentId: string | null;
  stableKey: string;
  title: string;
  whatThisDoes: string | null;
  whyThisExists: string | null;
  notIncluded: string | null;
  acceptanceCriteria: string | null;
  status: string;
  priority: string;
  tags: string | null;
  currentVersion: number;
  createdAt: string;
  updatedAt: string;
  versions: Version[];
  codeLinks: CodeLink[];
  testLinks: TestLink[];
  deliveryLinks: DeliveryLink[];
  children: Requirement[];
}

const statusLabels: Record<string, string> = {
  draft: 'Draft',
  ready_to_build: 'Ready to build',
  implemented: 'Implemented',
  verified: 'Verified',
};

const statusColors: Record<string, 'secondary' | 'default' | 'success' | 'warning' | 'danger'> = {
  draft: 'secondary',
  ready_to_build: 'default',
  implemented: 'success',
  verified: 'success',
};

const testStatusIcons: Record<string, any> = {
  passing: CheckCircle2,
  failing: XCircle,
  not_run: Clock,
};

const testStatusColors: Record<string, string> = {
  passing: 'text-green-600',
  failing: 'text-red-600',
  not_run: 'text-gray-400',
};

export default function RequirementPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [requirement, setRequirement] = useState<Requirement | null>(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editForm, setEditForm] = useState<any>({});

  useEffect(() => {
    fetchRequirement();
  }, [id]);

  async function fetchRequirement() {
    try {
      const response = await fetch(`/api/requirements/${id}`);
      if (response.ok) {
        const data = await response.json();
        setRequirement(data);
        setEditForm({
          title: data.title,
          whatThisDoes: data.whatThisDoes || '',
          whyThisExists: data.whyThisExists || '',
          notIncluded: data.notIncluded || '',
          acceptanceCriteria: data.acceptanceCriteria || '',
          status: data.status,
          priority: data.priority,
          tags: data.tags ? JSON.parse(data.tags) : [],
        });
      }
    } catch (error) {
      console.error('Error fetching requirement:', error);
    } finally {
      setLoading(false);
    }
  }

  async function saveRequirement() {
    setSaving(true);
    try {
      const response = await fetch(`/api/requirements/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...editForm,
          tags: editForm.tags?.length > 0 ? editForm.tags : null,
          changeSummary: 'Updated requirement details',
        }),
      });

      if (response.ok) {
        setEditing(false);
        fetchRequirement();
      }
    } catch (error) {
      console.error('Error saving requirement:', error);
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 className="h-8 w-8 animate-spin text-purple-600" />
      </div>
    );
  }

  if (!requirement) {
    return (
      <div className="px-6 py-8 max-w-7xl mx-auto">
        <p className="text-gray-500">Requirement not found</p>
      </div>
    );
  }

  const tags = requirement.tags ? JSON.parse(requirement.tags) : [];
  const passingTests = requirement.testLinks.filter((t) => t.status === 'passing').length;
  const failingTests = requirement.testLinks.filter((t) => t.status === 'failing').length;

  return (
    <div className="min-h-[calc(100vh-4rem)] bg-gray-50">
      <div className="px-6 py-8 max-w-6xl mx-auto">
        <div className="mb-2">
          <Link
            href={`/products/${requirement.productId}`}
            className="text-sm text-gray-500 hover:text-gray-700 flex items-center gap-1"
          >
            <ArrowLeft className="h-3 w-3" />
            Back to product
          </Link>
        </div>
        <div className="flex items-center gap-3 mb-8">
          <Badge variant="outline" className="text-base font-mono px-3 py-1">
            {requirement.stableKey}
          </Badge>
          <h1 className="text-3xl font-bold text-gray-900">{requirement.title}</h1>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          <div className="lg:col-span-3">
            <Tabs defaultValue="definition" className="w-full">
              <TabsList>
                <TabsTrigger value="definition">Definition</TabsTrigger>
                <TabsTrigger value="versions">Versions</TabsTrigger>
                <TabsTrigger value="implementation">Implementation</TabsTrigger>
                <TabsTrigger value="verification">Verification</TabsTrigger>
                <TabsTrigger value="delivery">Delivery work</TabsTrigger>
              </TabsList>

              <TabsContent value="definition">
                <Card>
                  <CardContent className="pt-6">
                    {editing ? (
                      <div className="space-y-6">
                        <div>
                          <label className="text-sm font-medium text-gray-700 mb-1 block">
                            Title
                          </label>
                          <Input
                            value={editForm.title}
                            onChange={(e) => setEditForm({ ...editForm, title: e.target.value })}
                          />
                        </div>
                        <div>
                          <label className="text-sm font-medium text-gray-700 mb-1 block">
                            What this does
                          </label>
                          <RichTextEditor
                            content={editForm.whatThisDoes}
                            onChange={(content) =>
                              setEditForm({ ...editForm, whatThisDoes: content })
                            }
                            placeholder="Users can..."
                            requirementId={id}
                          />
                          <p className="text-xs text-gray-500 mt-1">One clear sentence starting with "Users can..."</p>
                        </div>
                        <div>
                          <label className="text-sm font-medium text-gray-700 mb-1 block">
                            Why this exists
                          </label>
                          <RichTextEditor
                            content={editForm.whyThisExists}
                            onChange={(content) =>
                              setEditForm({ ...editForm, whyThisExists: content })
                            }
                            placeholder="This helps people..."
                            requirementId={id}
                          />
                          <p className="text-xs text-gray-500 mt-1">One or two sentences in plain English</p>
                        </div>
                        <div>
                          <label className="text-sm font-medium text-gray-700 mb-1 block">
                            Not included within this requirement
                          </label>
                          <RichTextEditor
                            content={editForm.notIncluded}
                            onChange={(content) =>
                              setEditForm({ ...editForm, notIncluded: content })
                            }
                            placeholder="Branching or merging versions, Restoring only part of an automation..."
                            requirementId={id}
                          />
                          <p className="text-xs text-gray-500 mt-1">Bullets that avoid confusion and scope creep</p>
                        </div>
                        <div>
                          <label className="text-sm font-medium text-gray-700 mb-1 block">
                            How we know it works
                          </label>
                          <RichTextEditor
                            content={editForm.acceptanceCriteria}
                            onChange={(content) =>
                              setEditForm({ ...editForm, acceptanceCriteria: content })
                            }
                            placeholder="Users can see a list of versions, Users can compare any two versions..."
                            requirementId={id}
                          />
                          <p className="text-xs text-gray-500 mt-1">Acceptance criteria that can map to tests</p>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <label className="text-sm font-medium text-gray-700 mb-1 block">
                              Status
                            </label>
                            <Select
                              value={editForm.status}
                              onValueChange={(value) => setEditForm({ ...editForm, status: value })}
                            >
                              <SelectTrigger>
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="draft">Draft</SelectItem>
                                <SelectItem value="ready_to_build">Ready to build</SelectItem>
                                <SelectItem value="implemented">Implemented</SelectItem>
                                <SelectItem value="verified">Verified</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                          <div>
                            <label className="text-sm font-medium text-gray-700 mb-1 block">
                              Priority
                            </label>
                            <Select
                              value={editForm.priority}
                              onValueChange={(value) => setEditForm({ ...editForm, priority: value })}
                            >
                              <SelectTrigger>
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="critical">Critical</SelectItem>
                                <SelectItem value="high">High</SelectItem>
                                <SelectItem value="medium">Medium</SelectItem>
                                <SelectItem value="low">Low</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                        </div>
                        <div>
                          <label className="text-sm font-medium text-gray-700 mb-1 block">
                            Tags
                          </label>
                          <div className="flex flex-wrap gap-2">
                            {['functional', 'nonfunctional', 'security', 'performance', 'usability', 'invariant'].map((tag) => (
                              <label key={tag} className="flex items-center gap-1.5 cursor-pointer">
                                <input
                                  type="checkbox"
                                  checked={editForm.tags?.includes(tag)}
                                  onChange={(e) => {
                                    if (e.target.checked) {
                                      setEditForm({ ...editForm, tags: [...(editForm.tags || []), tag] });
                                    } else {
                                      setEditForm({ ...editForm, tags: (editForm.tags || []).filter((t: string) => t !== tag) });
                                    }
                                  }}
                                  className="rounded border-gray-300 text-purple-600 focus:ring-purple-500"
                                />
                                <span className="text-sm text-gray-700">{tag}</span>
                              </label>
                            ))}
                          </div>
                        </div>
                        <div className="flex gap-2">
                          <Button onClick={saveRequirement} disabled={saving}>
                            {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                            Save changes
                          </Button>
                          <Button variant="outline" onClick={() => setEditing(false)}>
                            Cancel
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <div className="space-y-6">
                        <div>
                          <h3 className="text-lg font-semibold text-gray-900 mb-2">What this does</h3>
                          <RichTextViewer content={requirement.whatThisDoes} />
                        </div>
                        <div>
                          <h3 className="text-lg font-semibold text-gray-900 mb-2">Why this exists</h3>
                          <RichTextViewer content={requirement.whyThisExists} />
                        </div>
                        {requirement.notIncluded && (
                          <div>
                            <h3 className="text-lg font-semibold text-gray-900 mb-2">
                              Not included within this requirement
                            </h3>
                            <RichTextViewer content={requirement.notIncluded} />
                          </div>
                        )}
                        {requirement.acceptanceCriteria && (
                          <div>
                            <h3 className="text-lg font-semibold text-gray-900 mb-2">
                              How we know it works
                            </h3>
                            <RichTextViewer content={requirement.acceptanceCriteria} />
                          </div>
                        )}
                        {tags.length > 0 && (
                          <div>
                            <h3 className="text-lg font-semibold text-gray-900 mb-2">Tags</h3>
                            <div className="flex flex-wrap gap-2">
                              {tags.map((tag: string) => (
                                <Badge key={tag} variant="outline">{tag}</Badge>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="versions">
                <Card>
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <CardTitle>Requirement versions</CardTitle>
                      <Button variant="outline" size="sm">
                        Compare versions
                      </Button>
                    </div>
                    <p className="text-sm text-gray-500">
                      Compare or restore any version. Nothing is ever deleted.
                    </p>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      {requirement.versions.map((version) => (
                        <div
                          key={version.id}
                          className="p-4 rounded-lg border border-gray-200 bg-white"
                        >
                          <div className="flex items-center justify-between">
                            <div>
                              <div className="font-medium text-gray-900">
                                v{version.versionNumber}
                                {version.status === 'active' && (
                                  <Badge className="ml-2" variant="success">
                                    Current
                                  </Badge>
                                )}
                              </div>
                              <p className="text-sm text-gray-600">
                                {version.changeSummary || 'No description'}
                              </p>
                              <p className="text-xs text-gray-400 mt-1">
                                {version.changedBy} |{' '}
                                {format(new Date(version.changedAt), 'MMM d, yyyy h:mm a')}
                              </p>
                            </div>
                            {version.status !== 'active' && (
                              <div className="flex gap-2">
                                <Button variant="outline" size="sm">
                                  View diff
                                </Button>
                                <Button size="sm">Restore</Button>
                              </div>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="implementation">
                <Card>
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <CardTitle>Where it lives in code</CardTitle>
                      <div className="flex gap-2">
                        <Button variant="outline" size="sm">
                          Rescan now
                        </Button>
                        <Button size="sm">
                          <Plus className="h-4 w-4 mr-1" />
                          Add link
                        </Button>
                      </div>
                    </div>
                    <p className="text-sm text-gray-500">
                      Links refresh after merges. If something moved, we will ask you to confirm it.
                    </p>
                  </CardHeader>
                  <CardContent>
                    {requirement.codeLinks.length === 0 ? (
                      <p className="text-sm text-gray-500 text-center py-8">
                        No code links yet. Add one to track implementation.
                      </p>
                    ) : (
                      <div className="overflow-x-auto">
                        <table className="w-full">
                          <thead>
                            <tr className="border-b border-gray-200">
                              <th className="text-left py-3 px-4 text-sm font-medium text-gray-500">
                                Status
                              </th>
                              <th className="text-left py-3 px-4 text-sm font-medium text-gray-500">
                                Path
                              </th>
                              <th className="text-left py-3 px-4 text-sm font-medium text-gray-500">
                                What it does
                              </th>
                              <th className="text-left py-3 px-4 text-sm font-medium text-gray-500">
                                Last checked
                              </th>
                            </tr>
                          </thead>
                          <tbody>
                            {requirement.codeLinks.map((link) => (
                              <tr key={link.id} className="border-b border-gray-100">
                                <td className="py-3 px-4">
                                  <Badge
                                    variant={
                                      link.status === 'up_to_date'
                                        ? 'success'
                                        : link.status === 'needs_look'
                                        ? 'warning'
                                        : 'danger'
                                    }
                                  >
                                    {link.status.replace('_', ' ')}
                                  </Badge>
                                </td>
                                <td className="py-3 px-4 font-mono text-sm">{link.filePath}</td>
                                <td className="py-3 px-4 text-sm text-gray-600">
                                  {link.description || '-'}
                                </td>
                                <td className="py-3 px-4 text-sm text-gray-500">
                                  {link.lastCheckedAt
                                    ? formatDistanceToNow(new Date(link.lastCheckedAt), {
                                        addSuffix: true,
                                      })
                                    : 'Never'}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="verification">
                <Card>
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <CardTitle>Checks and evidence</CardTitle>
                      <Button size="sm">
                        <Plus className="h-4 w-4 mr-1" />
                        Add test link
                      </Button>
                    </div>
                    <p className="text-sm text-gray-500">
                      {failingTests > 0
                        ? `This requirement is mostly checked. ${failingTests} test${failingTests > 1 ? 's' : ''} failing right now.`
                        : 'Track tests and checks that verify this requirement.'}
                    </p>
                  </CardHeader>
                  <CardContent>
                    {requirement.testLinks.length === 0 ? (
                      <p className="text-sm text-gray-500 text-center py-8">
                        No test links yet. Add one to track verification.
                      </p>
                    ) : (
                      <div className="space-y-4">
                        {requirement.testLinks.map((test) => {
                          const Icon = testStatusIcons[test.status];
                          return (
                            <div
                              key={test.id}
                              className="p-4 rounded-lg border border-gray-200 bg-white flex items-center gap-4"
                            >
                              <Badge variant="outline">{test.testType}</Badge>
                              <div className="flex-1">
                                <p className="font-mono text-sm">{test.testPath}</p>
                                <p className={`text-sm ${testStatusColors[test.status]}`}>
                                  {test.status === 'passing'
                                    ? 'Passing'
                                    : test.status === 'failing'
                                    ? test.description || 'Failing'
                                    : 'Not run yet'}
                                </p>
                              </div>
                              <div className="text-sm text-gray-500">
                                {test.lastRunAt
                                  ? formatDistanceToNow(new Date(test.lastRunAt), {
                                      addSuffix: true,
                                    })
                                  : '-'}
                              </div>
                              <Icon className={`h-5 w-5 ${testStatusColors[test.status]}`} />
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="delivery">
                <Card>
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <CardTitle>Related delivery work</CardTitle>
                      <Button size="sm">
                        <Plus className="h-4 w-4 mr-1" />
                        Link ticket
                      </Button>
                    </div>
                  </CardHeader>
                  <CardContent>
                    {requirement.deliveryLinks.length === 0 ? (
                      <p className="text-sm text-gray-500 text-center py-8">
                        No delivery links yet. Link Jira or other tickets.
                      </p>
                    ) : (
                      <div className="space-y-4">
                        {requirement.deliveryLinks.map((link) => (
                          <div
                            key={link.id}
                            className="p-4 rounded-lg border border-gray-200 bg-white flex items-center gap-4"
                          >
                            <Badge variant="outline">{link.intent}</Badge>
                            <div className="flex-1">
                              <p className="font-medium">
                                {link.externalId} - {link.title || 'Untitled'}
                              </p>
                              <p className="text-sm text-gray-500">{link.externalSystem}</p>
                            </div>
                            {link.url && (
                              <a
                                href={link.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-purple-600 hover:text-purple-700"
                              >
                                <ExternalLink className="h-4 w-4" />
                              </a>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>
            </Tabs>
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">At a glance</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Badge variant={statusColors[requirement.status]}>
                    {statusLabels[requirement.status]}
                  </Badge>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Linked implementation</p>
                  <p className="font-medium">
                    {requirement.codeLinks.length} location
                    {requirement.codeLinks.length !== 1 ? 's' : ''}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Linked verification</p>
                  <p className="font-medium">
                    {requirement.testLinks.length} check
                    {requirement.testLinks.length !== 1 ? 's' : ''}
                    {failingTests > 0 && (
                      <span className="text-red-600 ml-1">({failingTests} failing)</span>
                    )}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Version</p>
                  <p className="font-medium">v{requirement.currentVersion}</p>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Quick actions</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <Button className="w-full" onClick={() => setEditing(true)}>
                  <Edit2 className="h-4 w-4 mr-2" />
                  Edit requirement
                </Button>
                <Button variant="outline" className="w-full">
                  Export PDF book
                </Button>
              </CardContent>
            </Card>

            {requirement.children.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Inside this requirement</CardTitle>
                </CardHeader>
                <CardContent>
                  <ul className="space-y-2">
                    {requirement.children.map((child) => (
                      <li key={child.id}>
                        <Link
                          href={`/requirements/${child.id}`}
                          className="text-sm text-gray-600 hover:text-purple-600 flex items-center gap-2"
                        >
                          <div className="w-2 h-2 rounded-full bg-purple-400" />
                          {child.title}
                        </Link>
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
