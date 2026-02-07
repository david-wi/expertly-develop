import { useState, useEffect } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  CheckCircle2,
  Copy,
  Check,
  Phone,
  ExternalLink,
  Loader2,
} from 'lucide-react';
import { api } from '@/api/client';
import type {
  IntakeCreate,
  IntakeResponse,
  IntakeTypeResponse,
  TemplateVersionResponse,
  VoiceProfileResponse,
} from '@/types';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const US_TIMEZONES = [
  { value: 'America/New_York', label: 'Eastern (ET)' },
  { value: 'America/Chicago', label: 'Central (CT)' },
  { value: 'America/Denver', label: 'Mountain (MT)' },
  { value: 'America/Los_Angeles', label: 'Pacific (PT)' },
  { value: 'America/Anchorage', label: 'Alaska (AKT)' },
  { value: 'Pacific/Honolulu', label: 'Hawaii (HT)' },
  { value: 'America/Phoenix', label: 'Arizona (no DST)' },
  { value: 'UTC', label: 'UTC' },
];

const VAPI_PHONE_NUMBER = '(555) 123-4567'; // Placeholder — replace with real VAPI number

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function CreateIntakePage() {
  const navigate = useNavigate();

  // Form state
  const [intakeName, setIntakeName] = useState('');
  const [intakeTypeId, setIntakeTypeId] = useState('');
  const [templateVersionId, setTemplateVersionId] = useState<string | null>(null);
  const [templateOverride, setTemplateOverride] = useState(false);
  const [voiceProfileId, setVoiceProfileId] = useState<string | null>(null);
  const [voiceOverride, setVoiceOverride] = useState(false);
  const [timezone, setTimezone] = useState('America/New_York');

  // Copy state
  const [codeCopied, setCodeCopied] = useState(false);
  const [linkCopied, setLinkCopied] = useState(false);

  // Created intake (shown after success)
  const [createdIntake, setCreatedIntake] = useState<IntakeResponse | null>(null);

  // ---- Reference data queries ----

  const { data: intakeTypes, isLoading: typesLoading } = useQuery<IntakeTypeResponse[]>({
    queryKey: ['intakeTypes'],
    queryFn: async () => {
      const res = await api.get<IntakeTypeResponse[]>('/intakeTypes');
      return res.data;
    },
  });

  const { data: templateVersions } = useQuery<TemplateVersionResponse[]>({
    queryKey: ['templateVersions', intakeTypeId],
    queryFn: async () => {
      const res = await api.get<TemplateVersionResponse[]>('/templateVersions', {
        params: { intakeTypeId },
      });
      return res.data;
    },
    enabled: !!intakeTypeId,
  });

  const { data: voiceProfiles } = useQuery<VoiceProfileResponse[]>({
    queryKey: ['voiceProfiles'],
    queryFn: async () => {
      const res = await api.get<VoiceProfileResponse[]>('/voiceProfiles', {
        params: { isEnabled: true },
      });
      return res.data;
    },
  });

  // Auto-populate defaults when intake type changes
  useEffect(() => {
    if (!intakeTypeId || !intakeTypes) return;
    const selected = intakeTypes.find((t) => t.intakeTypeId === intakeTypeId);
    if (!selected) return;

    if (!templateOverride) {
      setTemplateVersionId(selected.defaultTemplateVersionId);
    }
    if (!voiceOverride) {
      setVoiceProfileId(selected.defaultVoiceProfileId);
    }
  }, [intakeTypeId, intakeTypes, templateOverride, voiceOverride]);

  // ---- Mutation ----

  const createMutation = useMutation({
    mutationFn: async (payload: IntakeCreate) => {
      const res = await api.post<IntakeResponse>('/intakes', payload);
      return res.data;
    },
    onSuccess: (data) => {
      setCreatedIntake(data);
    },
  });

  // ---- Handlers ----

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!intakeName.trim() || !intakeTypeId) return;

    const payload: IntakeCreate = {
      intakeName: intakeName.trim(),
      intakeTypeId,
      timezone,
    };
    if (templateOverride && templateVersionId) {
      payload.templateVersionId = templateVersionId;
    }
    if (voiceOverride && voiceProfileId) {
      payload.voiceProfileIdOverride = voiceProfileId;
    }

    createMutation.mutate(payload);
  }

  async function copyToClipboard(text: string, setter: (v: boolean) => void) {
    try {
      await navigator.clipboard.writeText(text);
      setter(true);
      setTimeout(() => setter(false), 2000);
    } catch {
      // Fallback — noop
    }
  }

  // ---------------------------------------------------------------------------
  // Success view
  // ---------------------------------------------------------------------------

  if (createdIntake) {
    return (
      <div className="mx-auto max-w-lg px-4 py-16 sm:px-6">
        <div className="rounded-2xl border border-gray-200 bg-white p-8 text-center shadow-sm">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-green-100">
            <CheckCircle2 className="h-8 w-8 text-green-600" />
          </div>

          <h2 className="mt-4 text-xl font-bold text-gray-900">Intake Created</h2>
          <p className="mt-1 text-sm text-gray-500">{createdIntake.intakeName}</p>

          {/* Intake code */}
          {createdIntake.intakeCode && (
            <div className="mt-8">
              <p className="text-xs font-medium uppercase tracking-wider text-gray-500">
                Intake Code
              </p>
              <div className="mt-2 flex items-center justify-center gap-2">
                <span className="rounded-lg bg-gray-900 px-6 py-3 font-mono text-2xl font-bold tracking-widest text-white">
                  {createdIntake.intakeCode}
                </span>
                <button
                  onClick={() => copyToClipboard(createdIntake.intakeCode!, setCodeCopied)}
                  className="rounded-lg border border-gray-300 p-2 text-gray-500 hover:bg-gray-50 hover:text-gray-700 transition"
                  title="Copy code"
                >
                  {codeCopied ? (
                    <Check className="h-5 w-5 text-green-600" />
                  ) : (
                    <Copy className="h-5 w-5" />
                  )}
                </button>
              </div>
            </div>
          )}

          {/* Call instructions */}
          <div className="mt-6 rounded-lg border border-blue-100 bg-blue-50 p-4 text-left">
            <div className="flex items-start gap-3">
              <Phone className="mt-0.5 h-5 w-5 flex-shrink-0 text-blue-600" />
              <div>
                <p className="text-sm font-medium text-blue-900">
                  Call to begin the intake
                </p>
                <p className="mt-1 text-sm text-blue-700">
                  Dial{' '}
                  <span className="font-semibold">{VAPI_PHONE_NUMBER}</span>{' '}
                  and enter code{' '}
                  <span className="font-mono font-semibold">
                    {createdIntake.intakeCode}
                  </span>{' '}
                  when prompted.
                </p>
              </div>
            </div>
          </div>

          {/* Portal link */}
          {createdIntake.intakePortalUrl && (
            <div className="mt-4">
              <p className="text-xs font-medium uppercase tracking-wider text-gray-500">
                Portal Link
              </p>
              <div className="mt-2 flex items-center justify-center gap-2">
                <a
                  href={createdIntake.intakePortalUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-sm font-medium text-blue-600 hover:text-blue-700"
                >
                  {createdIntake.intakePortalUrl}
                  <ExternalLink className="h-3.5 w-3.5" />
                </a>
                <button
                  onClick={() =>
                    copyToClipboard(createdIntake.intakePortalUrl!, setLinkCopied)
                  }
                  className="rounded border border-gray-300 p-1 text-gray-400 hover:bg-gray-50 hover:text-gray-600 transition"
                  title="Copy portal link"
                >
                  {linkCopied ? (
                    <Check className="h-4 w-4 text-green-600" />
                  ) : (
                    <Copy className="h-4 w-4" />
                  )}
                </button>
              </div>
            </div>
          )}

          {/* Go to Dashboard */}
          <button
            onClick={() => navigate(`/intakes/${createdIntake.intakeId}`)}
            className="mt-8 inline-flex w-full items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-medium text-white shadow-sm hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition"
          >
            Go to Dashboard
          </button>
        </div>
      </div>
    );
  }

  // ---------------------------------------------------------------------------
  // Form view
  // ---------------------------------------------------------------------------

  return (
    <div className="mx-auto max-w-2xl px-4 py-8 sm:px-6 lg:px-8">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button
          onClick={() => navigate('/intakes')}
          className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600 transition"
        >
          <ArrowLeft className="h-5 w-5" />
        </button>
        <h1 className="text-2xl font-bold text-gray-900">Create New Intake</h1>
      </div>

      <form onSubmit={handleSubmit} className="mt-8 space-y-6">
        <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm space-y-5">
          {/* Intake name */}
          <div>
            <label htmlFor="intakeName" className="block text-sm font-medium text-gray-700">
              Intake Name <span className="text-red-500">*</span>
            </label>
            <input
              id="intakeName"
              type="text"
              required
              maxLength={400}
              value={intakeName}
              onChange={(e) => setIntakeName(e.target.value)}
              placeholder="e.g., Smith Auto Claim - Feb 2026"
              className="mt-1 block w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 placeholder:text-gray-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>

          {/* Intake Type */}
          <div>
            <label htmlFor="intakeType" className="block text-sm font-medium text-gray-700">
              Intake Type <span className="text-red-500">*</span>
            </label>
            <select
              id="intakeType"
              required
              value={intakeTypeId}
              onChange={(e) => {
                setIntakeTypeId(e.target.value);
                setTemplateOverride(false);
                setVoiceOverride(false);
              }}
              className="mt-1 block w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            >
              <option value="">Select an intake type...</option>
              {typesLoading ? (
                <option disabled>Loading...</option>
              ) : (
                intakeTypes?.map((t) => (
                  <option key={t.intakeTypeId} value={t.intakeTypeId}>
                    {t.intakeTypeName}
                  </option>
                ))
              )}
            </select>
          </div>

          {/* Template Version */}
          {intakeTypeId && (
            <div>
              <div className="flex items-center justify-between">
                <label
                  htmlFor="templateVersion"
                  className="block text-sm font-medium text-gray-700"
                >
                  Template Version
                </label>
                <button
                  type="button"
                  onClick={() => setTemplateOverride(!templateOverride)}
                  className="text-xs text-blue-600 hover:text-blue-700"
                >
                  {templateOverride ? 'Use default' : 'Override'}
                </button>
              </div>
              {templateOverride ? (
                <select
                  id="templateVersion"
                  value={templateVersionId ?? ''}
                  onChange={(e) => setTemplateVersionId(e.target.value || null)}
                  className="mt-1 block w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                >
                  <option value="">Select a version...</option>
                  {templateVersions?.map((v) => (
                    <option key={v.templateVersionId} value={v.templateVersionId}>
                      {v.templateName} - {v.versionLabel}
                    </option>
                  ))}
                </select>
              ) : (
                <p className="mt-1 text-sm text-gray-500">
                  Using intake type default
                  {templateVersionId && templateVersions
                    ? ` (${templateVersions.find((v) => v.templateVersionId === templateVersionId)?.versionLabel ?? templateVersionId})`
                    : ''}
                </p>
              )}
            </div>
          )}

          {/* Voice Profile */}
          {intakeTypeId && (
            <div>
              <div className="flex items-center justify-between">
                <label
                  htmlFor="voiceProfile"
                  className="block text-sm font-medium text-gray-700"
                >
                  Voice Profile
                </label>
                <button
                  type="button"
                  onClick={() => setVoiceOverride(!voiceOverride)}
                  className="text-xs text-blue-600 hover:text-blue-700"
                >
                  {voiceOverride ? 'Use default' : 'Override'}
                </button>
              </div>
              {voiceOverride ? (
                <select
                  id="voiceProfile"
                  value={voiceProfileId ?? ''}
                  onChange={(e) => setVoiceProfileId(e.target.value || null)}
                  className="mt-1 block w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                >
                  <option value="">Select a voice profile...</option>
                  {voiceProfiles?.map((vp) => (
                    <option key={vp.voiceProfileId} value={vp.voiceProfileId}>
                      {vp.voiceProfileName}
                    </option>
                  ))}
                </select>
              ) : (
                <p className="mt-1 text-sm text-gray-500">
                  Using intake type default
                  {voiceProfileId && voiceProfiles
                    ? ` (${voiceProfiles.find((vp) => vp.voiceProfileId === voiceProfileId)?.voiceProfileName ?? voiceProfileId})`
                    : ''}
                </p>
              )}
            </div>
          )}

          {/* Timezone */}
          <div>
            <label htmlFor="timezone" className="block text-sm font-medium text-gray-700">
              Timezone
            </label>
            <select
              id="timezone"
              value={timezone}
              onChange={(e) => setTimezone(e.target.value)}
              className="mt-1 block w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            >
              {US_TIMEZONES.map((tz) => (
                <option key={tz.value} value={tz.value}>
                  {tz.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Error */}
        {createMutation.isError && (
          <div className="rounded-lg border border-red-200 bg-red-50 p-4">
            <p className="text-sm text-red-700">
              {createMutation.error instanceof Error
                ? createMutation.error.message
                : 'Failed to create intake. Please try again.'}
            </p>
          </div>
        )}

        {/* Submit */}
        <div className="flex items-center justify-end gap-3">
          <button
            type="button"
            onClick={() => navigate('/intakes')}
            className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 transition"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={createMutation.isPending || !intakeName.trim() || !intakeTypeId}
            className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition"
          >
            {createMutation.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
            Create Intake
          </button>
        </div>
      </form>
    </div>
  );
}
