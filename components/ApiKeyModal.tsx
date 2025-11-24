
import React, { useState, useEffect } from 'react';
import { Key, Save, Lock, Wallet, CreditCard, X } from 'lucide-react';

interface ApiKeyModalProps {
  onSave: (code: string) => void;
  isOpen: boolean;
  mode?: 'api-key' | 'access-code';
  currentBalance?: number;
  lavaUrl?: string;
  onClose?: () => void;
}

export const ApiKeyModal: React.FC<ApiKeyModalProps> = ({ onSave, isOpen, mode = 'api-key', currentBalance = 0, lavaUrl, onClose }) => {
  const [inputKey, setInputKey] = useState('');

  useEffect(() => {
    setInputKey('');
  }, [isOpen]);

  const handleSave = () => {
    if (inputKey.trim().length > 0) {
      onSave(inputKey.trim());
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 backdrop-blur-md p-4 animate-in fade-in duration-300">
      <div className="bg-dark-900 border border-dark-800 rounded-2xl w-full max-w-md shadow-2xl overflow-hidden relative">
        {/* Close Button */}
        {onClose && (
          <button onClick={onClose} className="absolute top-3 right-3 text-gray-500 hover:text-white transition-colors">
            <X className="w-5 h-5" />
          </button>
        )}

        {/* Header */}
        <div className="p-4 flex items-center gap-2 bg-gradient-to-r from-dark-800 to-dark-900 border-b border-dark-800">
          <Wallet className="text-banana-500 h-6 w-6" />
          <h2 className="text-white font-bold text-lg">Кошелек</h2>
        </div>
        
        <div className="p-6 space-y-6">
          
          {/* Balance Display */}
          <div className="bg-dark-950 p-4 rounded-xl border border-white/5 flex flex-col items-center justify-center gap-1">
             <span className="text-gray-400 text-xs uppercase tracking-wider">Текущий баланс</span>
             <div className="text-3xl font-mono font-bold text-white">{currentBalance} ₽</div>
          </div>

          {/* Pay Action */}
          {lavaUrl && (
            <div className="space-y-2">
              <label className="text-gray-300 text-xs font-semibold uppercase tracking-wider">
                Пополнение баланса
              </label>
              <a 
                href={lavaUrl} 
                target="_blank" 
                rel="noreferrer"
                className="w-full py-3 bg-purple-600 hover:bg-purple-500 text-white font-bold rounded-lg transition-colors flex items-center justify-center gap-2"
              >
                <CreditCard className="w-5 h-5" />
                Оплатить через Lava
              </a>
              <p className="text-[10px] text-gray-500 text-center">
                После оплаты вы получите код пополнения. Введите его ниже.
              </p>
            </div>
          )}

          {/* Code Input */}
          <div className="space-y-2 pt-2 border-t border-white/5">
            <label className="text-gray-300 text-xs font-semibold uppercase tracking-wider">
              Активация кода
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <Key className="h-5 w-5 text-gray-500" />
              </div>
              <input
                type="text"
                value={inputKey}
                onChange={(e) => setInputKey(e.target.value)}
                placeholder="Введите код пополнения..."
                className="w-full bg-dark-950 border border-dark-800 text-gray-100 rounded-lg pl-10 pr-4 py-3 focus:ring-2 focus:ring-banana-500 focus:border-transparent outline-none transition-all"
              />
            </div>
            <button
              onClick={handleSave}
              disabled={!inputKey}
              className="w-full flex items-center justify-center gap-2 bg-banana-500 hover:bg-banana-400 text-dark-950 font-bold py-3 px-4 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed mt-2"
            >
              <Save className="h-5 w-5" />
              Активировать
            </button>
          </div>

        </div>
      </div>
    </div>
  );
};
