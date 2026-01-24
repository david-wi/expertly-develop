import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../services/api';
import type { Task, TaskCreate } from '../types';

export function useTasks(params?: {
  status?: string;
  assignee?: string;
  project_id?: string;
  limit?: number;
  offset?: number;
}) {
  return useQuery({
    queryKey: ['tasks', params],
    queryFn: () => api.getTasks(params),
  });
}

export function useTask(id: string) {
  return useQuery({
    queryKey: ['task', id],
    queryFn: () => api.getTask(id),
    enabled: !!id,
  });
}

export function useNextTask() {
  return useQuery({
    queryKey: ['tasks', 'next'],
    queryFn: () => api.getNextTask(),
    refetchInterval: 30000, // Refetch every 30 seconds
  });
}

export function useCreateTask() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (task: TaskCreate) => api.createTask(task),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
    },
  });
}

export function useUpdateTask() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, updates }: { id: string; updates: Partial<Task> }) =>
      api.updateTask(id, updates),
    onSuccess: (_, { id }) => {
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
      queryClient.invalidateQueries({ queryKey: ['task', id] });
    },
  });
}

export function useStartTask() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => api.startTask(id),
    onSuccess: (_, id) => {
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
      queryClient.invalidateQueries({ queryKey: ['task', id] });
    },
  });
}

export function useCompleteTask() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, output }: { id: string; output: string }) =>
      api.completeTask(id, output),
    onSuccess: (_, { id }) => {
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
      queryClient.invalidateQueries({ queryKey: ['task', id] });
    },
  });
}

export function useBlockTask() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      id,
      questionText,
      whyAsking,
      whatClaudeWillDo,
    }: {
      id: string;
      questionText: string;
      whyAsking?: string;
      whatClaudeWillDo?: string;
    }) => api.blockTask(id, questionText, whyAsking, whatClaudeWillDo),
    onSuccess: (_, { id }) => {
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
      queryClient.invalidateQueries({ queryKey: ['task', id] });
      queryClient.invalidateQueries({ queryKey: ['questions'] });
    },
  });
}

export function useDeleteTask() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => api.deleteTask(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
    },
  });
}
