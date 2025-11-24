
import React, { useState, useEffect } from 'react';
import { Key, Save, Eye, EyeOff, ShieldCheck } from 'lucide-react';
import { STORAGE_KEY_API_KEY } from '../constants';

interface ApiKeyModalProps {
  onSave: (key: string) => void;
  isOpen: boolean;
}

export const ApiKeyModal: React.FC<ApiKeyModalProps> = ({ onSave, isOpen }) => {
  const [inputKey, setInputKey] = useState('');
  const [showKey, setShowKey] = useState(false);

  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY_API_KEY);
    if (stored) setInputKey(stored);
  }, []);

  const handleSave = () => {
    if (inputKey.trim().length > 0) {
      localStorage.setItem(STORAGE_KEY_API_KEY, inputKey.trim());
      onSave(inputKey.trim());
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
      <div className="bg-dark-900 border border-dark-800 rounded-2xl w-full max-w-md shadow-2xl overflow-hidden">
        <div className="bg-gradient-to-r from-banana-600 to-banana-500 p-4 flex items-center gap-2">
          <ShieldCheck className="text-white h-6 w-6" />
          <h2 className="text-white font-bold text-lg">Авторизация API</h2>
        </div>
        
        <div className="p-6 space-y-4">
          <p className="text-gray-400 text-sm">
            Для использования модели <strong>Nano Banana Pro</strong> введите ваш API ключ.
            Ключ сохраняется только в браузере.
          </p>

          <div className="space-y-2">
            <label className="text-gray-300 text-xs font-semibold uppercase tracking-wider">Ваш API Key</label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <Key className="h-5 w-5 text-gray-500" />
              </div>
              <input
                type={showKey ? "text" : "password"}
                value={inputKey}
                onChange={(e) => setInputKey(e.target.value)}
                placeholder="Введите ключ здесь..."
                className="w-full bg-dark-950 border border-dark-800 text-gray-100 rounded-lg pl-10 pr-12 py-3 focus:ring-2 focus:ring-banana-500 focus:border-transparent outline-none transition-all"
              />
              <button
                type="button"
                onClick={() => setShowKey(!showKey)}
                className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-500 hover:text-gray-300"
              >
                {showKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>

          <div className="pt-2">
             <button
              onClick={handleSave}
              disabled={!inputKey}
              className="w-full flex items-center justify-center gap-2 bg-banana-500 hover:bg-banana-400 text-dark-950 font-bold py-3 px-4 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Save className="h-5 w-5" />
              Сохранить и продолжить
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
