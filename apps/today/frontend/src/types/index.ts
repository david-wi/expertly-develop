// Core entity types

export interface Task {
  id: string;
  tenant_id: string;
  project_id: string | null;
  title: string;
  description: string | null;
  priority: number;
  status: TaskStatus;
  assignee: 'claude' | 'user';
  due_date: string | null;
  blocking_question_id: string | null;
  context: Record<string, any>;
  output: string | null;
  source: string | null;
  tags: string[];
  created_at: string;
  updated_at: string;
  started_at: string | null;
  completed_at: string | null;
}

export type TaskStatus = 'queued' | 'working' | 'blocked' | 'completed' | 'cancelled';

export interface TaskCreate {
  title: string;
  description?: string;
  priority?: number;
  assignee?: 'claude' | 'user';
  project_id?: string;
  due_date?: string;
  tags?: string[];
}

export interface Question {
  id: string;
  tenant_id: string;
  user_id: string | null;
  text: string;
  context: string | null;
  why_asking: string | null;
  what_claude_will_do: string | null;
  priority: number;
  priority_reason: string | null;
  status: QuestionStatus;
  answer: string | null;
  answered_at: string | null;
  answered_by: string | null;
  created_at: string;
}

export type QuestionStatus = 'unanswered' | 'answered' | 'dismissed';

export interface Project {
  id: string;
  tenant_id: string;
  user_id: string | null;
  name: string;
  description: string | null;
  project_type: string;
  status: string;
  priority_order: number;
  success_criteria: string | null;
  target_date: string | null;
  parent_id: string | null;
  metadata: Record<string, any>;
  created_at: string;
  updated_at: string;
}

export interface Person {
  id: string;
  tenant_id: string;
  client_id: string | null;
  name: string;
  email: string | null;
  phone: string | null;
  title: string | null;
  company: string | null;
  relationship: string | null;
  relationship_to_user: string | null;
  political_context: string | null;
  communication_notes: string | null;
  last_contact: string | null;
  next_follow_up: string | null;
  context_notes: string | null;
  metadata: Record<string, any>;
  created_at: string;
  updated_at: string;
}

export interface Client {
  id: string;
  tenant_id: string;
  name: string;
  status: string;
  notes: string | null;
  metadata: Record<string, any>;
  created_at: string;
  updated_at: string;
}

export interface Draft {
  id: string;
  tenant_id: string;
  task_id: string | null;
  type: 'email' | 'slack' | 'document' | 'note';
  recipient: string | null;
  subject: string | null;
  body: string;
  status: DraftStatus;
  feedback: string | null;
  revision_of: string | null;
  relationship_context: Record<string, any> | null;
  created_at: string;
  updated_at: string;
  approved_at: string | null;
  sent_at: string | null;
}

export type DraftStatus = 'pending' | 'approved' | 'rejected' | 'sent' | 'revised';

export interface Playbook {
  id: string;
  tenant_id: string;
  name: string;
  description: string;
  category: string | null;
  triggers: string[];
  must_consult: boolean;
  content: string;
  scripts: Record<string, any>;
  references: Record<string, any>;
  examples: any[];
  learned_from: string | null;
  source_task_id: string | null;
  last_used: string | null;
  use_count: number;
  status: PlaybookStatus;
  created_at: string;
  updated_at: string;
}

export type PlaybookStatus = 'active' | 'proposed' | 'archived';

export interface WaitingItem {
  id: string;
  tenant_id: string;
  task_id: string | null;
  person_id: string | null;
  what: string;
  who: string | null;
  since: string;
  follow_up_date: string | null;
  why_it_matters: string | null;
  status: string;
  resolved_at: string | null;
  created_at: string;
}

export interface Knowledge {
  id: string;
  tenant_id: string;
  source_task_id: string | null;
  source_type: string;
  trigger_phrase: string | null;
  content: string;
  category: string;
  routed_to_type: string | null;
  routed_to_id: string | null;
  status: string;
  learned_at: string;
  created_at: string;
}

// Dashboard data
export interface DashboardData {
  today_priorities: Task[];
  questions_for_you: Question[];
  claude_working_on: Task | null;
  drafts_to_review: Draft[];
  waiting_on: WaitingItem[];
  overdue_items: WaitingItem[];
}

// API response types
export interface TaskNextResponse {
  task: Task;
  context: TaskContext;
  matched_playbooks: PlaybookMatchResult[];
  must_consult_warnings: MustConsultWarning[];
}

export interface TaskContext {
  people: Person[];
  project: Project | null;
  related_tasks: Task[];
  history: any[];
  relevant_playbooks: Playbook[];
}

export interface PlaybookMatchResult {
  id: string;
  name: string;
  must_consult: boolean;
  match_reason: string;
  relevance_score: number;
  content_preview: string;
}

export interface MustConsultWarning {
  playbook_name: string;
  playbook_id: string;
  warning: string;
}
