import React, { useState } from 'react';
import { 
  Copy, 
  Check, 
  Edit3, 
  RefreshCw, 
  ArrowLeftRight, 
  Briefcase, 
  Minimize2, 
  Smile, 
  Mail, 
  Share2 
} from 'lucide-react';
import { TtsPlayer } from './AudioControls';
import { ToneStyle } from '../types';

interface ResultActionBarProps {
  textToActUpon: string;
  onEdit?: () => void;
  onRegenerate?: () => void;
  onRefineTone?: (tone: ToneStyle) => void;
  onTranslateBack?: () => void;
  onCreateEmail?: () => void;
  ttsLanguage?: 'si' | 'en' | 'auto';
  isEditing?: boolean;
}

export const ResultActionBar: React.FC<ResultActionBarProps> = ({
  textToActUpon,
  onEdit,
  onRegenerate,
  onRefineTone,
  onTranslateBack,
  onCreateEmail,
  ttsLanguage = 'auto',
  isEditing = false,
}) => {
  const [copied, setCopied] = useState(false);
  const [shared, setShared] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(textToActUpon);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.warn('Copy failed:', err);
    }
  };

  const handleShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: 'LingoPro Result',
          text: textToActUpon,
        });
        setShared(true);
        setTimeout(() => setShared(false), 2000);
      } catch (_) {}
    } else {
      handleCopy();
    }
  };

  return (
    <div className="flex flex-wrap items-center justify-between gap-2 pt-3 border-t border-slate-100 dark:border-slate-800">
      {/* Primary Action Buttons */}
      <div className="flex flex-wrap items-center gap-1.5">
        {/* Copy */}
        <button
          id="action-copy-btn"
          type="button"
          onClick={handleCopy}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500"
          title="Copy text to clipboard"
        >
          {copied ? (
            <>
              <Check className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
              <span className="text-emerald-700 dark:text-emerald-300">Copied!</span>
            </>
          ) : (
            <>
              <Copy className="w-3.5 h-3.5" />
              <span>Copy</span>
            </>
          )}
        </button>

        {/* Text-To-Speech Listen */}
        <TtsPlayer text={textToActUpon} language={ttsLanguage} label="Listen 🔊" />

        {/* Edit In Place */}
        {onEdit && (
          <button
            id="action-edit-btn"
            type="button"
            onClick={onEdit}
            className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors ${
              isEditing
                ? 'bg-indigo-100 dark:bg-indigo-900/60 text-indigo-700 dark:text-indigo-300 font-semibold'
                : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
            }`}
            title="Edit text in-place"
          >
            <Edit3 className="w-3.5 h-3.5" />
            <span>{isEditing ? 'Done Editing' : 'Edit'}</span>
          </button>
        )}

        {/* Regenerate */}
        {onRegenerate && (
          <button
            id="action-regenerate-btn"
            type="button"
            onClick={onRegenerate}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            title="Regenerate output"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Regenerate</span>
          </button>
        )}

        {/* Share */}
        <button
          id="action-share-btn"
          type="button"
          onClick={handleShare}
          className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          title="Share via device or copy"
        >
          {shared ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Share2 className="w-3.5 h-3.5" />}
          <span>{shared ? 'Shared' : 'Share'}</span>
        </button>
      </div>

      {/* Contextual Transformation Actions */}
      <div className="flex flex-wrap items-center gap-1">
        {onTranslateBack && (
          <button
            id="action-translate-back-btn"
            type="button"
            onClick={onTranslateBack}
            className="flex items-center gap-1 px-2 py-1 rounded-md text-[11px] font-medium bg-slate-50 dark:bg-slate-800/80 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 border border-slate-200/60 dark:border-slate-700/60"
            title="Swap and translate back into original language"
          >
            <ArrowLeftRight className="w-3 h-3 text-indigo-500" />
            <span>Translate back</span>
          </button>
        )}

        {onRefineTone && (
          <>
            <button
              id="action-more-formal-btn"
              type="button"
              onClick={() => onRefineTone('formal')}
              className="flex items-center gap-1 px-2 py-1 rounded-md text-[11px] font-medium bg-slate-50 dark:bg-slate-800/80 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 border border-slate-200/60 dark:border-slate-700/60"
              title="Make more formal"
            >
              <Briefcase className="w-3 h-3 text-blue-500" />
              <span>More formal</span>
            </button>
            <button
              id="action-shorter-btn"
              type="button"
              onClick={() => onRefineTone('short')}
              className="flex items-center gap-1 px-2 py-1 rounded-md text-[11px] font-medium bg-slate-50 dark:bg-slate-800/80 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 border border-slate-200/60 dark:border-slate-700/60"
              title="Make shorter & direct"
            >
              <Minimize2 className="w-3 h-3 text-amber-500" />
              <span>Shorter</span>
            </button>
            <button
              id="action-friendlier-btn"
              type="button"
              onClick={() => onRefineTone('friendly')}
              className="flex items-center gap-1 px-2 py-1 rounded-md text-[11px] font-medium bg-slate-50 dark:bg-slate-800/80 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 border border-slate-200/60 dark:border-slate-700/60"
              title="Make friendlier"
            >
              <Smile className="w-3 h-3 text-emerald-500" />
              <span>Friendlier</span>
            </button>
          </>
        )}

        {onCreateEmail && (
          <button
            id="action-create-email-btn"
            type="button"
            onClick={onCreateEmail}
            className="flex items-center gap-1 px-2.5 py-1 rounded-md text-[11px] font-semibold bg-indigo-50 dark:bg-indigo-950/80 text-indigo-700 dark:text-indigo-300 hover:bg-indigo-100 dark:hover:bg-indigo-900 border border-indigo-200 dark:border-indigo-800"
            title="Convert this request into a structured professional email"
          >
            <Mail className="w-3 h-3 text-indigo-600 dark:text-indigo-400" />
            <span>Create Email</span>
          </button>
        )}
      </div>
    </div>
  );
};
