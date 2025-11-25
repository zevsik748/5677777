import React, { useState, useEffect, ReactNode, Component, ErrorInfo } from 'react';
import { ApiKeyModal } from './components/ApiKeyModal';
import { ImageGenerator } from './components/ImageGenerator';
import { HistorySidebar } from './components/HistorySidebar';
import { STORAGE_KEY_API_KEY, STORAGE_KEY_HISTORY, SECRET_TELEGRAM_LINK } from './constants';
import { HistoryItem } from './types';
import { Zap, Clock, Wallet, AlertTriangle, Send, Bot, Users } from 'lucide-react';

// --- Error Boundary ---
interface ErrorBoundaryProps {
  children?: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: string;
}

class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: "" };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error: error.message };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("ErrorBoundary caught error:", error, errorInfo);
    // Emergency cleanup
    try {
      // We don't clear API key, but maybe history if it's corrupt
    } catch(e) {}
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-black flex items-center justify-center p-4">
          <div className="bg-dark-900 border border-red-500/30 p-8 rounded-2xl max-w-md w-full text-center space-y-4 shadow-2xl">
            <div className="w-16 h-16 bg-red-500/10 rounded-full flex items-center justify-center mx-auto">
                <AlertTriangle className="w-8 h-8 text-red-500" />
            </div>
            <h2 className="text-xl font-bold text-white">Произошла ошибка</h2>
            <p className="text-gray-400 text-sm">{this.state.error}</p>
            <button 
              onClick={() => {
                localStorage.removeItem(STORAGE_KEY_HISTORY);
                window.location.reload();
              }}
              className="px-6 py-3 bg-red-600 hover:bg-red-500 text-white rounded-xl font-bold transition-colors w-full"
            >
              Сбросить и перезагрузить
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

// --- Utils ---
const STORAGE_KEY_BALANCE = 'kie_wallet_balance';
const STORAGE_KEY_USED_CODES = 'kie_used_promos';

const safeJsonParse = <T,>(str: string | null, fallback: T): T => {
  if (!str) return fallback;
  try {
    const res = JSON.parse(str);
    return res as T;
  } catch (e) {
    return fallback;
  }
};

export default function App() {
  const [apiKey, setApiKey] = useState('');
  const [balance, setBalance] = useState(0); 
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [usedCodes, setUsedCodes] = useState<string[]>([]);
  
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [selectedHistoryItem, setSelectedHistoryItem] = useState<HistoryItem | null>(null);
  
  // Fake online counter
  const [onlineUsers, setOnlineUsers] = useState(1240);

  // Initial Load
  useEffect(() => {
    try {
      const storedKey = localStorage.getItem(STORAGE_KEY_API_KEY);
      if (storedKey) setApiKey(storedKey);

      const storedHistory = safeJsonParse<HistoryItem[]>(localStorage.getItem(STORAGE_KEY_HISTORY), []);
      setHistory(Array.isArray(storedHistory) ? storedHistory : []);

      const storedBalance = safeJsonParse<number>(localStorage.getItem(STORAGE_KEY_BALANCE), 0);
      setBalance(typeof storedBalance === 'number' ? storedBalance : 0);

      const storedCodes = safeJsonParse<string[]>(localStorage.getItem(STORAGE_KEY_USED_CODES), []);
      setUsedCodes(Array.isArray(storedCodes) ? storedCodes : []);

    } catch (e) {
      console.error("Initialization error", e);
    }
  }, []);

  // Online Users Interval
  useEffect(() => {
    const interval = setInterval(() => {
      setOnlineUsers(prev => {
        const change = Math.floor(Math.random() * 5) - 2; // -2 to +2
        const next = prev + change;
        return next < 1000 ? 1000 : next > 1400 ? 1400 : next;
      });
    }, 3000);
    return () => clearInterval(interval);
  }, []);

  // Handlers
  const handleSetApiKey = (key: string) => {
    setApiKey(key);
    localStorage.setItem(STORAGE_KEY_API_KEY, key);
  };

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
    
    if (usedCodes.includes(normalizedCode)) {
      return { success: false, message: 'Этот код уже использован' };
    }

    // Logic: check prefix 'ferixdi' and parse number
    if (normalizedCode.toLowerCase().startsWith('ferixdi')) {
      const amountStr = normalizedCode.substring(7); // remove 'ferixdi'
      const amount = parseInt(amountStr, 10);
      
      if (!isNaN(amount) && amount > 0) {
        setBalance(prev => {
          const newVal = prev + amount;
          localStorage.setItem(STORAGE_KEY_BALANCE, JSON.stringify(newVal));
          return newVal;
        });
        setUsedCodes(prev => {
          const newCodes = [...prev, normalizedCode];
          localStorage.setItem(STORAGE_KEY_USED_CODES, JSON.stringify(newCodes));
          return newCodes;
        });
        return { success: true, message: `Промокод активирован: +${amount}₽` };
      }
    }

    return { success: false, message: 'Неверный код' };
  };

  const handleHistorySelect = (item: HistoryItem) => {
    setSelectedHistoryItem(item);
    setIsSidebarOpen(false);
  };

  return (
    <ErrorBoundary>
      <div className="min-h-screen text-gray-200 font-sans selection:bg-banana-500/30 pb-10">
        
        {/* Navbar */}
        <nav className="fixed top-0 left-0 right-0 z-40 bg-dark-950/80 backdrop-blur-md border-b border-white/5">
          <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 bg-gradient-to-br from-banana-400 to-banana-600 rounded-lg flex items-center justify-center shadow-lg shadow-banana-500/20">
                <Zap className="w-5 h-5 text-dark-950 fill-current" />
              </div>
              <span className="font-bold text-xl tracking-tight text-white hidden sm:block">
                AI <span className="text-banana-500">Studio</span>
              </span>
            </div>

            <div className="flex items-center gap-3">
               {/* Online Counter */}
               <div className="hidden md:flex items-center gap-2 px-3 py-1.5 bg-dark-900 rounded-full border border-white/5">
                  <div className="relative flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span>
                  </div>
                  <span className="text-xs font-mono text-gray-400">
                    <span className="text-white font-bold">{onlineUsers}</span> online
                  </span>
               </div>

              <button 
                onClick={() => setIsModalOpen(true)}
                className="flex items-center gap-2 px-3 py-1.5 bg-dark-900 hover:bg-dark-800 border border-white/10 rounded-full transition-all group"
              >
                <Wallet className="w-4 h-4 text-gray-400 group-hover:text-banana-500 transition-colors" />
                <span className="font-mono font-bold text-sm text-white">{balance} ₽</span>
              </button>

              <button 
                onClick={() => setIsSidebarOpen(true)}
                className="p-2 hover:bg-white/5 rounded-lg transition-colors relative"
              >
                <Clock className="w-5 h-5 text-gray-400" />
                {history.some(h => h.status === 'waiting') && (
                  <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-banana-500 rounded-full animate-pulse" />
                )}
              </button>

              <button 
                 onClick={() => setIsModalOpen(true)}
                 className="hidden sm:flex items-center gap-2 px-4 py-2 bg-white text-black font-bold text-sm rounded-lg hover:bg-gray-200 transition-colors"
              >
                Кабинет
              </button>
            </div>
          </div>
        </nav>

        {/* Main Content */}
        <main className="pt-24 px-4 max-w-5xl mx-auto">
          
          {/* INFO BANNER */}
          <div className="mb-8 flex flex-col sm:flex-row gap-3 justify-center items-center text-xs md:text-sm font-medium animate-in fade-in slide-in-from-top-4 duration-700">
             <a 
               href={SECRET_TELEGRAM_LINK} 
               target="_blank" 
               rel="noreferrer" 
               className="w-full sm:w-auto flex items-center justify-center gap-2 px-4 py-2 bg-blue-500/10 hover:bg-blue-500/20 text-blue-300 rounded-lg transition-colors border border-blue-500/20"
             >
                <Send className="w-3 h-3 md:w-4 md:h-4" />
                Подписывайся: @ferixdi_ai
             </a>
             <a 
               href="https://t.me/imgbananobot" 
               target="_blank" 
               rel="noreferrer" 
               className="w-full sm:w-auto flex items-center justify-center gap-2 px-4 py-2 bg-banana-500/10 hover:bg-banana-500/20 text-banana-500 rounded-lg transition-colors border border-banana-500/20"
             >
                <Bot className="w-3 h-3 md:w-4 md:h-4" />
                Бесплатно: @imgbananobot
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

        {/* Sidebar */}
        <div className={`fixed inset-y-0 right-0 w-80 bg-dark-950 transform transition-transform duration-300 z-50 border-l border-white/5 shadow-2xl ${isSidebarOpen ? 'translate-x-0' : 'translate-x-full'}`}>
          <HistorySidebar 
            history={history} 
            onSelect={handleHistorySelect}
            onClear={handleClearHistory}
            onClose={() => setIsSidebarOpen(false)}
          />
        </div>

        {/* Overlay for sidebar */}
        {isSidebarOpen && (
          <div 
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40 transition-opacity"
            onClick={() => setIsSidebarOpen(false)}
          />
        )}

        {/* Modal */}
        <ApiKeyModal 
          isOpen={isModalOpen}
          onClose={() => setIsModalOpen(false)}
          balance={balance}
          currentApiKey={apiKey}
          onSetApiKey={handleSetApiKey}
          onRedeemPromo={handleRedeemPromo}
        />

      </div>
    </ErrorBoundary>
  );
}