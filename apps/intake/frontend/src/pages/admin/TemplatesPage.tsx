import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  LayoutTemplate,
  Plus,
  CheckCircle2,
  FileEdit,
  Filter,
} from 'lucide-react';
import { api } from '@/api/client';
import type { TemplateVersion, IntakeType } from '@/types';
import { format } from 'date-fns';

// ── API helpers ──

function fetchTemplateVersions() {
  return api.get<TemplateVersion[]>('/templates').then((r) => r.data);
}

function fetchIntakeTypes() {
  return api.get<IntakeType[]>('/intake-types').then((r) => r.data);
}

// ── Page ──

export default function TemplatesPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [intakeTypeFilter, setIntakeTypeFilter] = useState('');

  const { data: templates = [], isLoading } = useQuery({
    queryKey: ['templates'],
    queryFn: fetchTemplateVersions,
  });

  const { data: intakeTypes = [] } = useQuery({
    queryKey: ['intake-types'],
    queryFn: fetchIntakeTypes,
  });

  const createMutation = useMutation({
    mutationFn: (data: { templateName: string; intakeTypeId: string; versionLabel: string }) =>
      api.post<TemplateVersion>('/templates', data),
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ['templates'] });
      navigate(`/admin/templates/${res.data.templateVersionId}`);
    },
  });

  const intakeTypeMap = new Map(intakeTypes.map((t) => [t.intakeTypeId, t]));

  const filteredTemplates = intakeTypeFilter
    ? templates.filter((t) => t.intakeTypeId === intakeTypeFilter)
    : templates;

  return (
    <div className="p-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div className="flex items-center gap-3">
          <LayoutTemplate className="w-6 h-6 text-gray-700" />
          <h1 className="text-2xl font-bold text-gray-900">Templates</h1>
        </div>
        <button
          onClick={() => {
            const name = prompt('Template name:');
            if (!name) return;
            const typeId = intakeTypes[0]?.intakeTypeId;
            if (!typeId) {
              alert('No intake types available. Please create one first.');
              return;
            }
            createMutation.mutate({
              templateName: name,
              intakeTypeId: typeId,
              versionLabel: 'v1.0',
            });
          }}
          disabled={createMutation.isPending}
          className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors text-sm font-medium disabled:opacity-50"
        >
          <Plus className="w-4 h-4" />
          New Template
        </button>
      </div>

      {/* Filter */}
      {intakeTypes.length > 1 && (
        <div className="flex items-center gap-4 mb-6 p-4 bg-white rounded-lg border border-gray-200">
          <Filter className="w-4 h-4 text-gray-500" />
          <div>
            <label className="block text-xs text-gray-500 mb-1">Intake Type</label>
            <select
              value={intakeTypeFilter}
              onChange={(e) => setIntakeTypeFilter(e.target.value)}
              className="px-3 py-1.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
            >
              <option value="">All Types</option>
              {intakeTypes.map((t) => (
                <option key={t.intakeTypeId} value={t.intakeTypeId}>
                  {t.intakeTypeName}
                </option>
              ))}
            </select>
          </div>
        </div>
      )}

      {/* Template list */}
      {isLoading ? (
        <div className="text-center py-12 text-gray-500">Loading templates...</div>
      ) : filteredTemplates.length === 0 ? (
        <div className="text-center py-16 bg-white rounded-lg border border-gray-200">
          <LayoutTemplate className="w-12 h-12 text-gray-300 mx-auto mb-3" />
          <h3 className="text-lg font-medium text-gray-700 mb-1">No templates</h3>
          <p className="text-sm text-gray-500">
            Create your first template to start defining intake questions.
          </p>
        </div>
      ) : (
        <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Template
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Version
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Intake Type
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Created
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {filteredTemplates.map((t) => {
                const intakeType = intakeTypeMap.get(t.intakeTypeId);
                return (
                  <tr
                    key={t.templateVersionId}
                    className="hover:bg-gray-50 cursor-pointer"
                    onClick={() => navigate(`/admin/templates/${t.templateVersionId}`)}
                  >
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <FileEdit className="w-4 h-4 text-gray-400" />
                        <span className="text-sm font-medium text-gray-900">
                          {t.templateName}
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600">{t.versionLabel}</td>
                    <td className="px-4 py-3 text-sm text-gray-600">
                      {intakeType?.intakeTypeName ?? '--'}
                    </td>
                    <td className="px-4 py-3">
                      {t.isPublished ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-700">
                          <CheckCircle2 className="w-3 h-3" />
                          Published
                        </span>
                      ) : (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-600">
                          Draft
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-500">
                      {format(new Date(t.createdAt), 'MMM d, yyyy')}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
