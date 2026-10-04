# LingoPro — Sinhala ↔ English Voice & Professional Communication Assistant

A modern, privacy-first, bilingual translation and AI communication workspace. Built with React 19, TypeScript, Express, Tailwind CSS, and the Google Gemini AI TypeScript SDK (`@google/genai`).

---

## 🌟 Key Features

- **Bidirectional Sinhala ↔ English Translation**: Natural, context-aware translations with phonetic Singlish conversion.
- **Tone Professionalization**: Convert informal drafts into Polished Professional, Formal, Friendly, Executive, or Direct business tones.
- **Executive Email Generator**: Generate bilingual ready-to-send workplace emails with formal/informal tone toggles and one-click copy.
- **Hardware Voice Speech-to-Text (STT)**: High-fidelity voice capture with Web Audio API real-time equalizer metering and Gemini Multimodal audio processing.
- **Bilingual Text-to-Speech (TTS)**: Powered by `gemini-3.8-flash-tts` with native browser speech synthesis fallback (`si-LK` and `en-US`).
- **Defense-in-Depth Security**: Hardened against XSS, Prompt Injection, Payload Exhaustion, SSRF, and Spoofed IP Rate-Limit Evasion.

---

## 🤖 Supported AI Models

- **Primary Text & Translation**: `gemini-3.8-flash` (with automatic fallback to `gemini-3.1-flash-lite`)
- **Speech-to-Text (STT)**: `gemini-3.1-flash-lite` (with automatic fallback to `gemini-3.8-flash`)
- **Text-to-Speech (TTS)**: `gemini-3.8-flash-tts`
- **Optional Backup Failover Engine**: CometAPI (`gemini-2.5-flash`, `gpt-4o-mini`)

---

## 🚀 Quick Start

### 1. Clone the repository
```bash
git clone https://github.com/YOUR_USERNAME/YOUR_REPO.git
cd YOUR_REPO
```

### 2. Clean install dependencies
```bash
npm ci
```

### 3. Configure environment variables
Copy the example environment file and add your server-side credentials:
```bash
cp .env.example .env
```
Edit `.env`:
```env
NODE_ENV=development
GEMINI_API_KEY=your_gemini_api_key_here
UPSTASH_REDIS_REST_URL=your_upstash_redis_rest_url
UPSTASH_REDIS_REST_TOKEN=your_upstash_redis_rest_token
PORT=3000
```

> **CRITICAL PRODUCTION REQUIREMENTS**:
> - **Fail-Closed `NODE_ENV`**: If `NODE_ENV` is unset or empty, LingoPro defaults to `'production'` security posture. Unknown/invalid `NODE_ENV` values abort startup.
> - **Mandatory Production Redis**: Distributed rate limiting via Upstash Redis (`UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN`) is **mandatory** in production. If Redis is unconfigured or unreachable in production, protected API endpoints **FAIL CLOSED (`HTTP 503`)** and **never** fall back to process-local in-memory rate limiting.
> - **Development vs. Production**: Vite dev middleware, `/api/security-test`, and the frontend Security & QA Test Lab are enabled **only** in explicit `development` / `test` modes and are excluded/disabled in production.

### 4. Run Development Server
```bash
NODE_ENV=development npm run dev
```
Open [http://localhost:3000](http://localhost:3000) in your browser.

---

## 📦 Deployment (Netlify, Vercel, Render, Railway, or Cloud Run)

- **Clean Install Command**: `npm ci`
- **Build Command**: `npm run build`
- **Start Command**: `npm start`
- **Required Production Environment Variables**:
  - `NODE_ENV=production`
  - `GEMINI_API_KEY` (Server-side secret only; never prefix with `VITE_`)
  - `UPSTASH_REDIS_REST_URL` (Mandatory in production)
  - `UPSTASH_REDIS_REST_TOKEN` (Mandatory in production)
- **Optional Environment Variables** (must be finite positive integers `> 0` if set):
  - `COMET_API_KEY` (Server-side failover provider)
  - `RATE_LIMIT_AI_PER_MIN` (Default: `25`)
  - `RATE_LIMIT_AUDIO_PER_MIN` (Default: `15`)
  - `RATE_LIMIT_STANDARD_PER_MIN` (Default: `60`)
  - `RATE_LIMIT_DAILY_QUOTA` (Default: `500`)

---

## 🛡️ Security Architecture

- **Pre-Parser Rate Limiting & Scoped Body Limits**: Rate limiting executes before JSON body parsing. Global JSON body payloads are capped at `256kb`, while `15mb` is permitted strictly on `/api/stt` after rate-limit clearance.
- **IPv6 `/64` Prefix Aggregation**: Prevents IPv6 address-rotation rate-limit bypasses by normalizing IPv6 addresses to their `/64` routing prefix before salted SHA-256 hashing. Raw IPs are never stored in Redis or printed in logs.
- **Input Sanitization & Prompt Fencing**: Strict Zod schemas, Unicode NFC normalization, Sinhala ZWJ (`\u200D`)/ZWNJ (`\u200C`) preservation, contextual prompt-injection detection, and structural delimiter fencing (`<<<USER_INPUT_START>>>` ... `<<<USER_INPUT_END>>>`).
- **AI Output Trust Boundary**: Untrusted AI JSON responses have protected server metadata keys (`detectedLanguage`, `targetLanguage`, `timestamp`, `_provider`, `provider`, `requestId`, `securityFlags`, etc.) stripped before server-controlled metadata is attached.
- **Audio Payload Verification**: Pre-decode Base64 size validation (10MB decoded max), binary magic-byte inspection, and strict MIME-to-container signature matching.
- **Security Headers**: Synchronized across Express (`server.ts`), Netlify (`netlify.toml`), and Vercel (`vercel.json`) — enforcing CSP, HSTS (`max-age=31536000; includeSubDomains; preload`), `X-Content-Type-Options: nosniff`, `Referrer-Policy`, and `Permissions-Policy`.
