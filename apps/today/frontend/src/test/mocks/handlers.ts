import { http, HttpResponse } from 'msw'
import type { Task, Question } from '../../types'

const API_URL = 'http://localhost:8000/api'

// Mock data
export const mockTasks: Task[] = [
  {
    id: '1',
    tenant_id: 'tenant-1',
    project_id: null,
    title: 'Test Task 1',
    description: 'Description for task 1',
    priority: 2,
    status: 'queued',
    assignee: 'claude',
    due_date: null,
    blocking_question_id: null,
    context: {},
    output: null,
    source: null,
    tags: ['test'],
    created_at: '2026-01-22T10:00:00Z',
    updated_at: '2026-01-22T10:00:00Z',
    started_at: null,
    completed_at: null,
  },
  {
    id: '2',
    tenant_id: 'tenant-1',
    project_id: null,
    title: 'Test Task 2',
    description: 'Description for task 2',
    priority: 1,
    status: 'working',
    assignee: 'claude',
    due_date: null,
    blocking_question_id: null,
    context: {},
    output: null,
    source: null,
    tags: [],
    created_at: '2026-01-22T11:00:00Z',
    updated_at: '2026-01-22T11:00:00Z',
    started_at: '2026-01-22T11:30:00Z',
    completed_at: null,
  },
]

export const mockQuestions: Question[] = [
  {
    id: 'q1',
    tenant_id: 'tenant-1',
    user_id: null,
    text: 'What is the preferred format?',
    context: 'Working on report',
    why_asking: 'Need clarification',
    what_claude_will_do: 'Format the report accordingly',
    priority: 1,
    priority_reason: 'Blocking task',
    status: 'unanswered',
    answer: null,
    answered_at: null,
    answered_by: null,
    created_at: '2026-01-22T12:00:00Z',
  },
]

export const handlers = [
  // Tasks
  http.get(`${API_URL}/tasks`, () => {
    return HttpResponse.json(mockTasks)
  }),

  http.get(`${API_URL}/tasks/next`, () => {
    return HttpResponse.json({
      task: mockTasks[0],
      context: { people: [], project: null, related_tasks: [], history: [], relevant_playbooks: [] },
      matched_playbooks: [],
      must_consult_warnings: [],
    })
  }),

  http.get(`${API_URL}/tasks/:id`, ({ params }) => {
    const task = mockTasks.find((t) => t.id === params.id)
    if (task) {
      return HttpResponse.json(task)
    }
    return new HttpResponse(null, { status: 404 })
  }),

  http.post(`${API_URL}/tasks`, async ({ request }) => {
    const body = (await request.json()) as { title: string; description?: string }
    const newTask: Task = {
      ...mockTasks[0],
      id: '3',
      title: body.title,
      description: body.description || null,
    }
    return HttpResponse.json(newTask, { status: 201 })
  }),

  http.put(`${API_URL}/tasks/:id`, async ({ params, request }) => {
    const task = mockTasks.find((t) => t.id === params.id)
    if (!task) {
      return new HttpResponse(null, { status: 404 })
    }
    const updates = (await request.json()) as Partial<Task>
    return HttpResponse.json({ ...task, ...updates })
  }),

  http.delete(`${API_URL}/tasks/:id`, ({ params }) => {
    const task = mockTasks.find((t) => t.id === params.id)
    if (!task) {
      return new HttpResponse(null, { status: 404 })
    }
    return new HttpResponse(null, { status: 204 })
  }),

  http.post(`${API_URL}/tasks/:id/start`, ({ params }) => {
    const task = mockTasks.find((t) => t.id === params.id)
    if (!task) {
      return new HttpResponse(null, { status: 404 })
    }
    return HttpResponse.json({ ...task, status: 'working', started_at: new Date().toISOString() })
  }),

  http.post(`${API_URL}/tasks/:id/complete`, async ({ params, request }) => {
    const task = mockTasks.find((t) => t.id === params.id)
    if (!task) {
      return new HttpResponse(null, { status: 404 })
    }
    const body = (await request.json()) as { output: string }
    return HttpResponse.json({
      ...task,
      status: 'completed',
      output: body.output,
      completed_at: new Date().toISOString(),
    })
  }),

  // Questions
  http.get(`${API_URL}/questions`, () => {
    return HttpResponse.json(mockQuestions)
  }),

  http.get(`${API_URL}/questions/unanswered`, () => {
    return HttpResponse.json(mockQuestions.filter((q) => q.status === 'unanswered'))
  }),

  http.put(`${API_URL}/questions/:id/answer`, async ({ params, request }) => {
    const question = mockQuestions.find((q) => q.id === params.id)
    if (!question) {
      return new HttpResponse(null, { status: 404 })
    }
    const body = (await request.json()) as { answer: string }
    return HttpResponse.json({
      question: { ...question, status: 'answered', answer: body.answer },
      unblocked_task_ids: [],
    })
  }),

  // Drafts
  http.get(`${API_URL}/drafts`, () => {
    return HttpResponse.json([])
  }),
]
