import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import type { Draft } from '../types';

export function useDrafts(params?: {
  status?: string;
  type?: string;
  limit?: number;
}) {
  return useQuery<Draft[]>({
    queryKey: ['drafts', params],
    queryFn: async () => {
      // Note: This endpoint would need to be added to the backend
      const response = await fetch(`${import.meta.env.VITE_API_URL || '/api'}/drafts?${new URLSearchParams(params as Record<string, string>).toString()}`, {
        headers: {
          'X-API-Key': localStorage.getItem('api_key') || '',
        },
      });
      if (!response.ok) return [];
      return response.json();
    },
    staleTime: 30000,
  });
}

export function usePendingDrafts(limit: number = 10) {
  return useDrafts({ status: 'pending', limit });
}

export function useApproveDraft() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, feedback }: { id: string; feedback?: string }) => {
      const response = await fetch(`${import.meta.env.VITE_API_URL || '/api'}/drafts/${id}/approve`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-API-Key': localStorage.getItem('api_key') || '',
        },
        body: JSON.stringify({ feedback }),
      });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['drafts'] });
    },
  });
}

export function useRejectDraft() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, feedback }: { id: string; feedback: string }) => {
      const response = await fetch(`${import.meta.env.VITE_API_URL || '/api'}/drafts/${id}/reject`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-API-Key': localStorage.getItem('api_key') || '',
        },
        body: JSON.stringify({ feedback }),
      });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['drafts'] });
    },
  });
}
