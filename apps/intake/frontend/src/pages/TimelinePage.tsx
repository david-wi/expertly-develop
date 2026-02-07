import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  Clock,
  Phone,
  Upload,
  Link2,
  Edit3,
  Bell,
  Filter,
  ChevronDown,
  ChevronRight,
  Activity,
} from 'lucide-react';
import { api } from '@/api/client';
import type { TimelineEvent, Contributor, IntakeSectionInstance } from '@/types';
import { format } from 'date-fns';

// ── API helpers ──

function fetchTimeline(intakeId: string) {
  return api.get<TimelineEvent[]>(`/intakes/${intakeId}/timeline`).then((r) => r.data);
}

function fetchSectionInstances(intakeId: string) {
  return api
    .get<IntakeSectionInstance[]>(`/intakes/${intakeId}/section-instances`)
    .then((r) => r.data);
}

function fetchContributors(intakeId: string) {
  return api.get<Contributor[]>(`/intakes/${intakeId}/contributors`).then((r) => r.data);
}

// ── Helpers ──

const eventIconMap: Record<string, typeof Phone> = {
  call: Phone,
  phoneCall: Phone,
  upload: Upload,
  fileUpload: Upload,
  urlRefresh: Link2,
  answerEdit: Edit3,
  followUp: Bell,
};

const eventColorMap: Record<string, { text: string; dot: string }> = {
  call: { text: 'text-purple-600', dot: 'bg-purple-500' },
  phoneCall: { text: 'text-purple-600', dot: 'bg-purple-500' },
  upload: { text: 'text-blue-600', dot: 'bg-blue-500' },
  fileUpload: { text: 'text-blue-600', dot: 'bg-blue-500' },
  urlRefresh: { text: 'text-cyan-600', dot: 'bg-cyan-500' },
  answerEdit: { text: 'text-amber-600', dot: 'bg-amber-500' },
  followUp: { text: 'text-green-600', dot: 'bg-green-500' },
};

const eventLabelMap: Record<string, string> = {
  call: 'Phone Call',
  phoneCall: 'Phone Call',
  upload: 'Upload',
  fileUpload: 'File Upload',
  urlRefresh: 'URL Refresh',
  answerEdit: 'Answer Edit',
  followUp: 'Follow-up',
};

// ── Page ──

export default function TimelinePage() {
  const { intakeId } = useParams<{ intakeId: string }>();

  const [sectionFilter, setSectionFilter] = useState('');
  const [personFilter, setPersonFilter] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [expandedEvents, setExpandedEvents] = useState<Set<string>>(new Set());

  const { data: events = [], isLoading } = useQuery({
    queryKey: ['timeline', intakeId],
    queryFn: () => fetchTimeline(intakeId!),
    enabled: !!intakeId,
  });

  const { data: sectionInstances = [] } = useQuery({
    queryKey: ['section-instances', intakeId],
    queryFn: () => fetchSectionInstances(intakeId!),
    enabled: !!intakeId,
  });

  const { data: contributors = [] } = useQuery({
    queryKey: ['contributors', intakeId],
    queryFn: () => fetchContributors(intakeId!),
    enabled: !!intakeId,
  });

  // Apply filters
  const filteredEvents = events.filter((evt) => {
    if (typeFilter && evt.eventType !== typeFilter) return false;
    if (personFilter && evt.actorId !== personFilter) return false;
    // Section filtering would depend on metadata
    if (sectionFilter) {
      const meta = evt.metadata as Record<string, unknown> | null;
      if (meta?.sectionInstanceId && meta.sectionInstanceId !== sectionFilter) return false;
    }
    return true;
  });

  const toggleExpanded = (id: string) => {
    setExpandedEvents((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  return (
    <div className="p-6 max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <Clock className="w-6 h-6 text-gray-700" />
        <h1 className="text-2xl font-bold text-gray-900">Timeline</h1>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-4 mb-8 p-4 bg-white rounded-lg border border-gray-200">
        <Filter className="w-4 h-4 text-gray-500 flex-shrink-0" />
        <div className="flex items-center gap-4 flex-wrap">
          <div>
            <label className="block text-xs text-gray-500 mb-1">Section</label>
            <select
              value={sectionFilter}
              onChange={(e) => setSectionFilter(e.target.value)}
              className="px-3 py-1.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
            >
              <option value="">All Sections</option>
              {sectionInstances.map((s) => (
                <option key={s.intakeSectionInstanceId} value={s.intakeSectionInstanceId}>
                  {s.sectionName}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">Person</label>
            <select
              value={personFilter}
              onChange={(e) => setPersonFilter(e.target.value)}
              className="px-3 py-1.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
            >
              <option value="">All People</option>
              {contributors.map((c) => (
                <option key={c.contributorId} value={c.contributorId}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">Event Type</label>
            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
              className="px-3 py-1.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
            >
              <option value="">All Types</option>
              <option value="phoneCall">Phone Calls</option>
              <option value="fileUpload">File Uploads</option>
              <option value="urlRefresh">URL Refreshes</option>
              <option value="answerEdit">Answer Edits</option>
              <option value="followUp">Follow-ups</option>
            </select>
          </div>
        </div>
      </div>

      {/* Timeline */}
      {isLoading ? (
        <div className="text-center py-12 text-gray-500">Loading timeline...</div>
      ) : filteredEvents.length === 0 ? (
        <div className="text-center py-16 bg-white rounded-lg border border-gray-200">
          <Clock className="w-12 h-12 text-gray-300 mx-auto mb-3" />
          <h3 className="text-lg font-medium text-gray-700 mb-1">No events yet</h3>
          <p className="text-sm text-gray-500">
            Events will appear here as activity occurs on this intake.
          </p>
        </div>
      ) : (
        <div className="relative">
          {/* Vertical line */}
          <div className="absolute left-6 top-0 bottom-0 w-px bg-gray-200" />

          <div className="space-y-0">
            {filteredEvents.map((event) => {
              const Icon = eventIconMap[event.eventType] ?? Activity;
              const colors = eventColorMap[event.eventType] ?? {
                text: 'text-gray-600',
                dot: 'bg-gray-500',
              };
              const label = eventLabelMap[event.eventType] ?? event.eventType;
              const isExpanded = expandedEvents.has(event.timelineEventId);
              const meta = (event.metadata ?? {}) as Record<string, unknown>;

              return (
                <div key={event.timelineEventId} className="relative pl-14 pb-6">
                  {/* Dot */}
                  <div
                    className={`absolute left-4 top-1 w-4 h-4 rounded-full ${colors.dot} ring-4 ring-white`}
                  />

                  <div className="bg-white rounded-lg border border-gray-200 shadow-sm">
                    <button
                      onClick={() => toggleExpanded(event.timelineEventId)}
                      className="w-full text-left p-4"
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex items-start gap-3 min-w-0">
                          <Icon className={`w-5 h-5 mt-0.5 ${colors.text} flex-shrink-0`} />
                          <div className="min-w-0">
                            <p className="text-sm font-medium text-gray-900">
                              {event.eventDescription}
                            </p>
                            <div className="flex items-center gap-3 mt-0.5 text-xs text-gray-500">
                              <span>
                                {format(new Date(event.occurredAt), 'MMM d, yyyy h:mm a')}
                              </span>
                              {event.actorName && (
                                <span className="text-gray-400">by {event.actorName}</span>
                              )}
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-2 flex-shrink-0 ml-4">
                          <span
                            className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 ${colors.text}`}
                          >
                            {label}
                          </span>
                          {isExpanded ? (
                            <ChevronDown className="w-4 h-4 text-gray-400" />
                          ) : (
                            <ChevronRight className="w-4 h-4 text-gray-400" />
                          )}
                        </div>
                      </div>

                      {/* Summary badges */}
                      <div className="flex items-center gap-3 mt-2 ml-8 flex-wrap">
                        {(event.eventType === 'call' || event.eventType === 'phoneCall') && (
                          <>
                            {meta.durationSeconds != null && (
                              <span className="text-xs text-gray-500">
                                Duration: {Math.round(Number(meta.durationSeconds) / 60)} min
                              </span>
                            )}
                            {meta.participants != null && (
                              <span className="text-xs text-gray-500">
                                Participants: {String(meta.participants)}
                              </span>
                            )}
                            {meta.questionsAnswered != null && (
                              <span className="text-xs text-indigo-600 font-medium">
                                {String(meta.questionsAnswered)} questions answered
                              </span>
                            )}
                          </>
                        )}
                        {(event.eventType === 'upload' || event.eventType === 'fileUpload') && (
                          <>
                            {meta.fileName != null && (
                              <span className="text-xs text-gray-500">
                                File: {String(meta.fileName)}
                              </span>
                            )}
                            {meta.proposalsGenerated != null && (
                              <span className="text-xs text-indigo-600 font-medium">
                                {String(meta.proposalsGenerated)} proposals generated
                              </span>
                            )}
                          </>
                        )}
                        {event.eventType === 'urlRefresh' && (
                          <>
                            {meta.urlLabel != null && (
                              <span className="text-xs text-gray-500">
                                {String(meta.urlLabel)}
                              </span>
                            )}
                            <span className="text-xs text-gray-500">
                              {meta.changesFound ? 'Changes found' : 'No changes'}
                            </span>
                          </>
                        )}
                        {event.eventType === 'answerEdit' && meta.questionText != null && (
                          <span className="text-xs text-gray-500">
                            Q: {String(meta.questionText)}
                          </span>
                        )}
                        {event.eventType === 'followUp' && meta.status != null && (
                          <span className="text-xs text-gray-500">
                            Status: {String(meta.status)}
                          </span>
                        )}
                      </div>
                    </button>

                    {/* Expanded details */}
                    {isExpanded && Object.keys(meta).length > 0 && (
                      <div className="px-4 pb-4 ml-8 border-t border-gray-100">
                        <div className="pt-3 space-y-2">
                          {event.eventType === 'answerEdit' && (
                            <>
                              {meta.oldAnswer != null && (
                                <div>
                                  <span className="text-xs font-medium text-gray-500">
                                    Old Answer
                                  </span>
                                  <p className="text-sm text-red-700 bg-red-50 rounded p-2 mt-1 line-through">
                                    {String(meta.oldAnswer)}
                                  </p>
                                </div>
                              )}
                              {meta.newAnswer != null && (
                                <div>
                                  <span className="text-xs font-medium text-gray-500">
                                    New Answer
                                  </span>
                                  <p className="text-sm text-green-700 bg-green-50 rounded p-2 mt-1">
                                    {String(meta.newAnswer)}
                                  </p>
                                </div>
                              )}
                            </>
                          )}
                          {Object.entries(meta).map(([key, value]) => {
                            // Skip already-displayed keys
                            if (
                              [
                                'oldAnswer',
                                'newAnswer',
                                'durationSeconds',
                                'participants',
                                'questionsAnswered',
                                'fileName',
                                'proposalsGenerated',
                                'urlLabel',
                                'changesFound',
                                'questionText',
                                'status',
                                'sectionInstanceId',
                              ].includes(key)
                            ) {
                              return null;
                            }
                            return (
                              <div key={key} className="flex items-start gap-3">
                                <span className="text-xs font-medium text-gray-500 w-32 flex-shrink-0 pt-0.5">
                                  {key}
                                </span>
                                <span className="text-sm text-gray-800">{String(value)}</span>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
