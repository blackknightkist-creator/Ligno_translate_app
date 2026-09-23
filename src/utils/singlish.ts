/**
 * Singlish & Sinhala Language Data and Utilities
 */

export interface PresetSample {
  id: string;
  category: 'singlish' | 'sinhala' | 'english' | 'email';
  title: string;
  input: string;
  description: string;
}

export const SAMPLE_PROMPTS: PresetSample[] = [
  {
    id: 'singlish-meeting',
    category: 'singlish',
    title: 'Meeting Absence (Singlish)',
    input: 'mata heta meeting ekata enna baha',
    description: 'Casual Singlish request to excuse absence from a meeting tomorrow',
  },
  {
    id: 'sinhala-reschedule',
    category: 'sinhala',
    title: 'Reschedule Request (Sinhala)',
    input: 'මට හෙට පැවැත්වීමට නියමිත රැස්වීම වෙනත් දිනයකට යොමු කිරීමට අවශ්‍යයි.',
    description: 'Formal Sinhala requesting to postpone a meeting',
  },
  {
    id: 'singlish-email-prompt',
    category: 'email',
    title: 'Leave Request to Manager (Singlish)',
    input: 'Manager ta kiyanna heta meeting ekata enna baha kiyala urgent personal reason ekak nisa.',
    description: 'Direct instruction in Singlish to draft an official email',
  },
  {
    id: 'english-colloquial',
    category: 'english',
    title: 'Casual Follow-up (English)',
    input: 'send me the document quickly as I need it for the review',
    description: 'Casual English request to elevate into executive/formal tone',
  },
  {
    id: 'singlish-invoice',
    category: 'singlish',
    title: 'Payment Followup (Singlish)',
    input: 'Sir ta kiyanna thama invoice eka approve wela naha, ikmanin update ekak dhenna puluwanda kiyala',
    description: 'Professional invoice follow-up request in Singlish',
  },
  {
    id: 'sinhala-welcome',
    category: 'sinhala',
    title: 'Formal Welcome (Sinhala)',
    input: 'අපගේ ආයතනය වෙත ඔබව සාදරයෙන් පිළිගනිමු. ඕනෑම සහයක් සඳහා අප අමතන්න.',
    description: 'Institutional greeting in formal Sinhala Unicode',
  },
];

/**
 * Phonetic quick map for common Singlish consonants & vowels
 * Helpful for users who want to know how Singlish maps to Sinhala
 */
export const SINGLISH_CHEAT_SHEET = [
  { singlish: 'a / aa', sinhala: 'අ / ආ', example: 'amma (අම්මා)' },
  { singlish: 'ka / kha', sinhala: 'ක / ඛ', example: 'karanna (කරන්න)' },
  { singlish: 'ga / gha', sinhala: 'ග / ඝ', example: 'gedhara (ගෙදර)' },
  { singlish: 'tha / da', sinhala: 'ත / ද', example: 'thaththa (තාත්තා)' },
  { singlish: 'ta / da', sinhala: 'ට / ඩ', example: 'tikak (ටිකක්)' },
  { singlish: 'ba / bha', sinhala: 'බ / භ', example: 'baha (බැහැ)' },
  { singlish: 'ma / ya / ra', sinhala: 'ම / ය / ර', example: 'mata (මට)' },
  { singlish: 'nisa / heta', sinhala: 'නිසා / හෙට', example: 'urgent nisa (හදිසි නිසා)' },
];
