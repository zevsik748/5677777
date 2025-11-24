
import React from 'react';
import { HistoryItem } from '../types';
import { MODEL_SORA } from '../constants';
import { Clock, CheckCircle2, XCircle, Loader2, Trash2, Video, Image as ImageIcon, X } from 'lucide-react';

interface HistorySidebarProps {
  history: HistoryItem[];
  onSelect: (item: HistoryItem) => void;
  onClear: () => void;
  onClose: () => void;
}

export const HistorySidebar: React.FC<HistorySidebarProps> = ({ history, onSelect, onClear, onClose }) => {
  return (
    <div className="h-full flex flex-col bg-dark-900 border-l border-dark-800 w-full shadow-2xl">
      <div className="p-4 border-b border-dark-800 flex justify-between items-center bg-dark-900/95 backdrop-blur">
        <h3 className="font-semibold text-gray-200 flex items-center gap-2">
          <Clock className="w-4 h-4 text-banana-500" />
          История
        </h3>
        <div className="flex items-center gap-3">
          {history.length > 0 && (
            <button 
              onClick={onClear}
              className="text-xs text-gray-500 hover:text-red-400 transition-colors flex items-center gap-1"
            >
              <Trash2 className="w-3 h-3" />
            </button>
          )}
          <button 
            onClick={onClose}
            className="text-gray-400 hover:text-white transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-3 space-y-3 custom-scrollbar">
        {history.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-40 text-gray-600 space-y-2">
            <Clock className="w-8 h-8 opacity-20" />
            <span className="text-sm">История пуста</span>
          </div>
        ) : (
          history.map((item) => {
            const isSora = item.model === MODEL_SORA;
            const displayUrl = item.resultUrl || item.imageUrl;

            return (
              <div
                key={item.id}
                onClick={() => onSelect(item)}
                className="group cursor-pointer p-3 rounded-xl bg-dark-950 border border-dark-800 hover:border-banana-500/50 hover:bg-dark-800 transition-all shadow-sm"
              >
                <div className="flex justify-between items-start mb-2">
                  <span className="text-[10px] text-gray-500 font-mono flex items-center gap-1.5">
                    {isSora ? <Video className="w-3 h-3 text-pink-400" /> : <ImageIcon className="w-3 h-3 text-banana-400" />}
                    {new Date(item.timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                  </span>
                  {item.status === 'success' && <CheckCircle2 className="w-3 h-3 text-green-500" />}
                  {item.status === 'waiting' && <Loader2 className="w-3 h-3 text-banana-500 animate-spin" />}
                  {item.status === 'fail' && <XCircle className="w-3 h-3 text-red-500" />}
                </div>
                
                <div className="flex gap-3">
                  {displayUrl && !isSora ? (
                     <div className="w-14 h-14 shrink-0 overflow-hidden rounded-lg border border-dark-700 bg-dark-900">
                       <img 
                        src={displayUrl} 
                        alt="thumb" 
                        className="w-full h-full object-cover"
                       />
                     </div>
                  ) : (
                    <div className="w-14 h-14 shrink-0 rounded-lg bg-dark-900 border border-dark-700 flex items-center justify-center text-dark-600">
                      {isSora ? <Video className="w-6 h-6" /> : <ImageIcon className="w-6 h-6" />}
                    </div>
                  )}
                  
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-gray-300 line-clamp-3 leading-relaxed">
                      {isSora ? (
                        <span className="text-gray-400 break-all font-mono text-[10px]">{item.videoInputUrl}</span>
                      ) : (
                        item.prompt || "Без промпта"
                      )}
                    </p>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
