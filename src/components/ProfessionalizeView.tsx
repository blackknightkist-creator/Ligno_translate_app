import React, { useState } from 'react';
import { 
  Sparkles, 
  Loader2, 
  AlertCircle, 
  CheckCircle, 
  ArrowRight, 
  ShieldCheck, 
  Info,
  Sliders,
  Check
} from 'lucide-react';
import { VoiceInputButton } from './AudioControls';
import { CharacterCounter } from './CharacterCounter';
import { ResultActionBar } from './ResultActionBar';
import { addHistoryItem } from '../utils/storage';
import { ProfessionalizeResult, ToneStyle } from '../types';

interface ProfessionalizeViewProps {
  initialText?: string;
  onNavigateToEmail: (text: string) => void;
}

export const ProfessionalizeView: React.FC<ProfessionalizeViewProps> = ({
  initialText = '',
  onNavigateToEmail,
}) => {
  const [inputText, setInputText] = useState(initialText);
  const [selectedStyle, setSelectedStyle] = useState<ToneStyle>('professional');
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState<ProfessionalizeResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [editableText, setEditableText] = useState('');
  const [isEditing, setIsEditing] = useState(false);

  const styles: { id: ToneStyle; title: string; subtitle: string }[] = [
    { id: 'professional', title: 'Professional', subtitle: 'Standard business & workplace correspondence' },
    { id: 'natural', title: 'Natural', subtitle: 'Conversational, fluent, easy to read' },
    { id: 'friendly', title: 'Friendly', subtitle: 'Warm, collaborative, empathetic tone' },
    { id: 'formal', title: 'Formal', subtitle: 'Diplomatic, institutional, client-facing' },
    { id: 'executive', title: 'Executive', subtitle: 'Leadership level, high impact, decisive' },
    { id: 'short', title: 'Short & Direct', subtitle: 'Concise, zero fluff, straight to the point' },
  ];

  const handleProfessionalize = async (textToProcess = inputText, styleToUse = selectedStyle) => {
    const text = textToProcess.trim();
    if (!text) return;

    setIsLoading(true);
    setError(null);
    setIsEditing(false);

    try {
      const response = await fetch('/api/professionalize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text,
          style: styleToUse,
        }),
      });

      const resData = await response.json();
      if (!response.ok || !resData.success) {
        throw new Error(resData.error || 'Failed to rewrite text.');
      }

      const profData: ProfessionalizeResult = resData.data;
      setResult(profData);
      setEditableText(profData.improvedText);

      addHistoryItem({
        mode: 'professionalize',
        inputText: text,
        inputLanguage: profData.sourceLanguage,
        primaryOutput: profData.improvedText,
        metadata: {
          style: styleToUse,
        },
      });
    } catch (err: any) {
      setError(err.message || 'Error occurred while improving text.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleStyleSwitch = (newStyle: ToneStyle) => {
    setSelectedStyle(newStyle);
    if (result && result.alternativeVariations[newStyle]) {
      setEditableText(result.alternativeVariations[newStyle]);
    } else if (inputText.trim()) {
      handleProfessionalize(inputText, newStyle);
    }
  };

  return (
    <div className="max-w-4xl mx-auto px-4 py-6 sm:py-8 space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold text-slate-900 dark:text-white">
          Professionalization &amp; Style Engine
        </h2>
        <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400">
          Turn casual drafts, Singlish, or Sinhala into workplace-ready communication while strictly preserving all facts.
        </p>
      </div>

      {/* Input Box */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 p-4 sm:p-6 space-y-4">
        <div className="flex items-center justify-between text-xs text-slate-500">
          <span className="font-semibold uppercase tracking-wider">Draft Text or Instructions</span>
          <CharacterCounter currentLength={inputText.length} maxLength={5000} compact />
        </div>

        <textarea
          id="professionalize-input"
          rows={4}
          value={inputText}
          onChange={(e) => setInputText(e.target.value)}
          placeholder="e.g. 'send me the document quickly' or 'mata heta enna baha urgent wadak nisa'..."
          className="w-full bg-slate-50/70 dark:bg-slate-950/70 border border-slate-200 dark:border-slate-800 rounded-xl p-3 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 text-base focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
        />

        <CharacterCounter currentLength={inputText.length} maxLength={5000} />

        {/* Style Selector Grid */}
        <div className="space-y-2">
          <span className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">
            Select Desired Tone Style:
          </span>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {styles.map((style) => (
              <button
                key={style.id}
                id={`prof-style-${style.id}`}
                type="button"
                onClick={() => handleStyleSwitch(style.id)}
                className={`p-3 rounded-xl text-left border transition-all ${
                  selectedStyle === style.id
                    ? 'bg-indigo-50 dark:bg-indigo-950/60 border-indigo-500 text-indigo-900 dark:text-indigo-200 shadow-xs'
                    : 'bg-slate-50/60 dark:bg-slate-800/60 border-slate-200 dark:border-slate-700/60 text-slate-700 dark:text-slate-300 hover:border-slate-300 dark:hover:border-slate-600'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="font-bold text-xs">{style.title}</span>
                  {selectedStyle === style.id && <Check className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />}
                </div>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1 line-clamp-1">{style.subtitle}</p>
              </button>
            ))}
          </div>
        </div>

        {/* Action button & voice input */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-2 border-t border-slate-100 dark:border-slate-800">
          <VoiceInputButton
            onTranscriptionReceived={(t) => {
              setInputText(t);
              handleProfessionalize(t, selectedStyle);
            }}
            preferredLanguage="si-LK"
            disabled={isLoading}
          />

          <button
            id="make-professional-btn"
            type="button"
            onClick={() => handleProfessionalize()}
            disabled={isLoading || !inputText.trim()}
            className="w-full sm:w-auto flex items-center justify-center gap-2 px-6 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-xs shadow-md shadow-indigo-500/25 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isLoading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Refining communication...</span>
              </>
            ) : (
              <>
                <Sparkles className="w-4 h-4" />
                <span>Make Professional</span>
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

      {/* Result Section */}
      {result && (
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 p-4 sm:p-6 space-y-4 shadow-sm">
          <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-slate-800">
            <div className="flex items-center gap-2">
              <span className="capitalize font-bold text-slate-900 dark:text-white text-sm">
                {selectedStyle} Communication Output
              </span>
            </div>
            <div className="flex items-center gap-1.5 text-xs text-emerald-600 dark:text-emerald-400 font-medium">
              <ShieldCheck className="w-4 h-4" />
              <span>Zero Hallucination Guarantee</span>
            </div>
          </div>

          {/* Improved Output Text Box */}
          <div className="p-4 rounded-xl bg-indigo-50/30 dark:bg-indigo-950/20 border border-indigo-100 dark:border-indigo-900/40 space-y-3">
            {isEditing ? (
              <textarea
                rows={3}
                value={editableText}
                onChange={(e) => setEditableText(e.target.value)}
                className="w-full p-2 bg-white dark:bg-slate-900 border border-indigo-300 dark:border-indigo-700 rounded-lg text-base text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500 font-medium"
              />
            ) : (
              <p className="text-base sm:text-lg font-medium text-slate-900 dark:text-slate-100 leading-relaxed select-all">
                {editableText}
              </p>
            )}

            <ResultActionBar
              textToActUpon={editableText}
              onEdit={() => setIsEditing(!isEditing)}
              isEditing={isEditing}
              onRegenerate={() => handleProfessionalize()}
              onRefineTone={(tone) => handleStyleSwitch(tone)}
              onCreateEmail={() => onNavigateToEmail(editableText)}
              ttsLanguage="en"
            />
          </div>

          {/* Changes & Improvements explanation */}
          {result.changesExplanation && result.changesExplanation.length > 0 && (
            <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-950/60 border border-slate-200/60 dark:border-slate-800 text-xs space-y-1.5">
              <div className="flex items-center gap-1.5 text-slate-700 dark:text-slate-300 font-bold">
                <Info className="w-3.5 h-3.5 text-indigo-500" />
                <span>Refinements Applied:</span>
              </div>
              <ul className="list-disc list-inside space-y-1 text-slate-600 dark:text-slate-400">
                {result.changesExplanation.map((explanation, idx) => (
                  <li key={idx}>{explanation}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
