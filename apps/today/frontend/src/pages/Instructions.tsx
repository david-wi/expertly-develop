import { useState } from 'react';
import { Card } from '../components/common/Card';
import { Button } from '../components/common/Button';

export function Instructions() {
  const [copied, setCopied] = useState<string | null>(null);
  const apiBaseUrl = window.location.origin;

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopied(id);
    setTimeout(() => setCopied(null), 2000);
  };

  const claudeInstructions = `# Expertly Today Integration

You are connected to Expertly Today, a task management system. Use the following API to interact with it.

## API Base URL
${apiBaseUrl}/api

## Authentication
Include this header with all requests:
X-API-Key: [Your API key from localStorage]

## Core Workflows

### 1. Get Your Next Task
GET /api/tasks/next
Returns the highest priority task assigned to you (claude) with full context.

### 2. Complete a Task
PUT /api/tasks/{id}/complete
Body: { "output": "Summary of what was done" }

### 3. Ask a Question
POST /api/questions
Body: {
  "text": "Your question",
  "context": "Why you're asking",
  "why_asking": "What information you need",
  "what_claude_will_do": "How you'll use the answer",
  "priority": 2
}

### 4. Check for Answers
GET /api/questions?status=answered
Look for answers to questions you previously asked.

### 5. Submit a Draft for Review
POST /api/drafts
Body: {
  "type": "email|slack|document|note",
  "recipient": "recipient@example.com",
  "subject": "Subject line",
  "body": "Draft content"
}

### 6. Look Up Playbooks
GET /api/playbooks
Check for relevant procedures before taking action.

### 7. Look Up People
GET /api/people?search=name
Get context about people mentioned in tasks.

## Key Endpoints
- GET /api/tasks - List all tasks
- GET /api/tasks?status=queued&assignee=claude - Your queue
- GET /api/questions/unanswered - Pending questions
- GET /api/drafts?status=pending - Drafts awaiting review
- GET /api/waiting-items - Items waiting on external parties
- GET /api/playbooks - Procedures and guidelines

## Full API Documentation
${apiBaseUrl}/api/docs`;

  const quickStartInstructions = `## Quick Start for Claude

1. Check your task queue: GET ${apiBaseUrl}/api/tasks?status=queued&assignee=claude
2. Get next priority task: GET ${apiBaseUrl}/api/tasks/next
3. Look up relevant playbooks before acting
4. If you need information, create a question and wait for an answer
5. Submit drafts for review before sending externally
6. Mark tasks complete when done`;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-[var(--theme-text-heading)]">Instructions</h1>
        <p className="text-sm text-gray-500">API documentation and setup instructions for Claude</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* API Documentation */}
        <Card>
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-gray-900">API Documentation</h2>
              <a
                href={`${apiBaseUrl}/api/docs`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm text-blue-600 hover:text-blue-800"
              >
                Open Swagger UI →
              </a>
            </div>

            <div className="bg-gray-50 p-4 rounded-md">
              <p className="text-sm text-gray-600 mb-2">Interactive API documentation (Swagger/OpenAPI):</p>
              <code className="text-sm bg-gray-200 px-2 py-1 rounded">{apiBaseUrl}/api/docs</code>
            </div>

            <div className="bg-gray-50 p-4 rounded-md">
              <p className="text-sm text-gray-600 mb-2">OpenAPI JSON specification:</p>
              <code className="text-sm bg-gray-200 px-2 py-1 rounded">{apiBaseUrl}/api/openapi.json</code>
            </div>
          </div>
        </Card>

        {/* Quick Start */}
        <Card>
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-gray-900">Quick Start</h2>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => copyToClipboard(quickStartInstructions, 'quickstart')}
              >
                {copied === 'quickstart' ? 'Copied!' : 'Copy'}
              </Button>
            </div>
            <div className="bg-gray-900 text-gray-100 p-4 rounded-md text-sm font-mono whitespace-pre-wrap overflow-x-auto max-h-64">
              {quickStartInstructions}
            </div>
          </div>
        </Card>
      </div>

      {/* Full Instructions */}
      <Card>
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-gray-900">Full Claude Instructions</h2>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => copyToClipboard(claudeInstructions, 'full')}
            >
              {copied === 'full' ? 'Copied!' : 'Copy Instructions'}
            </Button>
          </div>
          <p className="text-sm text-gray-500">
            Copy these instructions and paste them into Claude's system prompt or CLAUDE.md file.
          </p>
          <div className="bg-gray-900 text-gray-100 p-4 rounded-md text-sm font-mono whitespace-pre-wrap overflow-x-auto max-h-96">
            {claudeInstructions}
          </div>
        </div>
      </Card>

      {/* API Key Section */}
      <Card>
        <div className="space-y-4">
          <h2 className="text-lg font-semibold text-gray-900">Your API Key</h2>
          <p className="text-sm text-gray-500">
            Use this key in the X-API-Key header for all API requests.
          </p>
          <div className="flex items-center space-x-2">
            <code className="flex-1 text-sm bg-gray-100 px-3 py-2 rounded-md font-mono overflow-x-auto">
              {localStorage.getItem('api_key') || 'Not found - please log in again'}
            </code>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => {
                const key = localStorage.getItem('api_key');
                if (key) copyToClipboard(key, 'apikey');
              }}
            >
              {copied === 'apikey' ? 'Copied!' : 'Copy'}
            </Button>
          </div>
        </div>
      </Card>
    </div>
  );
}
