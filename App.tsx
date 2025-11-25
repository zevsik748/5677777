import React, { useState, useEffect, ReactNode, ErrorInfo } from 'react';
import { ApiKeyModal } from './components/ApiKeyModal';
import { ImageGenerator } from './components/ImageGenerator';
import { HistorySidebar } from './components/HistorySidebar';
import { STORAGE_KEY_HISTORY, SECRET_TELEGRAM_LINK, K_PART_1, K_PART_2, K_PART_3, K_PART_4, PROMO_RATES } from './constants';
import { HistoryItem } from './types';
import { Zap, Clock, Wallet, AlertTriangle, Send, Bot } from 'lucide-react';

interface ErrorBoundaryProps { children?: ReactNode; }
interface ErrorBoundaryState { hasError: boolean; error: string; }

class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { hasError: false, error: "" };

  static getDerivedStateFromError(error: Error) { return { hasError: true, error: error.message }; }
  componentDidCatch(error: Error, info: ErrorInfo) { console.error("Catch:", error, info); }
  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-black flex items-center justify-center text-white p-4">
            <div className="text-center max-w-md">
                <AlertTriangle className="w-12 h-12 text-red-500 mx-auto mb-4" />
                <h2 className="text-xl font-bold mb-2">Ошибка приложения</h2>
                <p className="text-gray-500 text-sm mb-6">{this.state.error}</p>
                <button onClick={() => { localStorage.clear(); window.location.reload(); }} className="bg-red-600 px-6 py-2 rounded-lg font-bold">Сброс</button>
            </div>
        </div>
      );
    }
    return <>{this.props.children}</>;
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
    setApiKey(K_PART_1 + K_PART_2 + K_PART_3 + K_PART_4);
    try {
        const b = localStorage.getItem(STORAGE_KEY_BALANCE);
        if (b) setBalance(Number(b) || 0);
        const h = localStorage.getItem(STORAGE_KEY_HISTORY);
        if (h) setHistory(JSON.parse(h) || []);
        const c = localStorage.getItem(STORAGE_KEY_USED_CODES);
        if (c) setUsedCodes(JSON.parse(c) || []);
    } catch (e) { console.error("Init error", e); }
  }, []);

  useEffect(() => {
    const interval = setInterval(() => {
      setOnlineUsers(p => {
        const next = p + (Math.random() > 0.5 ? 1 : -1) * Math.floor(Math.random() * 3);
        return next < 1000 ? 1000 : next > 1400 ? 1400 : next;
      });
    }, 3000);
    return () => clearInterval(interval);
  }, []);

  const handleUpdateHistory = (item: HistoryItem) => {
    setHistory(prev => {
      const exists = prev.find(i => i.id === item.id);
      const next = exists ? prev.map(i => i.id === item.id ? item : i) : [item, ...prev];
      try { localStorage.setItem(STORAGE_KEY_HISTORY, JSON.stringify(next)); } catch(e){}
      return next;
    });
  };

  const handleRedeemPromo = (code: string) => {
    const c = code.trim();
    if (usedCodes.includes(c)) return { success: false, message: 'Код уже использован' };
    const rate = PROMO_RATES[c as keyof typeof PROMO_RATES];
    if (rate) {
        const newBal = balance + rate;
        setBalance(newBal);
        setUsedCodes(prev => [...prev, c]);
        localStorage.setItem(STORAGE_KEY_BALANCE, String(newBal));
        localStorage.setItem(STORAGE_KEY_USED_CODES, JSON.stringify([...usedCodes, c]));
        return { success: true, message: `+${rate}₽` };
    }
    return { success: false, message: 'Неверный код' };
  };

  return (
    <ErrorBoundary>
      <div className="min-h-screen text-gray-200 font-sans selection:bg-banana-500/30 pb-safe">
        <nav className="fixed top-0 left-0 right-0 z-40 bg-dark-950/90 backdrop-blur-xl border-b border-white/5">
          <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
            <div className="flex items-center gap-2 font-bold text-xl text-white"><Zap className="w-6 h-6 text-banana-500 fill-current" /> AI Studio</div>
            <div className="flex items-center gap-3">
                <div className="hidden md:flex items-center gap-2 px-3 py-1 bg-white/5 rounded-full border border-white/5 text-xs font-mono text-gray-400"><span className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></span> {onlineUsers} online</div>
                <button onClick={() => setIsModalOpen(true)} className="flex items-center gap-2 px-3 py-1.5 bg-dark-900 border border-white/10 rounded-full"><Wallet className="w-4 h-4 text-gray-400" /><span className="font-mono font-bold text-white">{balance}₽</span></button>
                <button onClick={() => setIsSidebarOpen(true)} className="p-2 hover:bg-white/5 rounded-lg"><Clock className="w-5 h-5 text-gray-400" /></button>
                <button onClick={() => setIsModalOpen(true)} className="hidden sm:block px-4 py-1.5 bg-white text-black font-bold rounded-lg text-sm">Кошелек</button>
            </div>
          </div>
        </nav>

        <main className="pt-24 px-4 max-w-5xl mx-auto">
            <div className="mb-8 flex justify-center gap-4 text-xs font-bold">
                <a href={SECRET_TELEGRAM_LINK} target="_blank" className="flex items-center gap-2 px-4 py-2 bg-blue-500/10 text-blue-400 rounded-xl border border-blue-500/20 hover:bg-blue-500/20 transition-colors"><Send className="w-3 h-3" /> @ferixdi_ai</a>
                <a href="https://t.me/imgbananobot" target="_blank" className="flex items-center gap-2 px-4 py-2 bg-banana-500/10 text-banana-500 rounded-xl border border-banana-500/20 hover:bg-banana-500/20 transition-colors"><Bot className="w-3 h-3" /> @imgbananobot</a>
            </div>
            <ImageGenerator 
                apiKey={apiKey} balance={balance} 
                onHistoryUpdate={handleUpdateHistory} 
                onDeductBalance={(a) => { const n = Math.max(0, balance - a); setBalance(n); localStorage.setItem(STORAGE_KEY_BALANCE, String(n)); }}
                onReqTopUp={() => setIsModalOpen(true)}
                selectedItem={selectedHistoryItem}
            />
        </main>

        <div className={`fixed inset-y-0 right-0 w-80 bg-dark-950 transform transition-transform duration-300 z-[60] border-l border-white/5 shadow-2xl ${isSidebarOpen ? 'translate-x-0' : 'translate-x-full'}`}>
            <HistorySidebar history={history} onSelect={(i) => { setSelectedHistoryItem(i); setIsSidebarOpen(false); }} onClear={() => { setHistory([]); localStorage.removeItem(STORAGE_KEY_HISTORY); }} onClose={() => setIsSidebarOpen(false)} />
        </div>
        {isSidebarOpen && <div className="fixed inset-0 bg-black/50 z-[55]" onClick={() => setIsSidebarOpen(false)} />}
        
        <ApiKeyModal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} balance={balance} onRedeemPromo={handleRedeemPromo} />
      </div>
    </ErrorBoundary>
  );
}