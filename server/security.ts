/**
 * LingoPro Security Architecture Layer
 * 
 * Provides defense-in-depth:
 * - Centralized input validation and normalization
 * - Sinhala Unicode preservation (ZWJ \u200D, ZWNJ \u200C, Sinhala code block \u0D80-\u0DFF)
 * - Safe control character stripping
 * - Prompt injection containment and delimiter fencing
 * - Audio payload validation with magic-byte verification
 * - Trusted client IP extraction & network topology awareness
 * - Multi-tier sliding window rate limiter with cost caps
 * - Safe request ID generation & structured security logging
 */

import net from 'net';
import crypto from 'crypto';
import { Request } from 'express';
import { ALLOWED_AUDIO_MIME_TYPES, AllowedAudioMimeType } from './schemas';
import { hashClientIdentifier } from './rateLimiter';

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
 * while neutralizing non-printable control bytes and malicious formatting.
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
  // Essential for accurate Sinhala character rendering and conjunct shaping
  let normalized = rawInput.normalize('NFC');

  // 2. Length check before heavy processing
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

  // 4. Prompt injection detection markers (defensive signal, contextualized to avoid false positives on benign sentences)
  const suspiciousPromptPatterns = [
    /ignore\s+(?:all\s+)?(?:previous|prior|above|system)\s+(?:instructions|prompts|rules|directions)/i,
    /do\s+not\s+(?:translate|follow\s+(?:the\s+)?rules|obey\s+instructions)/i,
    /(?:just\s+)?(?:print|output|say|respond\s+with)\s+["']?hacked(?:_by_tester)?["']?/i,
    /\bhacked_by_tester\b/i,
    /you\s+are\s+now\s+(?:the\s+)?(?:dan|unrestricted|jailbroken|system\s+administrator|root|developer\s+mode)/i,
    /(?:reveal|show|print|output|display|dump)\s+(?:all\s+)?(?:your\s+|the\s+)?(?:hidden\s+|system\s+|initial\s+|secret\s+)?(?:prompt|instructions|rules|api\s*key|credentials)/i,
    /repeat\s+(?:all\s+)?(?:the\s+)?(?:above|previous|system)\s+(?:text|prompt|instructions)/i,
    /(?:disregard|override|bypass|forget)\s+(?:all\s+)?(?:your\s+|the\s+)?(?:previous\s+|prior\s+|safety\s+|security\s+|system\s+)?(?:rules|instructions|guidelines|restrictions|filters)/i,
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
 * User content is treated strictly as DATA, never instructions.
 */
export function fenceUserInput(text: string): string {
  // Normalize and replace any delimiter collisions to prevent escaping the fence
  const normalized = text.normalize('NFC');
  const escaped = normalized
    .replace(/<{2,}[^>]*USER_INPUT[^>]*>{2,}/gi, '[ESCAPED_DELIMITER]')
    .replace(/<<<USER_INPUT_START>>>/gi, '[ESCAPED_DELIMITER]')
    .replace(/<<<USER_INPUT_END>>>/gi, '[ESCAPED_DELIMITER]')
    .replace(/<<<END_USER_INPUT>>>/gi, '[ESCAPED_DELIMITER]')
    .replace(/<<<USER_INPUT>>>/gi, '[ESCAPED_DELIMITER]');

  return `<<<USER_INPUT_START>>>\n${escaped}\n<<<USER_INPUT_END>>>`;
}

/**
 * Validates audio base64 payload and inspects binary audio header magic bytes
 */
export function validateAudioPayload(
  base64Data: unknown,
  declaredMime?: unknown,
  maxBytes = 10 * 1024 * 1024
): {
  valid: boolean;
  error?: string;
  safeMimeType?: AllowedAudioMimeType;
  decodedLength?: number;
} {
  if (typeof base64Data !== 'string') {
    return { valid: false, error: 'Audio payload must be a string.' };
  }

  const trimmed = base64Data.trim();
  if (trimmed.length < 16) {
    return { valid: false, error: 'Audio payload is empty or too short.' };
  }

  // 1. Base64 format validation
  // Strip optional data URI prefix if present (e.g., data:audio/webm;base64,...)
  let cleanBase64 = trimmed;
  if (trimmed.startsWith('data:')) {
    const commaIndex = trimmed.indexOf(',');
    if (commaIndex === -1) {
      return { valid: false, error: 'Malformed audio data URI format.' };
    }
    cleanBase64 = trimmed.substring(commaIndex + 1).trim();
  }

  // Pre-decode length check: reject oversized Base64 payloads BEFORE decoding to prevent memory exhaustion
  const MAX_BASE64_LENGTH = 14 * 1024 * 1024; // ~14MB Base64 corresponds to ~10MB decoded payload
  if (cleanBase64.length > MAX_BASE64_LENGTH) {
    return { valid: false, error: 'Audio payload exceeds maximum size limit of 10MB.' };
  }

  const cleanNoWs = cleanBase64.replace(/[\r\n\s]/g, '');
  if (cleanNoWs.length % 4 !== 0) {
    return { valid: false, error: 'Audio payload contains invalid Base64 padding or length.' };
  }

  // Verify Base64 character set (A-Z, a-z, 0-9, +, /, =)
  if (!/^[A-Za-z0-9+/]+={0,2}$/.test(cleanNoWs)) {
    return { valid: false, error: 'Audio payload contains invalid Base64 encoding.' };
  }

  // 2. Decode and check exact byte size (10 MB maximum decoded payload)
  let buffer: Buffer;
  try {
    buffer = Buffer.from(cleanNoWs, 'base64');
  } catch {
    return { valid: false, error: 'Failed to decode Base64 audio payload.' };
  }

  if (buffer.length === 0) {
    return { valid: false, error: 'Decoded audio payload is empty.' };
  }

  const MAX_AUDIO_BYTES = 10 * 1024 * 1024; // Strict 10MB limit
  const effectiveMaxBytes = maxBytes ? Math.min(maxBytes, MAX_AUDIO_BYTES) : MAX_AUDIO_BYTES;
  if (buffer.length > effectiveMaxBytes) {
    return { valid: false, error: 'Audio payload exceeds maximum size limit of 10MB.' };
  }

  // 3. MIME type validation & parameter stripping
  let normalizedMime: AllowedAudioMimeType = 'audio/webm';
  if (typeof declaredMime === 'string' && declaredMime.trim()) {
    // Strip parameters such as ;codecs=opus
    const stripped = declaredMime.split(';')[0].trim().toLowerCase();
    if (ALLOWED_AUDIO_MIME_TYPES.includes(stripped as AllowedAudioMimeType)) {
      normalizedMime = stripped as AllowedAudioMimeType;
    } else {
      return {
        valid: false,
        error: `Unsupported audio MIME type: ${stripped}. Allowed types: ${ALLOWED_AUDIO_MIME_TYPES.join(', ')}`,
      };
    }
  }

  // 4. Magic-byte signature verification and exact container format matching
  const isWebM = buffer.length >= 4 && buffer[0] === 0x1A && buffer[1] === 0x45 && buffer[2] === 0xDF && buffer[3] === 0xA3;
  const isWav = buffer.length >= 12 && buffer.toString('ascii', 0, 4) === 'RIFF' && buffer.toString('ascii', 8, 12) === 'WAVE';
  const isOgg = buffer.length >= 4 && buffer.toString('ascii', 0, 4) === 'OggS';
  const isMp3Id3 = buffer.length >= 3 && buffer.toString('ascii', 0, 3) === 'ID3';
  const isMp3Sync = buffer.length >= 2 && buffer[0] === 0xFF && (buffer[1] & 0xE0) === 0xE0;
  const isMp4 = buffer.length >= 12 && buffer.toString('ascii', 4, 8) === 'ftyp';
  const isAacAdts = buffer.length >= 2 && buffer[0] === 0xFF && (buffer[1] & 0xF6) === 0xF0;

  let detectedFormat: 'webm' | 'wav' | 'ogg' | 'mp3' | 'mp4_aac' | null = null;
  if (isWebM) detectedFormat = 'webm';
  else if (isWav) detectedFormat = 'wav';
  else if (isOgg) detectedFormat = 'ogg';
  else if (isMp3Id3 || isMp3Sync) detectedFormat = 'mp3';
  else if (isMp4 || isAacAdts) detectedFormat = 'mp4_aac';

  if (!detectedFormat) {
    return {
      valid: false,
      error: 'Audio payload does not match any recognized audio container signature (WebM, WAV, OGG, MP3, MP4/AAC).',
    };
  }

  // Exact compatibility matrix: ensure declared MIME matches detected container format
  const formatCompatibility: Record<'webm' | 'wav' | 'ogg' | 'mp3' | 'mp4_aac', string[]> = {
    webm: ['audio/webm'],
    wav: ['audio/wav', 'audio/wave', 'audio/x-wav'],
    ogg: ['audio/ogg', 'audio/opus'],
    mp3: ['audio/mpeg', 'audio/mp3'],
    mp4_aac: ['audio/mp4', 'audio/aac'],
  };

  const allowedMimesForFormat = formatCompatibility[detectedFormat];
  if (!allowedMimesForFormat.includes(normalizedMime)) {
    return {
      valid: false,
      error: `MIME type and audio container format signature mismatch. Declared ${normalizedMime} does not match ${detectedFormat.toUpperCase()} binary signature.`,
    };
  }

  return {
    valid: true,
    safeMimeType: normalizedMime,
    decodedLength: buffer.length,
  };
}

/**
 * Extracts client IP using a secure reverse-proxy trust model.
 * Does not blindly trust client-supplied forwarding headers.
 */
export function getClientIp(req: Request): string {
  // If running in a verified Netlify edge environment, Netlify sets non-spoofable edge headers
  const isNetlifyEnv = Boolean(process.env.NETLIFY === 'true' || process.env.NETLIFY_LOCAL === 'true' || (process.env.LAMBDA_TASK_ROOT && process.env.AWS_LAMBDA_FUNCTION_NAME));
  if (isNetlifyEnv) {
    const edgeIp = req.headers['x-nf-client-connection-ip'];
    if (typeof edgeIp === 'string') {
      const cleanEdge = edgeIp.trim();
      if (net.isIP(cleanEdge)) {
        return cleanEdge;
      }
    }
  }

  // When Express 'trust proxy' is configured to 1, req.ip resolves via the trusted immediate reverse-proxy hop.
  // Express discards untrusted client-supplied prefixes in X-Forwarded-For.
  if (req.ip) {
    let cleanIp = req.ip.trim();
    if (cleanIp.startsWith('::ffff:')) {
      cleanIp = cleanIp.substring(7);
    }
    if (net.isIP(cleanIp)) {
      return cleanIp;
    }
  }

  // Fallback to socket remote address
  const socketAddress = req.socket?.remoteAddress;
  if (socketAddress) {
    let cleanSocket = socketAddress.trim();
    if (cleanSocket.startsWith('::ffff:')) {
      cleanSocket = cleanSocket.substring(7);
    }
    if (net.isIP(cleanSocket)) {
      return cleanSocket;
    }
  }

  return '127.0.0.1';
}

/**
 * Generates a cryptographically random, safe Request ID
 */
export function generateRequestId(): string {
  return crypto.randomUUID();
}

/**
 * Multi-tier sliding window rate limiter
 * Protects against DDoS, brute-force, and API cost exhaustion
 */
interface RateLimitBucket {
  count: number;
  resetTime: number;
  dailyCount: number;
  dailyResetTime: number;
}

const rateLimitStore = new Map<string, RateLimitBucket>();

// Cleanup stale rate limit entries periodically (unref'd to prevent holding process open)
const cleanupTimer = setInterval(() => {
  const now = Date.now();
  for (const [key, bucket] of rateLimitStore.entries()) {
    if (bucket.resetTime <= now && bucket.dailyResetTime <= now) {
      rateLimitStore.delete(key);
    }
  }
}, 5 * 60 * 1000);
if (cleanupTimer.unref) {
  cleanupTimer.unref();
}

export function checkRateLimit(
  clientIdentifier: string,
  limit = 25, // requests per window
  windowMs = 60 * 1000, // 1 minute
  dailyLimit = 500 // max requests per 24 hours per IP to prevent cost exhaustion
): {
  allowed: boolean;
  remaining: number;
  retryAfterSec?: number;
  dailyRemaining?: number;
  reason?: 'WINDOW_EXCEEDED' | 'DAILY_QUOTA_EXCEEDED';
} {
  const now = Date.now();
  const dayMs = 24 * 60 * 60 * 1000;
  let bucket = rateLimitStore.get(clientIdentifier);

  if (!bucket) {
    bucket = {
      count: 1,
      resetTime: now + windowMs,
      dailyCount: 1,
      dailyResetTime: now + dayMs,
    };
    rateLimitStore.set(clientIdentifier, bucket);
    return { allowed: true, remaining: limit - 1, dailyRemaining: dailyLimit - 1 };
  }

  // Check 24-hour daily quota
  if (bucket.dailyResetTime <= now) {
    bucket.dailyCount = 0;
    bucket.dailyResetTime = now + dayMs;
  }

  if (bucket.dailyCount >= dailyLimit) {
    const retryAfterSec = Math.ceil((bucket.dailyResetTime - now) / 1000);
    return {
      allowed: false,
      remaining: 0,
      dailyRemaining: 0,
      retryAfterSec,
      reason: 'DAILY_QUOTA_EXCEEDED',
    };
  }

  // Check minute window
  if (bucket.resetTime <= now) {
    bucket.count = 1;
    bucket.resetTime = now + windowMs;
    bucket.dailyCount += 1;
    return {
      allowed: true,
      remaining: limit - 1,
      dailyRemaining: dailyLimit - bucket.dailyCount,
    };
  }

  if (bucket.count >= limit) {
    const retryAfterSec = Math.ceil((bucket.resetTime - now) / 1000);
    return {
      allowed: false,
      remaining: 0,
      dailyRemaining: Math.max(0, dailyLimit - bucket.dailyCount),
      retryAfterSec,
      reason: 'WINDOW_EXCEEDED',
    };
  }

  bucket.count += 1;
  bucket.dailyCount += 1;

  return {
    allowed: true,
    remaining: limit - bucket.count,
    dailyRemaining: Math.max(0, dailyLimit - bucket.dailyCount),
  };
}

/**
 * Structured, redaction-safe security logger
 * NEVER logs audio, API keys, full user messages, or credentials
 */
export interface SecurityLogEntry {
  timestamp: string;
  requestId: string;
  method: string;
  route: string;
  status: number;
  durationMs: number;
  clientIp: string;
  securityFlags?: string[];
  rateLimited?: boolean;
}

export function logSecurityEvent(entry: SecurityLogEntry): void {
  // Format as structured JSON log entry — never expose raw IPv4/IPv6 addresses in logs
  const sanitized = {
    ...entry,
    clientIp: `ip_${hashClientIdentifier(entry.clientIp)}`,
  };
  console.log(`[LingoPro Security] ${JSON.stringify(sanitized)}`);
}
