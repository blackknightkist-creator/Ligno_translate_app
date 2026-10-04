/**
 * LingoPro Production Environment Configuration Validator (2026 Hardened)
 * 
 * Verifies required security, rate-limiting, and AI provider configurations at startup.
 * Adheres strictly to fail-closed & zero-leakage principles:
 * - Missing NODE_ENV defaults to 'production' (fail-closed)
 * - Invalid/unknown NODE_ENV fails startup
 * - Rate limit environment variables validated as finite positive integers (> 0)
 * - NEVER prints or logs secret keys or tokens
 * - Detects accidental VITE_ client leaks
 * - Enforces distributed rate limiting requirements in production
 */

export type RuntimeEnvironment = 'production' | 'development' | 'test';

const ALLOWED_NODE_ENVS: readonly RuntimeEnvironment[] = ['production', 'development', 'test'];

/**
 * Resolves NODE_ENV with strict fail-closed semantics:
 * - If NODE_ENV is unset or empty -> returns 'production' (fail-closed).
 * - If NODE_ENV is not one of 'production' | 'development' | 'test' -> throws an error.
 */
export function resolveNodeEnv(rawEnv: string | undefined = process.env.NODE_ENV): RuntimeEnvironment {
  if (rawEnv === undefined || rawEnv.trim() === '') {
    return 'production';
  }
  const normalized = rawEnv.trim().toLowerCase();
  if ((ALLOWED_NODE_ENVS as readonly string[]).includes(normalized)) {
    return normalized as RuntimeEnvironment;
  }
  throw new Error(
    `Invalid NODE_ENV "${rawEnv}". Allowed values are: production, development, test (or unset, which defaults to production).`
  );
}

/**
 * True whenever the application must enforce strict production security posture
 * (including when NODE_ENV is missing/unset or explicitly 'production').
 */
export function isProductionEnvironment(rawEnv: string | undefined = process.env.NODE_ENV): boolean {
  try {
    return resolveNodeEnv(rawEnv) === 'production';
  } catch {
    // Unknown/invalid NODE_ENV must also never enable dev-only features
    return true;
  }
}

export interface RateLimitEnvConfig {
  aiPerMinute: number;
  audioPerMinute: number;
  standardPerMinute: number;
  dailyQuota: number;
}

const DEFAULT_RATE_LIMITS: RateLimitEnvConfig = {
  aiPerMinute: 25,
  audioPerMinute: 15,
  standardPerMinute: 60,
  dailyQuota: 500,
};

/**
 * Strictly validates a positive integer environment variable.
 * Rejects NaN, Infinity, negative numbers, zero, decimals, and non-numeric strings.
 */
export function parsePositiveIntEnv(envName: string, rawValue: string | undefined, defaultValue: number): number {
  if (rawValue === undefined || rawValue === '') {
    return defaultValue;
  }
  const trimmed = rawValue.trim();
  // Must consist strictly of ASCII digits (no signs, decimals, exponents, or trailing chars)
  if (!/^\d+$/.test(trimmed)) {
    throw new Error(
      `Invalid ${envName}="${rawValue}": must be a finite positive integer greater than zero.`
    );
  }
  const parsed = Number(trimmed);
  if (!Number.isFinite(parsed) || !Number.isSafeInteger(parsed) || parsed <= 0) {
    throw new Error(
      `Invalid ${envName}="${rawValue}": must be a finite positive integer greater than zero.`
    );
  }
  return parsed;
}

/**
 * Validates all rate-limit environment variables and returns validated integers.
 * Throws if any configured rate-limit variable is invalid.
 */
export function validateRateLimitEnv(envObj: NodeJS.ProcessEnv = process.env): RateLimitEnvConfig {
  return {
    aiPerMinute: parsePositiveIntEnv(
      'RATE_LIMIT_AI_PER_MIN',
      envObj.RATE_LIMIT_AI_PER_MIN,
      DEFAULT_RATE_LIMITS.aiPerMinute
    ),
    audioPerMinute: parsePositiveIntEnv(
      'RATE_LIMIT_AUDIO_PER_MIN',
      envObj.RATE_LIMIT_AUDIO_PER_MIN,
      DEFAULT_RATE_LIMITS.audioPerMinute
    ),
    standardPerMinute: parsePositiveIntEnv(
      'RATE_LIMIT_STANDARD_PER_MIN',
      envObj.RATE_LIMIT_STANDARD_PER_MIN,
      DEFAULT_RATE_LIMITS.standardPerMinute
    ),
    dailyQuota: parsePositiveIntEnv(
      'RATE_LIMIT_DAILY_QUOTA',
      envObj.RATE_LIMIT_DAILY_QUOTA,
      DEFAULT_RATE_LIMITS.dailyQuota
    ),
  };
}

export interface EnvValidationResult {
  valid: boolean;
  warnings: string[];
  errors: string[];
  environment: RuntimeEnvironment;
  distributedStoreConfigured: boolean;
  aiProviderConfigured: boolean;
  rateLimits?: RateLimitEnvConfig;
}

export function validateEnvironment(options: { throwOnFatal?: boolean } = {}): EnvValidationResult {
  const warnings: string[] = [];
  const errors: string[] = [];
  let env: RuntimeEnvironment = 'production';

  // 1. Validate NODE_ENV (missing -> 'production', unknown -> startup error)
  try {
    env = resolveNodeEnv(process.env.NODE_ENV);
  } catch (err) {
    errors.push((err as Error).message);
    if (options.throwOnFatal) {
      throw err;
    }
  }

  // 2. Validate Rate-Limit Environment Variables
  let rateLimits: RateLimitEnvConfig | undefined;
  try {
    rateLimits = validateRateLimitEnv(process.env);
  } catch (err) {
    errors.push((err as Error).message);
    if (options.throwOnFatal) {
      throw err;
    }
  }

  // 3. AI Provider Credentials Check
  const hasGemini = Boolean(process.env.GEMINI_API_KEY || process.env.gemini_api || process.env.GEMINI_API);
  const hasComet = Boolean(process.env.COMET_API_KEY || process.env.BACKUP_API_KEY);
  const aiConfigured = hasGemini || hasComet;

  if (!aiConfigured) {
    if (env === 'production') {
      errors.push('No primary (GEMINI_API_KEY) or failover (COMET_API_KEY) API key found in production.');
    } else {
      warnings.push('No AI provider credentials detected. Set GEMINI_API_KEY in .env for live AI queries.');
    }
  }

  // 4. Distributed Rate Limiter Credentials Check (Upstash Redis)
  const hasRedisUrl = Boolean(process.env.UPSTASH_REDIS_REST_URL?.trim());
  const hasRedisToken = Boolean(process.env.UPSTASH_REDIS_REST_TOKEN?.trim());
  const redisConfigured = hasRedisUrl && hasRedisToken;

  if (env === 'production') {
    if (!redisConfigured) {
      errors.push(
        'Production security requirement: UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN must be configured. ' +
        'In-memory rate limiting is not permitted across multi-instance serverless deployments.'
      );
    }
  } else {
    if (!redisConfigured) {
      warnings.push('Upstash Redis credentials not detected. Operating with bounded in-memory rate limiting in development.');
    }
  }

  // 5. Client Leak Scanner: Verify no secrets are exposed via Vite VITE_ prefix
  const viteEnvKeys = Object.keys(process.env).filter((k) => k.startsWith('VITE_'));
  for (const key of viteEnvKeys) {
    const lower = key.toLowerCase();
    if (
      lower.includes('key') ||
      lower.includes('secret') ||
      lower.includes('token') ||
      lower.includes('password') ||
      lower.includes('gemini') ||
      lower.includes('comet') ||
      lower.includes('redis')
    ) {
      errors.push(
        `Critical Security Violation: Sensitive credential detected in client-exposed environment variable "${key}". ` +
        `Client environment variables prefixed with VITE_ are bundled into public frontend code.`
      );
    }
  }

  const result: EnvValidationResult = {
    valid: errors.length === 0,
    warnings,
    errors,
    environment: env,
    distributedStoreConfigured: redisConfigured,
    aiProviderConfigured: aiConfigured,
    rateLimits,
  };

  // Structured, secret-safe logging
  if (result.errors.length > 0) {
    console.error('[LingoPro EnvValidation] Configuration Errors detected:\n' + result.errors.map(e => `  ✗ ${e}`).join('\n'));
  }
  if (result.warnings.length > 0 && env !== 'test') {
    console.warn('[LingoPro EnvValidation] Configuration Warnings:\n' + result.warnings.map(w => `  ! ${w}`).join('\n'));
  }

  return result;
}
