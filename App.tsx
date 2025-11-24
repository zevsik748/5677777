
import React, { useState, useEffect } from 'react';
import { ApiKeyModal } from './components/ApiKeyModal';
import { ImageGenerator } from './components/ImageGenerator';
import { HistorySidebar } from './components/HistorySidebar';
import { STORAGE_KEY_API_KEY, STORAGE_KEY_HISTORY } from './constants';
import { HistoryItem } from './types';
import { Zap, Clock, Settings, LogOut } from 'lucide-react';

const App: React.FC = () => {
  const [apiKey, setApiKey] = useState<string | null>(null);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const [onlineCount, setOnlineCount] = useState(1240);

  useEffect(() => {
    // Check for API Key
    const storedKey = localStorage.getItem(STORAGE_KEY_API_KEY);
    if (storedKey) {
      setApiKey(storedKey);
    } else {
      setIsAuthModalOpen(true);
    }

    // Load History
    const storedHistory = localStorage.getItem(STORAGE_KEY_HISTORY);
    if (storedHistory) {
      try {
        setHistory(JSON.parse(storedHistory));
      } catch (e) {
        console.error("Failed to parse history", e);
      }
    }

    // Initialize online count randomly between 1000 and 1400
    setOnlineCount(Math.floor(Math.random() * (1400 - 1000 + 1)) + 1000);

    // Simulate gentle fluctuation
    const interval = setInterval(() => {
      setOnlineCount(prev => {
        // Change by a small amount (-4 to +4) to avoid jumping
        const change = Math.floor(Math.random() * 9) - 4;
        let next = prev + change;
        // Clamp values
        if (next < 1000) next = 1000 + Math.floor(Math.random() * 10);
        if (next > 1400) next = 1400 - Math.floor(Math.random() * 10);
        return next;
      });
    }, 3500);

    return () => clearInterval(interval);
  }, []);

  const handleApiKeySave = (key: string) => {
    setApiKey(key);
    setIsAuthModalOpen(false);
  };

  const handleHistoryUpdate = (newItem: HistoryItem) => {
    setHistory((prev) => {
      const exists = prev.find(item => item.id === newItem.id);
      let updated;
      if (exists) {
        updated = prev.map(item => item.id === newItem.id ? newItem : item);
      } else {
        updated = [newItem, ...prev];
      }
      
      localStorage.setItem(STORAGE_KEY_HISTORY, JSON.stringify(updated.slice(0, 50))); // Keep last 50
      return updated;
    });
  };

  const clearHistory = () => {
    if (confirm('Вы уверены, что хотите очистить историю?')) {
      setHistory([]);
      localStorage.removeItem(STORAGE_KEY_HISTORY);
    }
  };

  const handleSelectHistory = (item: HistoryItem) => {
    // Prioritize new resultUrl, fallback to legacy imageUrl
    const url = item.resultUrl || item.imageUrl;
    if (url) {
      window.open(url, '_blank');
    }
  };

  const resetKey = () => {
    if(confirm("Сбросить API ключ? Вам придется ввести его снова.")) {
      localStorage.removeItem(STORAGE_KEY_API_KEY);
      setApiKey(null);
      setIsAuthModalOpen(true);
    }
  }

  return (
    <div className="min-h-screen bg-black text-gray-100 font-sans flex flex-col selection:bg-banana-500/30">
      <div className="fixed inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-20 pointer-events-none z-0"></div>
      
      <ApiKeyModal isOpen={isAuthModalOpen} onSave={handleApiKeySave} />

      {/* Header */}
      <header className="h-16 border-b border-dark-800 bg-black/60 backdrop-blur-md sticky top-0 z-30 flex items-center justify-between px-4 lg:px-8 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-banana-400 to-banana-600 flex items-center justify-center text-dark-950 shadow-lg shadow-banana-500/20">
            <Zap className="w-5 h-5 fill-current" />
          </div>
          <h1 className="text-lg font-bold tracking-tight text-white">
            AI Client <span className="text-banana-500">All-in-One</span>
          </h1>
        </div>
        
        <div className="flex items-center gap-2">
          
          {/* Online Users Badge */}
          <div className="hidden md:flex items-center gap-2 px-3 py-1.5 bg-dark-800/50 rounded-full border border-white/5 mr-2 select-none">
              <div className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span>
              </div>
              <span className="text-xs font-medium text-gray-400">
                 <span className="text-gray-200 font-mono font-bold">{onlineCount}</span> онлайн
              </span>
          </div>

          {apiKey && (
            <button 
              onClick={resetKey}
              className="p-2 text-dark-400 hover:text-white transition-colors rounded-lg hover:bg-dark-800"
              title="Сменить API ключ"
            >
              <Settings className="w-5 h-5" />
            </button>
          )}
          <button 
            className={`p-2 transition-colors rounded-lg hover:bg-dark-800 ${isHistoryOpen ? 'text-banana-500 bg-banana-500/10' : 'text-gray-400 hover:text-white'}`}
            onClick={() => setIsHistoryOpen(!isHistoryOpen)}
            title="История"
          >
            <Clock className="w-5 h-5" />
          </button>
        </div>
      </header>

      {/* Main Content - Centered Focus Mode */}
      <main className="flex-1 overflow-y-auto w-full relative z-10">
         <div className="max-w-3xl mx-auto p-4 lg:p-8 pb-32">
           {apiKey ? (
             <ImageGenerator 
               apiKey={apiKey} 
               onHistoryUpdate={handleHistoryUpdate}
             />
           ) : (
             <div className="flex flex-col items-center justify-center mt-32 text-gray-500 gap-6 animate-in fade-in slide-in-from-bottom-4 duration-700">
                <div className="w-20 h-20 rounded-2xl bg-dark-900 border border-dark-800 flex items-center justify-center shadow-2xl">
                   <Zap className="w-10 h-10 text-dark-700" />
                </div>
                <div className="text-center space-y-2">
                  <h2 className="text-xl font-semibold text-gray-300">Добро пожаловать</h2>
                  <p>Введите API ключ для начала работы</p>
                </div>
                <button 
                  onClick={() => setIsAuthModalOpen(true)}
                  className="px-6 py-3 bg-banana-500 hover:bg-banana-400 text-dark-950 font-bold rounded-xl transition-all shadow-lg shadow-banana-500/20"
                >
                  Авторизация
                </button>
             </div>
           )}
         </div>
      </main>

      {/* History Drawer Overlay */}
      <>
        {/* Backdrop */}
        <div 
          className={`fixed inset-0 bg-black/60 backdrop-blur-sm z-40 transition-opacity duration-300 ${isHistoryOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
          onClick={() => setIsHistoryOpen(false)}
        />
        
        {/* Drawer Panel */}
        <div 
          className={`fixed inset-y-0 right-0 z-50 w-full sm:w-96 bg-dark-900 shadow-2xl transform transition-transform duration-300 ease-out ${isHistoryOpen ? 'translate-x-0' : 'translate-x-full'}`}
        >
          <HistorySidebar 
            history={history} 
            onSelect={(item) => {
              handleSelectHistory(item);
              // Optional: Don't close drawer immediately to allow multiple opens
            }}
            onClear={clearHistory}
            onClose={() => setIsHistoryOpen(false)}
          />
        </div>
      </>

    </div>
  );
};

export default App;
