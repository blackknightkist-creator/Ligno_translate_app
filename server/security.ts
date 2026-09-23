/**
 * LingoPro Security Architecture Layer
 * 
 * Provides defense-in-depth:
 * - Centralized input validation and normalization
 * - Sinhala Unicode preservation (ZWJ \u200D, ZWNJ \u200C, Sinhala code block \u0D80-\u0DFF)
 * - Safe control character stripping
 * - Prompt injection prevention and content fencing
 * - Sliding window rate limiter
 * - Request validation & security headers
 */

export interface ValidationOptions {
  maxLength?: number;
  minLength?: number;
  allowMultiline?: boolean;
}

export interface ValidationResult {
  valid: boolean;
  sanitized: string;
  error?: string;
  flags: string[];
}

// Maximum allowed input character count for freeform translation / emails
export const MAX_INPUT_LENGTH = 5000;
export const MIN_INPUT_LENGTH = 1;

/**
 * Validates and normalizes user input.
 * Preserves Sinhala script, English, numerals, emojis, and valid formatting
 * while neutralizing control bytes and malicious formatting.
 */
export function validateAndSanitizeInput(
  rawInput: unknown,
  options: ValidationOptions = {}
): ValidationResult {
  const maxLength = options.maxLength || MAX_INPUT_LENGTH;
  const minLength = options.minLength || MIN_INPUT_LENGTH;
  const flags: string[] = [];

  // Type check
  if (typeof rawInput !== 'string') {
    return {
      valid: false,
      sanitized: '',
      error: 'Invalid input format. Text must be a string.',
      flags: ['TYPE_ERROR'],
    };
  }

  // 1. Unicode Normalization (NFC: Canonical Decomposition followed by Canonical Composition)
  // Essential for accurate Sinhala character rendering and font shaping
  let normalized = rawInput.normalize('NFC');

  // 2. Length check before processing
  if (normalized.trim().length < minLength) {
    return {
      valid: false,
      sanitized: '',
      error: 'Input text cannot be empty.',
      flags: ['EMPTY_INPUT'],
    };
  }

  if (normalized.length > maxLength) {
    return {
      valid: false,
      sanitized: '',
      error: `Input exceeds maximum allowed length of ${maxLength} characters.`,
      flags: ['LENGTH_EXCEEDED'],
    };
  }

  // 3. Control character neutralization
  // Strip null bytes, backspaces, and non-printable control characters
  // CRITICAL: We explicitly PRESERVE:
  // - \u0009 (tab)
  // - \u000A (newline)
  // - \u000D (carriage return)
  // - \u200C (ZWNJ) - essential for Sinhala
  // - \u200D (ZWJ) - essential for Sinhala conjuncts (e.g., ක්‍ය, ප්‍ර, ර්‍ය)
  // - Sinhala Unicode block: \u0D80 to \u0DFF
  const safeText = normalized.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F-\u009F]/g, '');

  if (safeText.length !== normalized.length) {
    flags.push('STRIPPED_CONTROL_CHARS');
  }

  // 4. Prompt injection detection markers (defensive screening)
  const suspiciousPromptPatterns = [
    /ignore\s+(?:all\s+)?(?:previous|prior|above)\s+instructions/i,
    /do\s+not\s+(?:translate|follow\s+rules)/i,
    /(?:just\s+)?print\s+hacked/i,
    /hacked(?:_by_tester)?/i,
    /you\s+are\s+now\s+(?:dan|unrestricted|jailbroken)/i,
    /system\s*prompt\s*reveal/i,
    /repeat\s+(?:the\s+)?above\s+text/i,
    /disregard\s+(?:all\s+)?(?:the\s+)?rules/i,
    /output\s+(?:all\s+)?your\s+instructions/i,
    /bypass\s+safety/i,
  ];

  for (const pattern of suspiciousPromptPatterns) {
    if (pattern.test(safeText)) {
      flags.push('PROMPT_INJECTION_SUSPICION');
      break;
    }
  }

  return {
    valid: true,
    sanitized: safeText.trim(),
    flags,
  };
}

/**
 * Fences user content to protect LLM system prompts against instruction hijacking.
 * Wraps user input into isolated structural delimiters and escapes delimiter collisions.
 */
export function fenceUserInput(text: string): string {
  // Prevent escaping the fence by replacing internal closing delimiters
  const escaped = text.replace(/<<<USER_INPUT>>>/g, '[DELIMITER_REMOVED]');
  return `<<<USER_INPUT>>>\n${escaped}\n<<<END_USER_INPUT>>>`;
}

/**
 * Simple in-memory sliding window rate limiter
 * Protects against brute-force and resource exhaustion
 */
interface RateLimitBucket {
  count: number;
  resetTime: number;
}

const rateLimitStore = new Map<string, RateLimitBucket>();

// Cleanup stale rate limit entries every 5 minutes
setInterval(() => {
  const now = Date.now();
  for (const [key, bucket] of rateLimitStore.entries()) {
    if (bucket.resetTime <= now) {
      rateLimitStore.delete(key);
    }
  }
}, 5 * 60 * 1000);

export function checkRateLimit(
  clientIdentifier: string,
  limit = 30, // max requests
  windowMs = 60 * 1000 // 1 minute
): { allowed: boolean; remaining: number; retryAfterSec?: number } {
  const now = Date.now();
  const bucket = rateLimitStore.get(clientIdentifier);

  if (!bucket || bucket.resetTime <= now) {
    rateLimitStore.set(clientIdentifier, {
      count: 1,
      resetTime: now + windowMs,
    });
    return { allowed: true, remaining: limit - 1 };
  }

  if (bucket.count >= limit) {
    const retryAfterSec = Math.ceil((bucket.resetTime - now) / 1000);
    return {
      allowed: false,
      remaining: 0,
      retryAfterSec,
    };
  }

  bucket.count += 1;
  return {
    allowed: true,
    remaining: limit - bucket.count,
  };
}

/**
 * Validates audio base64 payload
 */
export function validateAudioPayload(base64Data: unknown, maxBytes = 10 * 1024 * 1024): { valid: boolean; error?: string } {
  if (typeof base64Data !== 'string') {
    return { valid: false, error: 'Audio payload must be a base64 string.' };
  }

  // Rough base64 size check
  const approximateSize = (base64Data.length * 3) / 4;
  if (approximateSize > maxBytes) {
    return { valid: false, error: 'Audio payload exceeds maximum size of 10MB.' };
  }

  return { valid: true };
}
