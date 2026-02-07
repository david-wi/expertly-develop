// ---------------------------------------------------------------------------
// Enums
// ---------------------------------------------------------------------------

export type QuestionStatus =
  | 'unanswered'
  | 'answered'
  | 'skipped'
  | 'later'
  | 'notApplicable';

export type QuestionInstanceStatus =
  | 'unanswered'
  | 'answered'
  | 'skipped'
  | 'later'
  | 'notApplicable';

export type AnswerType =
  | 'shortText'
  | 'longText'
  | 'yesNo'
  | 'list'
  | 'number'
  | 'date'
  | 'url'
  | 'uploadRequested';

export type UserRole =
  | 'admin'
  | 'editor'
  | 'viewer'
  | 'external_contributor';

export type IntakeStatus =
  | 'draft'
  | 'inProgress'
  | 'underReview'
  | 'completed'
  | 'cancelled';

export type SectionInstanceStatus =
  | 'notStarted'
  | 'inProgress'
  | 'complete'
  | 'notApplicable';

export type SessionType = 'phoneCall' | 'fileUpload' | 'urlRefresh';

export type SessionStatus = 'active' | 'completed' | 'failed' | 'cancelled';

export type EvidenceType =
  | 'transcriptExcerpt'
  | 'documentExcerpt'
  | 'urlContent'
  | 'image'
  | 'other';

export type RevisionType =
  | 'proposedFromCall'
  | 'proposedFromUpload'
  | 'proposedFromUrlRefresh'
  | 'confirmed'
  | 'manualEdit';

export type FollowUpStatus =
  | 'scheduled'
  | 'inProgress'
  | 'completed'
  | 'cancelled'
  | 'missed';

export type FollowUpContactMethod = 'phone' | 'email' | 'sms';

export type ContactMethod = 'phone' | 'email' | 'sms';

export type AssignmentPolicy =
  | 'askOnlyIfMissing'
  | 'askToConfirm'
  | 'askAnyway';

// ---------------------------------------------------------------------------
// Auth / Account
// ---------------------------------------------------------------------------

export interface User {
  userId: string;
  accountId: string;
  email: string | null;
  name: string;
  role: string;
}

export interface Account {
  accountId: string;
  accountName: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

// ---------------------------------------------------------------------------
// Voice Profile
// ---------------------------------------------------------------------------

export interface VoiceProfile {
  voiceProfileId: string;
  accountId: string;
  voiceProfileName: string;
  vapiVoiceId: string;
  notes?: string | null;
  isEnabled: boolean;
  createdAt: string;
  updatedAt: string;
}

// ---------------------------------------------------------------------------
// Intake Type
// ---------------------------------------------------------------------------

export interface IntakeType {
  intakeTypeId: string;
  accountId: string;
  intakeTypeName: string;
  description?: string | null;
  defaultTemplateVersionId?: string | null;
  defaultVoiceProfileId?: string | null;
  defaultsRecordingEnabled: boolean;
  defaultsTranscriptionEnabled: boolean;
  defaultsContinueRecordingAfterTransfer: boolean;
  createdAt: string;
  updatedAt: string;
}

// ---------------------------------------------------------------------------
// Templates
// ---------------------------------------------------------------------------

export interface TemplateQuestion {
  templateQuestionId: string;
  templateSectionId: string;
  questionKey: string;
  questionText: string;
  questionHelpText?: string | null;
  questionOrder: number;
  isRequired: boolean;
  answerType: AnswerType;
  applicabilityRuleText?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface TemplateSection {
  templateSectionId: string;
  templateVersionId: string;
  sectionName: string;
  sectionOrder: number;
  isRepeatable: boolean;
  repeatKeyName?: string | null;
  applicabilityRuleText?: string | null;
  questions?: TemplateQuestion[] | null;
  createdAt: string;
  updatedAt: string;
}

export interface TemplateVersion {
  templateVersionId: string;
  accountId: string;
  templateName: string;
  versionLabel: string;
  intakeTypeId: string;
  isPublished: boolean;
  sections?: TemplateSection[] | null;
  createdAt: string;
  updatedAt: string;
}

// ---------------------------------------------------------------------------
// Intake
// ---------------------------------------------------------------------------

export interface IntakeProgressSummary {
  totalQuestions: number;
  answered: number;
  skipped: number;
  later: number;
  notApplicable: number;
  unanswered: number;
  percentComplete: number;
}

export interface Intake {
  intakeId: string;
  accountId: string;
  intakeName: string;
  intakeTypeId: string;
  templateVersionId: string;
  intakeStatus: IntakeStatus;
  timezone: string;
  voiceProfileIdOverride?: string | null;
  intakeCode?: string | null;
  intakePortalUrl?: string | null;
  progress?: IntakeProgressSummary | null;
  createdAt: string;
  updatedAt: string;
}

export interface IntakeCreate {
  intakeName: string;
  intakeTypeId: string;
  templateVersionId?: string | null;
  timezone: string;
  voiceProfileIdOverride?: string | null;
}

export interface IntakeUpdate {
  intakeName?: string;
  intakeStatus?: IntakeStatus;
  voiceProfileIdOverride?: string | null;
}

// ---------------------------------------------------------------------------
// Section & Question Instances
// ---------------------------------------------------------------------------

export interface IntakeSectionInstance {
  intakeSectionInstanceId: string;
  intakeId: string;
  templateSectionId: string;
  sectionName: string;
  status: SectionInstanceStatus;
  totalQuestions: number;
  answeredQuestions: number;
  percentComplete: number;
  markedCompleteAt?: string | null;
  repeatIndex: number;
  instanceLabel?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface IntakeQuestionInstance {
  intakeQuestionInstanceId: string;
  intakeSectionInstanceId: string;
  templateQuestionId: string;
  questionText: string;
  questionKey: string;
  answerType: AnswerType;
  isRequired: boolean;
  status: QuestionStatus;
  currentAnswer?: string | null;
  currentAnswerRevisionId?: string | null;
  lastAnsweredAt?: string | null;
  createdAt: string;
  updatedAt: string;
}

// ---------------------------------------------------------------------------
// Answers
// ---------------------------------------------------------------------------

export interface AnswerRevision {
  answerRevisionId: string;
  intakeQuestionInstanceId: string;
  revisionType: RevisionType;
  answerText?: string | null;
  answerStructuredData?: Record<string, unknown> | null;
  confidenceScore?: number | null;
  sourceSessionId?: string | null;
  sourceEvidenceItemId?: string | null;
  isCurrent: boolean;
  createdAt: string;
  createdBy?: string | null;
}

export interface CurrentAnswer {
  answerRevisionId: string;
  answerText?: string | null;
  answerStructuredData?: Record<string, unknown> | null;
  chosenAt: string;
  chosenBy?: string | null;
}

// ---------------------------------------------------------------------------
// Sessions & Transcripts
// ---------------------------------------------------------------------------

export interface TranscriptSegment {
  startMs: number;
  endMs: number;
  speakerLabel: string;
  text: string;
}

export interface Transcript {
  transcriptId: string;
  sessionId: string;
  transcriptText: string;
  segments?: TranscriptSegment[] | null;
  createdAt: string;
}

export interface Session {
  sessionId: string;
  intakeId: string;
  accountId: string;
  sessionType: string;
  status: SessionStatus;
  contributorId?: string | null;
  externalProviderId?: string | null;
  startedAt: string;
  endedAt?: string | null;
  durationSeconds?: number | null;
  metadata?: Record<string, unknown> | null;
  notes?: string | null;
  createdAt: string;
  updatedAt?: string;
}

// ---------------------------------------------------------------------------
// Evidence
// ---------------------------------------------------------------------------

export interface EvidenceItem {
  evidenceItemId: string;
  intakeId: string;
  sessionId: string;
  evidenceType: EvidenceType;
  excerptText?: string | null;
  startMs?: number | null;
  endMs?: number | null;
  fileAssetId?: string | null;
  urlSnapshotId?: string | null;
  createdAt: string;
  updatedAt: string;
}

// ---------------------------------------------------------------------------
// Contributors & Assignments
// ---------------------------------------------------------------------------

export interface Contributor {
  contributorId: string;
  intakeId: string;
  name: string;
  email?: string | null;
  phone?: string | null;
  role?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface Assignment {
  assignmentId: string;
  contributorId: string;
  intakeSectionInstanceId: string;
  assignedAt: string;
  assignedBy?: string | null;
}

// ---------------------------------------------------------------------------
// Follow-up Plans
// ---------------------------------------------------------------------------

export interface FollowUpPlan {
  followUpId: string;
  intakeId: string;
  description: string;
  dueDate?: string | null;
  assignedTo?: string | null;
  isDone: boolean;
  doneAt?: string | null;
  createdAt: string;
  updatedAt: string;
}

// ---------------------------------------------------------------------------
// File Assets
// ---------------------------------------------------------------------------

export interface FileAsset {
  fileAssetId: string;
  intakeId: string;
  fileName: string;
  mimeType: string;
  fileSizeBytes: number;
  storageKey: string;
  processingStatus: string;
  processedAt?: string | null;
  createdAt: string;
  updatedAt: string;
}

// ---------------------------------------------------------------------------
// URL Sources & Snapshots
// ---------------------------------------------------------------------------

export interface UrlSnapshot {
  urlSnapshotId: string;
  urlSourceId: string;
  fetchedAt: string;
  contentHash?: string | null;
  extractedText?: string | null;
  createdAt: string;
}

export interface UrlSource {
  urlSourceId: string;
  intakeId: string;
  url: string;
  label?: string | null;
  lastFetchedAt?: string | null;
  createdAt: string;
  updatedAt: string;
}

// ---------------------------------------------------------------------------
// Proposals
// ---------------------------------------------------------------------------

export interface Proposal {
  proposalId: string;
  intakeId: string;
  intakeQuestionInstanceId: string;
  proposedAnswer: string;
  source: string;
  confidenceScore?: number | null;
  status: 'pending' | 'accepted' | 'rejected';
  rejectionReason?: string | null;
  resolvedAt?: string | null;
  resolvedBy?: string | null;
  createdAt: string;
}

// ---------------------------------------------------------------------------
// Timeline
// ---------------------------------------------------------------------------

export interface TimelineEvent {
  timelineEventId: string;
  intakeId: string;
  eventType: string;
  eventDescription: string;
  actorId?: string | null;
  actorName?: string | null;
  metadata?: Record<string, unknown> | null;
  occurredAt: string;
}

// ---------------------------------------------------------------------------
// Usage
// ---------------------------------------------------------------------------

export interface UsageRollup {
  totalSessions: number;
  totalCallMinutes: number;
  totalFilesProcessed: number;
  totalUrlsRefreshed: number;
  totalProposals: number;
  totalAnswersConfirmed: number;
  periodStart: string;
  periodEnd: string;
}

// ---------------------------------------------------------------------------
// Response type aliases (for pages that use *Response naming)
// ---------------------------------------------------------------------------

export type IntakeResponse = Intake;
export type IntakeTypeResponse = IntakeType;
export type TemplateVersionResponse = TemplateVersion;
export type TemplateSectionResponse = TemplateSection;
export type TemplateQuestionResponse = TemplateQuestion;
export type VoiceProfileResponse = VoiceProfile;
export type IntakeSectionInstanceResponse = IntakeSectionInstance;
export type IntakeQuestionInstanceResponse = IntakeQuestionInstance;
export type AnswerRevisionResponse = AnswerRevision;
export type EvidenceResponse = EvidenceItem;

// ContributorResponse has a different shape from the *Response variants in the
// original types.ts (uses different field names). Export as its own interface
// so pages using it get the shape they expect.
export interface ContributorResponse {
  intakeContributorId: string;
  intakeId: string;
  displayName: string;
  email: string | null;
  phone: string | null;
  preferredContactMethod: ContactMethod | null;
  isPrimaryPointPerson: boolean;
  pin: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface AssignmentResponse {
  assignmentId: string;
  intakeContributorId: string;
  intakeSectionInstanceId: string;
  assignmentPolicy: AssignmentPolicy;
  createdAt: string;
  updatedAt: string;
}

export type SessionResponse = Session;

export interface FollowUpResponse {
  followUpId: string;
  intakeId: string;
  accountId: string;
  createdFromSessionId: string | null;
  status: FollowUpStatus;
  nextContactAt: string;
  nextContactWindowText: string | null;
  contactMethod: FollowUpContactMethod;
  contactPersonId: string | null;
  focusSectionInstanceIds: string[] | null;
  completedSessionId: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface TranscriptResponse {
  transcriptId: string;
  sessionId: string;
  fullText: string;
  language: string;
  durationSeconds: number | null;
  segments: TranscriptSegment[];
  createdAt: string;
}

// ---------------------------------------------------------------------------
// Section Narrative Summary (returned from API)
// ---------------------------------------------------------------------------

export interface SectionNarrativeSummary {
  sectionInstanceId: string;
  narrativeText: string;
  generatedAt: string;
}

// ---------------------------------------------------------------------------
// Intake Dashboard Summary (convenience aggregation)
// ---------------------------------------------------------------------------

export interface IntakeDashboardSummary {
  intake: IntakeResponse;
  intakeTypeName: string;
  sections: IntakeSectionInstanceResponse[];
  contributors: ContributorResponse[];
  assignments: AssignmentResponse[];
  followUps: FollowUpResponse[];
  sessions: SessionResponse[];
  totalMinutesUsed: number;
  openIssuesCount: number;
}

// ---------------------------------------------------------------------------
// Paginated Response
// ---------------------------------------------------------------------------

export interface PaginatedResponse<T> {
  items: T[];
  nextCursor: string | null;
  totalCount: number | null;
}

// ---------------------------------------------------------------------------
// API Envelope
// ---------------------------------------------------------------------------

export interface ResponseEnvelope<T> {
  success: boolean;
  data: T | null;
  message: string | null;
  errors: Array<{ field?: string; code: string; message: string }> | null;
}
