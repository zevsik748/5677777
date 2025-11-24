
import React, { useState, useEffect, ReactNode, Component } from 'react';
import { ApiKeyModal } from './components/ApiKeyModal';
import { ImageGenerator } from './components/ImageGenerator';
import { HistorySidebar } from './components/HistorySidebar';
import { STORAGE_KEY_API_KEY, STORAGE_KEY_HISTORY } from './constants';
import { HistoryItem } from './types';
import { Zap, Clock, Wallet, AlertTriangle, Menu } from 'lucide-react';

interface ErrorBoundaryProps {
  children?: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: string;
}

class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  public state: ErrorBoundaryState = { hasError: false, error: "" };

  constructor(props: ErrorBoundaryProps) {
    super(props);
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error: error.message };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error("ErrorBoundary caught an error", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-black flex items-center justify-center p-4">
          <div className="bg-dark-900 border border-red-500/30 p-8 rounded-2xl max-w-md w-full text-center space-y-4">
            <AlertTriangle className="w-12 h-12 text-red-500 mx-auto" />
            <h2 className="text-xl font-bold text-white">Произошла ошибка</h2>
            <p className="text-gray-400 text-sm">{this.state.error}</p>
            <button 
              onClick={() => window.location.reload()}
              className="px-6 py-2 bg-red-600 hover:bg-red-500 text-white rounded-lg font-bold transition-colors"
            >
              Перезагрузить приложение
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default function App() {
  const [apiKey, setApiKey] = useState('');
  const [balance, setBalance] = useState(0); // This would typically come from an API
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [selectedHistoryItem, setSelectedHistoryItem] = useState<HistoryItem | null>(null);

  useEffect(() => {
    const storedKey = localStorage.getItem(STORAGE_KEY_API_KEY);
    if (storedKey) setApiKey(storedKey);

    const storedHistory = localStorage.getItem(STORAGE_KEY_HISTORY);
    if (storedHistory) {
      try {
        setHistory(JSON.parse(storedHistory));
      } catch (e) {
        console.error("Failed to parse history", e);
      }
    }
    
    // Simulating balance check or loading from local storage/API
    setBalance(Math.floor(Math.random() * 500)); 
  }, []);

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
      localStorage.setItem(STORAGE_KEY_HISTORY, JSON.stringify(newHistory));
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
    setBalance(prev => Math.max(0, prev - amount));
  };

  const handleHistorySelect = (item: HistoryItem) => {
    setSelectedHistoryItem(item);
    setIsSidebarOpen(false);
  };

  return (
    <ErrorBoundary>
      <div className="min-h-screen text-gray-200 font-sans selection:bg-banana-500/30">
        
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
              <button 
                onClick={() => setIsModalOpen(true)}
                className="flex items-center gap-2 px-3 py-1.5 bg-dark-900 hover:bg-dark-800 border border-white/10 rounded-full transition-all group"
              >
                <Wallet className="w-4 h-4 text-gray-400 group-hover:text-banana-500 transition-colors" />
                <span className="font-mono font-bold text-sm">{balance} ₽</span>
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
        <main className="pt-24 pb-12 px-4 max-w-5xl mx-auto">
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
        <div className={`fixed inset-y-0 right-0 w-80 bg-dark-950 transform transition-transform duration-300 z-50 ${isSidebarOpen ? 'translate-x-0' : 'translate-x-full'}`}>
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
            className="fixed inset-0 bg-black/50 backdrop-blur-sm z-40 transition-opacity"
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
          onRedeemPromo={(code) => {
            if (code === 'WELCOME') {
              setBalance(prev => prev + 100);
              return { success: true, message: 'Промокод активирован: +100₽' };
            }
            return { success: false, message: 'Неверный код' };
          }}
        />

      </div>
    </ErrorBoundary>
  );
}
