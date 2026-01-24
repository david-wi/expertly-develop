import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { db } from '@/lib/db';
import { products, requirements, requirementVersions, testLinks, releaseSnapshots } from '@/lib/db/schema';
import { desc, eq, sql } from 'drizzle-orm';
import { formatDistanceToNow } from 'date-fns';
import { AlertCircle, ArrowRight, CheckCircle2, FileText, GitBranch, Package } from 'lucide-react';

async function getDashboardData() {
  // Get recent requirement changes
  const recentVersions = await db
    .select({
      id: requirementVersions.id,
      requirementId: requirementVersions.requirementId,
      changeSummary: requirementVersions.changeSummary,
      changedAt: requirementVersions.changedAt,
      requirementTitle: requirements.title,
      productId: requirements.productId,
    })
    .from(requirementVersions)
    .innerJoin(requirements, eq(requirementVersions.requirementId, requirements.id))
    .orderBy(desc(requirementVersions.changedAt))
    .limit(5);

  // Get products with their requirement counts
  const productList = await db
    .select({
      id: products.id,
      name: products.name,
      requirementCount: sql<number>`count(${requirements.id})`.as('requirement_count'),
    })
    .from(products)
    .leftJoin(requirements, eq(products.id, requirements.productId))
    .groupBy(products.id)
    .limit(5);

  // Get checks that need attention (failing tests)
  const failingTests = await db
    .select({
      id: testLinks.id,
      testPath: testLinks.testPath,
      status: testLinks.status,
      lastRunAt: testLinks.lastRunAt,
      requirementId: testLinks.requirementId,
      requirementTitle: requirements.title,
    })
    .from(testLinks)
    .innerJoin(requirements, eq(testLinks.requirementId, requirements.id))
    .where(eq(testLinks.status, 'failing'))
    .limit(5);

  // Get draft releases
  const draftReleases = await db
    .select()
    .from(releaseSnapshots)
    .where(eq(releaseSnapshots.status, 'draft'))
    .orderBy(desc(releaseSnapshots.createdAt))
    .limit(3);

  // Get overall stats
  const totalRequirements = await db
    .select({ count: sql<number>`count(*)` })
    .from(requirements);

  const verifiedRequirements = await db
    .select({ count: sql<number>`count(*)` })
    .from(requirements)
    .where(eq(requirements.status, 'verified'));

  return {
    recentVersions,
    productList,
    failingTests,
    draftReleases,
    stats: {
      total: totalRequirements[0]?.count || 0,
      verified: verifiedRequirements[0]?.count || 0,
    },
  };
}

export default async function Dashboard() {
  const data = await getDashboardData();
  const hasData = data.productList.length > 0 || data.recentVersions.length > 0;

  return (
    <div className="px-6 py-8 max-w-7xl mx-auto">
      <div className="mb-2">
        <span className="text-sm text-gray-500">ExpertlyAI</span>
      </div>
      <h1 className="text-4xl font-bold text-gray-900 mb-8">Today</h1>

      {!hasData ? (
        <Card className="mb-8">
          <CardContent className="py-12 text-center">
            <FileText className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <h2 className="text-xl font-semibold text-gray-900 mb-2">Welcome to Expertly Define</h2>
            <p className="text-gray-500 mb-6 max-w-md mx-auto">
              Start by creating your first product to begin managing requirements, tracking implementations, and ensuring verification.
            </p>
            <Link href="/products">
              <Button>
                Create your first product
                <ArrowRight className="h-4 w-4 ml-2" />
              </Button>
            </Link>
          </CardContent>
        </Card>
      ) : (
        <>
          {/* Action bar */}
          {(data.recentVersions.length > 0 || data.failingTests.length > 0) && (
            <Card className="mb-8 bg-purple-50 border-purple-100">
              <CardContent className="py-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="font-semibold text-gray-900">A few things to look at today</h2>
                    <p className="text-sm text-gray-600">
                      Review {data.recentVersions.length} changes
                      {data.failingTests.length > 0 && `, fix ${data.failingTests.length} failing tests`}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    {data.recentVersions.length > 0 && (
                      <Button size="sm">Review changes</Button>
                    )}
                    {data.failingTests.length > 0 && (
                      <Button size="sm" variant="outline">Fix tests</Button>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
            {/* Recent changes */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <GitBranch className="h-5 w-5 text-purple-600" />
                  Recent changes
                </CardTitle>
              </CardHeader>
              <CardContent>
                {data.recentVersions.length === 0 ? (
                  <p className="text-sm text-gray-500">No recent changes</p>
                ) : (
                  <div className="space-y-4">
                    {data.recentVersions.map((version) => (
                      <Link
                        key={version.id}
                        href={`/requirements/${version.requirementId}`}
                        className="block group"
                      >
                        <div className="font-medium text-gray-900 group-hover:text-purple-600 transition-colors">
                          {version.requirementTitle}
                        </div>
                        <div className="text-sm text-gray-500">
                          {version.changeSummary || 'Updated'}
                        </div>
                        <div className="text-xs text-gray-400">
                          {formatDistanceToNow(new Date(version.changedAt), { addSuffix: true })}
                        </div>
                      </Link>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Release snapshot */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Package className="h-5 w-5 text-purple-600" />
                  Next release snapshot
                </CardTitle>
              </CardHeader>
              <CardContent>
                {data.draftReleases.length === 0 ? (
                  <div>
                    <p className="text-sm text-gray-500 mb-4">No draft releases</p>
                    <Link href="/releases">
                      <Button size="sm" variant="outline">Create snapshot</Button>
                    </Link>
                  </div>
                ) : (
                  <div>
                    <div className="font-medium text-gray-900 mb-1">
                      {data.draftReleases[0].versionName}
                      <Badge variant="secondary" className="ml-2">draft</Badge>
                    </div>
                    <p className="text-sm text-gray-500 mb-3">Critical requirements checked</p>
                    <div className="w-full bg-gray-200 rounded-full h-2 mb-2">
                      <div
                        className="bg-green-500 h-2 rounded-full"
                        style={{ width: `${Math.min(100, (data.stats.verified / Math.max(1, data.stats.total)) * 100)}%` }}
                      />
                    </div>
                    <p className="text-sm text-gray-600 mb-4">
                      {Math.round((data.stats.verified / Math.max(1, data.stats.total)) * 100)}% ({data.stats.verified} of {data.stats.total})
                    </p>
                    <div className="flex gap-2">
                      <Link href={`/releases/${data.draftReleases[0].id}`}>
                        <Button size="sm">View snapshot</Button>
                      </Link>
                      <Button size="sm" variant="outline">Export PDF</Button>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Checks that need love */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <AlertCircle className="h-5 w-5 text-purple-600" />
                  Checks that need love
                </CardTitle>
              </CardHeader>
              <CardContent>
                {data.failingTests.length === 0 ? (
                  <div className="flex items-center gap-2 text-green-600">
                    <CheckCircle2 className="h-5 w-5" />
                    <span className="text-sm">All checks passing</span>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {data.failingTests.map((test) => (
                      <Link
                        key={test.id}
                        href={`/requirements/${test.requirementId}`}
                        className="block group"
                      >
                        <div className="font-medium text-gray-900 group-hover:text-purple-600 transition-colors">
                          {test.requirementTitle}
                        </div>
                        <div className="text-sm text-red-600">
                          {test.testPath} is failing
                        </div>
                        {test.lastRunAt && (
                          <div className="text-xs text-gray-400">
                            Last run: {formatDistanceToNow(new Date(test.lastRunAt), { addSuffix: true })}
                          </div>
                        )}
                      </Link>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Products overview */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>Your Products</CardTitle>
              <Link href="/products">
                <Button size="sm" variant="outline">View all</Button>
              </Link>
            </CardHeader>
            <CardContent>
              {data.productList.length === 0 ? (
                <p className="text-sm text-gray-500">No products yet</p>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {data.productList.map((product) => (
                    <Link
                      key={product.id}
                      href={`/products/${product.id}`}
                      className="p-4 rounded-lg border border-gray-200 hover:border-purple-300 hover:bg-purple-50/50 transition-colors"
                    >
                      <div className="font-medium text-gray-900">{product.name}</div>
                      <div className="text-sm text-gray-500">
                        {product.requirementCount} requirements
                      </div>
                    </Link>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
