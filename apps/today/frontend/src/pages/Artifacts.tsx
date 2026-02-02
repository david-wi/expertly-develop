import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Modal } from '@expertly/ui';
import api from '../services/api';

interface ArtifactFile {
  name: string;
  path: string;
  size: number;
  modified_at: string;
  category: string;
}

interface ArtifactCategory {
  name: string;
  description: string;
  files: ArtifactFile[];
}

interface ArtifactsResponse {
  categories: ArtifactCategory[];
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}

function formatDate(isoString: string): string {
  const date = new Date(isoString);
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
}

export default function Artifacts() {
  const [selectedFile, setSelectedFile] = useState<ArtifactFile | null>(null);
  const [fileContent, setFileContent] = useState<string | null>(null);
  const [loadingContent, setLoadingContent] = useState(false);

  const { data, isLoading, error } = useQuery<ArtifactsResponse>({
    queryKey: ['artifacts'],
    queryFn: () => api.getArtifacts()
  });


  const loadFileContent = async (file: ArtifactFile) => {
    setSelectedFile(file);
    setLoadingContent(true);
    try {
      const content = await api.getArtifactContent(file.path);
      setFileContent(content);
    } catch (err) {
      setFileContent('Error loading file content');
    } finally {
      setLoadingContent(false);
    }
  };

  const closeViewer = () => {
    setSelectedFile(null);
    setFileContent(null);
  };

  if (isLoading) {
    return (
      <div className="p-6">
        <div className="animate-pulse">Loading artifacts...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6">
        <div className="text-red-600">Error loading artifacts</div>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-[var(--theme-text-heading)]">Artifacts</h1>
        <p className="text-gray-600 mt-1">
          Database seeds, documentation, and work plans
        </p>
      </div>

      {/* File Viewer Modal */}
      {selectedFile && (
        <Modal
          isOpen={!!selectedFile}
          onClose={closeViewer}
          title={selectedFile.name}
          size="full"
        >
          <p className="text-sm text-gray-500 -mt-2 mb-4">
            {formatBytes(selectedFile.size)} | Modified {formatDate(selectedFile.modified_at)}
          </p>
          <div className="max-h-[60vh] overflow-auto">
            {loadingContent ? (
              <div className="animate-pulse">Loading content...</div>
            ) : (
              <pre className="text-sm font-mono whitespace-pre-wrap bg-gray-50 p-4 rounded overflow-x-auto">
                {typeof fileContent === 'string'
                  ? fileContent
                  : JSON.stringify(fileContent, null, 2)}
              </pre>
            )}
          </div>
        </Modal>
      )}

      {/* Categories */}
      <div className="space-y-6">
        {data?.categories.map((category) => (
          <div key={category.name} className="bg-white rounded-lg shadow">
            <div className="px-4 py-3 border-b bg-gray-50 rounded-t-lg">
              <h2 className="font-semibold text-gray-900 capitalize">
                {category.name.replace('-', ' ')}
              </h2>
              <p className="text-sm text-gray-500">{category.description}</p>
            </div>

            {category.files.length === 0 ? (
              <div className="p-4 text-gray-500 text-sm">No files in this category</div>
            ) : (
              <div className="divide-y">
                {category.files.map((file) => (
                  <div
                    key={file.path}
                    className="px-4 py-3 flex items-center justify-between hover:bg-gray-50 cursor-pointer"
                    onClick={() => loadFileContent(file)}
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded bg-blue-100 flex items-center justify-center">
                        {file.name.endsWith('.json') ? (
                          <span className="text-blue-600 text-xs font-bold">{ }</span>
                        ) : file.name.endsWith('.md') ? (
                          <span className="text-blue-600 text-xs font-bold">MD</span>
                        ) : (
                          <span className="text-blue-600 text-xs font-bold">PY</span>
                        )}
                      </div>
                      <div>
                        <div className="font-medium text-gray-900">{file.name}</div>
                        <div className="text-sm text-gray-500">
                          {formatBytes(file.size)}
                        </div>
                      </div>
                    </div>
                    <div className="text-sm text-gray-500">
                      {formatDate(file.modified_at)}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
