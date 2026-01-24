import axios, { type AxiosInstance, type AxiosError } from 'axios';
import type {
  Task,
  TaskCreate,
  Question,
  Project,
  Person,
  Client,
  Draft,
  Playbook,
  Knowledge,
  DashboardData,
  TaskNextResponse,
} from '../types';

const API_BASE_URL = import.meta.env.VITE_API_URL || '/api';

class ApiService {
  private client: AxiosInstance;
  private apiKey: string | null = null;

  constructor() {
    this.client = axios.create({
      baseURL: API_BASE_URL,
      headers: {
        'Content-Type': 'application/json',
      },
    });

    // Load API key from localStorage on initialization
    this.loadApiKey();

    // Add API key to all requests
    this.client.interceptors.request.use((config) => {
      // Always try to get the latest API key from localStorage as fallback
      const key = this.apiKey || localStorage.getItem('api_key');
      if (key) {
        config.headers['X-API-Key'] = key;
      }
      return config;
    });

    // Handle errors
    this.client.interceptors.response.use(
      (response) => response,
      (error: AxiosError) => {
        if (error.response?.status === 401) {
          // Handle unauthorized
          console.error('Unauthorized - invalid API key');
        }
        return Promise.reject(error);
      }
    );
  }

  setApiKey(key: string) {
    this.apiKey = key;
    localStorage.setItem('api_key', key);
  }

  loadApiKey() {
    this.apiKey = localStorage.getItem('api_key');
    return this.apiKey;
  }

  // Tasks
  async getTasks(params?: {
    status?: string;
    assignee?: string;
    project_id?: string;
    limit?: number;
    offset?: number;
  }): Promise<Task[]> {
    const { data } = await this.client.get('/tasks', { params });
    return data;
  }

  async getNextTask(): Promise<TaskNextResponse | null> {
    try {
      const { data } = await this.client.get('/tasks/next');
      return data;
    } catch (error) {
      if ((error as AxiosError).response?.status === 404) {
        return null;
      }
      throw error;
    }
  }

  async getTask(id: string): Promise<Task> {
    const { data } = await this.client.get(`/tasks/${id}`);
    return data;
  }

  async createTask(task: TaskCreate): Promise<Task> {
    const { data } = await this.client.post('/tasks', task);
    return data;
  }

  async updateTask(id: string, updates: Partial<Task>): Promise<Task> {
    const { data } = await this.client.put(`/tasks/${id}`, updates);
    return data;
  }

  async startTask(id: string): Promise<Task> {
    const { data } = await this.client.post(`/tasks/${id}/start`);
    return data;
  }

  async completeTask(id: string, output: string): Promise<Task> {
    const { data } = await this.client.post(`/tasks/${id}/complete`, { output });
    return data;
  }

  async blockTask(id: string, questionText: string, whyAsking?: string, whatClaudeWillDo?: string): Promise<{ task: Task; question: Question }> {
    const { data } = await this.client.post(`/tasks/${id}/block`, {
      question_text: questionText,
      why_asking: whyAsking,
      what_claude_will_do: whatClaudeWillDo,
    });
    return data;
  }

  async deleteTask(id: string): Promise<void> {
    await this.client.delete(`/tasks/${id}`);
  }

  // Questions
  async getQuestions(params?: { status?: string; limit?: number; offset?: number }): Promise<Question[]> {
    const { data } = await this.client.get('/questions', { params });
    return data;
  }

  async getUnansweredQuestions(limit?: number): Promise<Question[]> {
    const { data } = await this.client.get('/questions/unanswered', { params: { limit } });
    return data;
  }

  async getQuestion(id: string): Promise<Question> {
    const { data } = await this.client.get(`/questions/${id}`);
    return data;
  }

  async createQuestion(question: {
    text: string;
    context?: string;
    why_asking?: string;
    what_claude_will_do?: string;
    priority?: number;
    task_ids?: string[];
  }): Promise<Question> {
    const { data } = await this.client.post('/questions', question);
    return data;
  }

  async answerQuestion(id: string, answer: string): Promise<{ question: Question; unblocked_task_ids: string[] }> {
    const { data } = await this.client.put(`/questions/${id}/answer`, { answer });
    return data;
  }

  async dismissQuestion(id: string, reason?: string): Promise<Question> {
    const { data } = await this.client.put(`/questions/${id}/dismiss`, { reason });
    return data;
  }

  // Projects
  async getProjects(params?: { status?: string; limit?: number; offset?: number }): Promise<Project[]> {
    const { data } = await this.client.get('/projects', { params });
    return data;
  }

  async getProject(id: string): Promise<Project> {
    const { data } = await this.client.get(`/projects/${id}`);
    return data;
  }

  async createProject(project: { name: string; description?: string; project_type?: string }): Promise<Project> {
    const { data } = await this.client.post('/projects', project);
    return data;
  }

  // People
  async getPeople(params?: { client_id?: string; relationship?: string; search?: string; limit?: number; offset?: number }): Promise<Person[]> {
    const { data } = await this.client.get('/people', { params });
    return data;
  }

  async getPerson(id: string): Promise<Person> {
    const { data } = await this.client.get(`/people/${id}`);
    return data;
  }

  async createPerson(person: {
    name: string;
    email?: string;
    phone?: string;
    title?: string;
    company?: string;
    client_id?: string;
    relationship?: string;
  }): Promise<Person> {
    const { data } = await this.client.post('/people', person);
    return data;
  }

  // Clients
  async getClients(params?: { status?: string; search?: string; limit?: number; offset?: number }): Promise<Client[]> {
    const { data } = await this.client.get('/clients', { params });
    return data;
  }

  async getClient(id: string): Promise<Client & { people: Person[] }> {
    const { data } = await this.client.get(`/clients/${id}`);
    return data;
  }

  async createClient(client: { name: string; status?: string; notes?: string }): Promise<Client> {
    const { data } = await this.client.post('/clients', client);
    return data;
  }

  // Playbooks
  async getPlaybooks(params?: { category?: string; must_consult?: boolean; status?: string }): Promise<Playbook[]> {
    const { data } = await this.client.get('/playbooks', { params });
    return data;
  }

  async getPlaybook(id: string): Promise<Playbook> {
    const { data } = await this.client.get(`/playbooks/${id}`);
    return data;
  }

  async matchPlaybooks(taskDescription: string): Promise<{
    matched: Array<{
      id: string;
      name: string;
      must_consult: boolean;
      match_reason: string;
      relevance_score: number;
      content_preview: string;
    }>;
    must_consult_warnings: Array<{
      playbook_name: string;
      playbook_id: string;
      warning: string;
    }>;
  }> {
    const { data } = await this.client.get('/playbooks/match', { params: { task: taskDescription } });
    return data;
  }

  // Knowledge
  async captureKnowledge(knowledge: {
    content: string;
    category: string;
    source_task_id?: string;
    trigger_phrase?: string;
  }): Promise<Knowledge> {
    const { data } = await this.client.post('/knowledge/capture', knowledge);
    return data;
  }

  async getKnowledge(params?: { status?: string; category?: string; limit?: number; offset?: number }): Promise<Knowledge[]> {
    const { data } = await this.client.get('/knowledge', { params });
    return data;
  }

  // Artifacts
  async getArtifacts(): Promise<{
    categories: Array<{
      name: string;
      description: string;
      files: Array<{
        name: string;
        path: string;
        size: number;
        modified_at: string;
        category: string;
      }>;
    }>;
  }> {
    const { data } = await this.client.get('/artifacts');
    return data;
  }

  async getArtifactContent(path: string): Promise<string> {
    const { data } = await this.client.get(`/artifacts/${path}`);
    return data;
  }

  // Organization
  async getOrganization(): Promise<{
    id: string;
    name: string;
    api_calls_this_month: number;
    created_at: string;
    usage: {
      total_users: number;
      total_tasks: number;
      tasks_completed_this_month: number;
      tasks_created_this_month: number;
      api_calls_this_month: number;
    };
  }> {
    const { data } = await this.client.get('/organization');
    return data;
  }

  async updateOrganization(updates: { name: string }): Promise<{ id: string; name: string }> {
    const { data } = await this.client.put('/organization', updates);
    return data;
  }

  // Users
  async getUsers(): Promise<Array<{
    id: string;
    email: string;
    name: string | null;
    role: string;
    timezone: string;
    created_at: string;
  }>> {
    const { data } = await this.client.get('/users');
    return data;
  }

  async createUser(user: { email: string; name?: string; role?: string; timezone?: string }): Promise<{
    id: string;
    email: string;
    name: string | null;
    role: string;
    timezone: string;
    api_key: string;
  }> {
    const { data } = await this.client.post('/users', user);
    return data;
  }

  async updateUser(id: string, updates: { name?: string; role?: string; timezone?: string }): Promise<{
    id: string;
    email: string;
    name: string | null;
    role: string;
    timezone: string;
  }> {
    const { data } = await this.client.put(`/users/${id}`, updates);
    return data;
  }

  async deleteUser(id: string): Promise<void> {
    await this.client.delete(`/users/${id}`);
  }

  // Dashboard aggregated data
  async getDashboardData(): Promise<DashboardData> {
    // For now, aggregate from individual endpoints
    const [tasks, questions, drafts] = await Promise.all([
      this.getTasks({ status: 'queued', assignee: 'claude', limit: 10 }),
      this.getUnansweredQuestions(10),
      this.client.get<Draft[]>('/drafts', { params: { status: 'pending', limit: 5 } }).then(r => r.data).catch(() => []),
    ]);

    // Get currently working task
    const workingTasks = await this.getTasks({ status: 'working', limit: 1 });

    return {
      today_priorities: tasks.slice(0, 5),
      questions_for_you: questions,
      claude_working_on: workingTasks[0] || null,
      drafts_to_review: drafts,
      waiting_on: [],
      overdue_items: [],
    };
  }
}

export const api = new ApiService();
export default api;
