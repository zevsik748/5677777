
import React, { useState, useEffect } from 'react';
import { ApiKeyModal } from './components/ApiKeyModal';
import { ImageGenerator } from './components/ImageGenerator';
import { HistorySidebar } from './components/HistorySidebar';
import { STORAGE_KEY_API_KEY, STORAGE_KEY_HISTORY } from './constants';
import { HistoryItem } from './types';
import { Zap, Clock, Settings, Wallet, Shield } from 'lucide-react';

// Safe environment variable getter
const getEnv = (key: string): string | undefined => {
  try {
    // @ts-ignore
    if (typeof import.meta !== 'undefined' && import.meta.env) {
      // @ts-ignore
      return import.meta.env[key];
    }
  } catch (e) {
    console.warn('Environment access error');
  }
  return undefined;
};

const App: React.FC = () => {
  // Application State
  const [apiKey, setApiKey] = useState<string | null>(null);
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const [onlineCount, setOnlineCount] = useState(1240);
  
  // Wallet / Auth State
  const [balance, setBalance] = useState<number>(0);
  const [isWalletModalOpen, setIsWalletModalOpen] = useState(false);
  
  // Timeweb / Server Config State
  const [accessCode, setAccessCode] = useState<string | null>(null); // The code to TOP UP
  const [lavaUrl, setLavaUrl] = useState<string | null>(null);

  useEffect(() => {
    // 1. Load configuration from Environment (Timeweb)
    const envApiKey = getEnv('VITE_API_KEY');
    const envAccessCode = getEnv('VITE_ACCESS_CODE');
    const envLavaUrl = getEnv('VITE_LAVA_URL');
    const envLavaKey = getEnv('VITE_LAVA_KEY'); // Fallback

    // Set API Key immediately if available (No Auth Screen)
    if (envApiKey) {
      setApiKey(envApiKey);
    } else {
      // Fallback: Check local storage for manually entered key
      const storedKey = localStorage.getItem(STORAGE_KEY_API_KEY);
      if (storedKey) setApiKey(storedKey);
    }

    if (envAccessCode) setAccessCode(envAccessCode);
    if (envLavaUrl || envLavaKey) {
      setLavaUrl(envLavaUrl || "https://lava.top/"); 
    }

    // 2. Load History
    const storedHistory = localStorage.getItem(STORAGE_KEY_HISTORY);
    if (storedHistory) {
      try {
        setHistory(JSON.parse(storedHistory));
      } catch (e) {
        console.error("Failed to parse history", e);
      }
    }

    // 3. Load Balance
    const storedBalance = localStorage.getItem('kie_user_balance');
    if (storedBalance) {
      setBalance(parseInt(storedBalance, 10));
    } else {
      setBalance(0); // Default start balance
    }

    // Fake Online Counter
    setOnlineCount(Math.floor(Math.random() * (1400 - 1000 + 1)) + 1000);
    const interval = setInterval(() => {
      setOnlineCount(prev => {
        const change = Math.floor(Math.random() * 9) - 4;
        let next = prev + change;
        if (next < 1000) next = 1000 + Math.floor(Math.random() * 10);
        if (next > 1400) next = 1400 - Math.floor(Math.random() * 10);
        return next;
      });
    }, 3500);

    return () => clearInterval(interval);
  }, []);

  const handleTopUp = (code: string) => {
    // If code matches the environment Access Code, add balance
    if (accessCode && code.trim() === accessCode) {
      const newBalance = 5000; // Grant 5000 RUB or whatever logic
      setBalance(newBalance);
      localStorage.setItem('kie_user_balance', newBalance.toString());
      setIsWalletModalOpen(false);
      alert(`Код принят! Баланс пополнен до ${newBalance} ₽`);
    } else {
      alert("Неверный код пополнения!");
    }
  };

  const handleDeductBalance = (amount: number) => {
    const newBalance = Math.max(0, balance - amount);
    setBalance(newBalance);
    localStorage.setItem('kie_user_balance', newBalance.toString());
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
      localStorage.setItem(STORAGE_KEY_HISTORY, JSON.stringify(updated.slice(0, 50))); 
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
    const url = item.resultUrl || item.imageUrl;
    if (url) window.open(url, '_blank');
  };

  return (
    <div className="min-h-screen bg-black text-gray-100 font-sans flex flex-col selection:bg-banana-500/30">
      <div className="fixed inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-20 pointer-events-none z-0"></div>
      
      {/* Wallet / Top Up Modal */}
      <ApiKeyModal 
        isOpen={isWalletModalOpen} 
        onSave={handleTopUp} 
        mode="access-code"
        currentBalance={balance}
        lavaUrl={lavaUrl || undefined}
        onClose={() => setIsWalletModalOpen(false)}
      />

      {/* Header */}
      <header className="h-16 border-b border-dark-800 bg-black/60 backdrop-blur-md sticky top-0 z-30 flex items-center justify-between px-4 lg:px-8 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-banana-400 to-banana-600 flex items-center justify-center text-dark-950 shadow-lg shadow-banana-500/20">
            <Zap className="w-5 h-5 fill-current" />
          </div>
          <h1 className="text-lg font-bold tracking-tight text-white hidden md:block">
            AI Client <span className="text-banana-500">All-in-One</span>
          </h1>
          <h1 className="text-lg font-bold tracking-tight text-white md:hidden">
            AI <span className="text-banana-500">Client</span>
          </h1>
        </div>
        
        <div className="flex items-center gap-2">
          
          <div className="hidden md:flex items-center gap-2 px-3 py-1.5 bg-dark-800/50 rounded-full border border-white/5 mr-2 select-none">
              <div className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span>
              </div>
              <span className="text-xs font-medium text-gray-400">
                 <span className="text-gray-200 font-mono font-bold">{onlineCount}</span> онлайн
              </span>
          </div>

          {/* Wallet Button */}
          <button 
            onClick={() => setIsWalletModalOpen(true)}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border transition-all ${
              balance > 0 
                ? 'bg-dark-900 border-dark-700 text-green-400 hover:border-green-500/50' 
                : 'bg-red-900/20 border-red-500/30 text-red-400 hover:bg-red-900/30'
            }`}
          >
            <Wallet className="w-4 h-4" />
            <span className="font-mono font-bold text-sm">{balance} ₽</span>
          </button>

          <button 
            className={`p-2 transition-colors rounded-lg hover:bg-dark-800 ${isHistoryOpen ? 'text-banana-500 bg-banana-500/10' : 'text-gray-400 hover:text-white'}`}
            onClick={() => setIsHistoryOpen(!isHistoryOpen)}
            title="История"
          >
            <Clock className="w-5 h-5" />
          </button>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto w-full relative z-10">
         <div className="max-w-3xl mx-auto p-4 lg:p-8 pb-32">
           {apiKey ? (
             <ImageGenerator 
               apiKey={apiKey} 
               onHistoryUpdate={handleHistoryUpdate}
               lavaUrl={lavaUrl || undefined}
               balance={balance}
               onDeductBalance={handleDeductBalance}
               onReqTopUp={() => setIsWalletModalOpen(true)}
             />
           ) : (
             /* Fallback if Key is missing completely */
             <div className="flex flex-col items-center justify-center mt-32 text-gray-500 gap-6">
                <Shield className="w-16 h-16 text-dark-700" />
                <div className="text-center">
                  <h2 className="text-xl font-bold text-gray-300">Система не настроена</h2>
                  <p className="text-sm">API Key не найден в настройках.</p>
                </div>
             </div>
           )}
         </div>
      </main>

      {/* History Drawer */}
      <>
        <div 
          className={`fixed inset-0 bg-black/60 backdrop-blur-sm z-40 transition-opacity duration-300 ${isHistoryOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
          onClick={() => setIsHistoryOpen(false)}
        />
        <div 
          className={`fixed inset-y-0 right-0 z-50 w-full sm:w-96 bg-dark-900 shadow-2xl transform transition-transform duration-300 ease-out ${isHistoryOpen ? 'translate-x-0' : 'translate-x-full'}`}
        >
          <HistorySidebar 
            history={history} 
            onSelect={(item) => handleSelectHistory(item)}
            onClear={clearHistory}
            onClose={() => setIsHistoryOpen(false)}
          />
        </div>
      </>
    </div>
  );
};

export default App;
