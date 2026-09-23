# LingoPro — Sinhala ↔ English Voice & Professional Communication Assistant

A modern, privacy-first, bilingual translation and AI communication workspace. Built with React 19, TypeScript, Express, Tailwind CSS, and the Google Gemini AI TypeScript SDK (`@google/genai`).

---

## 🌟 Key Features

- **Bidirectional Sinhala ↔ English Translation**: Natural, context-aware translations with phonetic Singlish conversion.
- **Tone Professionalization**: Convert informal drafts into Polished Professional, Formal, Friendly, Executive, or Direct business tones.
- **Executive Email Generator**: Generate bilingual ready-to-send workplace emails with formal/informal tone toggles and one-click copy.
- **Hardware Voice Speech-to-Text (STT)**: High-fidelity voice capture with Web Audio API real-time equalizer metering and Gemini Multimodal audio processing.
- **Bilingual Text-to-Speech (TTS)**: Built-in native speech synthesis with play, pause, resume, and stop controls.
- **Hardened Security**: Protected against XSS, Prompt Injection, DoS, and CORS/CSRF. Built with zero database persistence for total privacy.

---

## 🚀 Quick Start

### 1. Clone the repository
```bash
git clone https://github.com/YOUR_USERNAME/YOUR_REPO.git
cd YOUR_REPO
```

### 2. Install dependencies
```bash
npm install
```

### 3. Configure environment variables
Copy the example environment file and add your Gemini API key:
```bash
cp .env.example .env
```
Edit `.env`:
```env
GEMINI_API_KEY=your_gemini_api_key_here
PORT=3000
NODE_ENV=production
```

### 4. Run Development Server
```bash
npm run dev
```
Open [http://localhost:3000](http://localhost:3000) in your browser.

---

## 📦 Deployment (Render, Railway, or VPS)

This is a fullstack Node.js + Express application.

- **Build Command**: `npm run build`
- **Start Command**: `npm start`
- **Environment Variable**: `GEMINI_API_KEY` (Add your Google Gemini API key in your host's dashboard)

---

## 🛡️ Security Architecture

- **Stateless Privacy**: Zero persistent storage of audio or translations on the server.
- **Input Sanitization**: Unicode NFC normalization, ZWJ/ZWNJ preservation, and strict length capping.
- **Defensive Boundary Fencing**: Prompt-injection quarantine shields prior to Gemini API invocation.
- **Rate Limiting**: Sliding-window IP rate limiting to prevent resource exhaustion.
- **Security Headers**: HSTS, X-Content-Type-Options, X-Frame-Options, and Referrer-Policy enforced.
