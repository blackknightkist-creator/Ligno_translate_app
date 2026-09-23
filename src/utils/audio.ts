/**
 * LingoPro Audio Subsystem (STT & TTS)
 * 
 * Supports:
 * - Direct MediaRecorder hardware capture with Gemini Multimodal Speech-to-Text
 * - Live Web Speech Recognition (si-LK & en-US) for instant interim visual feedback
 * - Real-time volume/frequency level metering via Web Audio API AnalyserNode
 * - Automatic codec detection (audio/webm, audio/mp4, audio/aac, audio/wav, audio/ogg)
 * - Full cross-browser compatibility (Chrome, Android, Safari, Firefox, Edge, iframes)
 * - Web Speech Synthesis + Pause, Resume, Stop playback controls
 */

// Declare Web Speech API types for TypeScript
declare global {
  interface Window {
    SpeechRecognition: any;
    webkitSpeechRecognition: any;
    webkitAudioContext: typeof AudioContext;
  }
}

export interface STTHandlers {
  onInterimResult?: (transcript: string) => void;
  onFinalResult: (transcript: string, detectedLang?: string) => void;
  onError: (errorMsg: string, isPermissionError?: boolean) => void;
  onStateChange: (recording: boolean, isProcessing: boolean) => void;
  onVolumeChange?: (volume: number) => void; // 0 - 100 for live meter
}

export class AudioEngine {
  private activeRecognition: any = null;
  private mediaRecorder: MediaRecorder | null = null;
  private audioChunks: Blob[] = [];
  private mediaStream: MediaStream | null = null;
  private isRecording = false;
  private currentLanguage = 'si-LK';
  private currentMimeType = '';
  private accumulatedSpeechText = '';

  // Web Audio Context for volume metering
  private audioContext: AudioContext | null = null;
  private analyserNode: AnalyserNode | null = null;
  private volumeAnimationId: number | null = null;

  // TTS state
  private currentUtterance: SpeechSynthesisUtterance | null = null;
  private activeSourceNode: AudioBufferSourceNode | null = null;
  private isTtsPlaying = false;
  private isTtsPaused = false;

  public isWebSpeechSupported(): boolean {
    return Boolean(window.SpeechRecognition || window.webkitSpeechRecognition);
  }

  public setLanguage(lang: 'si-LK' | 'en-US') {
    this.currentLanguage = lang;
  }

  /**
   * Start Speech-to-Text session with microphone hardware acquisition
   */
  public async startRecording(
    handlers: STTHandlers,
    options: { preferLanguage?: 'si-LK' | 'en-US' | 'auto'; useServerSTT?: boolean } = {}
  ): Promise<boolean> {
    if (this.isRecording) {
      this.stopRecording();
      return false;
    }

    // 1. Check browser mediaDevices support
    if (typeof navigator === 'undefined' || !navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      handlers.onError(
        'Your browser does not support audio recording. Please use modern Chrome, Safari, or Firefox.',
        false
      );
      return false;
    }

    // 2. Request microphone permission with high-fidelity speech configuration
    try {
      this.mediaStream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });
    } catch (err: any) {
      console.warn('[AudioEngine] getUserMedia error:', err);
      const isPerm =
        err.name === 'NotAllowedError' ||
        err.name === 'PermissionDeniedError' ||
        err.message?.toLowerCase().includes('denied') ||
        err.message?.toLowerCase().includes('permission');
      const isNotFound = err.name === 'NotFoundError' || err.name === 'DevicesNotFoundError';

      const msg = isPerm
        ? 'Microphone permission was denied. Please allow microphone access in your browser or open this app in a new tab.'
        : isNotFound
        ? 'No microphone device was detected. Please plug in or enable a microphone and try again.'
        : `Microphone access error: ${err.message || 'Unknown device error'}. You can also open the app in a new tab.`;

      handlers.onError(msg, isPerm);
      handlers.onStateChange(false, false);
      return false;
    }

    this.isRecording = true;
    this.accumulatedSpeechText = '';
    handlers.onStateChange(true, false);

    const targetLang = options.preferLanguage === 'en-US' ? 'en-US' : 'si-LK';
    this.setLanguage(targetLang);

    // 3. Initialize real-time volume frequency analyser for responsive visual UI feedback
    try {
      const AudioCtxClass = window.AudioContext || window.webkitAudioContext;
      if (AudioCtxClass) {
        this.audioContext = new AudioCtxClass();
        // Resume in case browser suspended audio context
        if (this.audioContext.state === 'suspended') {
          this.audioContext.resume().catch(() => {});
        }
        const source = this.audioContext.createMediaStreamSource(this.mediaStream);
        this.analyserNode = this.audioContext.createAnalyser();
        this.analyserNode.fftSize = 256;
        source.connect(this.analyserNode);

        const dataArray = new Uint8Array(this.analyserNode.frequencyBinCount);
        const checkVolume = () => {
          if (!this.isRecording || !this.analyserNode) return;
          this.analyserNode.getByteFrequencyData(dataArray);
          let sum = 0;
          for (let i = 0; i < dataArray.length; i++) {
            sum += dataArray[i];
          }
          const avg = sum / dataArray.length;
          // Scale from 0 to 100
          const level = Math.min(100, Math.round((avg / 128) * 100));
          if (handlers.onVolumeChange) {
            handlers.onVolumeChange(level);
          }
          this.volumeAnimationId = requestAnimationFrame(checkVolume);
        };
        this.volumeAnimationId = requestAnimationFrame(checkVolume);
      }
    } catch (e) {
      console.warn('[AudioEngine] Volume analyser warning:', e);
    }

    // 4. Select best supported MediaRecorder MIME type
    const candidateMimeTypes = [
      'audio/webm;codecs=opus',
      'audio/webm',
      'audio/mp4',
      'audio/aac',
      'audio/ogg;codecs=opus',
      'audio/wav',
    ];
    let chosenMimeType = '';
    if (typeof MediaRecorder !== 'undefined') {
      for (const mime of candidateMimeTypes) {
        if (MediaRecorder.isTypeSupported(mime)) {
          chosenMimeType = mime;
          break;
        }
      }
    }
    this.currentMimeType = chosenMimeType;

    // 5. Start MediaRecorder hardware recording
    this.audioChunks = [];
    try {
      this.mediaRecorder = chosenMimeType
        ? new MediaRecorder(this.mediaStream, { mimeType: chosenMimeType })
        : new MediaRecorder(this.mediaStream);

      this.mediaRecorder.ondataavailable = (event) => {
        if (event.data && event.data.size > 0) {
          this.audioChunks.push(event.data);
        }
      };

      this.mediaRecorder.onstop = async () => {
        // Clean up hardware resources only after all chunks flushed
        this.cleanupHardware();

        handlers.onStateChange(false, true); // Processing
        const mime = this.currentMimeType || 'audio/webm';
        const audioBlob = new Blob(this.audioChunks, { type: mime });
        const webSpeechResult = this.accumulatedSpeechText.trim();

        // If audio data is present, send to server Gemini STT
        if (audioBlob.size > 50) {
          try {
            const base64Data = await this.blobToBase64(audioBlob);
            const res = await fetch('/api/stt', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                audioData: base64Data,
                mimeType: mime,
              }),
            });

            const json = await res.json();
            if (json.success && json.data?.transcription && json.data.transcription.trim()) {
              handlers.onFinalResult(json.data.transcription.trim(), json.data.detectedLanguage);
              handlers.onStateChange(false, false);
              return;
            } else if (webSpeechResult) {
              // Fall back to Web Speech if server didn't get speech
              handlers.onFinalResult(webSpeechResult, targetLang.startsWith('si') ? 'si' : 'en');
              handlers.onStateChange(false, false);
              return;
            } else {
              handlers.onError(
                json.error || 'No speech was recognized. Please speak closer to the microphone and try again.'
              );
              handlers.onStateChange(false, false);
              return;
            }
          } catch (netErr: any) {
            console.warn('[AudioEngine] Server STT fetch failed, checking WebSpeech fallback:', netErr);
            if (webSpeechResult) {
              handlers.onFinalResult(webSpeechResult, targetLang.startsWith('si') ? 'si' : 'en');
              handlers.onStateChange(false, false);
              return;
            }
            handlers.onError('Speech processing encountered a connection issue. Please try speaking again.');
            handlers.onStateChange(false, false);
            return;
          }
        } else if (webSpeechResult) {
          handlers.onFinalResult(webSpeechResult, targetLang.startsWith('si') ? 'si' : 'en');
          handlers.onStateChange(false, false);
          return;
        } else {
          handlers.onError('Recording was empty. Please hold the microphone, speak clearly, and tap stop.');
          handlers.onStateChange(false, false);
          return;
        }
      };

      // Collect audio chunks every 250ms
      this.mediaRecorder.start(250);
    } catch (recorderErr: any) {
      console.warn('[AudioEngine] MediaRecorder error:', recorderErr);
    }

    // 6. In parallel, run Web Speech API for instant interim text preview if supported
    const SpeechRecClass = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (SpeechRecClass && !options.useServerSTT) {
      try {
        const recognition = new SpeechRecClass();
        recognition.continuous = true;
        recognition.interimResults = true;
        recognition.maxAlternatives = 1;
        recognition.lang = targetLang;

        recognition.onresult = (event: any) => {
          let interim = '';
          for (let i = event.resultIndex; i < event.results.length; ++i) {
            const item = event.results[i];
            if (item.isFinal) {
              this.accumulatedSpeechText += (this.accumulatedSpeechText ? ' ' : '') + item[0].transcript;
            } else {
              interim += item[0].transcript;
            }
          }
          const fullInterim = (this.accumulatedSpeechText + (this.accumulatedSpeechText && interim ? ' ' : '') + interim).trim();
          if (fullInterim && handlers.onInterimResult) {
            handlers.onInterimResult(fullInterim);
          }
        };

        recognition.onerror = (event: any) => {
          // Benign warning: MediaRecorder continues recording hardware audio
          console.debug('[AudioEngine] Live WebSpeech interim notice:', event.error);
        };

        recognition.onend = () => {
          // If still recording, attempt to keep recognition active
          if (this.isRecording && this.activeRecognition === recognition) {
            try {
              recognition.start();
            } catch (_) {}
          }
        };

        recognition.start();
        this.activeRecognition = recognition;
      } catch (recInitErr) {
        console.debug('[AudioEngine] WebSpeech init notice:', recInitErr);
      }
    }

    return true;
  }

  /**
   * Stop active recording and process audio
   */
  public stopRecording() {
    this.isRecording = false;

    if (this.volumeAnimationId) {
      cancelAnimationFrame(this.volumeAnimationId);
      this.volumeAnimationId = null;
    }

    if (this.activeRecognition) {
      try {
        this.activeRecognition.stop();
      } catch (_) {}
      this.activeRecognition = null;
    }

    if (this.mediaRecorder && this.mediaRecorder.state !== 'inactive') {
      try {
        this.mediaRecorder.stop();
      } catch (_) {}
    } else {
      this.cleanupHardware();
    }
  }

  /**
   * Release hardware stream tracks and audio context
   */
  private cleanupHardware() {
    if (this.mediaStream) {
      this.mediaStream.getTracks().forEach((track) => {
        try {
          track.stop();
        } catch (_) {}
      });
      this.mediaStream = null;
    }

    if (this.audioContext && this.audioContext.state !== 'closed') {
      try {
        this.audioContext.close();
      } catch (_) {}
      this.audioContext = null;
    }
    this.analyserNode = null;
  }

  private blobToBase64(blob: Blob): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        const res = reader.result as string;
        const base64 = res?.split(',')[1];
        if (base64) resolve(base64);
        else reject(new Error('Failed to encode recorded audio.'));
      };
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  }

  // ==========================================
  // Text-To-Speech (TTS) Engine
  // ==========================================

  public speak(
    text: string,
    options: {
      language?: 'si' | 'en' | 'auto';
      onStart?: () => void;
      onEnd?: () => void;
      onError?: (err: string) => void;
    } = {}
  ) {
    if (!text || !text.trim()) return;

    this.stopSpeaking();

    const hasSinhala = /[\u0D80-\u0DFF]/.test(text);
    const targetLangCode = options.language === 'en' ? 'en-US' : (hasSinhala || options.language === 'si' ? 'si-LK' : 'en-US');

    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();

      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = targetLangCode;
      utterance.rate = 0.95;

      const voices = window.speechSynthesis.getVoices();
      const matchingVoice = voices.find((v) => v.lang.startsWith(targetLangCode.split('-')[0]));
      if (matchingVoice) {
        utterance.voice = matchingVoice;
      }

      utterance.onstart = () => {
        this.isTtsPlaying = true;
        this.isTtsPaused = false;
        options.onStart?.();
      };

      utterance.onend = () => {
        this.isTtsPlaying = false;
        this.isTtsPaused = false;
        this.currentUtterance = null;
        options.onEnd?.();
      };

      utterance.onerror = (e) => {
        this.isTtsPlaying = false;
        this.isTtsPaused = false;
        this.currentUtterance = null;
        options.onError?.(`Speech playback notice: ${e.error || 'Synthesis error'}`);
      };

      this.currentUtterance = utterance;
      window.speechSynthesis.speak(utterance);
    } else {
      options.onError?.('Text-to-speech is not supported by your browser.');
    }
  }

  public pauseSpeaking() {
    if ('speechSynthesis' in window && this.isTtsPlaying) {
      window.speechSynthesis.pause();
      this.isTtsPaused = true;
    }
  }

  public resumeSpeaking() {
    if ('speechSynthesis' in window && this.isTtsPaused) {
      window.speechSynthesis.resume();
      this.isTtsPaused = false;
    }
  }

  public stopSpeaking() {
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
    }
    if (this.activeSourceNode) {
      try {
        this.activeSourceNode.stop();
      } catch (_) {}
      this.activeSourceNode = null;
    }
    this.isTtsPlaying = false;
    this.isTtsPaused = false;
    this.currentUtterance = null;
  }

  public getTtsState() {
    return {
      isPlaying: this.isTtsPlaying,
      isPaused: this.isTtsPaused,
    };
  }
}

// Singleton instance
export const audioEngine = new AudioEngine();
