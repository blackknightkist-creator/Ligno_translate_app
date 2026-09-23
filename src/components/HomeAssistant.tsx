import React, { useState, useEffect } from 'react';
import { 
  Sparkles, 
  ArrowRight, 
  Loader2, 
  AlertCircle, 
  CheckCircle2, 
  RotateCcw, 
  Layers, 
  ArrowUpRight, 
  Zap,
  Info
} from 'lucide-react';
import { VoiceInputButton } from './AudioControls';
import { CharacterCounter } from './CharacterCounter';
import { ResultActionBar } from './ResultActionBar';
import { SAMPLE_PROMPTS } from '../utils/singlish';
import { validateClientInput } from '../utils/security';
import { addHistoryItem } from '../utils/storage';
import { UnifiedProcessResult, ToneStyle } from '../types';

interface HomeAssistantProps {
  onNavigateToEmail: (initialPrompt?: string) => void;
  onNavigateToTranslate: (initialText?: string) => void;
  onNavigateToProfessionalize: (initialText?: string) => void;
}

export const HomeAssistant: React.FC<HomeAssistantProps> = ({
  onNavigateToEmail,
  onNavigateToTranslate,
  onNavigateToProfessionalize,
}) => {
  const [inputText, setInputText] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState<UnifiedProcessResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selectedStyle, setSelectedStyle] = useState<ToneStyle>('professional');
  const [editableText, setEditableText] = useState('');
  const [isEditing, setIsEditing] = useState(false);

  // Live client-side security & language detection check
  const inputValidation = validateClientInput(inputText);

  // Reset editable text when style or result changes
  useEffect(() => {
    if (result) {
      setEditableText(result.styleVariations[selectedStyle] || result.englishTranslation);
    }
  }, [result, selectedStyle]);

  const handleProcess = async (textToProcess = inputText) => {
    const text = textToProcess.trim();
    if (!text) return;

    setIsLoading(true);
    setError(null);
    setIsEditing(false);

    try {
      const response = await fetch('/api/process', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text }),
      });

      const resData = await response.json();
      if (!response.ok || !resData.success) {
        throw new Error(resData.error || 'Failed to process communication request.');
      }

      const processData: UnifiedProcessResult = resData.data;
      setResult(processData);

      // Save to privacy-first local history
      addHistoryItem({
        mode: 'unified',
        inputText: text,
        inputLanguage: processData.detectedLanguage.label,
        primaryOutput: processData.styleVariations[selectedStyle] || processData.englishTranslation,
        secondaryOutput: processData.sinhalaUnicode,
        metadata: {
          style: selectedStyle,
        },
      });
    } catch (err: any) {
      setError(err.message || 'An unexpected error occurred.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleVoiceInput = (transcription: string) => {
    setInputText(transcription);
    handleProcess(transcription);
  };

  const handleSampleSelect = (sampleText: string) => {
    setInputText(sampleText);
    handleProcess(sampleText);
  };

  const handleToneChange = (tone: ToneStyle) => {
    setSelectedStyle(tone);
    if (result) {
      setEditableText(result.styleVariations[tone] || result.englishTranslation);
    }
  };

  const handleTranslateBack = () => {
    if (result) {
      // Put the current English or Sinhala back into the input and re-process
      setInputText(editableText || result.sinhalaUnicode);
      handleProcess(editableText || result.sinhalaUnicode);
    }
  };

  const availableStyles: { id: ToneStyle; label: string; desc: string }[] = [
    { id: 'professional', label: 'Professional', desc: 'Standard workplace communication' },
    { id: 'natural', label: 'Natural', desc: 'Fluent, conversational style' },
    { id: 'friendly', label: 'Friendly', desc: 'Warm, collaborative, polite' },
    { id: 'formal', label: 'Formal', desc: 'Corporate, official, diplomatic' },
    { id: 'executive', label: 'Executive', desc: 'Action-oriented leadership tone' },
    { id: 'short', label: 'Short & Direct', desc: 'Concise, zero fluff' },
  ];

  return (
    <div className="max-w-4xl mx-auto px-4 py-6 sm:py-8 space-y-6">
      {/* Visual Header */}
      <div className="text-center space-y-2">
        <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-900 dark:text-white">
          Sinhala ↔ English Smart Assistant
        </h1>
        <p className="text-sm text-slate-600 dark:text-slate-400 max-w-xl mx-auto">
          Type or speak in <span className="font-semibold text-indigo-600 dark:text-indigo-400">Sinhala Unicode</span>, <span className="font-semibold text-indigo-600 dark:text-indigo-400">English</span>, or <span className="font-semibold text-indigo-600 dark:text-indigo-400">Singlish</span>. LingoPro understands context, translates accurately, and elevates your message to executive quality.
        </p>
      </div>

      {/* Main Input Card */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-slate-200/80 dark:border-slate-800 p-4 sm:p-6 space-y-4">
        {/* Language Detection Chip & Status */}
        <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
          <div className="flex items-center gap-2">
            <span className="text-slate-500 dark:text-slate-400 font-medium">Input Detection:</span>
            {inputText.trim() ? (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-indigo-50 dark:bg-indigo-950/80 text-indigo-700 dark:text-indigo-300 font-semibold border border-indigo-200/60 dark:border-indigo-800/60">
                <span className="w-1.5 h-1.5 rounded-full bg-indigo-500 animate-pulse" />
                {inputValidation.hasSinhalaUnicode
                  ? 'Sinhala Unicode'
                  : inputValidation.hasSinglishCharacteristics
                  ? 'Singlish (Latin Sinhala)'
                  : 'English / Latin'}
              </span>
            ) : (
              <span className="text-slate-400 dark:text-slate-500 italic">Auto-detecting...</span>
            )}
          </div>

          <div className="flex items-center gap-3 text-slate-400 dark:text-slate-500">
            <span>{inputText.length} / 5000 chars</span>
            {inputText && (
              <button
                type="button"
                onClick={() => {
                  setInputText('');
                  setResult(null);
                  setError(null);
                }}
                className="text-xs text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 underline"
              >
                Clear
              </button>
            )}
          </div>
        </div>

        {/* Text Area */}
        <div className="relative space-y-2">
          <textarea
            id="main-assistant-input"
            rows={4}
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            placeholder="Type in Sinhala (මට හෙට...), Singlish (mata heta enna baha...), or English..."
            className="w-full p-4 rounded-xl bg-slate-50/70 dark:bg-slate-950/70 border border-slate-200 dark:border-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:focus:ring-indigo-400 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 text-base leading-relaxed transition-all resize-none font-sans"
            disabled={isLoading}
          />
          <CharacterCounter currentLength={inputText.length} maxLength={5000} />
        </div>

        {/* Input Validation Warning */}
        {inputValidation.warning && (
          <div className="flex items-center gap-1.5 text-xs text-amber-600 dark:text-amber-400">
            <AlertCircle className="w-3.5 h-3.5" />
            <span>{inputValidation.warning}</span>
          </div>
        )}

        {/* Action Controls: Prominent Mic + Understand & Refine Button */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-2">
          {/* Voice Input Section */}
          <div className="flex items-center gap-3 w-full sm:w-auto">
            <VoiceInputButton
              onTranscriptionReceived={handleVoiceInput}
              preferredLanguage="si-LK"
              disabled={isLoading}
            />
            <div className="text-xs text-slate-500 dark:text-slate-400">
              <p className="font-medium text-slate-700 dark:text-slate-300">Tap to speak</p>
              <p>Sinhala or English</p>
            </div>
          </div>

          {/* Primary Submit Button */}
          <button
            id="process-communication-btn"
            type="button"
            onClick={() => handleProcess()}
            disabled={isLoading || !inputText.trim()}
            className="w-full sm:w-auto flex items-center justify-center gap-2 px-6 py-3 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-sm shadow-md shadow-indigo-500/25 transition-all hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100"
          >
            {isLoading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Processing...</span>
              </>
            ) : (
              <>
                <Sparkles className="w-4 h-4" />
                <span>Understand &amp; Refine</span>
                <ArrowRight className="w-4 h-4" />
              </>
            )}
          </button>
        </div>

        {/* Quick Sample Presets */}
        {!result && (
          <div className="pt-2">
            <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2">
              Try a Quick Scenario:
            </p>
            <div className="flex flex-wrap gap-2">
              {SAMPLE_PROMPTS.map((sample) => (
                <button
                  key={sample.id}
                  id={`sample-prompt-${sample.id}`}
                  type="button"
                  onClick={() => handleSampleSelect(sample.input)}
                  className="text-xs px-3 py-1.5 rounded-lg bg-slate-100 dark:bg-slate-800/80 hover:bg-indigo-50 dark:hover:bg-indigo-950/50 hover:text-indigo-600 dark:hover:text-indigo-400 border border-slate-200/60 dark:border-slate-800 text-slate-700 dark:text-slate-300 transition-colors text-left"
                >
                  <span className="font-medium">{sample.title}</span>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Error Notification */}
      {error && (
        <div className="p-4 rounded-xl bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-900 text-rose-700 dark:text-rose-300 flex items-start gap-3">
          <AlertCircle className="w-5 h-5 shrink-0 mt-0.5 text-rose-600" />
          <div className="text-sm">
            <p className="font-semibold">Processing Notice</p>
            <p className="mt-0.5">{error}</p>
          </div>
        </div>
      )}

      {/* Result Display Section */}
      {result && (
        <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-slate-200/80 dark:border-slate-800 p-4 sm:p-6 space-y-6">
          {/* Result Header & Detected Intent */}
          <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-slate-100 dark:border-slate-800">
            <div className="flex items-center gap-2">
              <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400">
                <CheckCircle2 className="w-4 h-4" />
              </span>
              <div>
                <span className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                  Detected Input
                </span>
                <p className="text-sm font-bold text-slate-900 dark:text-slate-100">
                  {result.detectedLanguage.label}
                  {result.detectedLanguage.isSinglish && ' ➔ Converted to Sinhala & English'}
                </p>
              </div>
            </div>

            {/* Shortcut to Email */}
            <button
              type="button"
              id="goto-email-generator-btn"
              onClick={() => onNavigateToEmail(inputText)}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-indigo-700 dark:text-indigo-300 bg-indigo-50 dark:bg-indigo-950/60 rounded-lg hover:bg-indigo-100 dark:hover:bg-indigo-900/80 transition-colors"
            >
              <span>Draft as Email</span>
              <ArrowUpRight className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Bilingual Dual Output: Sinhala Unicode & English */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Sinhala Output Box */}
            <div className="p-4 rounded-xl bg-slate-50/80 dark:bg-slate-950/50 border border-slate-200/70 dark:border-slate-800/80 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase">
                  Sinhala Unicode (සිංහල)
                </span>
                <span className="text-[11px] text-slate-400">Natural Script</span>
              </div>
              <p className="text-base text-slate-900 dark:text-slate-100 font-medium leading-relaxed select-all">
                {result.sinhalaUnicode}
              </p>
            </div>

            {/* Direct English Translation Box */}
            <div className="p-4 rounded-xl bg-slate-50/80 dark:bg-slate-950/50 border border-slate-200/70 dark:border-slate-800/80 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase">
                  English Translation
                </span>
                <span className="text-[11px] text-slate-400">Accurate Context</span>
              </div>
              <p className="text-base text-slate-900 dark:text-slate-100 font-medium leading-relaxed select-all">
                {result.englishTranslation}
              </p>
            </div>
          </div>

          {/* Professional Tone Selector & Refinement Card */}
          <div className="space-y-3 pt-2">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div className="flex items-center gap-1.5">
                <Sparkles className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                <span className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">
                  Select Professional Style:
                </span>
              </div>

              {/* Factual Integrity Badge */}
              <div className="inline-flex items-center gap-1 text-[11px] text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/60 px-2 py-0.5 rounded-full border border-emerald-200/60 dark:border-emerald-900/60">
                <Info className="w-3 h-3" />
                <span>Facts &amp; dates strictly preserved</span>
              </div>
            </div>

            {/* Style Selector Pills */}
            <div className="flex flex-wrap gap-1.5">
              {availableStyles.map((style) => (
                <button
                  key={style.id}
                  id={`style-btn-${style.id}`}
                  type="button"
                  onClick={() => handleToneChange(style.id)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                    selectedStyle === style.id
                      ? 'bg-indigo-600 text-white shadow-xs'
                      : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
                  }`}
                  title={style.desc}
                >
                  {style.label}
                </button>
              ))}
            </div>

            {/* Main Interactive Output Box */}
            <div className="relative mt-3 p-4 rounded-xl bg-indigo-50/40 dark:bg-indigo-950/20 border border-indigo-100 dark:border-indigo-900/40">
              {isEditing ? (
                <textarea
                  value={editableText}
                  onChange={(e) => setEditableText(e.target.value)}
                  rows={3}
                  className="w-full p-2 bg-white dark:bg-slate-900 border border-indigo-300 dark:border-indigo-700 rounded-lg text-base text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500 font-medium"
                />
              ) : (
                <div className="space-y-1">
                  <div className="flex items-center justify-between text-xs text-indigo-700 dark:text-indigo-400 font-semibold mb-1">
                    <span className="capitalize">{selectedStyle} Style Output:</span>
                  </div>
                  <p className="text-base sm:text-lg font-medium text-slate-900 dark:text-slate-100 leading-relaxed select-all">
                    {editableText}
                  </p>
                </div>
              )}

              {/* Comprehensive Result Actions */}
              <div className="mt-4">
                <ResultActionBar
                  textToActUpon={editableText}
                  onEdit={() => setIsEditing(!isEditing)}
                  isEditing={isEditing}
                  onRegenerate={() => handleProcess()}
                  onRefineTone={handleToneChange}
                  onTranslateBack={handleTranslateBack}
                  onCreateEmail={() => onNavigateToEmail(editableText || inputText)}
                  ttsLanguage="auto"
                />
              </div>
            </div>

            {/* Grammar Insight / Notes if present */}
            {result.grammarCorrection && (
              <div className="flex items-start gap-2 p-3 rounded-lg bg-slate-50 dark:bg-slate-800/60 border border-slate-200/60 dark:border-slate-800 text-xs text-slate-600 dark:text-slate-300">
                <Zap className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
                <div>
                  <span className="font-semibold text-slate-800 dark:text-slate-200">Grammar &amp; Flow Note: </span>
                  <span>{result.grammarCorrection}</span>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
