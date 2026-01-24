import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import type { WaitingItem } from '../types';

const API_BASE = import.meta.env.VITE_API_URL || '/api';

async function fetchWithAuth(url: string, options?: RequestInit) {
  const apiKey = localStorage.getItem('api_key') || '';
  const response = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      'X-API-Key': apiKey,
      ...options?.headers,
    },
  });
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`);
  }
  return response.json();
}

export function useWaitingItems(params?: {
  status?: string;
  limit?: number;
}) {
  return useQuery<WaitingItem[]>({
    queryKey: ['waiting-items', params],
    queryFn: async () => {
      try {
        const queryParams = new URLSearchParams();
        if (params?.status) queryParams.append('status', params.status);
        if (params?.limit) queryParams.append('limit', params.limit.toString());
        return await fetchWithAuth(`${API_BASE}/waiting-items?${queryParams.toString()}`);
      } catch {
        return [];
      }
    },
    staleTime: 30000,
  });
}

export function useActiveWaitingItems(limit: number = 10) {
  return useWaitingItems({ status: 'waiting', limit });
}

export function useOverdueWaitingItems(limit: number = 10) {
  return useQuery<WaitingItem[]>({
    queryKey: ['waiting-items', 'overdue', limit],
    queryFn: async () => {
      try {
        return await fetchWithAuth(`${API_BASE}/waiting-items/overdue?limit=${limit}`);
      } catch {
        return [];
      }
    },
    staleTime: 30000,
  });
}

export function useResolveWaitingItem() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, notes }: { id: string; notes?: string }) => {
      return fetchWithAuth(`${API_BASE}/waiting-items/${id}/resolve`, {
        method: 'POST',
        body: JSON.stringify({ resolution_notes: notes }),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['waiting-items'] });
    },
  });
}

export function useCreateWaitingItem() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (item: {
      what: string;
      who?: string;
      follow_up_date?: string;
      why_it_matters?: string;
    }) => {
      return fetchWithAuth(`${API_BASE}/waiting-items`, {
        method: 'POST',
        body: JSON.stringify(item),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['waiting-items'] });
    },
  });
}
