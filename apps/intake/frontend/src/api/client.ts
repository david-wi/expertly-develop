import axios, { type AxiosInstance, type AxiosResponse } from 'axios';

import type {
  User,
  Account,
  VoiceProfile,
  IntakeType,
  TemplateVersion,
  TemplateSection,
  TemplateQuestion,
  Intake,
  IntakeSectionInstance,
  IntakeQuestionInstance,
  AnswerRevision,
  CurrentAnswer,
  Session,
  Contributor,
  Assignment,
  FollowUpPlan,
  FileAsset,
  UrlSource,
  UrlSnapshot,
  Proposal,
  TimelineEvent,
  UsageRollup,
} from '../types';

// ---------------------------------------------------------------------------
// Axios instance
// ---------------------------------------------------------------------------

const API_URL = import.meta.env.VITE_API_URL || '/api/v1';

const axiosInstance: AxiosInstance = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// ---------------------------------------------------------------------------
// Request interceptor — attach auth token
// ---------------------------------------------------------------------------

axiosInstance.interceptors.request.use((config) => {
  const token = localStorage.getItem('intake_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// ---------------------------------------------------------------------------
// Response interceptor — handle 401
// ---------------------------------------------------------------------------

axiosInstance.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('intake_token');
      // Only redirect if we are not already on the login page
      if (window.location.pathname !== '/login') {
        window.location.href = '/login';
      }
    }
    return Promise.reject(error);
  },
);

// ---------------------------------------------------------------------------
// Helper: unwrap AxiosResponse
// ---------------------------------------------------------------------------

function unwrap<T>(res: AxiosResponse<T>): T {
  return res.data;
}

// ---------------------------------------------------------------------------
// Auth
// ---------------------------------------------------------------------------

interface LoginResponse {
  token: string;
  tokenType: string;
  expiresAt: string;
  user: User;
}

const auth = {
  login(email: string, password: string): Promise<LoginResponse> {
    return axiosInstance.post('/auth/login', { email, password }).then(unwrap);
  },

  me(): Promise<User> {
    return axiosInstance.get('/me').then(unwrap);
  },

  getAccount(): Promise<Account> {
    return axiosInstance.get('/accounts/current').then(unwrap);
  },

  listUsers(): Promise<User[]> {
    return axiosInstance.get('/users').then(unwrap);
  },

  createUser(data: {
    email: string;
    name: string;
    role?: string;
  }): Promise<User> {
    return axiosInstance.post('/users', data).then(unwrap);
  },
};

// ---------------------------------------------------------------------------
// Voice Profiles
// ---------------------------------------------------------------------------

const voiceProfiles = {
  list(): Promise<VoiceProfile[]> {
    return axiosInstance.get('/voice-profiles').then(unwrap);
  },

  create(data: {
    voiceProfileName: string;
    vapiVoiceId: string;
    notes?: string;
    isEnabled?: boolean;
  }): Promise<VoiceProfile> {
    return axiosInstance.post('/voice-profiles', data).then(unwrap);
  },

  update(
    id: string,
    data: {
      voiceProfileName?: string;
      vapiVoiceId?: string;
      notes?: string;
      isEnabled?: boolean;
    },
  ): Promise<VoiceProfile> {
    return axiosInstance.patch(`/voice-profiles/${id}`, data).then(unwrap);
  },
};

// ---------------------------------------------------------------------------
// Intake Types
// ---------------------------------------------------------------------------

const intakeTypes = {
  list(): Promise<IntakeType[]> {
    return axiosInstance.get('/intake-types').then(unwrap);
  },

  create(data: {
    intakeTypeName: string;
    description?: string;
    defaultTemplateVersionId?: string;
    defaultVoiceProfileId?: string;
    defaultsRecordingEnabled?: boolean;
    defaultsTranscriptionEnabled?: boolean;
    defaultsContinueRecordingAfterTransfer?: boolean;
  }): Promise<IntakeType> {
    return axiosInstance.post('/intake-types', data).then(unwrap);
  },

  update(
    id: string,
    data: {
      intakeTypeName?: string;
      description?: string;
      defaultTemplateVersionId?: string;
      defaultVoiceProfileId?: string;
      defaultsRecordingEnabled?: boolean;
      defaultsTranscriptionEnabled?: boolean;
      defaultsContinueRecordingAfterTransfer?: boolean;
    },
  ): Promise<IntakeType> {
    return axiosInstance.patch(`/intake-types/${id}`, data).then(unwrap);
  },
};

// ---------------------------------------------------------------------------
// Templates
// ---------------------------------------------------------------------------

const templates = {
  list(params?: { intakeTypeId?: string; isPublished?: boolean }): Promise<TemplateVersion[]> {
    return axiosInstance.get('/templates', { params }).then(unwrap);
  },

  get(id: string): Promise<TemplateVersion> {
    return axiosInstance.get(`/templates/${id}`).then(unwrap);
  },

  create(data: {
    templateName: string;
    versionLabel: string;
    intakeTypeId: string;
  }): Promise<TemplateVersion> {
    return axiosInstance.post('/templates', data).then(unwrap);
  },

  createSection(
    templateId: string,
    data: {
      sectionName: string;
      sectionOrder: number;
      isRepeatable?: boolean;
      repeatKeyName?: string;
      applicabilityRuleText?: string;
    },
  ): Promise<TemplateSection> {
    return axiosInstance
      .post(`/templates/${templateId}/sections`, data)
      .then(unwrap);
  },

  createQuestion(
    templateId: string,
    sectionId: string,
    data: {
      questionKey: string;
      questionText: string;
      questionHelpText?: string;
      questionOrder: number;
      isRequired?: boolean;
      answerType: string;
      applicabilityRuleText?: string;
    },
  ): Promise<TemplateQuestion> {
    return axiosInstance
      .post(`/templates/${templateId}/sections/${sectionId}/questions`, data)
      .then(unwrap);
  },

  publish(templateId: string): Promise<TemplateVersion> {
    return axiosInstance.post(`/templates/${templateId}/publish`).then(unwrap);
  },
};

// ---------------------------------------------------------------------------
// Intakes
// ---------------------------------------------------------------------------

const intakes = {
  list(): Promise<Intake[]> {
    return axiosInstance.get('/intakes').then(unwrap);
  },

  get(id: string): Promise<Intake> {
    return axiosInstance.get(`/intakes/${id}`).then(unwrap);
  },

  create(data: {
    intakeName: string;
    intakeTypeId: string;
    templateVersionId?: string;
    timezone?: string;
    voiceProfileIdOverride?: string;
  }): Promise<Intake> {
    return axiosInstance.post('/intakes', data).then(unwrap);
  },

  update(
    id: string,
    data: {
      intakeName?: string;
      intakeStatus?: string;
      voiceProfileIdOverride?: string;
    },
  ): Promise<Intake> {
    return axiosInstance.patch(`/intakes/${id}`, data).then(unwrap);
  },

  rotateCode(id: string): Promise<{ intakeCode: string }> {
    return axiosInstance.post(`/intakes/${id}/rotate-code`).then(unwrap);
  },
};

// ---------------------------------------------------------------------------
// Sections
// ---------------------------------------------------------------------------

const sections = {
  list(intakeId: string): Promise<IntakeSectionInstance[]> {
    return axiosInstance.get(`/intakes/${intakeId}/sections`).then(unwrap);
  },

  get(intakeId: string, sectionId: string): Promise<IntakeSectionInstance> {
    return axiosInstance
      .get(`/intakes/${intakeId}/sections/${sectionId}`)
      .then(unwrap);
  },

  markComplete(intakeId: string, sectionId: string): Promise<IntakeSectionInstance> {
    return axiosInstance
      .post(`/intakes/${intakeId}/sections/${sectionId}/mark-complete`)
      .then(unwrap);
  },

  addRepeatInstance(
    intakeId: string,
    templateSectionId: string,
    data: { instanceLabel?: string },
  ): Promise<IntakeSectionInstance> {
    return axiosInstance
      .post(`/intakes/${intakeId}/sections/repeat`, {
        templateSectionId,
        ...data,
      })
      .then(unwrap);
  },
};

// ---------------------------------------------------------------------------
// Questions
// ---------------------------------------------------------------------------

const questions = {
  get(intakeId: string, questionId: string): Promise<IntakeQuestionInstance> {
    return axiosInstance
      .get(`/intakes/${intakeId}/questions/${questionId}`)
      .then(unwrap);
  },
};

// ---------------------------------------------------------------------------
// Answers
// ---------------------------------------------------------------------------

const answers = {
  revise(
    intakeId: string,
    data: {
      intakeQuestionInstanceId: string;
      answerValue: string;
      source?: string;
      sessionId?: string;
      contributorId?: string;
      makeCurrent?: boolean;
      confidence?: number;
      notes?: string;
    },
  ): Promise<AnswerRevision> {
    return axiosInstance
      .post(`/intakes/${intakeId}/answers`, data)
      .then(unwrap);
  },

  listRevisions(
    intakeId: string,
    questionInstanceId: string,
  ): Promise<AnswerRevision[]> {
    return axiosInstance
      .get(`/intakes/${intakeId}/answers/${questionInstanceId}/revisions`)
      .then(unwrap);
  },

  chooseCurrent(
    intakeId: string,
    data: {
      intakeQuestionInstanceId: string;
      answerRevisionId: string;
    },
  ): Promise<CurrentAnswer> {
    return axiosInstance
      .post(`/intakes/${intakeId}/answers/choose-current`, data)
      .then(unwrap);
  },
};

// ---------------------------------------------------------------------------
// Sessions
// ---------------------------------------------------------------------------

const sessions = {
  list(intakeId: string): Promise<Session[]> {
    return axiosInstance.get(`/intakes/${intakeId}/sessions`).then(unwrap);
  },

  create(
    intakeId: string,
    data: {
      sessionType: string;
      contributorId?: string;
      metadata?: Record<string, unknown>;
    },
  ): Promise<Session> {
    return axiosInstance
      .post(`/intakes/${intakeId}/sessions`, data)
      .then(unwrap);
  },
};

// ---------------------------------------------------------------------------
// Contributors
// ---------------------------------------------------------------------------

const contributors = {
  list(intakeId: string): Promise<Contributor[]> {
    return axiosInstance
      .get(`/intakes/${intakeId}/contributors`)
      .then(unwrap);
  },

  create(
    intakeId: string,
    data: {
      name: string;
      email?: string;
      phone?: string;
      role?: string;
    },
  ): Promise<Contributor> {
    return axiosInstance
      .post(`/intakes/${intakeId}/contributors`, data)
      .then(unwrap);
  },

  assign(
    intakeId: string,
    data: {
      contributorId: string;
      intakeSectionInstanceId: string;
    },
  ): Promise<Assignment> {
    return axiosInstance
      .post(`/intakes/${intakeId}/contributors/assign`, data)
      .then(unwrap);
  },
};

// ---------------------------------------------------------------------------
// Follow-ups
// ---------------------------------------------------------------------------

const followUps = {
  list(intakeId: string): Promise<FollowUpPlan[]> {
    return axiosInstance
      .get(`/intakes/${intakeId}/follow-ups`)
      .then(unwrap);
  },

  create(
    intakeId: string,
    data: {
      description: string;
      dueDate?: string;
      assignedTo?: string;
    },
  ): Promise<FollowUpPlan> {
    return axiosInstance
      .post(`/intakes/${intakeId}/follow-ups`, data)
      .then(unwrap);
  },

  markDone(id: string): Promise<FollowUpPlan> {
    return axiosInstance
      .post(`/follow-ups/${id}/mark-done`)
      .then(unwrap);
  },
};

// ---------------------------------------------------------------------------
// Files
// ---------------------------------------------------------------------------

const files = {
  list(intakeId: string): Promise<FileAsset[]> {
    return axiosInstance.get(`/intakes/${intakeId}/files`).then(unwrap);
  },

  upload(intakeId: string, data: FormData): Promise<FileAsset> {
    return axiosInstance
      .post(`/intakes/${intakeId}/files`, data, {
        headers: { 'Content-Type': 'multipart/form-data' },
      })
      .then(unwrap);
  },

  process(intakeId: string, fileId: string): Promise<FileAsset> {
    return axiosInstance
      .post(`/intakes/${intakeId}/files/${fileId}/process`)
      .then(unwrap);
  },
};

// ---------------------------------------------------------------------------
// URLs
// ---------------------------------------------------------------------------

const urls = {
  list(intakeId: string): Promise<UrlSource[]> {
    return axiosInstance.get(`/intakes/${intakeId}/urls`).then(unwrap);
  },

  create(
    intakeId: string,
    data: { url: string; label?: string },
  ): Promise<UrlSource> {
    return axiosInstance
      .post(`/intakes/${intakeId}/urls`, data)
      .then(unwrap);
  },

  refresh(intakeId: string, urlId: string): Promise<UrlSnapshot> {
    return axiosInstance
      .post(`/intakes/${intakeId}/urls/${urlId}/refresh`)
      .then(unwrap);
  },

  snapshots(intakeId: string, urlId: string): Promise<UrlSnapshot[]> {
    return axiosInstance
      .get(`/intakes/${intakeId}/urls/${urlId}/snapshots`)
      .then(unwrap);
  },
};

// ---------------------------------------------------------------------------
// Proposals
// ---------------------------------------------------------------------------

const proposals = {
  list(intakeId: string): Promise<Proposal[]> {
    return axiosInstance.get(`/intakes/${intakeId}/proposals`).then(unwrap);
  },

  accept(intakeId: string, proposalId: string): Promise<Proposal> {
    return axiosInstance
      .post(`/intakes/${intakeId}/proposals/${proposalId}/accept`)
      .then(unwrap);
  },

  reject(
    intakeId: string,
    proposalId: string,
    reason: string,
  ): Promise<Proposal> {
    return axiosInstance
      .post(`/intakes/${intakeId}/proposals/${proposalId}/reject`, { reason })
      .then(unwrap);
  },
};

// ---------------------------------------------------------------------------
// Timeline
// ---------------------------------------------------------------------------

const timeline = {
  get(intakeId: string): Promise<TimelineEvent[]> {
    return axiosInstance.get(`/intakes/${intakeId}/timeline`).then(unwrap);
  },
};

// ---------------------------------------------------------------------------
// Usage
// ---------------------------------------------------------------------------

const usage = {
  getIntake(intakeId: string): Promise<UsageRollup> {
    return axiosInstance.get(`/intakes/${intakeId}/usage`).then(unwrap);
  },

  getReport(start: string, end: string): Promise<UsageRollup> {
    return axiosInstance
      .get('/usage/report', { params: { start, end } })
      .then(unwrap);
  },
};

// ---------------------------------------------------------------------------
// Unified API object
// ---------------------------------------------------------------------------

export const api = {
  auth,
  voiceProfiles,
  intakeTypes,
  templates,
  intakes,
  sections,
  questions,
  answers,
  sessions,
  contributors,
  followUps,
  files,
  urls,
  proposals,
  timeline,
  usage,
} as const;

export { axiosInstance };
export default api;
