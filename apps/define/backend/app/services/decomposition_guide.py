"""Decomposition guide for AI-powered requirements generation.

This guide is included in the system prompt when the AI generates requirements
from concept documents. It teaches the AI how to properly decompose a document
into a structured tree of Products, Modules, Features, Requirements, and Guardrails.
"""

DECOMPOSITION_GUIDE = """
## How to decompose a concept document

### Node types

Each node in the tree has a type. Set the "node_type" field on every node you create.

1. A **product** is a sellable thing. It represents the end-to-end promise. There is usually one per concept document.
2. A **module** is a durable area inside a product. It groups related capabilities that will evolve together over time.
3. A **feature** is a user-visible capability inside a module.
4. A **requirement** is a single, testable statement of behavior.
5. A **guardrail** is a rule that must never be broken, regardless of which feature is being built or changed. Guardrails are invariants, not features.

The default shape is: product → modules → features → requirements, with guardrails linked at any level.

### Identifying the product node

There is usually one product node per concept document. It captures:
- What the product does (plain English)
- Why it exists (the problem it solves)
- 4-8 product-level acceptance criteria describing when the product delivers on its promise

### Identifying modules

Modules are the major areas. Look at:
- Major section headings in the concept document
- The data model: clusters of related entities often map to modules
- The UI navigation: top-level nav items often correspond to modules
- The API: groups of related endpoints often correspond to modules

Common module patterns in SaaS products:
- Core domain model (templates, questions, structure)
- Primary workflow (e.g., phone intake sessions)
- Data capture and evidence (answers, revisions, audit trail)
- Ingestion from external sources (file uploads, URL monitoring)
- Collaboration (contributors, assignments, follow-ups)
- Web portal and user experience
- Administration and configuration
- Reporting, usage, and billing

Each module should have 3-6 acceptance criteria.

### Identifying features

A feature is a user-visible capability. The test: can you describe it to a user and would they understand what it gives them?

How to find features:
- Each numbered subsection or named capability is often a feature
- Each screen or page described in a UI spec is often a feature or contains multiple features
- Each distinct API endpoint group often corresponds to a feature
- Each distinct workflow or user story is often a feature

If a feature has more than 10 requirements beneath it, consider splitting it. If a feature has only 1 requirement, consider merging it into a sibling feature. Each feature should have 3-7 acceptance criteria.

### Identifying requirements

A requirement is a single, testable statement of behavior.

How to find requirements:
- Each bullet point in acceptance criteria lists is often a requirement
- Each API endpoint's described behavior often maps to one or more requirements
- Each UI action (button, form submission, state change) often maps to a requirement
- Each rule or policy described often maps to a requirement
- Each edge case or error handling behavior often maps to a requirement

Writing good requirements:
1. Start with what the user or system does, not implementation details
2. Include "why it exists" even if it seems obvious
3. Write acceptance criteria as condition/action/result statements
4. Each acceptance criterion should be independently testable
5. If the requirement statement is simple enough to be directly testable, the acceptance criteria list can be short (even 1-2 items)

Bad requirements:
- Too vague: "The system should handle uploads"
- Too implementation-specific: "Use a PostgreSQL trigger to update the status column"
- Too large: "The system supports multi-person collaboration" (that is a feature or module)
- Missing the "why"

### Identifying guardrails

Guardrails are rules that must never be broken. They are invariants, not features.

How to find them:
- Words like "must never," "must always," "under no circumstances," "regardless of"
- Security boundaries (cross-account access, authorization rules)
- Data integrity rules (no silent overwrites, no in-place mutation of history)
- Trust rules (every answer must be traceable, every change must be attributable)
- Explicit "guardrails" or "rules" sections in the document

Most products have 3-8 product-level guardrails. Modules may add 1-3 more. Features and requirements rarely introduce new guardrails. If you find more than 12-15 guardrails total, you may be writing requirements and labeling them as guardrails.

### Handling non-functional requirements

Place non-functional requirements (performance targets, file size limits, concurrency limits) under the feature they most directly constrain. Tag them with "performance", "reliability", "scalability", or "infrastructure".

If truly cross-cutting (e.g., "99.9% uptime"), place under an operational or infrastructure module.

### Handling UI and screens

Each screen described in a concept document is a source of features and requirements. Do not skip screens.

For each screen, extract:
1. A feature for the screen if it represents a distinct capability
2. Requirements for each distinct behavior: what is displayed, what actions are available, what is hidden by permissions, what navigation exists

Common mistake: treating the backend API and data model as the whole product and ignoring the UI spec.

### Handling API contracts

Do not create one requirement per endpoint. Instead:
- Group related endpoints into the feature they serve
- Extract requirements for the behaviors those endpoints enable
- Create requirements for API-level conventions (pagination, authentication, error handling, versioning)

### Completeness checklist

After decomposition, verify coverage of:
1. Every section of the concept document
2. Every screen or page described in the UI spec
3. Every API endpoint group
4. Every data entity (entities not referenced by any requirement indicate missing requirements)
5. Every stated goal or value proposition
6. Every edge case or error scenario
7. Every guardrail or invariant
8. Security and access control
9. Notifications and communications
10. Non-functional concerns

### Sizing guide

A detailed concept document of 500-1000 lines typically produces 40-80 requirements.
A document of 1000-2000 lines typically produces 80-150 requirements.
If your output is significantly below this range, go back and check for missed categories.

### Common mistakes to avoid

1. Skipping UI requirements (the most common omission)
2. Treating modules as requirements (if your "requirement" is a paragraph, it needs to be broken down)
3. Ignoring the "why" field
4. Creating guardrails for things that are just requirements
5. Duplicating content across levels (each level should be at its own altitude)
6. Missing stated product goals (if the document says "a key goal is X" there must be nodes that deliver on X)
7. Stopping at the backend (if the document describes phone integration, web portal, notifications, and API, cover all four)
"""
