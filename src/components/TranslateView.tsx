import React, { useState } from 'react';
import { 
  ArrowLeftRight, 
  Languages, 
  Loader2, 
  AlertCircle, 
  BookOpen, 
  Sparkles, 
  Check, 
  Copy,
  ChevronDown,
  ChevronUp
} from 'lucide-react';
import { VoiceInputButton } from './AudioControls';
import { CharacterCounter } from './CharacterCounter';
import { ResultActionBar } from './ResultActionBar';
import { SINGLISH_CHEAT_SHEET } from '../utils/singlish';
import { addHistoryItem } from '../utils/storage';
import { TranslationResult } from '../types';

interface TranslateViewProps {
  initialText?: string;
  onNavigateToEmail: (prompt: string) => void;
}

export const TranslateView: React.FC<TranslateViewProps> = ({
  initialText = '',
  onNavigateToEmail,
}) => {
  const [inputText, setInputText] = useState(initialText);
  const [targetLang, setTargetLang] = useState<'auto' | 'en' | 'si'>('auto');
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState<TranslationResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showCheatSheet, setShowCheatSheet] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editedTranslation, setEditedTranslation] = useState('');

  const handleTranslate = async (textToTranslate = inputText) => {
    const text = textToTranslate.trim();
    if (!text) return;

    setIsLoading(true);
    setError(null);
    setIsEditing(false);

    try {
      const response = await fetch('/api/translate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text,
          targetLang,
        }),
      });

      const resData = await response.json();
      if (!response.ok || !resData.success) {
        throw new Error(resData.error || 'Translation failed.');
      }

      const transData: TranslationResult = resData.data;
      setResult(transData);
      setEditedTranslation(transData.translatedText);

      addHistoryItem({
        mode: 'translate',
        inputText: text,
        inputLanguage: transData.detectedLanguage.label,
        primaryOutput: transData.translatedText,
        secondaryOutput: transData.singlishInSinhalaScript,
        metadata: {
          targetLang: transData.targetLanguage,
        },
      });
    } catch (err: any) {
      setError(err.message || 'Translation error occurred.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSwap = () => {
    if (result && editedTranslation) {
      const prevOutput = editedTranslation;
      setInputText(prevOutput);
      setTargetLang(result.targetLanguage === 'en' ? 'si' : 'en');
      handleTranslate(prevOutput);
    } else {
      setTargetLang(targetLang === 'en' ? 'si' : 'en');
    }
  };

  const handleVoiceInput = (transcription: string) => {
    setInputText(transcription);
    handleTranslate(transcription);
  };

  return (
    <div className="max-w-4xl mx-auto px-4 py-6 sm:py-8 space-y-6">
      {/* Title */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-slate-900 dark:text-white">
            Dedicated Translation Engine
          </h2>
          <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400">
            High-fidelity Sinhala ↔ English translation with Singlish contextual conversion.
          </p>
        </div>

        {/* Singlish Cheat Sheet toggle */}
        <button
          type="button"
          onClick={() => setShowCheatSheet(!showCheatSheet)}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-indigo-50 dark:bg-indigo-950/70 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800 hover:bg-indigo-100 transition-colors"
        >
          <BookOpen className="w-3.5 h-3.5" />
          <span>Singlish Guide</span>
          {showCheatSheet ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
        </button>
      </div>

      {/* Singlish Cheat Sheet Drawer */}
      {showCheatSheet && (
        <div className="p-4 rounded-xl bg-indigo-50/50 dark:bg-indigo-950/40 border border-indigo-200 dark:border-indigo-900/60 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-indigo-900 dark:text-indigo-200">
              Singlish Phonetic Mapping &amp; Examples
            </span>
            <span className="text-[11px] text-indigo-600 dark:text-indigo-400">
              Type naturally in Latin characters — LingoPro maps it automatically
            </span>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
            {SINGLISH_CHEAT_SHEET.map((item, idx) => (
              <div key={idx} className="p-2 rounded bg-white dark:bg-slate-900 border border-indigo-100 dark:border-indigo-900">
                <span className="font-bold text-indigo-700 dark:text-indigo-300">{item.singlish}</span>
                <span className="text-slate-400 mx-1">➔</span>
                <span className="font-medium text-slate-800 dark:text-slate-200">{item.sinhala}</span>
                <p className="text-[10px] text-slate-500 mt-0.5">{item.example}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Language Direction Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-white dark:bg-slate-900 p-3 rounded-xl border border-slate-200/80 dark:border-slate-800 shadow-xs">
        <div className="flex items-center gap-2 text-xs font-semibold">
          <span className="px-3 py-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200">
            Source: Auto-Detect (Sinhala / English / Singlish)
          </span>

          <button
            id="translate-swap-direction-btn"
            type="button"
            onClick={handleSwap}
            className="p-1.5 rounded-lg text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-950/60 transition-colors"
            title="Swap translation direction"
          >
            <ArrowLeftRight className="w-4 h-4" />
          </button>

          <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800 p-0.5 rounded-lg">
            <button
              type="button"
              onClick={() => setTargetLang('auto')}
              className={`px-2.5 py-1 rounded-md text-xs transition-colors ${
                targetLang === 'auto'
                  ? 'bg-white dark:bg-slate-700 text-indigo-600 dark:text-indigo-300 font-bold shadow-xs'
                  : 'text-slate-600 dark:text-slate-400'
              }`}
            >
              Auto Target
            </button>
            <button
              type="button"
              onClick={() => setTargetLang('en')}
              className={`px-2.5 py-1 rounded-md text-xs transition-colors ${
                targetLang === 'en'
                  ? 'bg-white dark:bg-slate-700 text-indigo-600 dark:text-indigo-300 font-bold shadow-xs'
                  : 'text-slate-600 dark:text-slate-400'
              }`}
            >
              ➔ English
            </button>
            <button
              type="button"
              onClick={() => setTargetLang('si')}
              className={`px-2.5 py-1 rounded-md text-xs transition-colors ${
                targetLang === 'si'
                  ? 'bg-white dark:bg-slate-700 text-indigo-600 dark:text-indigo-300 font-bold shadow-xs'
                  : 'text-slate-600 dark:text-slate-400'
              }`}
            >
              ➔ Sinhala (සිංහල)
            </button>
          </div>
        </div>
      </div>

      {/* Translation Panels (Source & Target) */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Source Text Panel */}
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 p-4 space-y-3 flex flex-col justify-between">
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs text-slate-500">
              <span className="font-semibold uppercase tracking-wider">Source Text</span>
              <CharacterCounter currentLength={inputText.length} maxLength={5000} compact />
            </div>
            <textarea
              id="translate-source-input"
              rows={6}
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              placeholder="Enter Sinhala, English, or Singlish (e.g. 'mata heta meeting ekata enna baha')..."
              className="w-full bg-slate-50/70 dark:bg-slate-950/70 border border-slate-200 dark:border-slate-800 rounded-xl p-3 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 text-base focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
            />
            <CharacterCounter currentLength={inputText.length} maxLength={5000} />
          </div>

          <div className="flex items-center justify-between pt-2 border-t border-slate-100 dark:border-slate-800">
            <VoiceInputButton
              onTranscriptionReceived={handleVoiceInput}
              preferredLanguage="si-LK"
              disabled={isLoading}
            />
            <button
              id="execute-translation-btn"
              type="button"
              onClick={() => handleTranslate()}
              disabled={isLoading || !inputText.trim()}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-xs shadow-md shadow-indigo-500/20 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Translating...</span>
                </>
              ) : (
                <>
                  <Languages className="w-3.5 h-3.5" />
                  <span>Translate</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* Target Translation Panel */}
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 p-4 space-y-3 flex flex-col justify-between">
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs text-slate-500">
              <span className="font-semibold uppercase tracking-wider">
                {result ? (result.targetLanguage === 'en' ? 'English Output' : 'Sinhala Output (සිංහල)') : 'Translation'}
              </span>
              {result && (
                <span className="text-[11px] text-indigo-600 dark:text-indigo-400 font-medium">
                  {result.detectedLanguage.label}
                </span>
              )}
            </div>

            {isLoading ? (
              <div className="h-36 flex flex-col items-center justify-center text-slate-400 gap-2">
                <Loader2 className="w-6 h-6 animate-spin text-indigo-600" />
                <span className="text-xs">Analyzing and translating...</span>
              </div>
            ) : result ? (
              <div className="min-h-[144px] space-y-3">
                {isEditing ? (
                  <textarea
                    rows={4}
                    value={editedTranslation}
                    onChange={(e) => setEditedTranslation(e.target.value)}
                    className="w-full bg-slate-50 dark:bg-slate-950 border border-indigo-300 dark:border-indigo-700 rounded-lg p-2 text-base text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                ) : (
                  <p className="text-base sm:text-lg font-medium text-slate-900 dark:text-slate-100 leading-relaxed select-all">
                    {editedTranslation}
                  </p>
                )}

                {/* Singlish conversion details if applicable */}
                {result.singlishInSinhalaScript && (
                  <div className="p-2.5 rounded-lg bg-indigo-50/50 dark:bg-indigo-950/30 border border-indigo-100 dark:border-indigo-900 text-xs">
                    <span className="font-semibold text-indigo-700 dark:text-indigo-300">Sinhala Unicode Rendering: </span>
                    <span className="text-slate-800 dark:text-slate-200 font-medium">{result.singlishInSinhalaScript}</span>
                  </div>
                )}
              </div>
            ) : (
              <div className="h-36 flex items-center justify-center text-slate-400 text-xs italic">
                Translation will appear here with preserved context &amp; names.
              </div>
            )}
          </div>

          {/* Action Bar for Target Panel */}
          {result && (
            <ResultActionBar
              textToActUpon={editedTranslation}
              onEdit={() => setIsEditing(!isEditing)}
              isEditing={isEditing}
              onRegenerate={() => handleTranslate()}
              onTranslateBack={handleSwap}
              onCreateEmail={() => onNavigateToEmail(editedTranslation)}
              ttsLanguage={result.targetLanguage === 'si' ? 'si' : 'en'}
            />
          )}
        </div>
      </div>

      {/* Grammar notes and alternatives */}
      {result && result.grammarNotes && result.grammarNotes.length > 0 && (
        <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 text-xs space-y-1.5">
          <span className="font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
            Translation &amp; Cultural Notes:
          </span>
          <ul className="list-disc list-inside space-y-1 text-slate-600 dark:text-slate-400">
            {result.grammarNotes.map((note, idx) => (
              <li key={idx}>{note}</li>
            ))}
          </ul>
        </div>
      )}

      {error && (
        <div className="p-3 rounded-lg bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 text-rose-700 dark:text-rose-300 text-xs flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}
    </div>
  );
};
