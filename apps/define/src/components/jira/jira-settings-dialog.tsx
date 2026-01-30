'use client';

import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Loader2, Settings, CheckCircle2 } from 'lucide-react';

interface JiraSettingsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  productId: string;
  onSaved?: () => void;
}

export function JiraSettingsDialog({
  open,
  onOpenChange,
  productId,
  onSaved,
}: JiraSettingsDialogProps) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [hasExisting, setHasExisting] = useState(false);
  const [form, setForm] = useState({
    jiraHost: '',
    jiraEmail: '',
    jiraApiToken: '',
    defaultProjectKey: '',
  });

  useEffect(() => {
    if (open) {
      fetchSettings();
    }
  }, [open, productId]);

  async function fetchSettings() {
    setLoading(true);
    try {
      const response = await fetch(`/api/jira/settings/${productId}`);
      if (response.ok) {
        const data = await response.json();
        if (data.settings) {
          setHasExisting(true);
          setForm({
            jiraHost: data.settings.jiraHost || '',
            jiraEmail: data.settings.jiraEmail || '',
            jiraApiToken: '', // Don't populate - user must re-enter if changing
            defaultProjectKey: data.settings.defaultProjectKey || '',
          });
        } else {
          setHasExisting(false);
          setForm({
            jiraHost: '',
            jiraEmail: '',
            jiraApiToken: '',
            defaultProjectKey: '',
          });
        }
      }
    } catch (error) {
      console.error('Error fetching Jira settings:', error);
    } finally {
      setLoading(false);
    }
  }

  async function saveSettings(e: React.FormEvent) {
    e.preventDefault();
    if (!form.jiraHost || !form.jiraEmail || !form.defaultProjectKey) {
      return;
    }
    if (!hasExisting && !form.jiraApiToken) {
      return;
    }

    setSaving(true);
    try {
      const response = await fetch(`/api/jira/settings/${productId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });

      if (response.ok) {
        onOpenChange(false);
        onSaved?.();
      }
    } catch (error) {
      console.error('Error saving Jira settings:', error);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Settings className="h-5 w-5" />
            Jira Settings
          </DialogTitle>
          <DialogDescription>
            Configure Jira integration to send stories directly from requirements.
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-primary-600" />
          </div>
        ) : (
          <form onSubmit={saveSettings} className="space-y-4">
            <div>
              <label className="text-sm font-medium text-gray-700 mb-1 block">
                Jira Host
              </label>
              <Input
                placeholder="mycompany.atlassian.net"
                value={form.jiraHost}
                onChange={(e) => setForm({ ...form, jiraHost: e.target.value })}
                required
              />
              <p className="text-xs text-gray-500 mt-1">
                Your Jira Cloud instance hostname (without https://)
              </p>
            </div>

            <div>
              <label className="text-sm font-medium text-gray-700 mb-1 block">
                Email
              </label>
              <Input
                type="email"
                placeholder="you@company.com"
                value={form.jiraEmail}
                onChange={(e) => setForm({ ...form, jiraEmail: e.target.value })}
                required
              />
              <p className="text-xs text-gray-500 mt-1">
                Your Atlassian account email
              </p>
            </div>

            <div>
              <label className="text-sm font-medium text-gray-700 mb-1 block">
                API Token {hasExisting && '(leave blank to keep current)'}
              </label>
              <Input
                type="password"
                placeholder={hasExisting ? '••••••••' : 'Paste your API token'}
                value={form.jiraApiToken}
                onChange={(e) => setForm({ ...form, jiraApiToken: e.target.value })}
                required={!hasExisting}
              />
              <p className="text-xs text-gray-500 mt-1">
                <a
                  href="https://id.atlassian.com/manage-profile/security/api-tokens"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary-600 hover:underline"
                >
                  Create an API token
                </a>{' '}
                in your Atlassian account settings
              </p>
            </div>

            <div>
              <label className="text-sm font-medium text-gray-700 mb-1 block">
                Default Project Key
              </label>
              <Input
                placeholder="PROJ"
                value={form.defaultProjectKey}
                onChange={(e) =>
                  setForm({ ...form, defaultProjectKey: e.target.value.toUpperCase() })
                }
                required
              />
              <p className="text-xs text-gray-500 mt-1">
                The project key where stories will be created (e.g., PROJ, DEV, PROD)
              </p>
            </div>

            {hasExisting && (
              <div className="flex items-center gap-2 text-sm text-green-600 bg-green-50 p-2 rounded">
                <CheckCircle2 className="h-4 w-4" />
                Jira is configured for this product
              </div>
            )}

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={saving}>
                {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Save Settings
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
