import React, { useState, useEffect } from 'react';
import { Navbar, NavTab } from './components/Navbar';
import { HomeAssistant } from './components/HomeAssistant';
import { TranslateView } from './components/TranslateView';
import { ProfessionalizeView } from './components/ProfessionalizeView';
import { EmailView } from './components/EmailView';
import { HistoryView } from './components/HistoryView';
import { SettingsView } from './components/SettingsView';
import { SecurityTestSuite } from './components/SecurityTestSuite';
import { HistoryItem } from './types';
import { ShieldCheck, Heart, Sparkles, Terminal } from 'lucide-react';

export default function App() {
  const [currentTab, setCurrentTab] = useState<NavTab>('home');
  const [isDarkMode, setIsDarkMode] = useState<boolean>(() => {
    return localStorage.getItem('lingopro_dark_mode') === 'true';
  });
  const [isApiHealthy, setIsApiHealthy] = useState<boolean>(true);

  // Cross-view state transfer
  const [emailPrompt, setEmailPrompt] = useState<string>('');
  const [translatePrompt, setTranslatePrompt] = useState<string>('');
  const [profPrompt, setProfPrompt] = useState<string>('');

  // Apply dark mode class to html element
  useEffect(() => {
    const root = document.documentElement;
    if (isDarkMode) {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
    localStorage.setItem('lingopro_dark_mode', String(isDarkMode));
  }, [isDarkMode]);

  // Health check on mount and periodic poll
  useEffect(() => {
    const checkHealth = async () => {
      try {
        const res = await fetch('/api/health');
        setIsApiHealthy(res.ok);
      } catch (_) {
        setIsApiHealthy(false);
      }
    };
    checkHealth();
    const interval = setInterval(checkHealth, 30000);
    return () => clearInterval(interval);
  }, []);

  const handleNavigateToEmail = (promptText = '') => {
    setEmailPrompt(promptText);
    setCurrentTab('email');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleNavigateToTranslate = (text = '') => {
    setTranslatePrompt(text);
    setCurrentTab('translate');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleNavigateToProfessionalize = (text = '') => {
    setProfPrompt(text);
    setCurrentTab('professionalize');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleReuseHistoryItem = (item: HistoryItem) => {
    if (item.mode === 'email') {
      setEmailPrompt(item.inputText);
      setCurrentTab('email');
    } else if (item.mode === 'translate') {
      setTranslatePrompt(item.inputText);
      setCurrentTab('translate');
    } else if (item.mode === 'professionalize') {
      setProfPrompt(item.inputText);
      setCurrentTab('professionalize');
    } else {
      setTranslatePrompt(item.inputText);
      setCurrentTab('home');
    }
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 selection:bg-indigo-500 selection:text-white transition-colors duration-200">
      {/* Navigation Header */}
      <Navbar
        currentTab={currentTab}
        onSelectTab={setCurrentTab}
        isDarkMode={isDarkMode}
        onToggleDarkMode={() => setIsDarkMode(!isDarkMode)}
        isApiHealthy={isApiHealthy}
      />

      {/* Main App Content View Switcher */}
      <main className="flex-1 pb-12">
        {currentTab === 'home' && (
          <HomeAssistant
            onNavigateToEmail={handleNavigateToEmail}
            onNavigateToTranslate={handleNavigateToTranslate}
            onNavigateToProfessionalize={handleNavigateToProfessionalize}
          />
        )}

        {currentTab === 'translate' && (
          <TranslateView
            initialText={translatePrompt}
            onNavigateToEmail={handleNavigateToEmail}
          />
        )}

        {currentTab === 'professionalize' && (
          <ProfessionalizeView
            initialText={profPrompt}
            onNavigateToEmail={handleNavigateToEmail}
          />
        )}

        {currentTab === 'email' && (
          <EmailView initialPrompt={emailPrompt} />
        )}

        {currentTab === 'history' && (
          <HistoryView onReuseItem={handleReuseHistoryItem} />
        )}

        {currentTab === 'security' && (
          <SecurityTestSuite />
        )}

        {currentTab === 'settings' && (
          <SettingsView
            isDarkMode={isDarkMode}
            onToggleDarkMode={() => setIsDarkMode(!isDarkMode)}
          />
        )}
      </main>

      {/* Trust & Craft Footer */}
      <footer className="border-t border-slate-200 dark:border-slate-800/80 bg-white/50 dark:bg-slate-900/50 py-6 text-xs text-slate-500 dark:text-slate-400">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <span className="font-bold text-slate-700 dark:text-slate-300">LingoPro AI</span>
            <span>•</span>
            <span>Sinhala ↔ English Voice &amp; Communication Assistant</span>
          </div>

          <div className="flex flex-wrap items-center gap-4 text-[11px]">
            <span className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400">
              <ShieldCheck className="w-3.5 h-3.5" />
              <span>Zero-Storage Audio Privacy</span>
            </span>
            <span>•</span>
            <span>Sinhala Unicode Standard Compliant</span>
            <span>•</span>
            <button
              onClick={() => setCurrentTab('security')}
              className="text-indigo-600 dark:text-indigo-400 hover:underline flex items-center gap-1"
            >
              <Terminal className="w-3 h-3" />
              <span>QA &amp; Security Lab</span>
            </button>
          </div>
        </div>
      </footer>
    </div>
  );
}
