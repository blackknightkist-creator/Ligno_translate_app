/**
 * Client-side Security and Validation Utilities
 */

import { SecurityStatus } from '../types';

export const MAX_ALLOWED_CHARS = 5000;

/**
 * Sanitizes input text by neutralizing script tags, event handlers, and javascript: protocols,
 * while preserving valid Sinhala Unicode characters, ZWJ (\u200D), and punctuation.
 */
export function sanitizeTextInput(input: string): string {
  if (!input) return '';
  return input
    .normalize('NFC')
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    .replace(/on\w+\s*=\s*(["']).*?\1/gi, '')
    .replace(/on\w+\s*=\s*[^\s>]+/gi, '')
    .replace(/javascript\s*:/gi, '')
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F-\u009F]/g, '')
    .trim();
}

/**
 * Validates text on the client before submission.
 * Preserves Sinhala Unicode, ZWJ (\u200D), ZWNJ (\u200C).
 */
export function validateClientInput(text: string): SecurityStatus {
  const normalized = text.normalize('NFC');
  const count = normalized.length;

  const hasSinhalaUnicode = /[\u0D80-\u0DFF]/.test(normalized);

  // Common Singlish word roots
  const singlishKeywords = [
    'mata', 'heta', 'oya', 'karanna', 'enna', 'baha', 'puluwan', 
    'kiyanna', 'thiyenawa', 'danna', 'kohomada', 'subha', 'wadak'
  ];
  const words = normalized.toLowerCase().split(/\s+/);
  const hasSinglishCharacteristics = !hasSinhalaUnicode && words.some(w => singlishKeywords.includes(w.replace(/[^a-z]/g, '')));

  let warning: string | undefined;
  if (count > MAX_ALLOWED_CHARS) {
    warning = `Character limit exceeded (${count}/${MAX_ALLOWED_CHARS}). Please shorten your input.`;
  }

  // Strip non-printable control chars except newlines and tabs
  const sanitized = normalized.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F-\u009F]/g, '');

  return {
    passed: count > 0 && count <= MAX_ALLOWED_CHARS,
    sanitized,
    warning,
    characterCount: count,
    hasSinhalaUnicode,
    hasSinglishCharacteristics,
  };
}

/**
 * HTML Escaper to prevent any accidental injection if rendering user content
 */
export function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
