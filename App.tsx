import React, { Component, useState, useEffect, ReactNode, ErrorInfo } from 'react';
import { ApiKeyModal } from './components/ApiKeyModal';
import { ImageGenerator } from './components/ImageGenerator';
import { HistorySidebar } from './components/HistorySidebar';
import { STORAGE_KEY_API_KEY, STORAGE_KEY_HISTORY, SECRET_TELEGRAM_LINK, K_PART_1, K_PART_2, K_PART_3, K_PART_4, PROMO_RATES } from './constants';
import { HistoryItem } from './types';
import { Zap, Clock, Wallet, AlertTriangle, Send, Bot } from 'lucide-react';

interface ErrorBoundaryProps {
  children?: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: string;
}

class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  public state: ErrorBoundaryState = { hasError: false, error: "" };

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error: error.message };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("ErrorBoundary caught error:", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-black flex items-center justify-center p-4">
          <div className="bg-gray-900 border border-red-500/30 p-8 rounded-2xl max-w-md w-full text-center space-y-4 shadow-2xl">
            <div className="w-16 h-16 bg-red-500/10 rounded-full flex items-center justify-center mx-auto">
                <AlertTriangle className="w-8 h-8 text-red-500" />
            </div>
            <h2 className="text-xl font-bold text-white">Произошла ошибка</h2>
            <p className="text-gray-400 text-sm">{this.state.error}</p>
            <button 
              onClick={() => {
                try {
                    localStorage.clear();
                } catch(e) {}
                window.location.reload();
              }}
              className="px-6 py-3 bg-red-600 hover:bg-red-500 text-white rounded-xl font-bold transition-colors w-full"
            >
              Полный сброс
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

const STORAGE_KEY_BALANCE = 'kie_wallet_balance';
const STORAGE_KEY_USED_CODES = 'kie_used_promos';

export default function App() {
  const [apiKey, setApiKey] = useState('');
  const [balance, setBalance] = useState(0); 
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [usedCodes, setUsedCodes] = useState<string[]>([]);
  
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [selectedHistoryItem, setSelectedHistoryItem] = useState<HistoryItem | null>(null);
  const [onlineUsers, setOnlineUsers] = useState(1240);

  useEffect(() => {
    // ASSEMBLE API KEY
    const k = K_PART_1 + K_PART_2 + K_PART_3 + K_PART_4;
    setApiKey(k);

    try {
      const histRaw = localStorage.getItem(STORAGE_KEY_HISTORY);
      if (histRaw) {
        try {
          const parsed = JSON.parse(histRaw);
          if (Array.isArray(parsed)) setHistory(parsed);
        } catch(e) { console.error('History parse error', e); }
      }

      const balRaw = localStorage.getItem(STORAGE_KEY_BALANCE);
      if (balRaw) {
         const parsed = parseFloat(balRaw);
         if (!isNaN(parsed)) setBalance(parsed);
      }

      const codesRaw = localStorage.getItem(STORAGE_KEY_USED_CODES);
      if (codesRaw) {
         try {
           const parsed = JSON.parse(codesRaw);
           if (Array.isArray(parsed)) setUsedCodes(parsed);
         } catch(e) {}
      }
    } catch (e) {
      console.error("Storage error", e);
    }
  }, []);

  useEffect(() => {
    // Faster, more dynamic online updates
    const interval = setInterval(() => {
      setOnlineUsers(prev => {
        const change = Math.floor(Math.random() * 7) - 3; 
        let next = prev + change;
        if (next < 1000) next = 1000 + Math.floor(Math.random() * 50);
        if (next > 1400) next = 1400 - Math.floor(Math.random() * 50);
        return next;
      });
    }, 2000);
    return () => clearInterval(interval);
  }, []);

  const handleUpdateHistory = (item: HistoryItem) => {
    setHistory(prev => {
      const exists = prev.find(i => i.id === item.id);
      let newHistory;
      if (exists) {
        newHistory = prev.map(i => i.id === item.id ? item : i);
      } else {
        newHistory = [item, ...prev];
      }
      try {
        localStorage.setItem(STORAGE_KEY_HISTORY, JSON.stringify(newHistory));
      } catch(e) {}
      return newHistory;
    });
  };

  const handleClearHistory = () => {
    if (window.confirm('Вы уверены, что хотите очистить историю?')) {
      setHistory([]);
      localStorage.removeItem(STORAGE_KEY_HISTORY);
    }
  };

  const handleDeductBalance = (amount: number) => {
    setBalance(prev => {
      const newVal = Math.max(0, prev - amount);
      localStorage.setItem(STORAGE_KEY_BALANCE, JSON.stringify(newVal));
      return newVal;
    });
  };

  const handleRedeemPromo = (code: string): { success: boolean; message: string } => {
    const normalizedCode = code.trim();
    if (usedCodes.includes(normalizedCode)) return { success: false, message: 'Этот код уже использован' };

    // STRICT PROMO CHECKING
    const rate = PROMO_RATES[normalizedCode as keyof typeof PROMO_RATES];
    
    if (rate) {
        setBalance(prev => {
          const newVal = prev + rate;
          localStorage.setItem(STORAGE_KEY_BALANCE, JSON.stringify(newVal));
          return newVal;
        });
        setUsedCodes(prev => {
          const newCodes = [...prev, normalizedCode];
          localStorage.setItem(STORAGE_KEY_USED_CODES, JSON.stringify(newCodes));
          return newCodes;
        });
        return { success: true, message: `Баланс пополнен: +${rate}₽` };
    }

    return { success: false, message: 'Неверный код' };
  };

  return (
    <ErrorBoundary>
      <div className="min-h-screen text-gray-200 font-sans selection:bg-banana-500/30">
        <nav className="fixed top-0 left-0 right-0 z-40 bg-dark-950/80 backdrop-blur-xl border-b border-white/5">
          <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 bg-gradient-to-br from-banana-400 to-banana-600 rounded-lg flex items-center justify-center shadow-lg shadow-banana-500/20">
                <Zap className="w-5 h-5 text-gray-950 fill-current" />
              </div>
              <span className="font-bold text-xl tracking-tight text-white hidden sm:block">
                AI <span className="text-banana-500">Studio</span>
              </span>
            </div>

            <div className="flex items-center gap-3">
               <div className="hidden md:flex items-center gap-2 px-3 py-1.5 bg-dark-900 rounded-full border border-white/5">
                  <div className="relative flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span>
                  </div>
                  <span className="text-xs font-mono text-gray-400">
                    <span className="text-white font-bold">{onlineUsers}</span> online
                  </span>
               </div>

              <button onClick={() => setIsModalOpen(true)} className="flex items-center gap-2 px-3 py-1.5 bg-dark-900 hover:bg-dark-800 border border-white/10 rounded-full transition-all group">
                <Wallet className="w-4 h-4 text-gray-400 group-hover:text-banana-500 transition-colors" />
                <span className="font-mono font-bold text-sm text-white">{balance} ₽</span>
              </button>

              <button onClick={() => setIsSidebarOpen(true)} className="p-2 hover:bg-white/5 rounded-lg transition-colors relative">
                <Clock className="w-5 h-5 text-gray-400" />
                {history.some(h => h.status === 'waiting') && <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-banana-500 rounded-full animate-pulse" />}
              </button>

              <button onClick={() => setIsModalOpen(true)} className="hidden sm:flex items-center gap-2 px-4 py-2 bg-white text-black font-bold text-sm rounded-lg hover:bg-gray-200 transition-colors">
                Кошелек
              </button>
            </div>
          </div>
        </nav>

        <main className="pt-24 px-4 max-w-5xl mx-auto pb-24 md:pb-12">
          <div className="mb-6 flex flex-col sm:flex-row gap-3 justify-center items-center text-xs md:text-sm font-medium animate-in fade-in slide-in-from-top-4 duration-700">
             <a href={SECRET_TELEGRAM_LINK} target="_blank" rel="noreferrer" className="w-full sm:w-auto flex items-center justify-center gap-2 px-4 py-2 bg-blue-500/10 hover:bg-blue-500/20 text-blue-400 rounded-xl transition-colors border border-blue-500/20">
                <Send className="w-3 h-3 md:w-4 md:h-4" /> Подписывайся: @ferixdi_ai
             </a>
             <a href="https://t.me/imgbananobot" target="_blank" rel="noreferrer" className="w-full sm:w-auto flex items-center justify-center gap-2 px-4 py-2 bg-banana-500/10 hover:bg-banana-500/20 text-banana-500 rounded-xl transition-colors border border-banana-500/20">
                <Bot className="w-3 h-3 md:w-4 md:h-4" /> Бесплатно: @imgbananobot
             </a>
          </div>

          <ImageGenerator 
            apiKey={apiKey}
            balance={balance}
            onHistoryUpdate={handleUpdateHistory}
            onDeductBalance={handleDeductBalance}
            onReqTopUp={() => setIsModalOpen(true)}
            selectedItem={selectedHistoryItem}
          />
        </main>

        <div className={`fixed inset-y-0 right-0 w-80 bg-dark-950 transform transition-transform duration-300 z-[60] border-l border-white/5 shadow-2xl ${isSidebarOpen ? 'translate-x-0' : 'translate-x-full'}`}>
          <HistorySidebar 
            history={history} 
            onSelect={(item) => { setSelectedHistoryItem(item); setIsSidebarOpen(false); }}
            onClear={handleClearHistory}
            onClose={() => setIsSidebarOpen(false)}
          />
        </div>

        {isSidebarOpen && <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[55]" onClick={() => setIsSidebarOpen(false)} />}

        <ApiKeyModal 
          isOpen={isModalOpen} onClose={() => setIsModalOpen(false)}
          balance={balance} 
          onRedeemPromo={handleRedeemPromo}
        />
      </div>
    </ErrorBoundary>
  );
}