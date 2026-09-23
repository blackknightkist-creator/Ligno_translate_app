import React, { useState, useEffect } from 'react';
import { Mic, MicOff, Volume2, Square, Pause, Play, AlertCircle, Loader2, ExternalLink, X } from 'lucide-react';
import { audioEngine, STTHandlers } from '../utils/audio';

interface AudioControlsProps {
  onTranscriptionReceived: (text: string, detectedLang?: string) => void;
  preferredLanguage?: 'si-LK' | 'en-US' | 'auto';
  disabled?: boolean;
}

export const VoiceInputButton: React.FC<AudioControlsProps> = ({
  onTranscriptionReceived,
  preferredLanguage = 'si-LK',
  disabled = false,
}) => {
  const [isRecording, setIsRecording] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const [volumeLevel, setVolumeLevel] = useState(0);
  const [interimText, setInterimText] = useState('');
  const [audioError, setAudioError] = useState<string | null>(null);
  const [isPermissionError, setIsPermissionError] = useState(false);

  useEffect(() => {
    let timer: any = null;
    if (isRecording) {
      setRecordingSeconds(0);
      timer = setInterval(() => {
        setRecordingSeconds((prev) => prev + 1);
      }, 1000);
    } else {
      clearInterval(timer);
      setVolumeLevel(0);
    }
    return () => clearInterval(timer);
  }, [isRecording]);

  const toggleRecording = async () => {
    setAudioError(null);
    setIsPermissionError(false);

    if (isRecording) {
      audioEngine.stopRecording();
      setIsRecording(false);
      setVolumeLevel(0);
      return;
    }

    const handlers: STTHandlers = {
      onInterimResult: (transcript) => {
        setInterimText(transcript);
      },
      onFinalResult: (transcript, detectedLang) => {
        setInterimText('');
        setVolumeLevel(0);
        onTranscriptionReceived(transcript, detectedLang);
      },
      onError: (msg, isPerm) => {
        setAudioError(msg);
        setIsPermissionError(Boolean(isPerm));
        setIsRecording(false);
        setIsProcessing(false);
        setVolumeLevel(0);
      },
      onStateChange: (recording, processing) => {
        setIsRecording(recording);
        setIsProcessing(processing);
        if (!recording) setVolumeLevel(0);
      },
      onVolumeChange: (vol) => {
        setVolumeLevel(vol);
      },
    };

    await audioEngine.startRecording(handlers, {
      preferLanguage: preferredLanguage as 'si-LK' | 'en-US' | 'auto',
    });
  };

  const formatTime = (secs: number) => {
    const mins = Math.floor(secs / 60);
    const remSecs = secs % 60;
    return `${mins.toString().padStart(2, '0')}:${remSecs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="flex flex-col items-center">
      {/* Recording indicator & controls */}
      <div className="flex items-center gap-3">
        <button
          id="voice-record-btn"
          type="button"
          onClick={toggleRecording}
          disabled={disabled || isProcessing}
          className={`relative group flex items-center justify-center rounded-2xl p-3.5 transition-all shadow-md focus:outline-none focus:ring-4 focus:ring-indigo-300 dark:focus:ring-indigo-800 ${
            isRecording
              ? 'bg-rose-600 text-white hover:bg-rose-700 shadow-rose-500/30 scale-105'
              : isProcessing
              ? 'bg-amber-500 text-white cursor-wait'
              : 'bg-indigo-600 hover:bg-indigo-700 text-white shadow-indigo-500/25 hover:scale-105 active:scale-95'
          } ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
          aria-label={isRecording ? 'Stop Recording' : 'Speak with Microphone'}
          title={isRecording ? 'Click to Stop Recording' : 'Speak in Sinhala or English'}
        >
          {isProcessing ? (
            <Loader2 className="w-6 h-6 animate-spin" />
          ) : isRecording ? (
            <Square className="w-6 h-6 fill-current" />
          ) : (
            <Mic className="w-6 h-6" />
          )}

          {/* Pulse wave ring when recording */}
          {isRecording && (
            <span
              className="absolute -inset-1 rounded-2xl bg-rose-500/30 animate-ping pointer-events-none"
              style={{ animationDuration: volumeLevel > 20 ? '0.8s' : '1.5s' }}
            />
          )}
        </button>

        {/* Recording active timer & status */}
        {isRecording && (
          <div className="flex items-center gap-2.5 px-3.5 py-2 rounded-xl bg-rose-50 dark:bg-rose-950/70 border border-rose-200 dark:border-rose-900 text-rose-700 dark:text-rose-300 text-xs font-semibold shadow-sm animate-fade-in">
            {/* Live audio frequency equalizer bars */}
            <div className="flex items-center gap-0.5 h-4 px-1">
              {[0.5, 0.9, 1.3, 0.8, 0.6].map((scaleFactor, idx) => {
                const dynamicHeight = Math.max(
                  4,
                  Math.min(18, Math.round(4 + (volumeLevel / 100) * 14 * scaleFactor))
                );
                return (
                  <span
                    key={idx}
                    className="w-1 bg-rose-500 rounded-full transition-all duration-75"
                    style={{ height: `${dynamicHeight}px` }}
                  />
                );
              })}
            </div>
            <span>Recording ({formatTime(recordingSeconds)})</span>
            <span className="text-[11px] text-rose-500 font-normal">Tap square to finish</span>
          </div>
        )}

        {isProcessing && (
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-amber-50 dark:bg-amber-950/60 border border-amber-200 dark:border-amber-900 text-amber-800 dark:text-amber-300 text-xs font-medium shadow-sm">
            <Loader2 className="w-3.5 h-3.5 animate-spin text-amber-600" />
            <span>Transcribing speech with Gemini AI...</span>
          </div>
        )}
      </div>

      {/* Interim live speech feedback */}
      {interimText && (
        <div className="mt-2 text-xs italic text-indigo-700 dark:text-indigo-300 bg-indigo-50 dark:bg-indigo-950/70 px-3 py-1.5 rounded-md max-w-md text-center border border-indigo-200/60 dark:border-indigo-900/60 animate-fade-in">
          "{interimText}"
        </div>
      )}

      {/* Audio Error Alert & Permission Guidance */}
      {audioError && (
        <div className="mt-3 flex flex-col gap-1.5 p-2.5 max-w-md text-xs text-rose-700 dark:text-rose-300 bg-rose-50 dark:bg-rose-950/50 rounded-xl border border-rose-200 dark:border-rose-900/60 shadow-sm animate-fade-in">
          <div className="flex items-start justify-between gap-2">
            <div className="flex items-start gap-1.5">
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-600 dark:text-rose-400 mt-0.5" />
              <span>{audioError}</span>
            </div>
            <button
              type="button"
              onClick={() => {
                setAudioError(null);
                setIsPermissionError(false);
              }}
              className="p-0.5 text-rose-500 hover:text-rose-700 rounded transition-colors"
              title="Dismiss"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* If iframe or permission blocked, offer opening in new tab */}
          {isPermissionError && (
            <div className="pt-1 flex items-center justify-end">
              <a
                href={window.location.href}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-700 text-white font-semibold text-xs shadow-sm transition-colors"
              >
                <ExternalLink className="w-3.5 h-3.5" />
                <span>Open in New Window to Allow Mic</span>
              </a>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

interface TtsPlayerProps {
  text: string;
  language?: 'si' | 'en' | 'auto';
  label?: string;
}

export const TtsPlayer: React.FC<TtsPlayerProps> = ({ text, language = 'auto', label = 'Listen' }) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handlePlay = () => {
    setErrorMsg(null);
    if (isPaused) {
      audioEngine.resumeSpeaking();
      setIsPaused(false);
      setIsPlaying(true);
      return;
    }

    audioEngine.speak(text, {
      language: language as 'si' | 'en' | 'auto',
      onStart: () => {
        setIsPlaying(true);
        setIsPaused(false);
      },
      onEnd: () => {
        setIsPlaying(false);
        setIsPaused(false);
      },
      onError: (err) => {
        setErrorMsg(err);
        setIsPlaying(false);
        setIsPaused(false);
      },
    });
  };

  const handlePause = () => {
    audioEngine.pauseSpeaking();
    setIsPaused(true);
  };

  const handleStop = () => {
    audioEngine.stopSpeaking();
    setIsPlaying(false);
    setIsPaused(false);
  };

  return (
    <div className="inline-flex items-center gap-1 bg-slate-100 dark:bg-slate-800 rounded-lg p-1 text-xs">
      {!isPlaying ? (
        <button
          id="tts-play-btn"
          type="button"
          onClick={handlePlay}
          className="flex items-center gap-1.5 px-2.5 py-1 text-slate-700 dark:text-slate-200 hover:text-indigo-600 dark:hover:text-indigo-400 font-medium rounded-md hover:bg-white dark:hover:bg-slate-700 transition-colors"
          title="Read aloud"
        >
          <Volume2 className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
          <span>{label}</span>
        </button>
      ) : (
        <>
          <button
            id="tts-pause-btn"
            type="button"
            onClick={isPaused ? handlePlay : handlePause}
            className="p-1 text-slate-700 dark:text-slate-200 hover:bg-white dark:hover:bg-slate-700 rounded-md"
            title={isPaused ? 'Resume' : 'Pause'}
          >
            {isPaused ? <Play className="w-3.5 h-3.5" /> : <Pause className="w-3.5 h-3.5" />}
          </button>
          <button
            id="tts-stop-btn"
            type="button"
            onClick={handleStop}
            className="p-1 text-rose-600 hover:bg-white dark:hover:bg-slate-700 rounded-md"
            title="Stop playback"
          >
            <Square className="w-3.5 h-3.5 fill-current" />
          </button>
          <span className="text-[11px] text-indigo-600 dark:text-indigo-400 font-semibold px-1 animate-pulse">
            Playing...
          </span>
        </>
      )}

      {errorMsg && (
        <span className="text-[10px] text-rose-500 px-1" title={errorMsg}>
          TTS unavailable
        </span>
      )}
    </div>
  );
};
