/**
 * LingoPro Production Server
 * Express + Vite Full-Stack Application
 * 
 * Features:
 * - Defense-in-depth security middleware
 * - Rate limiting
 * - Server-side Gemini AI orchestration
 * - Production static serving & Vite development middleware
 */

import express, { Request, Response, NextFunction } from 'express';
import path from 'path';
import dotenv from 'dotenv';
import { createServer as createViteServer } from 'vite';
import {
  validateAndSanitizeInput,
  checkRateLimit,
  validateAudioPayload,
} from './server/security';
import {
  processUnifiedInput,
  translateTextService,
  professionalizeTextService,
  generateEmailService,
  transcribeAudioService,
  synthesizeSpeechService,
} from './server/aiService';

dotenv.config();

const app = express();
const PORT = 3000;

// Security: Enforce JSON body size limit (prevent denial of service via memory bloating)
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Security: HTTP Security Headers
app.use((req: Request, res: Response, next: NextFunction) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'SAMEORIGIN');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  next();
});

// Security: In-memory Rate Limiting Middleware for API routes
app.use('/api', (req: Request, res: Response, next: NextFunction) => {
  // Identify client safely (respect proxy headers if present)
  const clientIp = (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() || req.socket.remoteAddress || 'unknown-client';
  
  // High-volume limit: 60 requests/minute for light endpoints, 25/minute for heavy AI
  const isHeavyAi = ['/process', '/translate', '/professionalize', '/email', '/stt'].some(path => req.path.startsWith(path));
  const limit = isHeavyAi ? 25 : 60;

  const rateCheck = checkRateLimit(clientIp, limit, 60 * 1000);
  if (!rateCheck.allowed) {
    res.setHeader('Retry-After', rateCheck.retryAfterSec || 30);
    return res.status(429).json({
      error: 'Too many requests. Please try again shortly.',
      retryAfter: rateCheck.retryAfterSec,
    });
  }

  next();
});

// ==========================================
// API Routes
// ==========================================

// Health Check & Security Diagnostics
app.get('/api/health', (req: Request, res: Response) => {
  const hasGeminiKey = Boolean(process.env.GEMINI_API_KEY);
  res.json({
    status: 'ok',
    service: 'LingoPro AI Assistant',
    version: '1.0.0',
    hasApiKey: hasGeminiKey,
    timestamp: Date.now(),
  });
});

// Unified Processing (Auto-detect -> Translate -> Professionalize)
app.post('/api/process', async (req: Request, res: Response) => {
  try {
    const { text } = req.body;
    const validation = validateAndSanitizeInput(text, { maxLength: 5000 });

    if (!validation.valid) {
      return res.status(400).json({ error: validation.error, flags: validation.flags });
    }

    const result = await processUnifiedInput(validation.sanitized, validation.flags);
    res.json({
      success: true,
      data: result,
      securityFlags: validation.flags,
    });
  } catch (error: any) {
    console.error('[API /process error]:', error?.message || error);
    res.status(500).json({
      error: 'Sorry, I could not process that request. Please try again.',
      details: process.env.NODE_ENV === 'development' ? error?.message : undefined,
    });
  }
});

// Dedicated Translation Endpoint
app.post('/api/translate', async (req: Request, res: Response) => {
  try {
    const { text, targetLang } = req.body;
    const validation = validateAndSanitizeInput(text, { maxLength: 5000 });

    if (!validation.valid) {
      return res.status(400).json({ error: validation.error, flags: validation.flags });
    }

    const safeTarget = targetLang === 'si' || targetLang === 'en' ? targetLang : 'auto';
    const result = await translateTextService(validation.sanitized, safeTarget);

    res.json({
      success: true,
      data: result,
      securityFlags: validation.flags,
    });
  } catch (error: any) {
    console.error('[API /translate error]:', error?.message || error);
    res.status(500).json({
      error: 'Sorry, I could not translate that text. Please try again.',
    });
  }
});

// Dedicated Professionalization Endpoint
app.post('/api/professionalize', async (req: Request, res: Response) => {
  try {
    const { text, style } = req.body;
    const validation = validateAndSanitizeInput(text, { maxLength: 5000 });

    if (!validation.valid) {
      return res.status(400).json({ error: validation.error, flags: validation.flags });
    }

    const validStyles = ['natural', 'friendly', 'professional', 'formal', 'executive', 'short'];
    const safeStyle = validStyles.includes(style) ? style : 'professional';

    const result = await professionalizeTextService(validation.sanitized, safeStyle);
    res.json({
      success: true,
      data: result,
      securityFlags: validation.flags,
    });
  } catch (error: any) {
    console.error('[API /professionalize error]:', error?.message || error);
    res.status(500).json({
      error: 'Sorry, I could not improve that text. Please try again.',
    });
  }
});

// Dedicated Email Generator Endpoint
app.post('/api/email', async (req: Request, res: Response) => {
  try {
    const { request, style, recipientRole } = req.body;
    const validation = validateAndSanitizeInput(request, { maxLength: 5000 });

    if (!validation.valid) {
      return res.status(400).json({ error: validation.error, flags: validation.flags });
    }

    const validStyles = ['natural', 'friendly', 'professional', 'formal', 'executive', 'short'];
    const safeStyle = validStyles.includes(style) ? style : 'professional';

    const result = await generateEmailService(validation.sanitized, safeStyle, recipientRole);
    res.json({
      success: true,
      data: result,
      securityFlags: validation.flags,
    });
  } catch (error: any) {
    console.error('[API /email error]:', error?.message || error);
    res.status(500).json({
      error: 'Sorry, I could not generate the email. Please try again.',
    });
  }
});

// Speech-to-Text Endpoint (Accepts base64 audio and transcribes via Gemini)
app.post('/api/stt', async (req: Request, res: Response) => {
  try {
    const { audioData, mimeType } = req.body;
    const payloadValidation = validateAudioPayload(audioData);

    if (!payloadValidation.valid) {
      return res.status(400).json({ error: payloadValidation.error });
    }

    const rawMimeType = typeof mimeType === 'string' && mimeType.startsWith('audio/') 
      ? mimeType 
      : 'audio/webm';
    const safeMimeType = rawMimeType.split(';')[0].trim();

    const result = await transcribeAudioService(audioData, safeMimeType);
    res.json({
      success: true,
      data: result,
    });
  } catch (error: any) {
    console.error('[API /stt error]:', error?.message || error);
    const msg = String(error?.message || '');
    const isHighDemand = error?.status === 503 || msg.includes('503') || msg.includes('high demand') || msg.includes('UNAVAILABLE');
    res.status(isHighDemand ? 503 : 500).json({
      error: isHighDemand
        ? 'Speech recognition service is experiencing high traffic. Please try speaking again in a few moments or use text input.'
        : 'Failed to transcribe audio. You may also speak using browser speech recognition or type your message.',
    });
  }
});

// Text-to-Speech Endpoint
app.post('/api/tts', async (req: Request, res: Response) => {
  try {
    const { text, voice } = req.body;
    const validation = validateAndSanitizeInput(text, { maxLength: 600 });

    if (!validation.valid) {
      return res.status(400).json({ error: validation.error });
    }

    const result = await synthesizeSpeechService(validation.sanitized, voice);
    res.json(result);
  } catch (error: any) {
    console.error('[API /tts error]:', error?.message || error);
    res.json({ success: false, fallbackToBrowser: true });
  }
});

// Security & Functional Diagnostic Runner Endpoint
app.post('/api/security-test', (req: Request, res: Response) => {
  const { testType, payload } = req.body;
  
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
    const testIp = 'test-client-sandbox-' + Date.now();
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

  res.json({ status: 'unknown_test' });
});

// ==========================================
// Vite Middleware & Static Serving Setup
// ==========================================

async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req: Request, res: Response) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`LingoPro Server running at http://0.0.0.0:${PORT}`);
  });
}

startServer();
