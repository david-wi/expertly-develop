import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import api from '../services/api';
import { Card } from '../components/common/Card';
import type { Project } from '../types';

export function Projects() {
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>('all');

  const { data: projects = [], isLoading, error } = useQuery({
    queryKey: ['projects'],
    queryFn: () => api.getProjects(),
  });

  const statuses = ['all', ...new Set(projects.map(p => p.status))];
  const filteredProjects = statusFilter === 'all'
    ? projects
    : projects.filter(p => p.status === statusFilter);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-12">
        <p className="text-red-600">Failed to load projects</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Projects</h1>
          <p className="text-sm text-gray-500">Active and past projects</p>
        </div>
        <span className="text-sm text-gray-500">{projects.length} projects</span>
      </div>

      {statuses.length > 1 && (
        <div className="flex items-center space-x-2">
          {statuses.map((status) => (
            <button
              key={status}
              onClick={() => setStatusFilter(status)}
              className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${
                statusFilter === status
                  ? 'bg-blue-100 text-blue-700'
                  : 'text-gray-600 hover:bg-gray-100'
              }`}
            >
              {status.charAt(0).toUpperCase() + status.slice(1)}
            </button>
          ))}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <h2 className="text-lg font-semibold text-gray-900 mb-4">All Projects</h2>
          {filteredProjects.length === 0 ? (
            <div className="text-center py-8">
              <FolderIcon className="mx-auto h-12 w-12 text-gray-400" />
              <p className="mt-4 text-sm text-gray-500">No projects found.</p>
            </div>
          ) : (
            <div className="divide-y divide-gray-100">
              {filteredProjects.map((project) => (
                <button
                  key={project.id}
                  onClick={() => setSelectedProject(project)}
                  className={`w-full text-left py-3 -mx-4 px-4 transition-colors ${
                    selectedProject?.id === project.id ? 'bg-blue-50' : 'hover:bg-gray-50'
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900">{project.name}</p>
                      {project.description && (
                        <p className="text-xs text-gray-500 mt-0.5 line-clamp-1">{project.description}</p>
                      )}
                      <div className="mt-1 flex items-center space-x-2">
                        <StatusBadge status={project.status} />
                        <span className="text-xs text-gray-400">{project.project_type}</span>
                      </div>
                    </div>
                    <ChevronRightIcon className="w-5 h-5 text-gray-400 ml-2 flex-shrink-0" />
                  </div>
                </button>
              ))}
            </div>
          )}
        </Card>

        <div>
          {selectedProject ? (
            <Card>
              <div className="space-y-4">
                <div className="flex items-start justify-between">
                  <h2 className="text-lg font-semibold text-gray-900">{selectedProject.name}</h2>
                  <StatusBadge status={selectedProject.status} />
                </div>

                {selectedProject.description && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                    <p className="text-sm text-gray-600 bg-gray-50 p-3 rounded-md">{selectedProject.description}</p>
                  </div>
                )}

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Type</label>
                    <p className="text-sm text-gray-900">{selectedProject.project_type}</p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Priority</label>
                    <p className="text-sm text-gray-900">#{selectedProject.priority_order}</p>
                  </div>
                </div>

                {selectedProject.success_criteria && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Success Criteria</label>
                    <p className="text-sm text-gray-600 bg-green-50 p-3 rounded-md">{selectedProject.success_criteria}</p>
                  </div>
                )}

                {selectedProject.target_date && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Target Date</label>
                    <p className="text-sm text-gray-900">{new Date(selectedProject.target_date).toLocaleDateString()}</p>
                  </div>
                )}

                <div className="pt-4 border-t text-xs text-gray-400">
                  <p>Created: {new Date(selectedProject.created_at).toLocaleDateString()}</p>
                  <p>Updated: {new Date(selectedProject.updated_at).toLocaleDateString()}</p>
                </div>
              </div>
            </Card>
          ) : (
            <Card>
              <div className="text-center py-12">
                <FolderIcon className="mx-auto h-12 w-12 text-gray-400" />
                <p className="mt-4 text-gray-500">Select a project to view details</p>
              </div>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const colors: Record<string, string> = {
    active: 'bg-green-100 text-green-800',
    planning: 'bg-blue-100 text-blue-800',
    'on-hold': 'bg-yellow-100 text-yellow-800',
    completed: 'bg-gray-100 text-gray-800',
    cancelled: 'bg-red-100 text-red-800',
  };
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${colors[status] || 'bg-gray-100 text-gray-800'}`}>
      {status}
    </span>
  );
}

function ChevronRightIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
    </svg>
  );
}

function FolderIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
    </svg>
  );
}
