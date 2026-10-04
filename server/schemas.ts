import { z } from 'zod';

/**
 * Strict server-side allowlists for domain models.
 * Frontend validation is never trusted; every input must match these exact enumerations.
 */

export const VALID_RECIPIENT_ROLES = [
  'Manager / Supervisor',
  'Client / Customer',
  'Team / Colleague',
  'HR Department',
  'Professor / Instructor',
  'Executive / Director',
] as const;

export type ValidRecipientRole = (typeof VALID_RECIPIENT_ROLES)[number];

export const VALID_TONE_STYLES = [
  'natural',
  'friendly',
  'professional',
  'formal',
  'executive',
  'short',
] as const;

export type ValidToneStyle = (typeof VALID_TONE_STYLES)[number];

export const VALID_TARGET_LANGUAGES = ['si', 'en', 'auto'] as const;
export type ValidTargetLanguage = (typeof VALID_TARGET_LANGUAGES)[number];

export const ALLOWED_AUDIO_MIME_TYPES = [
  'audio/webm',
  'audio/wav',
  'audio/wave',
  'audio/x-wav',
  'audio/mpeg',
  'audio/mp3',
  'audio/mp4',
  'audio/aac',
  'audio/ogg',
  'audio/opus',
] as const;

export type AllowedAudioMimeType = (typeof ALLOWED_AUDIO_MIME_TYPES)[number];

/**
 * Schema for /api/process
 */
export const ProcessRequestSchema = z.object({
  text: z
    .string()
    .min(1, 'Text input cannot be empty')
    .max(5000, 'Text input exceeds maximum limit of 5000 characters'),
}).strict();

export type ProcessRequest = z.infer<typeof ProcessRequestSchema>;

/**
 * Schema for /api/translate
 */
export const TranslateRequestSchema = z.object({
  text: z
    .string()
    .min(1, 'Text input cannot be empty')
    .max(5000, 'Text input exceeds maximum limit of 5000 characters'),
  targetLang: z
    .enum(VALID_TARGET_LANGUAGES)
    .default('auto'),
}).strict();

export type TranslateRequest = z.infer<typeof TranslateRequestSchema>;

/**
 * Schema for /api/professionalize
 */
export const ProfessionalizeRequestSchema = z.object({
  text: z
    .string()
    .min(1, 'Text input cannot be empty')
    .max(5000, 'Text input exceeds maximum limit of 5000 characters'),
  style: z
    .enum(VALID_TONE_STYLES)
    .default('professional'),
}).strict();

export type ProfessionalizeRequest = z.infer<typeof ProfessionalizeRequestSchema>;

/**
 * Schema for /api/email
 * Prevents recipientRole and style injection by enforcing strict allowlists.
 */
export const EmailRequestSchema = z.object({
  request: z
    .string()
    .min(1, 'Request prompt cannot be empty')
    .max(5000, 'Request prompt exceeds maximum limit of 5000 characters'),
  style: z
    .enum(VALID_TONE_STYLES)
    .default('professional'),
  recipientRole: z
    .enum(VALID_RECIPIENT_ROLES)
    .default('Manager / Supervisor'),
}).strict();

export type EmailRequest = z.infer<typeof EmailRequestSchema>;

/**
 * Schema for /api/stt
 */
export const STTRequestSchema = z.object({
  audioData: z
    .string()
    .min(10, 'audioData is too short or empty')
    .max(15 * 1024 * 1024, 'audioData payload exceeds maximum size limit'),
  mimeType: z
    .string()
    .optional()
    .default('audio/webm'),
}).strict();

export type STTRequest = z.infer<typeof STTRequestSchema>;

/**
 * Schema for /api/tts
 */
export const TTSRequestSchema = z.object({
  text: z
    .string()
    .min(1, 'Text cannot be empty')
    .max(600, 'Text exceeds maximum length of 600 characters for TTS'),
  voice: z
    .string()
    .max(50, 'Voice parameter too long')
    .optional()
    .default('Kore'),
}).strict();

export type TTSRequest = z.infer<typeof TTSRequestSchema>;
