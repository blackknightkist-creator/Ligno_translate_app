import React, { useState, useEffect } from 'react';
import { 
  Settings, 
  ShieldCheck, 
  Lock, 
  Cpu, 
  Volume2, 
  Globe, 
  Check, 
  Server,
  Layers,
  Info
} from 'lucide-react';
import { getStoredSettings, saveSettings } from '../utils/storage';
import { AppSettings, ToneStyle } from '../types';

interface SettingsViewProps {
  isDarkMode: boolean;
  onToggleDarkMode: () => void;
}

export const SettingsView: React.FC<SettingsViewProps> = ({ isDarkMode, onToggleDarkMode }) => {
  const [settings, setSettings] = useState<AppSettings>(getStoredSettings());
  const [savedSuccess, setSavedSuccess] = useState(false);
  const [healthStatus, setHealthStatus] = useState<any>(null);

  useEffect(() => {
    fetch('/api/health')
      .then((res) => res.json())
      .then((data) => setHealthStatus(data))
      .catch(() => setHealthStatus({ status: 'offline' }));
  }, []);

  const handleUpdate = <K extends keyof AppSettings>(key: K, value: AppSettings[K]) => {
    const updated = { ...settings, [key]: value };
    setSettings(updated);
    saveSettings(updated);
    setSavedSuccess(true);
    setTimeout(() => setSavedSuccess(false), 1500);
  };

  return (
    <div className="max-w-4xl mx-auto px-4 py-6 sm:py-8 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-slate-900 dark:text-white">
            Settings &amp; Architecture
          </h2>
          <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400">
            Configure processing preferences, review data privacy, and inspect system architecture.
          </p>
        </div>

        {savedSuccess && (
          <span className="flex items-center gap-1.5 px-3 py-1 bg-emerald-50 dark:bg-emerald-950 text-emerald-600 dark:text-emerald-400 rounded-lg text-xs font-semibold">
            <Check className="w-3.5 h-3.5" />
            <span>Preferences Saved</span>
          </span>
        )}
      </div>

      {/* Settings Sections */}
      <div className="space-y-4">
        {/* Language & Tone Defaults */}
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 p-5 space-y-4 shadow-xs">
          <div className="flex items-center gap-2 text-sm font-bold text-slate-900 dark:text-slate-100">
            <Globe className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
            <span>Language &amp; Communication Preferences</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
            <div>
              <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Default Target Translation:
              </label>
              <select
                value={settings.preferredTargetLang}
                onChange={(e) => handleUpdate('preferredTargetLang', e.target.value as any)}
                className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg p-2.5 text-slate-800 dark:text-slate-200"
              >
                <option value="auto">Auto-Detect &amp; Select</option>
                <option value="en">English</option>
                <option value="si">Sinhala (සිංහල)</option>
              </select>
            </div>

            <div>
              <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Default Professional Tone:
              </label>
              <select
                value={settings.defaultTone}
                onChange={(e) => handleUpdate('defaultTone', e.target.value as ToneStyle)}
                className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg p-2.5 text-slate-800 dark:text-slate-200"
              >
                <option value="professional">Professional</option>
                <option value="natural">Natural</option>
                <option value="friendly">Friendly</option>
                <option value="formal">Formal</option>
                <option value="executive">Executive</option>
                <option value="short">Short &amp; Direct</option>
              </select>
            </div>
          </div>
        </div>

        {/* Privacy & Storage Section */}
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 p-5 space-y-4 shadow-xs">
          <div className="flex items-center gap-2 text-sm font-bold text-slate-900 dark:text-slate-100">
            <Lock className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
            <span>Data Privacy &amp; Handling Disclosures</span>
          </div>

          <div className="space-y-3 text-xs">
            <div className="flex items-center justify-between p-3 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200/60 dark:border-slate-800">
              <div>
                <p className="font-semibold text-slate-800 dark:text-slate-200">Local History Retention</p>
                <p className="text-slate-500">Store translations and emails locally in your browser storage only.</p>
              </div>
              <input
                type="checkbox"
                checked={settings.storeHistoryLocally}
                onChange={(e) => handleUpdate('storeHistoryLocally', e.target.checked)}
                className="h-4 w-4 rounded text-indigo-600 focus:ring-indigo-500"
              />
            </div>

            <div className="flex items-center justify-between p-3 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200/60 dark:border-slate-800">
              <div>
                <p className="font-semibold text-slate-800 dark:text-slate-200">Server Data Retention Policy</p>
                <p className="text-slate-500">LingoPro does not persist your translation or audio history on its own application server. Audio and text are processed in memory and sent to configured AI providers for inference.</p>
              </div>
              <span className="text-[11px] font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950 px-2 py-0.5 rounded shrink-0">
                In-Memory
              </span>
            </div>
          </div>
        </div>

        {/* Server & Engine Diagnostics */}
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 p-5 space-y-3 shadow-xs">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-sm font-bold text-slate-900 dark:text-slate-100">
              <Server className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
              <span>Backend Service &amp; Security Controls</span>
            </div>
            <span className="flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 border border-emerald-200/60 dark:border-emerald-800">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
              {healthStatus?.status === 'ok' ? 'Operational' : 'Connecting...'}
            </span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
            <div className="p-2.5 rounded-lg bg-slate-50 dark:bg-slate-950 border border-slate-200/60 dark:border-slate-800">
              <span className="text-slate-400 block text-[10px] uppercase">Service Health</span>
              <span className="font-semibold text-slate-800 dark:text-slate-200">
                {healthStatus?.status === 'ok' ? 'Active (HTTP 200)' : 'Checking...'}
              </span>
            </div>
            <div className="p-2.5 rounded-lg bg-slate-50 dark:bg-slate-950 border border-slate-200/60 dark:border-slate-800">
              <span className="text-slate-400 block text-[10px] uppercase">Failover Architecture</span>
              <span className="font-semibold text-indigo-600 dark:text-indigo-400">Dual-Engine Ready</span>
            </div>
            <div className="p-2.5 rounded-lg bg-slate-50 dark:bg-slate-950 border border-slate-200/60 dark:border-slate-800">
              <span className="text-slate-400 block text-[10px] uppercase">Rate Limiting</span>
              <span className="font-semibold text-emerald-600 dark:text-emerald-400">
                Sliding Window (Active)
              </span>
            </div>
            <div className="p-2.5 rounded-lg bg-slate-50 dark:bg-slate-950 border border-slate-200/60 dark:border-slate-800">
              <span className="text-slate-400 block text-[10px] uppercase">Security Headers</span>
              <span className="font-semibold text-emerald-600 dark:text-emerald-400">
                HSTS / CSP Enforced
              </span>
            </div>
          </div>
          <p className="text-[11px] text-slate-500 dark:text-slate-400 pt-1">
            ⚡ <strong>Failover Architecture:</strong> Requests are processed via Google Gemini API with automatic backup generator failover when temporary limits are encountered.
          </p>
        </div>

        {/* Architectural Flow Diagram */}
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 p-5 space-y-3 shadow-xs">
          <div className="flex items-center gap-2 text-sm font-bold text-slate-900 dark:text-slate-100">
            <Layers className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
            <span>Security Pipeline Architecture</span>
          </div>

          <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200/60 dark:border-slate-800 font-mono text-[11px] text-slate-700 dark:text-slate-300 overflow-x-auto whitespace-pre leading-relaxed">
{`Client Request (Text or Audio)
  ↓
Strict Content-Type Check (application/json) + Request ID Generation
  ↓
Input Validation (Zod Schema + NFC Normalization + ZWJ Preservation)
  ↓
Audio Verification (Base64 Integrity + Magic-Byte Signature Check)
  ↓
Reverse Proxy IP Extraction (Trusted Hop) & Sliding Window Rate Limiter
  ↓
Prompt Fencing (<<<USER_INPUT_START>>> ... <<<USER_INPUT_END>>> Delimiters)
  ↓
Dual-Engine AI Orchestration with Bounded Exponential Backoff
  ├── Primary: Gemini 3.8 Flash
  └── Failover: Backup Engine (CometAPI)
  ↓
Sanitized JSON Response with Safe Error Handling`}
          </div>
        </div>
      </div>
    </div>
  );
};
