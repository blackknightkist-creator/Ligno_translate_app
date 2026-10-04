/**
 * LingoPro Hardened Production Server
 * Express + Vite Full-Stack Application
 * 
 * Features:
 * - OWASP Top 10 2026 Defense-in-depth architecture
 * - Fail-closed NODE_ENV handling (missing NODE_ENV -> production posture; invalid NODE_ENV -> startup fail)
 * - Rate limiting executed BEFORE body parsing to prevent pre-limiter memory exhaustion
 * - 256kb global JSON body limit; 15mb JSON limit isolated strictly to /api/stt AFTER rate limiting
 * - Serverless-ready (Netlify, Vercel, Docker, Railway, Cloud Run)
 * - Strict Zod schema validation on all API endpoints
 * - Magic-byte binary verification for audio payloads
 * - Distributed Upstash Redis rate limiting with IPv6 /64 prefix aggregation
 * - Trusted reverse-proxy IP resolution
 * - Strict Content-Security-Policy (no unsafe-eval, no broad network wildcards)
 * - Minimal public health endpoint (zero internal config leakage)
 * - Redacted structured security logging with cryptographic request IDs
 */

import 'dotenv/config';
import express, { Request, Response, NextFunction } from 'express';
import path from 'path';
import compression from 'compression';
import { ZodError } from 'zod';
import {
  validateAndSanitizeInput,
  checkRateLimit,
  validateAudioPayload,
  getClientIp,
  generateRequestId,
  logSecurityEvent,
} from './server/security';
import { evaluateRateLimit } from './server/rateLimiter';
import {
  validateEnvironment,
  resolveNodeEnv,
  isProductionEnvironment,
  validateRateLimitEnv,
} from './server/envValidation';
import {
  ProcessRequestSchema,
  TranslateRequestSchema,
  ProfessionalizeRequestSchema,
  EmailRequestSchema,
  STTRequestSchema,
  TTSRequestSchema,
} from './server/schemas';
import {
  processUnifiedInput,
  translateTextService,
  professionalizeTextService,
  generateEmailService,
  transcribeAudioService,
  synthesizeSpeechService,
  getEngineStatus,
} from './server/aiService';

// Extend Express Request interface to carry request ID and timing
declare global {
  namespace Express {
    interface Request {
      id?: string;
      startTime?: number;
    }
  }
}

// Validate NODE_ENV and rate-limit integer environment variables immediately on module load
// Throws and aborts startup if NODE_ENV or any RATE_LIMIT_* variable is invalid
resolveNodeEnv(process.env.NODE_ENV);
validateRateLimitEnv(process.env);

const app = express();
const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;

// ==========================================
// 1. Core Platform & Reverse-Proxy Topology
// ==========================================

// Configure Express trust proxy for reverse-proxy architectures (Netlify Edge, Cloud Run, Railway)
// Trusts the single upstream hop without blindly accepting forged client headers
app.set('trust proxy', 1);

// Disable technology disclosure header
app.disable('x-powered-by');

// Enable HTTP Text Compression (Gzip / Brotli)
app.use(compression({
  filter: (req, res) => {
    if (req.headers['x-no-compression'] || req.headers.upgrade) {
      return false;
    }
    return compression.filter(req, res);
  },
}) as any);

// ==========================================
// 2. Request ID & Structured Security Logging
// ==========================================

app.use((req: Request, res: Response, next: NextFunction) => {
  req.id = generateRequestId();
  req.startTime = performance.now();
  res.setHeader('X-Request-ID', req.id);

  res.on('finish', () => {
    const durationMs = Math.round(performance.now() - (req.startTime || performance.now()));
    logSecurityEvent({
      timestamp: new Date().toISOString(),
      requestId: req.id || 'unknown',
      method: req.method,
      route: req.path,
      status: res.statusCode,
      durationMs,
      clientIp: getClientIp(req),
    });
  });

  next();
});

// ==========================================
// 3. Strict HTTP Security Headers
// ==========================================

export const TRUSTED_FRAME_ANCESTORS =
  "frame-ancestors 'self' https://aistudio.google.com https://*.google.com https://*.googleusercontent.com https://*.run.app";

export function buildContentSecurityPolicy(isProd = isProductionEnvironment()): string {
  const scriptDirectives = isProd ? "script-src 'self' blob:" : "script-src 'self' 'unsafe-inline' blob:";
  return [
    "default-src 'self'",
    scriptDirectives,
    "worker-src 'self' blob:",
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    "font-src 'self' https://fonts.gstatic.com data:",
    "img-src 'self' data: blob:",
    "media-src 'self' blob: data:",
    "connect-src 'self'",
    TRUSTED_FRAME_ANCESTORS,
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
  ].join('; ');
}

app.use((req: Request, res: Response, next: NextFunction) => {
  // Prevent MIME-sniffing
  res.setHeader('X-Content-Type-Options', 'nosniff');

  // Referrer metadata control
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');

  // HSTS (HTTP Strict Transport Security): 1 year + includeSubDomains + preload
  res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains; preload');

  // Cross-Origin Isolation & Isolation policies
  res.setHeader('Cross-Origin-Opener-Policy', 'same-origin-allow-popups');
  res.setHeader('Cross-Origin-Resource-Policy', 'same-origin');

  // Permissions Policy: restrict unneeded hardware APIs while allowing microphone for STT
  res.setHeader(
    'Permissions-Policy',
    'microphone=(self), camera=(), geolocation=(), payment=(), usb=(), bluetooth=()'
  );

  // Content-Security-Policy (Tightened for production; missing NODE_ENV is treated as production)
  res.setHeader('Content-Security-Policy', buildContentSecurityPolicy(isProductionEnvironment()));

  next();
});

// ==========================================
// 4. URL Normalization & Pre-Parser Content-Type Check
// ==========================================

// Serverless URL normalizer (ensures Netlify functions seamlessly match /api/* routes before rate limiting)
app.use((req: Request, res: Response, next: NextFunction) => {
  if (!req.url.startsWith('/api') && (
    req.url.startsWith('/process') ||
    req.url.startsWith('/translate') ||
    req.url.startsWith('/health') ||
    req.url.startsWith('/email') ||
    req.url.startsWith('/stt') ||
    req.url.startsWith('/tts') ||
    req.url.startsWith('/professionalize')
  )) {
    req.url = '/api' + req.url;
  }
  next();
});

// Enforce Content-Type: application/json on all API POST requests BEFORE rate limiting & body parsing
app.use('/api', (req: Request, res: Response, next: NextFunction) => {
  if (req.method === 'POST' && req.path !== '/health') {
    const contentType = req.headers['content-type'] || '';
    if (!contentType.toLowerCase().includes('application/json')) {
      return res.status(415).json({
        error: 'Unsupported Media Type. Requests must provide Content-Type: application/json',
        requestId: req.id,
      });
    }
  }
  next();
});

// ==========================================
// 5. Production Distributed Rate Limiting Middleware (Runs BEFORE Body Parsing)
// ==========================================

app.use('/api', async (req: Request, res: Response, next: NextFunction) => {
  // Public health probe is a lightweight status check and does not consume AI/STT resources
  if (req.method === 'GET' && (req.path === '/health' || req.path === '/api/health')) {
    return next();
  }

  const clientIp = getClientIp(req);

  // Differentiated functional tiers:
  // - STT: Audio transcription/synthesis
  // - Heavy AI: LLM inference (process, translate, professionalize, email)
  // - Standard: Health and non-AI endpoints
  let tier: 'ai' | 'stt' | 'standard' = 'standard';
  if (req.path.startsWith('/stt') || req.path.startsWith('/tts')) {
    tier = 'stt';
  } else if (['/process', '/translate', '/professionalize', '/email'].some(p => req.path.startsWith(p))) {
    tier = 'ai';
  }

  try {
    const rateCheck = await evaluateRateLimit(clientIp, tier);

    res.setHeader('RateLimit-Limit', rateCheck.limit);
    res.setHeader('RateLimit-Remaining', rateCheck.remaining);
    res.setHeader('RateLimit-Policy', `${rateCheck.limit};w=60`);

    if (!rateCheck.allowed) {
      if (
        rateCheck.reason === 'REDIS_CONFIGURATION_REQUIRED' ||
        rateCheck.reason === 'REDIS_UNAVAILABLE'
      ) {
        res.setHeader('Retry-After', rateCheck.retryAfterSec || 60);
        return res.status(503).json({
          error:
            rateCheck.reason === 'REDIS_UNAVAILABLE'
              ? 'Rate limiting service temporarily unavailable. Request rejected by fail-closed security policy.'
              : 'Rate limiting service unconfigured in production. Distributed Upstash Redis store required.',
          requestId: req.id,
        });
      }

      res.setHeader('Retry-After', rateCheck.retryAfterSec || 30);
      return res.status(429).json({
        error: rateCheck.reason === 'DAILY_QUOTA_EXCEEDED'
          ? 'Daily request allowance reached for this client. Please resume tomorrow.'
          : 'Too many requests. Please slow down and try again shortly.',
        retryAfter: rateCheck.retryAfterSec,
        requestId: req.id,
      });
    }

    next();
  } catch (err) {
    console.error('[RateLimiter] Middleware unhandled error:', (err as Error)?.message || err);
    if (isProductionEnvironment()) {
      res.setHeader('Retry-After', 60);
      return res.status(503).json({
        error: 'Rate limiting service unavailable. Request rejected by fail-closed security policy.',
        requestId: req.id,
      });
    }
    next();
  }
});

// ==========================================
// 6. Scoped Body Parsing (Executed AFTER Rate Limiting)
// ==========================================

export const GLOBAL_JSON_BODY_LIMIT = '256kb';
export const STT_AUDIO_JSON_BODY_LIMIT = '15mb';

const standardJsonParser = express.json({ limit: GLOBAL_JSON_BODY_LIMIT });
const sttAudioJsonParser = express.json({ limit: STT_AUDIO_JSON_BODY_LIMIT });

// Apply 15MB parser strictly to /api/stt; apply 256KB parser to all other routes
app.use((req: Request, res: Response, next: NextFunction) => {
  if (req.path === '/api/stt' || req.url.startsWith('/api/stt')) {
    return sttAudioJsonParser(req, res, next);
  }
  return standardJsonParser(req, res, next);
});
app.use(express.urlencoded({ extended: false, limit: '64kb' }));

// ==========================================
// 7. Hardened API Routes
// ==========================================

// Minimal Public Health Endpoint (Zero sensitive internal configuration leakage)
app.get('/api/health', (req: Request, res: Response) => {
  res.json({
    status: 'ok',
    timestamp: Date.now(),
  });
});

// Internal Health Endpoint (Available ONLY in explicit development/test environments)
app.get('/api/internal/health', (req: Request, res: Response) => {
  if (isProductionEnvironment()) {
    return res.status(404).json({ error: 'Endpoint unavailable in production', requestId: req.id });
  }
  const engine = getEngineStatus();
  res.json({
    status: 'ok',
    engine,
    timestamp: Date.now(),
  });
});

// Unified Processing (Auto-detect -> Translate -> Professionalize)
app.post('/api/process', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const parsed = ProcessRequestSchema.parse(req.body);
    const validation = validateAndSanitizeInput(parsed.text, { maxLength: 5000 });

    if (!validation.valid) {
      return res.status(400).json({ error: validation.error, flags: validation.flags, requestId: req.id });
    }

    const result = await processUnifiedInput(validation.sanitized, validation.flags);
    res.json({
      success: true,
      data: result,
      securityFlags: validation.flags,
    });
  } catch (error) {
    next(error);
  }
});

// Dedicated Translation Endpoint
app.post('/api/translate', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const parsed = TranslateRequestSchema.parse(req.body);
    const validation = validateAndSanitizeInput(parsed.text, { maxLength: 5000 });

    if (!validation.valid) {
      return res.status(400).json({ error: validation.error, flags: validation.flags, requestId: req.id });
    }

    const result = await translateTextService(validation.sanitized, parsed.targetLang);
    res.json({
      success: true,
      data: result,
      securityFlags: validation.flags,
    });
  } catch (error) {
    next(error);
  }
});

// Dedicated Professionalization Endpoint
app.post('/api/professionalize', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const parsed = ProfessionalizeRequestSchema.parse(req.body);
    const validation = validateAndSanitizeInput(parsed.text, { maxLength: 5000 });

    if (!validation.valid) {
      return res.status(400).json({ error: validation.error, flags: validation.flags, requestId: req.id });
    }

    const result = await professionalizeTextService(validation.sanitized, parsed.style);
    res.json({
      success: true,
      data: result,
      securityFlags: validation.flags,
    });
  } catch (error) {
    next(error);
  }
});

// Dedicated Email Generator Endpoint (Enforces strict allowlists for style and recipientRole)
app.post('/api/email', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const parsed = EmailRequestSchema.parse(req.body);
    const validation = validateAndSanitizeInput(parsed.request, { maxLength: 5000 });

    if (!validation.valid) {
      return res.status(400).json({ error: validation.error, flags: validation.flags, requestId: req.id });
    }

    const result = await generateEmailService(validation.sanitized, parsed.style, parsed.recipientRole);
    res.json({
      success: true,
      data: result,
      securityFlags: validation.flags,
    });
  } catch (error) {
    next(error);
  }
});

// Speech-to-Text Endpoint (Strict Base64 and Audio Magic-Byte Verification; 15MB body parser allowed)
app.post('/api/stt', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const parsed = STTRequestSchema.parse(req.body);
    const payloadValidation = validateAudioPayload(parsed.audioData, parsed.mimeType);

    if (!payloadValidation.valid) {
      return res.status(400).json({ error: payloadValidation.error, requestId: req.id });
    }

    const result = await transcribeAudioService(parsed.audioData, payloadValidation.safeMimeType || 'audio/webm');
    res.json({
      success: true,
      data: result,
    });
  } catch (error) {
    next(error);
  }
});

// Text-to-Speech Endpoint
app.post('/api/tts', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const parsed = TTSRequestSchema.parse(req.body);
    const validation = validateAndSanitizeInput(parsed.text, { maxLength: 600 });

    if (!validation.valid) {
      return res.status(400).json({ error: validation.error, requestId: req.id });
    }

    const result = await synthesizeSpeechService(validation.sanitized, parsed.voice);
    res.json(result);
  } catch (error) {
    next(error);
  }
});

// Diagnostic endpoint: Strictly disabled in production (including when NODE_ENV is unset/missing)
app.all('/api/security-test', (req: Request, res: Response) => {
  if (isProductionEnvironment() || req.method !== 'POST') {
    return res.status(404).json({ error: 'Endpoint unavailable in production', requestId: req.id });
  }

  const { testType, payload } = req.body || {};

  if (testType === 'input_validation') {
    const result = validateAndSanitizeInput(payload);
    return res.json({
      testType,
      passed: result.valid,
      sanitized: result.sanitized,
      flags: result.flags,
      error: result.error,
    });
  }

  if (testType === 'rate_limit_probe') {
    const testIp = '198.51.100.' + (Math.floor(Math.random() * 200) + 1);
    const probeResults = [];
    for (let i = 0; i < 5; i++) {
      probeResults.push(checkRateLimit(testIp, 3, 10000));
    }
    return res.json({
      testType,
      probeResults,
      blockedAfterLimit: probeResults[3].allowed === false,
    });
  }

  return res.json({ status: 'unknown_test' });
});

// ==========================================
// 8. Centralized Error Handling Middleware
// ==========================================

app.use((err: any, req: Request, res: Response, _next: NextFunction) => {
  // Handle Zod schema validation errors cleanly with HTTP 400
  if (err instanceof ZodError) {
    const firstIssue = err.issues[0];
    const message = firstIssue 
      ? `${firstIssue.path.join('.') || 'body'}: ${firstIssue.message}` 
      : 'Invalid request payload';
    return res.status(400).json({
      error: message,
      requestId: req.id,
    });
  }

  // Handle payload too large errors
  if (err?.type === 'entity.too.large' || err?.status === 413) {
    return res.status(413).json({
      error: 'Payload Too Large. Please reduce request payload size.',
      requestId: req.id,
    });
  }

  // Handle malformed JSON syntax errors
  if (err instanceof SyntaxError && 'status' in err && (err as any).status === 400) {
    return res.status(400).json({
      error: 'Malformed JSON payload.',
      requestId: req.id,
    });
  }

  // Handle transient upstream provider errors
  const status = err?.status || err?.code;
  const msg = String(err?.message || '');
  const isHighDemand = status === 503 || msg.includes('503') || msg.includes('high demand') || msg.includes('UNAVAILABLE');

  if (isHighDemand) {
    return res.status(503).json({
      error: 'Service temporarily under high demand. Please try again shortly.',
      requestId: req.id,
    });
  }

  // Server-side logging without leaking secrets or user data
  console.error(`[Server Error][${req.id}] ${err?.name || 'Error'}: ${err?.message || 'Unexpected failure'}`);

  // Only return detailed error messages in explicit development mode
  const isExplicitDev = resolveNodeEnv(process.env.NODE_ENV) === 'development';
  res.status(500).json({
    error: isExplicitDev ? err?.message || 'Internal Server Error' : 'Unable to process the request.',
    requestId: req.id,
  });
});

// ==========================================
// 9. Vite & Static Serving Configuration
// ==========================================

async function startServer() {
  // Startup environment & security configuration verification (throws on invalid NODE_ENV or RATE_LIMIT_*)
  validateEnvironment({ throwOnFatal: true });

  const resolvedEnv = resolveNodeEnv(process.env.NODE_ENV);

  // Vite dev middleware is enabled ONLY when NODE_ENV is explicitly 'development' or 'test'
  if (resolvedEnv === 'development' || resolvedEnv === 'test') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const fs = await import('fs');
    const candidatePath1 = path.join(process.cwd(), 'dist');
    const candidatePath2 = path.join(__dirname, 'dist');
    const distPath = fs.existsSync(candidatePath1) 
      ? candidatePath1 
      : (fs.existsSync(candidatePath2) ? candidatePath2 : __dirname);

    app.use(express.static(distPath));
    app.get('*', (req: Request, res: Response) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`[LingoPro] Server listening at http://0.0.0.0:${PORT} (${resolvedEnv})`);
  });
}

// Export app for serverless platforms (Netlify Functions, Vercel, AWS Lambda)
export default app;
export { app };

// Start standalone HTTP listener if not running in a serverless environment
if (!process.env.VERCEL && !process.env.NETLIFY && !process.env.AWS_LAMBDA_FUNCTION_NAME) {
  startServer();
}
