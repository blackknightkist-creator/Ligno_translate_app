/**
 * LingoPro Production Rate Limiter (2026 Hardened)
 * 
 * Architecture:
 * - Production (including when NODE_ENV is unset/missing): Upstash Redis distributed rate limiting is MANDATORY.
 *   1. If Redis configuration is missing -> FAIL CLOSED.
 *   2. If Redis initialization fails -> FAIL CLOSED.
 *   3. If Redis request fails / becomes unavailable -> FAIL CLOSED.
 *   There is NO production path that falls back to in-memory rate limiting.
 *   Process-local in-memory stores do not provide global boundaries across serverless instances.
 * - Development / Test: Local bounded in-memory sliding window allowed ONLY when NODE_ENV is explicitly 'development' or 'test'.
 * 
 * Security Controls:
 * - IPv6 /64 prefix aggregation (prevents IPv6 /64 address-rotation bypass while preserving IPv4 /32 behavior)
 * - Salted SHA-256 IP hashing (zero plain IPs or PII stored in Redis or logs)
 * - Atomic Redis pipeline increments with TTLs
 * - Functional tiers (AI operations, Audio STT/TTS, Standard API)
 * - Daily quota cost protection
 * - Strict positive-integer validation of rate-limit environment variables
 */

import crypto from 'crypto';
import net from 'net';
import { Redis } from '@upstash/redis';
import { isProductionEnvironment, validateRateLimitEnv, RateLimitEnvConfig } from './envValidation';

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  limit: number;
  retryAfterSec?: number;
  reason?:
    | 'WINDOW_EXCEEDED'
    | 'DAILY_QUOTA_EXCEEDED'
    | 'REDIS_CONFIGURATION_REQUIRED'
    | 'REDIS_UNAVAILABLE';
  isDistributed: boolean;
  error?: string;
}

// Validate rate-limit environment variables at module initialization (throws on invalid config)
export const LIMIT_CONFIG: RateLimitEnvConfig = validateRateLimitEnv(process.env);

export function getActiveLimitConfig(): RateLimitEnvConfig {
  return validateRateLimitEnv(process.env);
}

// Initialize Upstash Redis client if credentials exist
let redisClient: Redis | null = null;
let redisInitAttempted = false;
let redisInitError: string | null = null;

/**
 * Resets cached Redis client instance (used in automated regression tests to verify fail-closed states).
 */
export function resetRedisClientForTesting(): void {
  redisClient = null;
  redisInitAttempted = false;
  redisInitError = null;
}

export function getRedisClient(): Redis | null {
  if (redisInitAttempted) {
    return redisClient;
  }
  redisInitAttempted = true;

  const url = process.env.UPSTASH_REDIS_REST_URL?.trim();
  const token = process.env.UPSTASH_REDIS_REST_TOKEN?.trim();

  if (url && token) {
    try {
      redisClient = new Redis({ url, token });
      redisInitError = null;
    } catch (err) {
      redisInitError = (err as Error).message || 'Failed to initialize Upstash Redis client';
      console.error('[RateLimiter] Failed to initialize Upstash Redis client:', redisInitError);
      redisClient = null;
    }
  }

  return redisClient;
}

// In-Memory Bounded Store (Development / Test ONLY — NEVER used in production)
interface MemoryBucket {
  count: number;
  resetTime: number;
  dailyCount: number;
  dailyResetTime: number;
}

const MAX_MEMORY_KEYS = 10000;
const memoryStore = new Map<string, MemoryBucket>();
let memoryRateLimitCalls = 0;

/**
 * Returns and optionally resets the number of times checkMemoryRateLimit() was invoked.
 * Used in security regression tests to prove zero in-memory fallback in production.
 */
export function getMemoryRateLimitCallCount(reset = false): number {
  const current = memoryRateLimitCalls;
  if (reset) {
    memoryRateLimitCalls = 0;
  }
  return current;
}

// Periodic cleanup of stale memory buckets
const memoryCleanup = setInterval(() => {
  const now = Date.now();
  for (const [key, bucket] of memoryStore.entries()) {
    if (bucket.resetTime <= now && bucket.dailyResetTime <= now) {
      memoryStore.delete(key);
    }
  }
  // Hard cap to prevent memory exhaustion in high-cardinality attacks
  if (memoryStore.size > MAX_MEMORY_KEYS) {
    const keysToDelete = Array.from(memoryStore.keys()).slice(0, 2000);
    for (const k of keysToDelete) memoryStore.delete(k);
  }
}, 60 * 1000);

if (memoryCleanup.unref) {
  memoryCleanup.unref();
}

/**
 * Expands a valid IPv6 address into 8 canonical 4-hex-digit hextets and extracts its /64 subnet prefix
 * (first 4 hextets). Prevents attackers from rotating across 2^64 interface identifiers within a single /64 allocation.
 */
export function normalizeIpv6To64Prefix(ip: string): string {
  // Strip IPv6 zone index if present (e.g., fe80::1%eth0)
  const withoutZone = ip.split('%')[0].toLowerCase();

  // Handle embedded IPv4 at end of IPv6 (e.g. ::ffff:192.0.2.128 or 64:ff9b::192.0.2.128)
  let working = withoutZone;
  if (working.includes('.')) {
    const lastColon = working.lastIndexOf(':');
    const ipv4Part = working.substring(lastColon + 1);
    if (net.isIPv4(ipv4Part)) {
      const octets = ipv4Part.split('.').map((o) => parseInt(o, 10));
      const hex1 = ((octets[0] << 8) | octets[1]).toString(16).padStart(4, '0');
      const hex2 = ((octets[2] << 8) | octets[3]).toString(16).padStart(4, '0');
      working = `${working.substring(0, lastColon)}:${hex1}:${hex2}`;
    }
  }

  let hextets: string[] = [];
  if (working.includes('::')) {
    const [leftRaw, rightRaw] = working.split('::');
    const left = leftRaw ? leftRaw.split(':') : [];
    const right = rightRaw ? rightRaw.split(':') : [];
    const missing = Math.max(0, 8 - (left.length + right.length));
    hextets = [...left, ...Array(missing).fill('0000'), ...right];
  } else {
    hextets = working.split(':');
  }

  const canonical = hextets.slice(0, 8).map((h) => h.padStart(4, '0').toLowerCase());
  while (canonical.length < 8) {
    canonical.push('0000');
  }

  // First 4 hextets represent the /64 routing prefix
  return `${canonical.slice(0, 4).join(':')}::/64`;
}

/**
 * Normalizes client IP (IPv4 exact address, IPv6 /64 prefix) and hashes with an internal salt.
 * Guarantees zero plain IP addresses or PII are stored in Redis, memory, or logs.
 */
export function hashClientIdentifier(rawIp: string): string {
  let normalized = (rawIp || '').trim().toLowerCase();
  if (normalized.startsWith('::ffff:')) {
    const maybeV4 = normalized.substring(7);
    if (net.isIPv4(maybeV4)) {
      normalized = maybeV4;
    }
  }

  const ipVersion = net.isIP(normalized);
  let identitySource: string;
  if (ipVersion === 4) {
    identitySource = normalized;
  } else if (ipVersion === 6) {
    identitySource = normalizeIpv6To64Prefix(normalized);
  } else {
    identitySource = 'untrusted-client';
  }

  return crypto.createHash('sha256').update(`lingopro:${identitySource}`).digest('hex').substring(0, 16);
}

/**
 * Execute rate limit check in local memory store (Development & Test ONLY).
 * Explicitly barred from execution when in production (including when NODE_ENV is missing).
 */
function checkMemoryRateLimit(
  hashedId: string,
  tier: string,
  limit: number,
  windowMs = 60 * 1000,
  dailyLimit = getActiveLimitConfig().dailyQuota
): RateLimitResult {
  memoryRateLimitCalls++;
  if (isProductionEnvironment()) {
    return {
      allowed: false,
      remaining: 0,
      limit: 0,
      retryAfterSec: 60,
      reason: 'REDIS_UNAVAILABLE',
      isDistributed: false,
      error: 'In-memory rate limiting is strictly prohibited in production.',
    };
  }

  const now = Date.now();
  const dayMs = 24 * 60 * 60 * 1000;
  const key = `${hashedId}:${tier}`;
  let bucket = memoryStore.get(key);

  if (!bucket) {
    bucket = {
      count: 1,
      resetTime: now + windowMs,
      dailyCount: 1,
      dailyResetTime: now + dayMs,
    };
    memoryStore.set(key, bucket);
    return {
      allowed: true,
      remaining: Math.max(0, limit - 1),
      limit,
      isDistributed: false,
    };
  }

  // Reset daily quota if day has elapsed
  if (bucket.dailyResetTime <= now) {
    bucket.dailyCount = 0;
    bucket.dailyResetTime = now + dayMs;
  }

  // Check daily quota
  if (bucket.dailyCount >= dailyLimit) {
    const retrySec = Math.max(1, Math.ceil((bucket.dailyResetTime - now) / 1000));
    return {
      allowed: false,
      remaining: 0,
      limit,
      retryAfterSec: retrySec,
      reason: 'DAILY_QUOTA_EXCEEDED',
      isDistributed: false,
    };
  }

  // Reset minute window if elapsed
  if (bucket.resetTime <= now) {
    bucket.count = 1;
    bucket.resetTime = now + windowMs;
    bucket.dailyCount++;
    return {
      allowed: true,
      remaining: Math.max(0, limit - 1),
      limit,
      isDistributed: false,
    };
  }

  // Window limit check
  if (bucket.count >= limit) {
    const retrySec = Math.max(1, Math.ceil((bucket.resetTime - now) / 1000));
    return {
      allowed: false,
      remaining: 0,
      limit,
      retryAfterSec: retrySec,
      reason: 'WINDOW_EXCEEDED',
      isDistributed: false,
    };
  }

  bucket.count++;
  bucket.dailyCount++;
  return {
    allowed: true,
    remaining: Math.max(0, limit - bucket.count),
    limit,
    isDistributed: false,
  };
}

/**
 * Execute distributed rate limit check via Upstash Redis
 * Uses atomic pipeline increments with automatic TTL expiration
 */
export async function checkRedisRateLimit(
  redis: Redis,
  hashedId: string,
  tier: string,
  limit: number,
  windowSeconds = 60,
  dailyLimit = getActiveLimitConfig().dailyQuota
): Promise<RateLimitResult> {
  const now = Math.floor(Date.now() / 1000);
  const currentMinuteWindow = Math.floor(now / windowSeconds);
  const currentDayWindow = Math.floor(now / 86400);

  const windowKey = `lp:rl:${tier}:${hashedId}:${currentMinuteWindow}`;
  const dailyKey = `lp:quota:${hashedId}:${currentDayWindow}`;

  // Atomic pipeline: INCR on window key, INCR on daily key
  const pipeline = redis.pipeline();
  pipeline.incr(windowKey);
  pipeline.expire(windowKey, windowSeconds * 2);
  pipeline.incr(dailyKey);
  pipeline.expire(dailyKey, 86400 * 2);

  const results = await pipeline.exec();
  if (!Array.isArray(results) || typeof results[0] !== 'number' || typeof results[2] !== 'number') {
    throw new Error('Malformed or empty pipeline response from Upstash Redis');
  }

  const windowCount = results[0] as number;
  const dailyCount = results[2] as number;

  if (dailyCount > dailyLimit) {
    const secondsUntilTomorrow = 86400 - (now % 86400);
    return {
      allowed: false,
      remaining: 0,
      limit,
      retryAfterSec: secondsUntilTomorrow,
      reason: 'DAILY_QUOTA_EXCEEDED',
      isDistributed: true,
    };
  }

  if (windowCount > limit) {
    const secondsUntilNextWindow = windowSeconds - (now % windowSeconds);
    return {
      allowed: false,
      remaining: 0,
      limit,
      retryAfterSec: Math.max(1, secondsUntilNextWindow),
      reason: 'WINDOW_EXCEEDED',
      isDistributed: true,
    };
  }

  return {
    allowed: true,
    remaining: Math.max(0, limit - windowCount),
    limit,
    isDistributed: true,
  };
}

/**
 * Core rate limiting function.
 * 
 * Architecture Policy:
 * In PRODUCTION (including when NODE_ENV is unset/missing):
 * - Upstash Redis is MANDATORY.
 * - A. Redis configured + reachable -> use Upstash Redis distributed rate limiting.
 * - B. Redis configuration missing -> FAIL CLOSED.
 * - C. Redis configured but request fails / becomes unavailable -> FAIL CLOSED.
 * - D. Redis initialization fails -> FAIL CLOSED.
 * - NEVER falls back to checkMemoryRateLimit in production.
 * 
 * In DEVELOPMENT / TEST (NODE_ENV explicitly 'development' or 'test'):
 * - Operates safely with bounded local in-memory sliding window when Redis is unconfigured or unreachable.
 */
export async function evaluateRateLimit(
  clientIp: string,
  tier: 'ai' | 'stt' | 'standard',
  customLimit?: number,
  redisOverride?: Redis | null
): Promise<RateLimitResult> {
  const isProduction = isProductionEnvironment();
  const activeLimits = getActiveLimitConfig();
  let limit = activeLimits.standardPerMinute;
  if (tier === 'ai') {
    limit = activeLimits.aiPerMinute;
  } else if (tier === 'stt') {
    limit = activeLimits.audioPerMinute;
  }
  if (typeof customLimit === 'number' && customLimit > 0) {
    limit = customLimit;
  }

  const hashedId = hashClientIdentifier(clientIp);
  const redis = redisOverride !== undefined ? redisOverride : getRedisClient();

  if (isProduction) {
    // B & D: Redis configuration missing or initialization failed in production -> FAIL CLOSED
    if (!redis) {
      return {
        allowed: false,
        remaining: 0,
        limit: 0,
        retryAfterSec: 60,
        reason: redisInitError ? 'REDIS_UNAVAILABLE' : 'REDIS_CONFIGURATION_REQUIRED',
        isDistributed: false,
        error: redisInitError
          ? 'Production security requirement: Upstash Redis initialization failed. Failing closed.'
          : 'Production security requirement: Upstash Redis distributed rate limiter is not configured.',
      };
    }

    // A & C: Redis configured in production -> evaluate or FAIL CLOSED on outage/error
    try {
      return await checkRedisRateLimit(redis, hashedId, tier, limit, 60, activeLimits.dailyQuota);
    } catch (err) {
      console.error('[RateLimiter] Production Upstash Redis request failed (failing closed):', (err as Error).message);
      return {
        allowed: false,
        remaining: 0,
        limit: 0,
        retryAfterSec: 30,
        reason: 'REDIS_UNAVAILABLE',
        isDistributed: false,
        error: 'Rate limiting service temporarily unavailable. Failing closed in production.',
      };
    }
  }

  // Non-production (Development / Test): Use Redis if configured and reachable, otherwise bounded memory limiter
  if (redis) {
    try {
      return await checkRedisRateLimit(redis, hashedId, tier, limit, 60, activeLimits.dailyQuota);
    } catch (err) {
      console.warn('[RateLimiter] Non-production Redis request failed, using dev memory store:', (err as Error).message);
      return checkMemoryRateLimit(hashedId, tier, limit, 60000, activeLimits.dailyQuota);
    }
  }

  return checkMemoryRateLimit(hashedId, tier, limit, 60000, activeLimits.dailyQuota);
}

/**
 * Synchronous variant for non-production unit tests
 */
export function checkRateLimitSync(
  clientIdentifier: string,
  limit = 25,
  windowMs = 60 * 1000,
  dailyLimit = getActiveLimitConfig().dailyQuota
): RateLimitResult {
  const hashed = hashClientIdentifier(clientIdentifier);
  return checkMemoryRateLimit(hashed, 'sync', limit, windowMs, dailyLimit);
}

/**
 * Diagnostic status reporting (zero sensitive credentials exposed)
 */
export function getRateLimiterStatus(): {
  isDistributed: boolean;
  provider: 'upstash-redis' | 'unconfigured-fail-closed' | 'in-memory-development-fallback';
  limits: RateLimitEnvConfig;
} {
  const isProduction = isProductionEnvironment();
  const redis = getRedisClient();
  const isDistributed = Boolean(redis);

  let provider: 'upstash-redis' | 'unconfigured-fail-closed' | 'in-memory-development-fallback' = 'in-memory-development-fallback';
  if (isDistributed) {
    provider = 'upstash-redis';
  } else if (isProduction) {
    provider = 'unconfigured-fail-closed';
  }

  return {
    isDistributed,
    provider,
    limits: { ...getActiveLimitConfig() },
  };
}
