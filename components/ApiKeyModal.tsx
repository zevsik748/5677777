
import React, { useState } from 'react';
import { Wallet, CreditCard, X, Send, Copy, CheckCircle2, Gift, Coins } from 'lucide-react';
import { SBP_NUMBER, SBP_BANK, SBP_RECIPIENT, SECRET_TELEGRAM_LINK } from '../constants';

interface ApiKeyModalProps {
  isOpen: boolean;
  onClose: () => void;
  balance: number;
  onRedeemPromo: (code: string) => { success: boolean; message: string };
}

export const ApiKeyModal: React.FC<ApiKeyModalProps> = ({ 
  isOpen, 
  onClose, 
  balance, 
  onRedeemPromo
}) => {
  const [promoCode, setPromoCode] = useState('');
  const [promoStatus, setPromoStatus] = useState<{msg: string, type: 'success' | 'error' | null}>({ msg: '', type: null });
  const [copied, setCopied] = useState(false);

  if (!isOpen) return null;

  const handleCopy = () => {
    navigator.clipboard.writeText(SBP_NUMBER);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handlePromoSubmit = () => {
    if (!promoCode.trim()) return;
    const result = onRedeemPromo(promoCode);
    setPromoStatus({ 
      msg: result.message, 
      type: result.success ? 'success' : 'error' 
    });
    if (result.success) setPromoCode('');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4 animate-in fade-in duration-300">
      <div className="bg-gray-900 border border-gray-800 rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-800 bg-gray-950/50">
          <h2 className="text-white font-bold text-lg flex items-center gap-2">
            <Wallet className="w-5 h-5 text-banana-500" />
            Кошелек
          </h2>
          <button onClick={onClose} className="text-gray-500 hover:text-white transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>
        
        <div className="p-6 overflow-y-auto custom-scrollbar space-y-6">
          
           {/* Balance Card */}
           <div className="bg-gradient-to-br from-gray-800 to-gray-900 p-5 rounded-xl border border-white/5 flex flex-col items-center justify-center relative overflow-hidden">
              <div className="absolute inset-0 bg-banana-500/5 blur-xl"></div>
              <span className="text-gray-400 text-xs uppercase tracking-wider font-semibold z-10">Ваш баланс</span>
              <div className="text-4xl font-mono font-bold text-white mt-1 z-10">{balance} ₽</div>
           </div>

           {/* Payment Info */}
           <div className="bg-blue-900/10 border border-blue-500/20 rounded-xl p-4 space-y-3">
              <div className="flex items-center gap-2 text-blue-400 text-sm font-bold uppercase tracking-wider mb-2">
                <CreditCard className="w-4 h-4" /> 
                Пополнение через СБП
              </div>
              
              <div className="space-y-2 text-sm">
                <div className="flex justify-between items-center p-3 bg-gray-950 rounded-lg border border-white/5">
                  <span className="text-gray-400">Банк</span>
                  <span className="text-white font-medium">{SBP_BANK}</span>
                </div>
                <div className="flex justify-between items-center p-3 bg-gray-950 rounded-lg border border-white/5">
                  <span className="text-gray-400">Получатель</span>
                  <span className="text-white font-medium">{SBP_RECIPIENT}</span>
                </div>
                <div className="flex justify-between items-center p-3 bg-gray-950 rounded-lg border border-white/5 group relative">
                  <span className="text-gray-400">Телефон</span>
                  <div className="flex items-center gap-2">
                    <span className="text-white font-mono font-bold text-lg">{SBP_NUMBER}</span>
                    <button 
                      onClick={handleCopy}
                      className="p-1.5 hover:bg-white/10 rounded transition-colors text-gray-400 hover:text-white"
                    >
                      {copied ? <CheckCircle2 className="w-4 h-4 text-green-500" /> : <Copy className="w-4 h-4" />}
                    </button>
                  </div>
                </div>
              </div>

              {/* Amount Options */}
              <div className="grid grid-cols-3 gap-2 mt-2">
                  {[100, 500, 1000].map(amount => (
                      <div key={amount} className="bg-gray-950 border border-white/10 rounded-lg p-2 text-center">
                          <div className="text-banana-500 font-bold">{amount}₽</div>
                          <div className="text-[10px] text-gray-500">Пакет</div>
                      </div>
                  ))}
              </div>

              <a 
                href={SECRET_TELEGRAM_LINK} 
                target="_blank" 
                rel="noreferrer"
                className="flex items-center justify-center gap-2 w-full py-3 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-lg transition-colors mt-2"
              >
                <Send className="w-4 h-4" />
                Отправить чек
              </a>
           </div>

           {/* Code Activation */}
           <div className="pt-4 border-t border-white/5 space-y-3">
             <label className="text-sm font-bold text-gray-300 flex items-center gap-2">
                <Gift className="w-4 h-4 text-banana-500" />
                Активация кода
             </label>
             <div className="flex gap-2">
                <input 
                  type="text" 
                  value={promoCode}
                  onChange={(e) => {
                    setPromoCode(e.target.value);
                    setPromoStatus({msg: '', type: null});
                  }}
                  placeholder="Введите код пополнения"
                  className="flex-1 bg-gray-950 border border-gray-700 rounded-lg px-4 py-3 text-white focus:ring-2 focus:ring-banana-500 outline-none placeholder:text-gray-600 font-mono"
                />
                <button 
                  onClick={handlePromoSubmit}
                  disabled={!promoCode}
                  className="px-6 bg-banana-500 hover:bg-banana-400 disabled:opacity-50 disabled:cursor-not-allowed text-gray-950 font-bold rounded-lg transition-colors"
                >
                  OK
                </button>
             </div>
             
             {promoStatus.msg && (
               <div className={`text-xs p-3 rounded-lg flex items-center gap-2 animate-in slide-in-from-top-2 ${
                 promoStatus.type === 'success' ? 'bg-green-500/10 text-green-400 border border-green-500/20' : 'bg-red-500/10 text-red-400 border border-red-500/20'
               }`}>
                  {promoStatus.type === 'success' ? <CheckCircle2 className="w-4 h-4" /> : <X className="w-4 h-4" />}
                  {promoStatus.msg}
               </div>
             )}
           </div>

        </div>
      </div>
    </div>
  );
};
