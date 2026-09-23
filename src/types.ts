/**
 * LingoPro Shared Types
 * Production-ready typing for Sinhala ↔ English Voice & Professional Assistant
 */

export type LanguageCode = 'si' | 'en' | 'singlish' | 'mixed' | 'auto';

export interface DetectedLanguageInfo {
  code: 'si' | 'en' | 'singlish' | 'mixed';
  confidence: number;
  label: string;
  isSinglish: boolean;
  script: 'sinhala' | 'latin' | 'mixed';
}

export type ToneStyle = 'natural' | 'friendly' | 'professional' | 'formal' | 'executive' | 'short';

export interface TranslationResult {
  originalText: string;
  detectedLanguage: DetectedLanguageInfo;
  targetLanguage: 'en' | 'si';
  translatedText: string;
  singlishInSinhalaScript?: string;
  naturalAlternative?: string;
  grammarNotes?: string[];
  preservedEntities?: { type: string; value: string }[];
  pronunciationGuide?: string;
  detectedTone?: string;
  timestamp: number;
}

export interface ProfessionalizeResult {
  originalText: string;
  sourceLanguage: 'si' | 'en' | 'singlish';
  style: ToneStyle;
  improvedText: string;
  alternativeVariations: {
    natural: string;
    friendly: string;
    professional: string;
    formal: string;
    executive: string;
    short: string;
  };
  changesExplanation: string[];
  timestamp: number;
}

export interface EmailResult {
  originalRequest: string;
  sourceLanguage: string;
  style: ToneStyle;
  subject: string;
  greeting: string;
  body: string;
  closing: string;
  signaturePlaceholder: string;
  fullEmailText: string;
  detectedIntent: string;
  timestamp: number;
}

export interface UnifiedProcessResult {
  detectedLanguage: DetectedLanguageInfo;
  sinhalaUnicode: string;
  englishTranslation: string;
  professionalEnglish: string;
  professionalSinhala: string;
  styleVariations: Record<ToneStyle, string>;
  grammarCorrection?: string;
  suggestedAction?: 'translate' | 'professionalize' | 'email';
  timestamp: number;
}

export interface HistoryItem {
  id: string;
  timestamp: number;
  mode: 'unified' | 'translate' | 'professionalize' | 'email' | 'voice';
  inputText: string;
  inputLanguage: string;
  primaryOutput: string;
  secondaryOutput?: string;
  metadata?: {
    style?: ToneStyle;
    targetLang?: string;
    subject?: string;
  };
}

export interface SecurityStatus {
  passed: boolean;
  sanitized: string;
  warning?: string;
  characterCount: number;
  hasSinhalaUnicode: boolean;
  hasSinglishCharacteristics: boolean;
}

export interface AppSettings {
  preferredTargetLang: 'en' | 'si' | 'auto';
  defaultTone: ToneStyle;
  enableVoiceInterim: boolean;
  autoDetectLanguage: boolean;
  storeHistoryLocally: boolean;
  ttsVoicePreference: 'auto' | 'sinhala' | 'english';
  highContrastMode: boolean;
}
