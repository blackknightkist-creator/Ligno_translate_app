import React, { useState, useEffect } from 'react';
import { 
  History, 
  Trash2, 
  Download, 
  Search, 
  Copy, 
  Check, 
  ExternalLink, 
  Shield, 
  FileText,
  AlertTriangle
} from 'lucide-react';
import { 
  getHistory, 
  removeHistoryItem, 
  clearAllHistory, 
  exportHistoryFile,
  getStoredSettings,
  saveSettings
} from '../utils/storage';
import { HistoryItem } from '../types';

interface HistoryViewProps {
  onReuseItem: (item: HistoryItem) => void;
}

export const HistoryView: React.FC<HistoryViewProps> = ({ onReuseItem }) => {
  const [items, setItems] = useState<HistoryItem[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterMode, setFilterMode] = useState<string>('all');
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [confirmClear, setConfirmClear] = useState(false);
  const [storeLocally, setStoreLocally] = useState(true);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = () => {
    const settings = getStoredSettings();
    setStoreLocally(settings.storeHistoryLocally);
    setItems(getHistory());
  };

  const handleToggleStoreLocally = () => {
    const settings = getStoredSettings();
    const updated = !settings.storeHistoryLocally;
    saveSettings({ ...settings, storeHistoryLocally: updated });
    setStoreLocally(updated);
    if (!updated) {
      // If user turns off history, give them option to clear
      setConfirmClear(true);
    }
  };

  const handleDeleteItem = (id: string) => {
    removeHistoryItem(id);
    setItems(getHistory());
  };

  const handleClearAll = () => {
    clearAllHistory();
    setItems([]);
    setConfirmClear(false);
  };

  const handleCopy = async (text: string, id: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 2000);
    } catch (_) {}
  };

  const filteredItems = items.filter((item) => {
    const matchesSearch = 
      item.inputText.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.primaryOutput.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesMode = filterMode === 'all' || item.mode === filterMode;
    return matchesSearch && matchesMode;
  });

  return (
    <div className="max-w-4xl mx-auto px-4 py-6 sm:py-8 space-y-6">
      {/* Header & Privacy Badge */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-2xl font-bold text-slate-900 dark:text-white">
            Activity &amp; Result History
          </h2>
          <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400">
            Stored locally in your browser only. Voice recordings are never stored.
          </p>
        </div>

        {/* Local Storage Privacy Toggle */}
        <div className="flex items-center gap-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 px-3 py-1.5 rounded-xl shadow-xs">
          <Shield className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
          <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">Save History:</span>
          <button
            type="button"
            onClick={handleToggleStoreLocally}
            className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${
              storeLocally ? 'bg-indigo-600' : 'bg-slate-300 dark:bg-slate-700'
            }`}
          >
            <span
              className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform ${
                storeLocally ? 'translate-x-4.5' : 'translate-x-1'
              }`}
            />
          </button>
        </div>
      </div>

      {/* Toolbar: Search, Filter, Export & Clear */}
      <div className="bg-white dark:bg-slate-900 p-3 rounded-2xl border border-slate-200/80 dark:border-slate-800 flex flex-wrap items-center justify-between gap-3">
        {/* Search */}
        <div className="relative flex-1 min-w-[220px]">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
          <input
            type="text"
            placeholder="Search saved text or translations..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-3 py-1.5 text-xs rounded-lg bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </div>

        {/* Mode Filter */}
        <div className="flex items-center gap-1 text-xs">
          {['all', 'unified', 'translate', 'professionalize', 'email'].map((mode) => (
            <button
              key={mode}
              type="button"
              onClick={() => setFilterMode(mode)}
              className={`px-2.5 py-1 rounded-md capitalize transition-colors ${
                filterMode === mode
                  ? 'bg-indigo-50 dark:bg-indigo-950/80 text-indigo-700 dark:text-indigo-300 font-bold'
                  : 'text-slate-500 hover:text-slate-900 dark:hover:text-slate-200'
              }`}
            >
              {mode}
            </button>
          ))}
        </div>

        {/* Export & Wipe Controls */}
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => exportHistoryFile('json')}
            className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200"
            title="Download JSON export"
          >
            <Download className="w-3.5 h-3.5" />
            <span>JSON</span>
          </button>
          <button
            type="button"
            onClick={() => exportHistoryFile('txt')}
            className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200"
            title="Download text file"
          >
            <FileText className="w-3.5 h-3.5" />
            <span>TXT</span>
          </button>
          <button
            type="button"
            onClick={() => setConfirmClear(true)}
            disabled={items.length === 0}
            className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold bg-rose-50 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400 hover:bg-rose-100 disabled:opacity-40"
            title="Delete all history"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>Clear All</span>
          </button>
        </div>
      </div>

      {/* Clear Confirmation Prompt */}
      {confirmClear && (
        <div className="p-4 rounded-xl bg-amber-50 dark:bg-amber-950/60 border border-amber-200 dark:border-amber-900 flex items-center justify-between gap-4">
          <div className="flex items-center gap-2 text-xs text-amber-900 dark:text-amber-200">
            <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
            <span>Are you sure you want to delete all saved items? This cannot be undone.</span>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={handleClearAll}
              className="px-3 py-1 bg-rose-600 text-white rounded text-xs font-bold hover:bg-rose-700"
            >
              Yes, Wipe All
            </button>
            <button
              type="button"
              onClick={() => setConfirmClear(false)}
              className="px-3 py-1 bg-slate-200 dark:bg-slate-700 text-slate-800 dark:text-slate-200 rounded text-xs font-medium"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* History Items List */}
      <div className="space-y-3">
        {filteredItems.length === 0 ? (
          <div className="p-12 text-center rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 text-slate-400 text-sm">
            <History className="w-8 h-8 mx-auto mb-2 opacity-40" />
            <p className="font-semibold text-slate-600 dark:text-slate-300">No saved history items found</p>
            <p className="text-xs text-slate-400 mt-1">
              Your translated texts, refined communications, and emails will appear here.
            </p>
          </div>
        ) : (
          filteredItems.map((item) => (
            <div
              key={item.id}
              className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200/80 dark:border-slate-800 p-4 space-y-3 shadow-2xs hover:border-indigo-300 dark:hover:border-indigo-800 transition-colors"
            >
              <div className="flex items-center justify-between text-xs text-slate-500 pb-2 border-b border-slate-100 dark:border-slate-800">
                <div className="flex items-center gap-2">
                  <span className="capitalize px-2 py-0.5 rounded font-bold bg-indigo-50 dark:bg-indigo-950/70 text-indigo-700 dark:text-indigo-300 border border-indigo-200/60 dark:border-indigo-800/60 text-[10px]">
                    {item.mode}
                  </span>
                  <span>{new Date(item.timestamp).toLocaleString()}</span>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => onReuseItem(item)}
                    className="flex items-center gap-1 text-indigo-600 dark:text-indigo-400 hover:underline font-semibold"
                  >
                    <span>Open in Editor</span>
                    <ExternalLink className="w-3 h-3" />
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDeleteItem(item.id)}
                    className="text-slate-400 hover:text-rose-500 p-1"
                    title="Delete item"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              {/* Content Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                <div>
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
                    Input ({item.inputLanguage})
                  </span>
                  <p className="text-slate-800 dark:text-slate-200 font-medium whitespace-pre-wrap line-clamp-3">
                    {item.inputText}
                  </p>
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                      Result
                    </span>
                    <button
                      type="button"
                      onClick={() => handleCopy(item.primaryOutput, item.id)}
                      className="flex items-center gap-1 text-indigo-600 hover:underline text-[11px]"
                    >
                      {copiedId === item.id ? <Check className="w-3 h-3 text-emerald-500" /> : <Copy className="w-3 h-3" />}
                      <span>{copiedId === item.id ? 'Copied' : 'Copy'}</span>
                    </button>
                  </div>
                  <p className="text-slate-900 dark:text-slate-100 font-medium whitespace-pre-wrap line-clamp-3">
                    {item.primaryOutput}
                  </p>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};
