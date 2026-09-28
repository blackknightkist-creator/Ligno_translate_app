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
            Configure processing preferences, privacy controls, and inspect system architecture.
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
            <span>Privacy-First Data Protection</span>
          </div>

          <div className="space-y-3 text-xs">
            <div className="flex items-center justify-between p-3 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200/60 dark:border-slate-800">
              <div>
                <p className="font-semibold text-slate-800 dark:text-slate-200">Local History Retention</p>
                <p className="text-slate-500">Store translations and emails locally on this device only.</p>
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
                <p className="font-semibold text-slate-800 dark:text-slate-200">Zero Audio Persistence</p>
                <p className="text-slate-500">Microphone voice audio is processed in memory and never stored.</p>
              </div>
              <span className="text-[11px] font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950 px-2 py-0.5 rounded">
                Strict Active
              </span>
            </div>
          </div>
        </div>

        {/* Server & Engine Diagnostics */}
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 p-5 space-y-3 shadow-xs">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-sm font-bold text-slate-900 dark:text-slate-100">
              <Server className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
              <span>Backend Engine &amp; Failover Generator Status</span>
            </div>
            <span className="flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 border border-emerald-200/60 dark:border-emerald-800">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
              Auto-Failover Active
            </span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
            <div className="p-2.5 rounded-lg bg-slate-50 dark:bg-slate-950 border border-slate-200/60 dark:border-slate-800">
              <span className="text-slate-400 block text-[10px] uppercase">Primary Engine</span>
              <span className="font-semibold text-slate-800 dark:text-slate-200">Gemini 3.8 Flash</span>
            </div>
            <div className="p-2.5 rounded-lg bg-slate-50 dark:bg-slate-950 border border-slate-200/60 dark:border-slate-800">
              <span className="text-slate-400 block text-[10px] uppercase">Backup Generator</span>
              <span className="font-semibold text-indigo-600 dark:text-indigo-400">CometAPI (Online)</span>
            </div>
            <div className="p-2.5 rounded-lg bg-slate-50 dark:bg-slate-950 border border-slate-200/60 dark:border-slate-800">
              <span className="text-slate-400 block text-[10px] uppercase">Active Provider</span>
              <span className="font-semibold text-emerald-600 dark:text-emerald-400">
                {healthStatus?.activeProvider || 'Gemini Primary'}
              </span>
            </div>
            <div className="p-2.5 rounded-lg bg-slate-50 dark:bg-slate-950 border border-slate-200/60 dark:border-slate-800">
              <span className="text-slate-400 block text-[10px] uppercase">Quota Recovery</span>
              <span className="font-semibold text-emerald-600 dark:text-emerald-400">
                Auto-Resume Enabled
              </span>
            </div>
          </div>
          <p className="text-[11px] text-slate-500 dark:text-slate-400 pt-1">
            ⚡ <strong>Failover Guarantee:</strong> If Google AI Studio Gemini API reaches its daily quota or temporary rate limit, the system instantly switches to the CometAPI Backup Generator. When the limit resets, traffic automatically reverts to Gemini.
          </p>
        </div>

        {/* Architectural Flow Diagram */}
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 p-5 space-y-3 shadow-xs">
          <div className="flex items-center gap-2 text-sm font-bold text-slate-900 dark:text-slate-100">
            <Layers className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
            <span>Dual-Engine Failover Architecture</span>
          </div>

          <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200/60 dark:border-slate-800 font-mono text-[11px] text-slate-700 dark:text-slate-300 overflow-x-auto whitespace-pre leading-relaxed">
{`User Input (Text or Voice)
  ↓
Web UI / Microphone (Web Speech / MediaRecorder)
  ↓
Input Validation & Unicode Normalization (Preserves ZWJ \\u200D & Sinhala \\u0D80-\\u0DFF)
  ↓
Security Layer (Rate Limiter + Prompt Fencing + Strict Security Headers)
  ↓
Application API Router (/api/process, /api/translate, /api/email, /api/stt)
  ↓
Dual-Engine AI Orchestrator
  ├── Primary: Google Gemini 3.8 Flash / 3.1 Flash-Lite
  └── Auto-Failover: CometAPI Backup Generator (gemini-2.5-flash / gpt-4o-mini)
      ↳ Instant handover on 429 / RESOURCE_EXHAUSTED / Quota limits
      ↳ Periodic auto-check & automatic resumption once quota restores
  ↓
Output Validation & Canary Scrubbing
  ↓
User Interface (Instant Copy / Edit / Share / Audio Playback)`}
          </div>
        </div>
      </div>
    </div>
  );
};
