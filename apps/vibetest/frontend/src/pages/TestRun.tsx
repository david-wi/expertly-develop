import { useParams, Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useQuery } from '@tanstack/react-query'
import { runsApi } from '../api/client'
import { TestRun as TestRunType, TestResult } from '../types'
import {
  ArrowLeft,
  CheckCircle,
  XCircle,
  Clock,
  Image,
  ChevronDown,
  ChevronRight,
  Loader2,
} from 'lucide-react'
import { useState } from 'react'
import clsx from 'clsx'

export default function TestRun() {
  const { projectId, runId } = useParams<{ projectId: string; runId: string }>()
  const { t } = useTranslation()
  const [expandedResults, setExpandedResults] = useState<Set<string>>(new Set())

  const { data: run, isLoading } = useQuery({
    queryKey: ['run', projectId, runId],
    queryFn: () => runsApi.get(projectId!, runId!),
    enabled: !!projectId && !!runId,
    refetchInterval: (query) => {
      const data = query.state.data as TestRunType | undefined
      return data?.status === 'running' ? 2000 : false
    },
  })

  const toggleExpand = (resultId: string) => {
    const newExpanded = new Set(expandedResults)
    if (newExpanded.has(resultId)) {
      newExpanded.delete(resultId)
    } else {
      newExpanded.add(resultId)
    }
    setExpandedResults(newExpanded)
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-8 h-8 animate-spin text-primary-600" />
      </div>
    )
  }

  const runData = run as TestRunType

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'passed':
        return <CheckCircle className="w-5 h-5 text-green-500" />
      case 'failed':
        return <XCircle className="w-5 h-5 text-red-500" />
      case 'skipped':
        return <Clock className="w-5 h-5 text-gray-400" />
      case 'running':
        return <Loader2 className="w-5 h-5 text-blue-500 animate-spin" />
      default:
        return <Clock className="w-5 h-5 text-gray-400" />
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <Link
          to={`/projects/${projectId}`}
          className="flex items-center gap-2 text-sm text-gray-600 hover:text-gray-900 mb-4"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Project
        </Link>

        <div className="flex items-start justify-between">
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold text-gray-900">
                {runData?.name || `Test Run`}
              </h1>
              <span
                className={clsx(
                  'px-3 py-1 text-sm rounded-full',
                  runData?.status === 'completed'
                    ? 'bg-green-100 text-green-700'
                    : runData?.status === 'failed'
                    ? 'bg-red-100 text-red-700'
                    : runData?.status === 'running'
                    ? 'bg-blue-100 text-blue-700'
                    : 'bg-gray-100 text-gray-700'
                )}
              >
                {t(`status.${runData?.status}`)}
              </span>
            </div>
            <p className="text-gray-600 mt-1">
              Started {runData?.started_at ? new Date(runData.started_at).toLocaleString() : 'N/A'}
            </p>
          </div>
        </div>
      </div>

      {/* Summary Stats */}
      {runData?.summary && (
        <div className="grid grid-cols-4 gap-4">
          <div className="bg-white p-4 rounded-lg border border-gray-200">
            <div className="text-2xl font-bold text-gray-900">{runData.summary.total}</div>
            <div className="text-sm text-gray-600">Total Tests</div>
          </div>
          <div className="bg-white p-4 rounded-lg border border-gray-200">
            <div className="text-2xl font-bold text-green-600">{runData.summary.passed}</div>
            <div className="text-sm text-gray-600">{t('runs.passed')}</div>
          </div>
          <div className="bg-white p-4 rounded-lg border border-gray-200">
            <div className="text-2xl font-bold text-red-600">{runData.summary.failed}</div>
            <div className="text-sm text-gray-600">{t('runs.failed')}</div>
          </div>
          <div className="bg-white p-4 rounded-lg border border-gray-200">
            <div className="text-2xl font-bold text-gray-500">{runData.summary.skipped}</div>
            <div className="text-sm text-gray-600">{t('runs.skipped')}</div>
          </div>
        </div>
      )}

      {/* Results */}
      <div className="bg-white rounded-lg border border-gray-200">
        <div className="p-4 border-b border-gray-200">
          <h2 className="font-semibold text-gray-900">Test Results</h2>
        </div>
        <div className="divide-y divide-gray-200">
          {(runData?.results as TestResult[])?.map((result) => (
            <div key={result.id} className="p-4">
              <button
                onClick={() => toggleExpand(result.id)}
                className="w-full flex items-center justify-between"
              >
                <div className="flex items-center gap-3">
                  {getStatusIcon(result.status)}
                  <div className="text-left">
                    <div className="font-medium text-gray-900">
                      {result.test_case_title || result.test_case_id}
                    </div>
                    {result.error_message && (
                      <div className="text-sm text-red-600 mt-1">
                        {result.error_message}
                      </div>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  {result.duration_ms !== null && (
                    <span className="text-sm text-gray-500">
                      {result.duration_ms}ms
                    </span>
                  )}
                  {expandedResults.has(result.id) ? (
                    <ChevronDown className="w-5 h-5 text-gray-400" />
                  ) : (
                    <ChevronRight className="w-5 h-5 text-gray-400" />
                  )}
                </div>
              </button>

              {expandedResults.has(result.id) && (
                <div className="mt-4 pl-8 space-y-4">
                  {/* Steps */}
                  {result.steps_executed && result.steps_executed.length > 0 && (
                    <div>
                      <h4 className="text-sm font-medium text-gray-700 mb-2">Steps</h4>
                      <div className="space-y-2">
                        {result.steps_executed.map((step, i) => (
                          <div
                            key={i}
                            className="flex items-center gap-2 text-sm"
                          >
                            {step.status === 'passed' ? (
                              <CheckCircle className="w-4 h-4 text-green-500" />
                            ) : step.status === 'failed' ? (
                              <XCircle className="w-4 h-4 text-red-500" />
                            ) : (
                              <Clock className="w-4 h-4 text-gray-400" />
                            )}
                            <span className="text-gray-700">
                              {step.step.action}
                              {step.step.selector && ` on ${step.step.selector}`}
                              {step.step.value && ` with "${step.step.value}"`}
                            </span>
                            <span className="text-gray-500">({step.duration_ms}ms)</span>
                            {step.error && (
                              <span className="text-red-600">- {step.error}</span>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* AI Analysis */}
                  {result.ai_analysis && (
                    <div className="bg-primary-50 p-4 rounded-lg">
                      <h4 className="text-sm font-medium text-primary-900 mb-2">
                        AI Analysis
                      </h4>
                      <p className="text-sm text-primary-800 mb-2">
                        <strong>Summary:</strong> {result.ai_analysis.summary}
                      </p>
                      <p className="text-sm text-primary-800 mb-2">
                        <strong>Root Cause:</strong> {result.ai_analysis.likely_root_cause}
                      </p>
                      <p className="text-sm text-primary-800">
                        <strong>Suggested Fix:</strong> {result.ai_analysis.suggested_fix}
                      </p>
                      <p className="text-xs text-primary-600 mt-2">
                        Confidence: {Math.round(result.ai_analysis.confidence * 100)}%
                      </p>
                    </div>
                  )}

                  {/* Artifacts */}
                  {result.artifacts && result.artifacts.length > 0 && (
                    <div>
                      <h4 className="text-sm font-medium text-gray-700 mb-2">
                        Artifacts
                      </h4>
                      <div className="flex flex-wrap gap-2">
                        {result.artifacts.map((artifact) => (
                          <a
                            key={artifact.id}
                            href={`/api/v1/artifacts/${artifact.file_path.split('/').pop()}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center gap-2 px-3 py-2 bg-gray-100 rounded-lg text-sm text-gray-700 hover:bg-gray-200"
                          >
                            <Image className="w-4 h-4" />
                            {artifact.type}
                          </a>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
