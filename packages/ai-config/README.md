# Expertly AI Config

Shared AI configuration client for Expertly applications.

## Overview

This package provides a centralized way for all Expertly apps to:
- Fetch AI model configurations from the Admin service
- Get the correct model for each use case
- Initialize Anthropic and OpenAI clients with proper API keys

## Installation

```bash
# From the monorepo root
pip install -e packages/ai-config

# Or add to requirements.txt
-e ../../../packages/ai-config  # adjust path as needed
```

## Usage

```python
from ai_config import AIConfigClient

# Initialize client (uses ADMIN_API_URL env var or defaults to production)
client = AIConfigClient()

# Get model for a specific use case
model_id = await client.get_model_for_use_case("coding")
# Returns: "claude-sonnet-4-0-latest"

# Get full config for a use case
config = await client.get_use_case_config("analysis_heavy")
# Returns: {"model_id": "...", "max_tokens": 8192, "temperature": 0.7, ...}

# Get an initialized Anthropic client
anthropic_client = client.get_anthropic_client()

# Get an initialized OpenAI client
openai_client = client.get_openai_client()
```

## Use Cases

Available use cases (configure in Admin):
- `coding` - Code generation and editing
- `analysis_heavy` - Complex analysis and research
- `analysis_medium` - Standard analysis tasks
- `categorization` - Classification and tagging
- `summarization` - Text summarization
- `extraction_simple` - Simple data extraction
- `decisions_simple` - Quick yes/no decisions
- `image_generation` - Avatar/image creation (DALL-E)
- `vision` - Image analysis
- `requirements_parsing` - Parsing requirements documents
- `file_conversion` - Converting files to markdown
- `jira_generation` - Generating Jira stories
- `page_analysis` - Analyzing web pages
- `test_generation` - Generating test scripts
- `failure_analysis` - Analyzing test failures
- `code_session` - Interactive coding (Vibecode)
- `chat` - General conversational AI

## Configuration

The client fetches configuration from the Admin API. It caches the config
for 5 minutes to reduce API calls.

### Environment Variables

- `ADMIN_API_URL` - Admin API base URL (default: `https://admin-api.ai.devintensive.com`)
- `ANTHROPIC_API_KEY` - Anthropic API key (required for Anthropic models)
- `OPENAI_API_KEY` - OpenAI API key (required for OpenAI models)

## Fallback Behavior

If the Admin API is unavailable, the client falls back to:
1. Default model: `claude-sonnet-4-0-latest`
2. Default max_tokens: 4096
3. Default temperature: 0.7

This ensures apps continue to work even if Admin is temporarily down.
