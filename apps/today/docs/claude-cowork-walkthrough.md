# Claude Cowork Walkthrough

> A mental simulation of how Claude Cowork would interact with the Expertly Today platform, invoking APIs and following the workflow.

---

## Overview

This document walks through a typical work session with Claude Cowork, showing:
1. How Claude bootstraps and loads context
2. How tasks flow through the system
3. What APIs are called and when
4. What happens at each step

---

## Session Bootstrap

### Step 1: Claude Loads Context

When a session starts, Claude would:

```
GET /api/tasks/next?assignee=claude
```

**Response:**
```json
{
  "task": {
    "id": "8bc565e3-2f72-4061-94e0-57237d018582",
    "title": "Submit proof of registration to dismiss ticket",
    "description": "Need to submit proof of registration to dismiss the ticket",
    "priority": 1,
    "status": "queued",
    "assignee": "claude",
    "context": {}
  },
  "matched_playbooks": [],
  "blocking_questions": []
}
```

### Step 2: Check for Playbook Matches

Before starting work, Claude checks for relevant playbooks:

```
GET /api/playbooks/match?task=Submit proof of registration to dismiss ticket
```

**Response:**
```json
{
  "matched": [],
  "must_consult": []
}
```

No playbooks match this task, so Claude proceeds without special instructions.

---

## Task Execution Flow

### Step 3: Start the Task

```
POST /api/tasks/{task_id}/start
```

**Response:**
```json
{
  "id": "8bc565e3-2f72-4061-94e0-57237d018582",
  "status": "working",
  "started_at": "2026-01-23T10:30:00Z"
}
```

The task is now marked as "working". The dashboard would show "Claude is working on: Submit proof of registration..."

### Step 4: Claude Encounters a Blocker

Claude discovers it needs information from David to proceed. It creates a blocking question:

```
POST /api/questions
{
  "task_id": "8bc565e3-2f72-4061-94e0-57237d018582",
  "question": "Where can I find the proof of registration document? Is it in your files or do you need to obtain it from somewhere?",
  "urgency": "blocking",
  "context": {
    "what_i_tried": "Searched email and Google Drive for 'registration' documents",
    "why_i_need_this": "Cannot proceed without the document to submit"
  }
}
```

**Response:**
```json
{
  "id": "q-123",
  "status": "unanswered",
  "task_id": "8bc565e3-2f72-4061-94e0-57237d018582"
}
```

### Step 5: Block the Task

```
POST /api/tasks/{task_id}/block
{
  "question_id": "q-123",
  "reason": "Waiting for document location from David"
}
```

The task is now "blocked" and appears in the Questions section for David.

### Step 6: Move to Next Task

Claude continues working on other tasks:

```
GET /api/tasks/next?assignee=claude
```

Returns the next highest-priority unblocked task.

---

## Playbook-Guided Task Flow

### Scenario: Email Drafting

When Claude gets a task like "Email Jaideep about Baha Mar presentation":

```
GET /api/playbooks/match?task=Email Jaideep about Baha Mar presentation
```

**Response:**
```json
{
  "matched": [
    {
      "id": "email-drafting-guide",
      "name": "Email Drafting Guide",
      "must_consult": true,
      "match_reason": "trigger: 'email'",
      "relevance_score": 1.0,
      "content_preview": "# Email Drafting Guide\n\nHow to draft emails for David's review..."
    }
  ],
  "must_consult": ["email-drafting-guide"]
}
```

**Claude sees `must_consult: true`** — this means Claude MUST read the full playbook before proceeding.

### Step: Read Full Playbook

```
GET /api/playbooks/{playbook_id}
```

Claude reads:
- Must read `david-writing-style.md` first
- Tone: warm but strategic
- Never send directly, always draft for approval

### Step: Look Up the Person

```
GET /api/people?search=Jaideep
```

**Response:**
```json
{
  "results": [
    {
      "id": "person-456",
      "name": "Jaideep Abraham",
      "email": "jaideep@...",
      "relationship_notes": "VP at Baha Mar. Interested in AI solutions. Has budget authority.",
      "communication_history": "Last contact: 2026-01-15, discussed presentation"
    }
  ]
}
```

### Step: Create Draft

```
POST /api/drafts
{
  "type": "email",
  "recipient": "Jaideep Abraham",
  "subject": "Baha Mar - Expertly AI Presentation",
  "body": "Hi Jaideep,\n\nHere's the presentation:\n[Link]\n\nHappy to walk you through it. Are you free this week?\n\nBest,\nDavid",
  "task_id": "task-789",
  "relationship_context": {
    "person_id": "person-456",
    "last_contact": "2026-01-15"
  }
}
```

**Response:**
```json
{
  "id": "draft-101",
  "status": "pending",
  "created_at": "2026-01-23T11:00:00Z"
}
```

The draft now appears in David's "Drafts to Review" panel.

---

## Knowledge Capture Flow

### After Completing a Task

Claude follows the mandatory Learning Loop. After every task:

```
POST /api/knowledge/capture
{
  "content": "Jaideep prefers short emails with bullet points rather than long paragraphs",
  "category": "person",
  "source_task_id": "task-789",
  "trigger_phrase": "for future reference"
}
```

**Response:**
```json
{
  "knowledge": {
    "id": "k-202",
    "category": "person",
    "status": "routed",
    "routed_to_type": "person",
    "routed_to_id": "person-456"
  },
  "routed_to": {
    "type": "person",
    "id": "person-456",
    "field_updated": "context_notes",
    "action_taken": "Added to Jaideep Abraham's context notes"
  }
}
```

The learning is automatically routed to Jaideep's profile.

---

## Question-Answer Flow

### David Answers a Question

When David views the Questions page and answers:

```
POST /api/questions/{question_id}/answer
{
  "answer": "The registration document is in the glove compartment of the car. Take a photo and submit it to the court website.",
  "unblocks_task": true
}
```

**This triggers:**
1. Question marked as "answered"
2. Linked task unblocked automatically
3. Task moves back to "queued" state

### Claude Gets Notified

On next poll:

```
GET /api/tasks/next?assignee=claude
```

The previously blocked task is now returned as the next priority.

---

## Draft Review Flow

### David Reviews a Draft

David sees the draft in the dashboard and clicks "Review":

**To Approve:**
```
POST /api/drafts/{draft_id}/approve
{
  "feedback": "Looks good, send it"
}
```

**To Reject:**
```
POST /api/drafts/{draft_id}/reject
{
  "feedback": "Make it shorter, remove the last paragraph"
}
```

### On Rejection

Claude would:
1. See the rejected draft
2. Create a revision:

```
POST /api/drafts
{
  "type": "email",
  "recipient": "Jaideep Abraham",
  "subject": "Baha Mar - Expertly AI Presentation",
  "body": "[Shortened version]",
  "revision_of_id": "draft-101"
}
```

---

## Waiting Items Flow

### Claude Creates a Waiting Item

When something is sent and Claude needs to track the response:

```
POST /api/waiting-items
{
  "description": "Response from Jaideep about Baha Mar meeting",
  "waiting_for": "Jaideep Abraham",
  "expected_by": "2026-01-26",
  "source_type": "email",
  "source_reference": "draft-101",
  "follow_up_action": "Send gentle reminder if no response by Friday"
}
```

### Daily Check

Claude checks overdue items:

```
GET /api/waiting-items/overdue
```

Returns items past their expected date for follow-up.

---

## Task Completion

### Completing a Task

```
POST /api/tasks/{task_id}/complete
{
  "output": {
    "summary": "Sent presentation email to Jaideep, awaiting response",
    "artifacts": ["draft-101"],
    "next_steps": "Follow up if no response by Friday"
  }
}
```

**Response:**
```json
{
  "id": "task-789",
  "status": "completed",
  "completed_at": "2026-01-23T11:30:00Z"
}
```

---

## API Summary

| Endpoint | Purpose | When Called |
|----------|---------|-------------|
| `GET /api/tasks/next` | Get next task to work on | Session start, after completing a task |
| `GET /api/playbooks/match` | Find relevant playbooks | Before starting any task |
| `POST /api/tasks/{id}/start` | Mark task as working | When beginning work |
| `POST /api/tasks/{id}/block` | Block task with question | When stuck |
| `POST /api/tasks/{id}/complete` | Mark task done | When finished |
| `POST /api/questions` | Ask David a question | When clarification needed |
| `POST /api/drafts` | Create content for review | Before sending emails/messages |
| `POST /api/knowledge/capture` | Capture learnings | After every task (mandatory) |
| `GET /api/people` | Look up person context | Before communicating |
| `POST /api/waiting-items` | Track pending responses | After sending outreach |

---

## Issues Identified (Post-Simulation Verification)

### Issue 1: ✅ RESOLVED - Task Claim Mechanism

**Status:** Implemented and working.

**Endpoint:** `POST /api/tasks/claim?worker_id=claude-worker-1`

Atomically claims and starts the next available task for a worker.

---

### Issue 2: ✅ RESOLVED - Knowledge Capture Enforcement

**Status:** Implemented (awaiting deployment).

`TaskComplete` schema now requires `learnings_captured: bool` field:
```python
learnings_captured: bool = Field(
    ...,  # Required
    description="Must explicitly acknowledge whether learnings were captured"
)
learnings_summary: Optional[str] = Field(
    None,
    description="Brief summary of what was learned (required if learnings_captured=true)"
)
```

---

### Issue 3: OPEN - Missing Relationship Context in Task Response

**Problem:** When getting a task, Claude doesn't automatically get related people/clients.

**Proposed Fix:** Expand `/api/tasks/{id}` response to include:
```json
{
  "task": {...},
  "related_people": [...],
  "related_clients": [...],
  "similar_past_tasks": [...]
}
```

---

### Issue 4: ✅ RESOLVED - Playbook Matching in Next Response

**Status:** Already implemented.

`GET /api/tasks/next` returns:
```json
{
  "task": {...},
  "matched_playbooks": [...],
  "must_consult_warnings": [...]
}
```

---

## Field Name Reference (Important!)

The actual API uses different field names than some documentation:

| Component | Doc Field | Actual Field |
|-----------|-----------|--------------|
| Waiting Items | `description` | `what` |
| Waiting Items | `waiting_for` | `who` |
| Waiting Items | `expected_by` | `follow_up_date` |
| Drafts | `draft_type` | `type` |
| Questions | POST `/answer` | PUT `/answer` |
| Knowledge | `category: "preference"` | Must be: playbook, person, client, project, setting, rule |

---

## Recommended Improvements

1. ~~**Add `/api/tasks/claim`**~~ - ✅ Done
2. ~~**Require learnings in task completion**~~ - ✅ Done (needs deploy)
3. **Expand task context** - Include people, clients, history in task response
4. ~~**Auto-match playbooks**~~ - ✅ Already exists
5. **Add draft revision tracking** - Link revisions to original drafts
6. **Add task templates** - For recurring task patterns

---

## Claude Cowork Instructions Reference

The system expects Claude to follow these instructions (from CLAUDE.md):

1. **Bootstrap Process:**
   - Load context from dashboard
   - Check for priority items (questions, drafts, waiting items)
   - Start on highest-priority task

2. **Task Execution:**
   - Always check playbooks before starting
   - If blocked, create question and move on
   - Never wait idle — continue to next task

3. **Knowledge Capture:**
   - After EVERY task, capture learnings
   - Ask: Did David teach me something? Did I discover something?

4. **Draft Protocol:**
   - NEVER send directly
   - Always create draft for review
   - Include relationship context

5. **Continuous Work:**
   - When task completes, immediately get next task
   - Only stop when explicitly told or all tasks blocked

---

## Simulation Verification Results (2026-01-23)

Manual verification of all API endpoints:

| Step | Endpoint | Result |
|------|----------|--------|
| 1 | `GET /api/tasks/next?assignee=claude` | ✅ Returns task + matched_playbooks |
| 2 | `GET /api/playbooks/{id}` | ✅ Returns full playbook content |
| 3 | `POST /api/tasks/{id}/start` | ✅ Sets status=working, started_at |
| 4 | `POST /api/tasks/{id}/block` | ✅ Creates question, links to task |
| 5 | `GET /api/tasks/next` | ✅ Skips blocked tasks |
| 6 | `PUT /api/questions/{id}/answer` | ✅ Answers question, unblocks task |
| 7 | `GET /api/tasks/{id}` | ✅ Shows unblocked task (queued) |
| 8 | `POST /api/tasks/{id}/complete` | ✅ Marks completed |
| 9 | `POST /api/knowledge/capture` | ✅ Captures learning |
| 10 | `POST /api/drafts` | ✅ Creates pending draft |
| 11 | `POST /api/drafts/{id}/approve` | ✅ Approves draft |
| 12 | `POST /api/waiting-items` | ✅ Creates waiting item |
| 13 | `POST /api/tasks/claim?worker_id=X` | ✅ Atomic claim works |

All core APIs functional and tested
