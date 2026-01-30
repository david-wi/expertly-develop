/**
 * AI Configuration Client for fetching model config from Admin API.
 */

interface AIUseCaseConfig {
  use_case: string;
  model_id: string;
  max_tokens: number;
  temperature: number;
}

interface AIConfigResponse {
  use_cases: AIUseCaseConfig[];
}

// Cache for AI config
let aiConfigCache: AIConfigResponse | null = null;
let aiConfigCacheTime = 0;
const AI_CONFIG_CACHE_TTL = 5 * 60 * 1000; // 5 minutes

// Default fallback values
const DEFAULT_MODEL = 'claude-sonnet-4-0-latest';
const DEFAULT_MAX_TOKENS = 4096;
const DEFAULT_TEMPERATURE = 0.7;

/**
 * Fetch AI configuration from Admin API with caching.
 */
export async function getAIConfig(): Promise<AIConfigResponse> {
  const now = Date.now();
  if (aiConfigCache && now - aiConfigCacheTime < AI_CONFIG_CACHE_TTL) {
    return aiConfigCache;
  }

  const adminApiUrl = process.env.ADMIN_API_URL || 'https://admin-api.ai.devintensive.com';
  try {
    const response = await fetch(`${adminApiUrl}/api/public/ai-config`);
    if (response.ok) {
      aiConfigCache = (await response.json()) as AIConfigResponse;
      aiConfigCacheTime = now;
      return aiConfigCache;
    }
  } catch (error) {
    console.warn('[AIConfig] Failed to fetch AI config from Admin API:', error);
  }

  // Fallback to defaults
  return {
    use_cases: [
      { use_case: 'code_session', model_id: DEFAULT_MODEL, max_tokens: 8192, temperature: 0.3 },
      { use_case: 'chat', model_id: DEFAULT_MODEL, max_tokens: DEFAULT_MAX_TOKENS, temperature: DEFAULT_TEMPERATURE },
    ],
  };
}

/**
 * Get model configuration for a specific use case.
 */
export async function getModelForUseCase(useCase: string): Promise<AIUseCaseConfig> {
  const config = await getAIConfig();
  const useCaseConfig = config.use_cases.find((uc) => uc.use_case === useCase);
  if (useCaseConfig) {
    return useCaseConfig;
  }
  // Default fallback
  return {
    use_case: useCase,
    model_id: DEFAULT_MODEL,
    max_tokens: DEFAULT_MAX_TOKENS,
    temperature: DEFAULT_TEMPERATURE,
  };
}

/**
 * Clear the configuration cache.
 */
export function clearAIConfigCache(): void {
  aiConfigCache = null;
  aiConfigCacheTime = 0;
}
