import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../services/api';

export function useQuestions(params?: {
  status?: string;
  limit?: number;
  offset?: number;
}) {
  return useQuery({
    queryKey: ['questions', params],
    queryFn: () => api.getQuestions(params),
  });
}

export function useUnansweredQuestions(limit?: number) {
  return useQuery({
    queryKey: ['questions', 'unanswered', limit],
    queryFn: () => api.getUnansweredQuestions(limit),
    refetchInterval: 30000, // Refetch every 30 seconds
  });
}

export function useQuestion(id: string) {
  return useQuery({
    queryKey: ['question', id],
    queryFn: () => api.getQuestion(id),
    enabled: !!id,
  });
}

export function useCreateQuestion() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (question: {
      text: string;
      context?: string;
      why_asking?: string;
      what_claude_will_do?: string;
      priority?: number;
      task_ids?: string[];
    }) => api.createQuestion(question),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['questions'] });
    },
  });
}

export function useAnswerQuestion() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, answer }: { id: string; answer: string }) =>
      api.answerQuestion(id, answer),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['questions'] });
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
    },
  });
}

export function useDismissQuestion() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, reason }: { id: string; reason?: string }) =>
      api.dismissQuestion(id, reason),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['questions'] });
    },
  });
}
