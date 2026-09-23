import React, { useState } from 'react';
import { 
  Mail, 
  Loader2, 
  AlertCircle, 
  Copy, 
  Check, 
  Sparkles, 
  Edit3, 
  RefreshCw, 
  Share2, 
  Volume2,
  FileText,
  UserCheck
} from 'lucide-react';
import { VoiceInputButton, TtsPlayer } from './AudioControls';
import { CharacterCounter } from './CharacterCounter';
import { addHistoryItem } from '../utils/storage';
import { EmailResult, ToneStyle } from '../types';

interface EmailViewProps {
  initialPrompt?: string;
}

export const EmailView: React.FC<EmailViewProps> = ({ initialPrompt = '' }) => {
  const [requestText, setRequestText] = useState(initialPrompt);
  const [recipientRole, setRecipientRole] = useState('Manager');
  const [style, setStyle] = useState<ToneStyle>('professional');
  const [isLoading, setIsLoading] = useState(false);
  const [emailResult, setEmailResult] = useState<EmailResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copiedSection, setCopiedSection] = useState<string | null>(null);
  const [isEditing, setIsEditing] = useState(false);

  // Editable email parts
  const [subject, setSubject] = useState('');
  const [greeting, setGreeting] = useState('');
  const [body, setBody] = useState('');
  const [closing, setClosing] = useState('');
  const [signature, setSignature] = useState('');

  const emailStyles: { id: ToneStyle; label: string }[] = [
    { id: 'formal', label: 'Formal' },
    { id: 'professional', label: 'Professional' },
    { id: 'friendly', label: 'Friendly Professional' },
    { id: 'executive', label: 'Executive' },
    { id: 'short', label: 'Short' },
  ];

  const recipientRoles = [
    'Manager / Supervisor',
    'Client / Customer',
    'Team / Colleague',
    'HR Department',
    'Professor / Instructor',
    'Executive / Director',
  ];

  const handleGenerate = async (promptToUse = requestText, styleToUse = style) => {
    const text = promptToUse.trim();
    if (!text) return;

    setIsLoading(true);
    setError(null);
    setIsEditing(false);

    try {
      const response = await fetch('/api/email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          request: text,
          style: styleToUse,
          recipientRole,
        }),
      });

      const resData = await response.json();
      if (!response.ok || !resData.success) {
        throw new Error(resData.error || 'Failed to generate email.');
      }

      const emailData: EmailResult = resData.data;
      setEmailResult(emailData);

      setSubject(emailData.subject);
      setGreeting(emailData.greeting);
      setBody(emailData.body);
      setClosing(emailData.closing);
      setSignature(emailData.signaturePlaceholder);

      addHistoryItem({
        mode: 'email',
        inputText: text,
        inputLanguage: emailData.sourceLanguage,
        primaryOutput: emailData.fullEmailText,
        metadata: {
          style: styleToUse,
          subject: emailData.subject,
        },
      });
    } catch (err: any) {
      setError(err.message || 'Error occurred generating email.');
    } finally {
      setIsLoading(false);
    }
  };

  const fullEmailContent = `${subject ? `Subject: ${subject}\n\n` : ''}${greeting}\n\n${body}\n\n${closing}\n${signature}`;

  const copyToClipboard = async (text: string, sectionId: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedSection(sectionId);
      setTimeout(() => setCopiedSection(null), 2000);
    } catch (_) {}
  };

  const handleShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: subject || 'Professional Email',
          text: fullEmailContent,
        });
      } catch (_) {}
    } else {
      copyToClipboard(fullEmailContent, 'full');
    }
  };

  return (
    <div className="max-w-4xl mx-auto px-4 py-6 sm:py-8 space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold text-slate-900 dark:text-white">
          Professional Business Email Generator
        </h2>
        <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400">
          State your message simply in Sinhala, Singlish, or English. LingoPro constructs a properly structured, respectful business email.
        </p>
      </div>

      {/* Input Configuration Card */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 p-4 sm:p-6 space-y-4">
        {/* Recipient & Tone Controls */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-1">
              Recipient Role:
            </label>
            <select
              id="email-recipient-select"
              value={recipientRole}
              onChange={(e) => setRecipientRole(e.target.value)}
              className="w-full text-xs font-medium bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg p-2.5 text-slate-800 dark:text-slate-200 focus:ring-2 focus:ring-indigo-500"
            >
              {recipientRoles.map((role) => (
                <option key={role} value={role}>
                  {role}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-1">
              Tone &amp; Formality:
            </label>
            <div className="flex flex-wrap gap-1">
              {emailStyles.map((s) => (
                <button
                  key={s.id}
                  id={`email-tone-${s.id}`}
                  type="button"
                  onClick={() => {
                    setStyle(s.id);
                    if (emailResult) handleGenerate(requestText, s.id);
                  }}
                  className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                    style === s.id
                      ? 'bg-indigo-600 text-white shadow-xs'
                      : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
                  }`}
                >
                  {s.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Input prompt */}
        <div className="space-y-2">
          <div className="flex items-center justify-between text-xs text-slate-500">
            <span className="font-semibold uppercase tracking-wider">What would you like to communicate?</span>
            <CharacterCounter currentLength={requestText.length} maxLength={5000} compact />
          </div>
          <textarea
            id="email-request-input"
            rows={3}
            value={requestText}
            onChange={(e) => setRequestText(e.target.value)}
            placeholder="e.g., 'Manager ta kiyanna heta meeting ekata enna baha kiyala urgent medical appointment ekak nisa'..."
            className="w-full bg-slate-50/70 dark:bg-slate-950/70 border border-slate-200 dark:border-slate-800 rounded-xl p-3 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 text-base focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
          />
          <CharacterCounter currentLength={requestText.length} maxLength={5000} />
        </div>

        {/* Action button & voice input */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-2 border-t border-slate-100 dark:border-slate-800">
          <VoiceInputButton
            onTranscriptionReceived={(t) => {
              setRequestText(t);
              handleGenerate(t, style);
            }}
            preferredLanguage="si-LK"
            disabled={isLoading}
          />

          <button
            id="generate-email-btn"
            type="button"
            onClick={() => handleGenerate()}
            disabled={isLoading || !requestText.trim()}
            className="w-full sm:w-auto flex items-center justify-center gap-2 px-6 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-xs shadow-md shadow-indigo-500/25 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isLoading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Crafting Email...</span>
              </>
            ) : (
              <>
                <Mail className="w-4 h-4" />
                <span>Generate Professional Email</span>
              </>
            )}
          </button>
        </div>
      </div>

      {error && (
        <div className="p-3 rounded-lg bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 text-rose-700 dark:text-rose-300 text-xs flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Generated Email Preview Paper Card */}
      {emailResult && (
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/90 dark:border-slate-800 p-5 sm:p-7 shadow-sm space-y-5">
          {/* Action Bar atop email */}
          <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-slate-100 dark:border-slate-800">
            <div className="flex items-center gap-2">
              <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400">
                <FileText className="w-4 h-4" />
              </span>
              <span className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">
                Ready-to-Send Email ({style} Tone)
              </span>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setIsEditing(!isEditing)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
              >
                <Edit3 className="w-3.5 h-3.5" />
                <span>{isEditing ? 'Done Editing' : 'Edit'}</span>
              </button>

              <button
                id="copy-full-email-btn"
                type="button"
                onClick={() => copyToClipboard(fullEmailContent, 'full')}
                className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-semibold bg-indigo-600 hover:bg-indigo-700 text-white shadow-xs transition-colors"
              >
                {copiedSection === 'full' ? (
                  <>
                    <Check className="w-3.5 h-3.5 text-white" />
                    <span>Copied!</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5" />
                    <span>Copy Email</span>
                  </>
                )}
              </button>

              <button
                type="button"
                onClick={handleShare}
                className="p-1.5 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg"
                title="Share email"
              >
                <Share2 className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Email Canvas */}
          <div className="space-y-4 font-sans text-slate-900 dark:text-slate-100 text-sm leading-relaxed bg-slate-50/50 dark:bg-slate-950/40 p-4 sm:p-6 rounded-xl border border-slate-200/60 dark:border-slate-800/80">
            {/* Subject Line */}
            <div className="flex items-center justify-between pb-3 border-b border-slate-200/60 dark:border-slate-800">
              <div className="flex-1 pr-3">
                <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block">Subject:</span>
                {isEditing ? (
                  <input
                    type="text"
                    value={subject}
                    onChange={(e) => setSubject(e.target.value)}
                    className="w-full text-base font-bold bg-white dark:bg-slate-900 border border-indigo-300 dark:border-indigo-700 rounded p-1.5 text-slate-900 dark:text-white"
                  />
                ) : (
                  <h3 className="text-base font-bold text-slate-900 dark:text-white">{subject}</h3>
                )}
              </div>
              <button
                type="button"
                onClick={() => copyToClipboard(subject, 'subject')}
                className="text-xs text-indigo-600 dark:text-indigo-400 hover:underline shrink-0"
              >
                {copiedSection === 'subject' ? 'Copied' : 'Copy Subject'}
              </button>
            </div>

            {/* Salutation */}
            <div>
              {isEditing ? (
                <input
                  type="text"
                  value={greeting}
                  onChange={(e) => setGreeting(e.target.value)}
                  className="w-full bg-white dark:bg-slate-900 border border-indigo-300 dark:border-indigo-700 rounded p-1.5 text-sm"
                />
              ) : (
                <p className="font-semibold text-slate-800 dark:text-slate-200">{greeting}</p>
              )}
            </div>

            {/* Body */}
            <div>
              {isEditing ? (
                <textarea
                  rows={5}
                  value={body}
                  onChange={(e) => setBody(e.target.value)}
                  className="w-full bg-white dark:bg-slate-900 border border-indigo-300 dark:border-indigo-700 rounded p-2 text-sm leading-relaxed"
                />
              ) : (
                <p className="whitespace-pre-line text-slate-800 dark:text-slate-200 leading-relaxed font-normal">
                  {body}
                </p>
              )}
            </div>

            {/* Closing & Signature */}
            <div className="pt-2">
              {isEditing ? (
                <div className="space-y-1">
                  <input
                    type="text"
                    value={closing}
                    onChange={(e) => setClosing(e.target.value)}
                    className="w-full bg-white dark:bg-slate-900 border border-indigo-300 dark:border-indigo-700 rounded p-1 text-sm"
                  />
                  <textarea
                    rows={2}
                    value={signature}
                    onChange={(e) => setSignature(e.target.value)}
                    className="w-full bg-white dark:bg-slate-900 border border-indigo-300 dark:border-indigo-700 rounded p-1 text-sm"
                  />
                </div>
              ) : (
                <div className="text-slate-800 dark:text-slate-200 font-medium space-y-1">
                  <p>{closing}</p>
                  <p className="whitespace-pre-line text-slate-500 dark:text-slate-400 font-mono text-xs">{signature}</p>
                </div>
              )}
            </div>
          </div>

          {/* Audio listen & regenerate bar */}
          <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-100 dark:border-slate-800 text-xs">
            <TtsPlayer text={fullEmailContent} language="en" label="Listen to Full Email 🔊" />

            <button
              type="button"
              onClick={() => handleGenerate(requestText, style)}
              className="flex items-center gap-1 text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 font-medium"
            >
              <RefreshCw className="w-3 h-3" />
              <span>Regenerate Variation</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
