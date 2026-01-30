'use client';

import { useState, useEffect, use } from 'react';
import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ArrowLeft, Loader2, Package, Download, GitCompare } from 'lucide-react';
import { format } from 'date-fns';

interface ReleaseSnapshot {
  id: string;
  productId: string;
  versionName: string;
  description: string | null;
  requirementsSnapshot: string;
  stats: string | null;
  status: string;
  createdAt: string;
  releasedAt: string | null;
}

interface Requirement {
  id: string;
  title: string;
  whatThisDoes: string | null;
  status: string;
  priority: string;
}

export default function ReleasePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [release, setRelease] = useState<ReleaseSnapshot | null>(null);
  const [requirements, setRequirements] = useState<Requirement[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchRelease();
  }, [id]);

  async function fetchRelease() {
    try {
      const response = await fetch(`/api/releases/${id}`);
      if (response.ok) {
        const data = await response.json();
        setRelease(data);
        if (data.requirementsSnapshot) {
          setRequirements(JSON.parse(data.requirementsSnapshot));
        }
      }
    } catch (error) {
      console.error('Error fetching release:', error);
    } finally {
      setLoading(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 className="h-8 w-8 animate-spin text-primary-600" />
      </div>
    );
  }

  if (!release) {
    return (
      <div className="px-6 py-8 max-w-7xl mx-auto">
        <p className="text-gray-500">Release not found</p>
      </div>
    );
  }

  const stats = release.stats ? JSON.parse(release.stats) : { total: 0, verified: 0 };
  const verifiedPercentage = stats.total > 0 ? Math.round((stats.verified / stats.total) * 100) : 0;

  return (
    <div className="min-h-[calc(100vh-4rem)] bg-gray-50">
      <div className="px-6 py-8 max-w-6xl mx-auto">
        <div className="mb-2">
          <Link
            href="/releases"
            className="text-sm text-gray-500 hover:text-gray-700 flex items-center gap-1"
          >
            <ArrowLeft className="h-3 w-3" />
            Releases
          </Link>
        </div>
        <div className="mb-2">
          <span className="text-sm text-gray-500">ExpertlyAI</span>
        </div>
        <h1 className="text-3xl font-bold text-gray-900 mb-8">
          Release {release.versionName} snapshot
        </h1>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
          <Card>
            <CardHeader>
              <CardTitle>Release readiness</CardTitle>
              <p className="text-sm text-gray-500">
                A snapshot is a point-in-time view of what the product meant and what checks passed.
              </p>
            </CardHeader>
            <CardContent>
              <div className="mb-4">
                <p className="text-sm text-gray-600 mb-2">Critical requirements checked</p>
                <div className="w-full bg-gray-200 rounded-full h-3 mb-2">
                  <div
                    className="bg-green-500 h-3 rounded-full transition-all"
                    style={{ width: `${verifiedPercentage}%` }}
                  />
                </div>
                <p className="text-sm text-gray-600">
                  {stats.verified} of {stats.total} ({verifiedPercentage}%)
                </p>
              </div>
              <div className="flex gap-2">
                <Button>
                  <Download className="h-4 w-4 mr-2" />
                  Export release PDF
                </Button>
                <Button variant="outline">
                  <GitCompare className="h-4 w-4 mr-2" />
                  Compare to last release
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>What changed in this release</CardTitle>
            </CardHeader>
            <CardContent>
              {release.description ? (
                <p className="text-gray-600">{release.description}</p>
              ) : (
                <p className="text-gray-500 italic">No description provided.</p>
              )}
              <div className="mt-4 pt-4 border-t border-gray-200">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-500">Created</span>
                  <span className="text-gray-900">
                    {format(new Date(release.createdAt), 'MMM d, yyyy h:mm a')}
                  </span>
                </div>
                <div className="flex items-center justify-between text-sm mt-2">
                  <span className="text-gray-500">Status</span>
                  <Badge variant={release.status === 'released' ? 'success' : 'secondary'}>
                    {release.status}
                  </Badge>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Requirements in this snapshot</CardTitle>
          </CardHeader>
          <CardContent>
            {requirements.length === 0 ? (
              <p className="text-gray-500 text-center py-8">No requirements in this snapshot.</p>
            ) : (
              <div className="space-y-2">
                {requirements.map((req) => (
                  <div
                    key={req.id}
                    className="flex items-center justify-between p-3 rounded-lg border border-gray-200 bg-white"
                  >
                    <div>
                      <p className="font-medium text-gray-900">{req.title}</p>
                      <p className="text-sm text-gray-500">{req.whatThisDoes || 'No description'}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge
                        variant={
                          req.status === 'verified'
                            ? 'success'
                            : req.status === 'implemented'
                            ? 'default'
                            : 'secondary'
                        }
                      >
                        {req.status.replace('_', ' ')}
                      </Badge>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
