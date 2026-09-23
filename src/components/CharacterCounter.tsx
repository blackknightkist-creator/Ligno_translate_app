import React from 'react';

interface CharacterCounterProps {
  currentLength: number;
  maxLength?: number;
  showTokenEstimate?: boolean;
  className?: string;
  compact?: boolean;
}

/**
 * CharacterCounter Component
 * Displays character usage against the maximum limit (default 5,000)
 * along with an intelligent bilingual token estimation for Gemini API limits.
 */
export const CharacterCounter: React.FC<CharacterCounterProps> = ({
  currentLength,
  maxLength = 5000,
  showTokenEstimate = true,
  className = '',
  compact = false,
}) => {
  const percentage = Math.min(100, Math.round((currentLength / maxLength) * 100));
  const remaining = Math.max(0, maxLength - currentLength);

  // Estimate tokens: English text is ~4 chars/token; Sinhala Unicode is ~0.8-1 token/char
  const estimatedTokens = Math.max(
    0,
    Math.round(currentLength === 0 ? 0 : Math.ceil(currentLength / 3.6))
  );

  // Determine threshold states
  const isNearLimit = percentage >= 80 && percentage < 95;
  const isAtLimit = percentage >= 95;

  const textColor = isAtLimit
    ? 'text-rose-600 dark:text-rose-400 font-bold'
    : isNearLimit
    ? 'text-amber-600 dark:text-amber-400 font-semibold'
    : 'text-slate-500 dark:text-slate-400';

  const barColor = isAtLimit
    ? 'bg-rose-500'
    : isNearLimit
    ? 'bg-amber-500'
    : 'bg-indigo-500';

  if (compact) {
    return (
      <div className={`flex items-center gap-2 text-xs ${className}`}>
        <span className={textColor}>
          {currentLength.toLocaleString()} / {maxLength.toLocaleString()}
        </span>
        {showTokenEstimate && currentLength > 0 && (
          <span className="text-[11px] text-slate-400 dark:text-slate-500 hidden sm:inline">
            (~{estimatedTokens.toLocaleString()} tokens)
          </span>
        )}
      </div>
    );
  }

  return (
    <div className={`flex flex-col gap-1 text-xs select-none ${className}`}>
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5">
          <span className={textColor}>
            {currentLength.toLocaleString()}
            <span className="font-normal text-slate-400 dark:text-slate-500"> / {maxLength.toLocaleString()} chars</span>
          </span>

          {showTokenEstimate && (
            <span
              className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400"
              title="Estimated Gemini AI tokens based on character heuristics"
            >
              ~{estimatedTokens.toLocaleString()} tokens
            </span>
          )}
        </div>

        {isAtLimit ? (
          <span className="text-[11px] text-rose-600 dark:text-rose-400 font-medium">
            {remaining === 0 ? 'Max limit reached' : `${remaining} left`}
          </span>
        ) : isNearLimit ? (
          <span className="text-[11px] text-amber-600 dark:text-amber-400">
            {remaining} chars left
          </span>
        ) : null}
      </div>

      {/* Sleek mini progress bar */}
      <div className="w-full h-1 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
        <div
          className={`h-full transition-all duration-150 ${barColor}`}
          style={{ width: `${percentage}%` }}
        />
      </div>
    </div>
  );
};
