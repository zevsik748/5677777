
import React, { useState, useRef, useEffect } from 'react';
import { 
  AspectRatio, 
  OutputFormat, 
  Resolution, 
  TaskInput,
  HistoryItem,
  ModelType,
  SectionType,
  UpscaleFactor
} from '../types';
import { 
  ASPECT_RATIOS, 
  DEFAULT_PROMPT, 
  DEFAULT_SORA_URL,
  DEFAULT_TOPAZ_URL,
  MODEL_NANO,
  MODEL_SORA,
  MODEL_TOPAZ,
  SECTION_SECRET,
  NANO_PRESETS,
  MARKETING_COPY,
  SECRET_PRICE,
  SBP_NUMBER,
  SBP_BANK,
  SECRET_TELEGRAM_LINK
} from '../constants';
import { createTask, getTaskStatus, parseResultJson } from '../services/kieService';
import { 
  Wand2, Download, Maximize2, Loader2, AlertTriangle, 
  UploadCloud, Video, Zap, X, Check, Sparkles, 
  MonitorPlay, Lock, ExternalLink, ChevronRight, CreditCard, Copy, Terminal, Send, Gift, ShieldCheck
} from 'lucide-react';

interface ImageGeneratorProps {
  apiKey: string;
  onHistoryUpdate: (item: HistoryItem) => void;
  lavaUrl?: string;
  balance: number;
  onDeductBalance: (amount: number) => void;
  onReqTopUp: () => void;
}

// Pricing configuration (RUB)
const PRICES: Record<ModelType, number> = {
  [MODEL_NANO]: 19,
  [MODEL_SORA]: 5,
  [MODEL_TOPAZ]: 10,
};

// Safe ID generator
const generateId = () => Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);

export const ImageGenerator: React.FC<ImageGeneratorProps> = ({ 
  apiKey, 
  onHistoryUpdate, 
  lavaUrl,
  balance,
  onDeductBalance,
  onReqTopUp
}) => {
  const [activeSection, setActiveSection] = useState<SectionType>(MODEL_NANO);

  // Nano Form State
  const [prompt, setPrompt] = useState(DEFAULT_PROMPT);
  const [aspectRatio, setAspectRatio] = useState<AspectRatio>(AspectRatio.Square);
  const [resolution, setResolution] = useState<Resolution>(Resolution.Res_1K);
  const [format, setFormat] = useState<OutputFormat>(OutputFormat.PNG);
  const [refImage, setRefImage] = useState<string | null>(null);

  // Sora Form State
  const [soraUrl, setSoraUrl] = useState(DEFAULT_SORA_URL);

  // Topaz Form State
  const [topazUrl, setTopazUrl] = useState(DEFAULT_TOPAZ_URL);
  const [upscaleFactor, setUpscaleFactor] = useState<UpscaleFactor>(UpscaleFactor.X4);

  // Secret/Payment State
  const [showPayment, setShowPayment] = useState(false);
  const [checkingPayment, setCheckingPayment] = useState(false);

  // Execution State
  const [loading, setLoading] = useState(false);
  const [resultUrl, setResultUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [statusMsg, setStatusMsg] = useState<string>('');

  const pollingRef = useRef<number | null>(null);
  const resultRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    return () => {
      if (pollingRef.current) window.clearInterval(pollingRef.current);
    };
  }, []);

  useEffect(() => {
    setResultUrl(null);
    setError(null);
    setShowPayment(false);
  }, [activeSection]);

  useEffect(() => {
    if (resultUrl && resultRef.current) {
      resultRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }, [resultUrl]);

  const handleRefImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 10 * 1024 * 1024) {
        setError(`Размер файла не должен превышать 10MB`);
        return;
      }
      const reader = new FileReader();
      reader.onloadend = () => {
        setRefImage(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const startPolling = (taskId: string, model: ModelType, currentPrompt?: string, currentVideoUrl?: string) => {
    setStatusMsg('Обработка задачи...');
    
    const historyId = generateId();
    const historyItemBase: HistoryItem = {
      id: historyId,
      taskId,
      model,
      status: 'waiting',
      timestamp: Date.now()
    };

    if (model === MODEL_NANO) historyItemBase.prompt = currentPrompt;
    if (model === MODEL_SORA || model === MODEL_TOPAZ) historyItemBase.videoInputUrl = currentVideoUrl;

    onHistoryUpdate(historyItemBase);

    pollingRef.current = window.setInterval(async () => {
      try {
        const data = await getTaskStatus(apiKey, taskId);
        
        if (data.state === 'success') {
          if (pollingRef.current) window.clearInterval(pollingRef.current);
          setLoading(false);
          setStatusMsg('Готово!');
          
          const urls = parseResultJson(data.resultJson);
          const finalUrl = urls.length > 0 ? urls[0] : null;
          
          if (finalUrl) {
            setResultUrl(finalUrl);
            onHistoryUpdate({
              ...historyItemBase,
              status: 'success',
              resultUrl: finalUrl
            });
          } else {
            setError('Результат не найден.');
            onHistoryUpdate({ ...historyItemBase, status: 'fail' });
          }
        } else if (data.state === 'fail') {
          if (pollingRef.current) window.clearInterval(pollingRef.current);
          setLoading(false);
          setError(data.failMsg || 'Операция не удалась.');
          onHistoryUpdate({ ...historyItemBase, status: 'fail' });
        }
      } catch (err) {
        console.error(err);
      }
    }, 2000);
  };

  const handleGenerate = async () => {
    const model = activeSection as ModelType;
    const price = PRICES[model] || 0;

    // 1. CHECK BALANCE
    if (balance < price) {
      onReqTopUp();
      return;
    }

    setLoading(true);
    setError(null);
    setResultUrl(null);
    setStatusMsg('Инициализация...');

    try {
      let input: TaskInput;
      
      if (model === MODEL_NANO) {
        if (!prompt.trim()) throw new Error("Введите промпт");
        input = {
          prompt,
          aspect_ratio: aspectRatio,
          resolution,
          output_format: format,
          image_input: refImage ? [refImage] : []
        };
      } else if (model === MODEL_SORA) {
        if (!soraUrl.trim()) throw new Error("Введите URL видео");
        if (!soraUrl.includes("sora.chatgpt.com")) throw new Error("Только ссылки sora.chatgpt.com");
        input = { video_url: soraUrl };
      } else if (model === MODEL_TOPAZ) {
         if (!topazUrl.trim()) throw new Error("Введите URL видео");
         input = { video_url: topazUrl, upscale_factor: upscaleFactor };
      } else {
         throw new Error("Unknown model");
      }

      // 2. DEDUCT BALANCE (Optimistic)
      onDeductBalance(price);

      const taskId = await createTask(apiKey, model, input);
      
      if (model === MODEL_NANO) {
        startPolling(taskId, model, prompt);
      } else {
        startPolling(taskId, model, undefined, model === MODEL_SORA ? soraUrl : topazUrl);
      }

    } catch (err: any) {
      setLoading(false);
      setError(err.message || "Ошибка при создании задачи");
    }
  };

  const handleTelegramRedirect = () => {
    setCheckingPayment(true);
    setTimeout(() => {
       setCheckingPayment(false);
       window.open(SECRET_TELEGRAM_LINK, '_blank');
    }, 1000);
  };

  const handleLavaRedirect = () => {
    if (lavaUrl) {
      window.open(lavaUrl, '_blank');
    } else {
      alert("Ссылка на оплату не настроена.");
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    alert("Скопировано: " + text);
  };

  const isVideoResult = (activeSection === MODEL_SORA || activeSection === MODEL_TOPAZ || (resultUrl && resultUrl.match(/\.(mp4|mov|webm)(\?.*)?$/i)));
  const currentPrice = activeSection !== SECTION_SECRET ? PRICES[activeSection as ModelType] : 0;

  // Helper to render marketing points
  const renderMarketingPoints = (model: ModelType) => (
     <div className="mb-8 bg-black/20 p-5 rounded-2xl border border-white/5">
        <h3 className="text-sm font-bold text-gray-400 uppercase tracking-wider mb-4 flex items-center gap-2">
           <Sparkles className="w-4 h-4 text-yellow-500" />
           Маркетинговые преимущества
        </h3>
        <ul className="space-y-3">
           {MARKETING_COPY[model].map((point, idx) => (
              <li key={idx} className="text-sm text-gray-300 flex items-start gap-3">
                 <div className="w-1.5 h-1.5 rounded-full bg-banana-500 mt-1.5 shrink-0" />
                 <span className="leading-relaxed">{point}</span>
              </li>
           ))}
        </ul>
     </div>
  );

  return (
    <div className="space-y-8">
      
      {/* Navigation Switcher */}
      <div className="flex justify-center overflow-x-auto pb-2">
         <div className="bg-dark-900 p-1.5 rounded-2xl border border-white/10 flex shadow-2xl">
            {[
               { id: MODEL_NANO, label: 'Nano Pro', icon: Wand2, color: 'text-banana-500' },
               { id: MODEL_SORA, label: 'Sora Remove', icon: Video, color: 'text-pink-500' },
               { id: MODEL_TOPAZ, label: 'Topaz Upscale', icon: MonitorPlay, color: 'text-cyan-400' },
               { id: SECTION_SECRET, label: 'Premium', icon: Lock, color: 'text-red-500' },
            ].map((tab) => (
               <button
                  key={tab.id}
                  onClick={() => setActiveSection(tab.id as SectionType)}
                  className={`flex items-center gap-2 px-4 md:px-6 py-3 rounded-xl text-xs md:text-sm font-bold transition-all duration-300 ${
                     activeSection === tab.id 
                        ? 'bg-dark-800 text-white shadow-lg border border-white/5' 
                        : 'text-gray-500 hover:text-gray-300 hover:bg-white/5'
                  }`}
               >
                  <tab.icon className={`w-4 h-4 ${activeSection === tab.id ? tab.color : 'text-gray-600'}`} />
                  <span className="whitespace-nowrap">{tab.label}</span>
               </button>
            ))}
         </div>
      </div>

      {/* SECRET SECTION */}
      {activeSection === SECTION_SECRET ? (
         <div className="bg-dark-950 border border-red-900/30 rounded-[2.5rem] shadow-2xl relative overflow-hidden">
             <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,_var(--tw-gradient-stops))] from-red-900/20 via-transparent to-transparent pointer-events-none"></div>
             
             {/* Header */}
             <div className="p-8 md:p-12 border-b border-red-900/20 relative z-10">
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-red-500/10 border border-red-500/20 text-red-500 text-[10px] font-bold uppercase tracking-widest mb-6 animate-pulse">
                   <Lock className="w-3 h-3" /> Private Access
                </div>
                <h2 className="text-4xl md:text-5xl font-extrabold text-white tracking-tight mb-4">
                   Google Labs <span className="text-red-500">Insider</span>
                </h2>
                <p className="text-xl text-gray-400 font-light leading-relaxed max-w-2xl">
                   Доступ к аккаунту Google Labs с безлимитными возможностями.
                </p>
             </div>

             {/* Content Body */}
             <div className="p-8 md:p-12 grid md:grid-cols-2 gap-12 relative z-10">
                
                {/* Features List */}
                <div className="space-y-8">
                   <div className="space-y-4">
                      <h3 className="text-lg font-bold text-white flex items-center gap-2">
                         <Terminal className="w-5 h-5 text-red-500" />
                         Включено в пакет (1 месяц):
                      </h3>
                      <ul className="space-y-4">
                         {[
                            "Безлимит Nano Banana Pro",
                            "Безлимит генерации видео Veo",
                            "Ключ доступа США (US) на месяц — В подарок 🎁",
                            "Поддержка 24/7"
                         ].map((item, i) => (
                            <li key={i} className="flex items-start gap-3 text-gray-300 text-sm">
                               <Check className="w-5 h-5 text-red-500 shrink-0" />
                               <span>{item}</span>
                            </li>
                         ))}
                      </ul>
                   </div>
                   
                   <div className="p-5 bg-red-950/30 border border-red-500/10 rounded-xl space-y-4">
                      <div className="flex items-start gap-2 text-red-200">
                         <div className="mt-1"><Lock className="w-4 h-4 text-red-500" /></div>
                         <p className="text-xs italic leading-relaxed opacity-80">
                            "Я не стал интегрировать сюда Veo через официальное API, так как одно видео выходит в районе 80 рублей. Мы не идиоты же — мы знаем, как использовать его грамотно."
                         </p>
                      </div>
                      
                      <div className="flex items-start gap-2 text-red-200 pt-2 border-t border-red-500/10">
                         <div className="mt-1"><ShieldCheck className="w-4 h-4 text-red-500" /></div>
                         <p className="text-xs leading-relaxed opacity-90">
                            За любую проблему с аккаунтом отвечаю лично: <a href="https://t.me/ferixdi_ai" target="_blank" rel="noreferrer" className="font-bold underline hover:text-white transition-colors">https://t.me/ferixdi_ai</a>
                         </p>
                      </div>
                   </div>
                </div>

                {/* Pricing & Payment */}
                <div className="bg-dark-900/50 rounded-3xl border border-white/5 p-8 flex flex-col justify-between">
                   {!showPayment ? (
                      <>
                         <div className="space-y-2">
                            <span className="text-sm text-gray-500 line-through">5 000 ₽</span>
                            <div className="flex items-baseline gap-2">
                               <span className="text-5xl font-extrabold text-white">{SECRET_PRICE} ₽</span>
                               <span className="text-gray-400 font-medium">/ мес</span>
                            </div>
                            <p className="text-xs text-gray-500 mt-2">Ограниченное предложение.</p>
                         </div>

                         <div className="mt-8 space-y-4">
                            <button 
                               onClick={() => setShowPayment(true)}
                               className="w-full py-4 bg-red-600 hover:bg-red-500 text-white font-bold rounded-xl transition-all shadow-lg shadow-red-900/20 flex items-center justify-center gap-2"
                            >
                               <CreditCard className="w-5 h-5" />
                               Перейти к оплате
                            </button>
                            <div className="flex items-center justify-center gap-2 text-xs text-gray-500">
                               <Gift className="w-3 h-3" /> US Access Key Included
                            </div>
                         </div>
                      </>
                   ) : (
                      <div className="space-y-6 animate-in fade-in zoom-in duration-300">
                         <div className="text-center space-y-2">
                            <h3 className="text-white font-bold">Оплата доступа</h3>
                            <p className="text-xs text-gray-400">Выберите удобный способ</p>
                         </div>

                         <div className="space-y-3">
                            {/* Lava Button */}
                            {lavaUrl && (
                              <button 
                                 onClick={handleLavaRedirect}
                                 className="w-full py-4 bg-purple-600 hover:bg-purple-500 text-white font-bold rounded-xl transition-all shadow-lg shadow-purple-900/20 flex items-center justify-center gap-2"
                              >
                                 <CreditCard className="w-5 h-5" />
                                 Оплатить через Lava
                              </button>
                            )}
                            
                            {/* SBP Manual Info */}
                            {!lavaUrl && (
                               <div className="space-y-3">
                                  <div className="bg-dark-950 p-3 rounded-lg border border-white/10 flex justify-between items-center">
                                     <div className="text-xs text-gray-400">СБП / Банк</div>
                                     <div className="text-sm font-bold text-white">{SBP_BANK}</div>
                                  </div>
                                  <div className="bg-dark-950 p-3 rounded-lg border border-white/10 flex justify-between items-center">
                                     <div className="text-xs text-gray-400">Номер</div>
                                     <div className="flex items-center gap-2">
                                        <span className="text-sm font-bold text-white">{SBP_NUMBER}</span>
                                        <button onClick={() => copyToClipboard(SBP_NUMBER)} className="text-gray-500 hover:text-white">
                                           <Copy className="w-4 h-4" />
                                        </button>
                                     </div>
                                  </div>
                               </div>
                            )}

                            <div className="bg-dark-950 p-3 rounded-lg border border-white/10 flex justify-between items-center">
                               <div className="text-xs text-gray-400">Сумма</div>
                               <div className="flex items-center gap-2">
                                  <span className="text-sm font-bold text-red-400">{SECRET_PRICE} ₽</span>
                                  <button onClick={() => copyToClipboard(SECRET_PRICE.toString())} className="text-gray-500 hover:text-white">
                                     <Copy className="w-4 h-4" />
                                  </button>
                               </div>
                            </div>
                         </div>

                         <div className="p-3 bg-red-500/10 rounded-lg border border-red-500/20 text-xs text-red-200 text-center">
                            Внимание! После оплаты обязательно отправьте чек в Telegram для получения кода доступа.
                         </div>

                         <button 
                            onClick={handleTelegramRedirect}
                            disabled={checkingPayment}
                            className="w-full py-4 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-xl transition-all shadow-lg shadow-blue-900/20 flex items-center justify-center gap-2"
                         >
                            {checkingPayment ? <Loader2 className="w-5 h-5 animate-spin" /> : <Send className="w-5 h-5" />}
                            {checkingPayment ? 'Открываем Telegram...' : 'Отправить чек и получить код'}
                         </button>
                         
                         <button 
                            onClick={() => setShowPayment(false)}
                            className="w-full py-2 text-xs text-gray-500 hover:text-white transition-colors"
                         >
                            Вернуться назад
                         </button>
                      </div>
                   )}
                </div>
             </div>
         </div>
      ) : (
      
      /* MAIN TOOLS INTERFACE */
      <div className="bg-dark-900/40 backdrop-blur-xl border border-white/10 rounded-[2.5rem] p-1 shadow-2xl relative overflow-hidden ring-1 ring-white/5">
        <div className={`absolute top-0 left-0 right-0 h-1 opacity-75 ${
           activeSection === MODEL_NANO ? 'bg-gradient-to-r from-transparent via-banana-500 to-transparent' : 
           activeSection === MODEL_SORA ? 'bg-gradient-to-r from-transparent via-pink-500 to-transparent' :
           'bg-gradient-to-r from-transparent via-cyan-400 to-transparent'
        }`}></div>

        <div className="bg-dark-950/80 rounded-[2.3rem] p-6 md:p-10">
            
            {/* Header & Price */}
            <div className="flex flex-col md:flex-row md:items-start justify-between gap-6 mb-8">
               <div className="flex-1">
                  {activeSection === MODEL_NANO && (
                     <>
                        <h2 className="text-3xl md:text-4xl font-extrabold text-white">Nano <span className="text-banana-500">Banana Pro</span></h2>
                        <p className="text-gray-400 mt-2 text-sm">Профессиональная нейрофотосессия для брендов.</p>
                     </>
                  )}
                  {activeSection === MODEL_SORA && (
                     <>
                        <h2 className="text-3xl md:text-4xl font-extrabold text-white">Sora <span className="text-pink-500">Watermark Remover</span></h2>
                        <p className="text-gray-400 mt-2 text-sm">Очистка видео от водяных знаков для коммерции.</p>
                     </>
                  )}
                  {activeSection === MODEL_TOPAZ && (
                     <>
                        <h2 className="text-3xl md:text-4xl font-extrabold text-white">Topaz <span className="text-cyan-400">Video Upscale</span></h2>
                        <p className="text-gray-400 mt-2 text-sm">Улучшение качества видео до 4K (AI Restore).</p>
                     </>
                  )}
               </div>
               <div className="bg-dark-900/80 px-5 py-3 rounded-2xl border border-white/5 text-right min-w-[120px]">
                  <div className={`text-2xl font-bold font-mono ${balance < currentPrice ? 'text-red-500' : 'text-white'}`}>
                     {currentPrice} ₽
                  </div>
                  <div className="text-[10px] text-gray-500 uppercase font-bold tracking-wider">за операцию</div>
               </div>
            </div>

            {/* Marketing Points */}
            {renderMarketingPoints(activeSection as ModelType)}

            {/* NANO FORM */}
            {activeSection === MODEL_NANO && (
              <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
                 {/* Prompt Area */}
                 <div className="space-y-3">
                    <div className="flex justify-between items-end">
                      <label className="text-xs font-bold text-gray-500 uppercase tracking-wider ml-1">Ваш запрос</label>
                      <button onClick={() => setPrompt('')} className="text-[10px] text-gray-500 hover:text-white flex items-center gap-1">
                        <X className="w-3 h-3" /> Очистить
                      </button>
                    </div>
                    <textarea
                      value={prompt}
                      onChange={(e) => setPrompt(e.target.value)}
                      className="w-full bg-dark-900/50 border border-white/10 text-gray-100 rounded-2xl p-5 h-32 text-sm leading-relaxed focus:ring-2 focus:ring-banana-500/30 outline-none resize-none placeholder:text-dark-700"
                      placeholder="Опишите сцену, освещение, стиль..."
                    />
                 </div>

                 {/* Controls Grid */}
                 <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-6">
                       <div className="space-y-3">
                          <label className="text-xs font-bold text-gray-500 uppercase tracking-wider ml-1">Формат</label>
                          <div className="grid grid-cols-3 gap-2">
                            {ASPECT_RATIOS.slice(0, 6).map((ratio) => (
                              <button
                                key={ratio}
                                onClick={() => setAspectRatio(ratio)}
                                className={`text-xs py-2.5 rounded-lg border transition-all ${
                                  aspectRatio === ratio 
                                    ? 'bg-banana-500 text-dark-950 border-banana-500 font-bold' 
                                    : 'bg-dark-900/50 border-white/5 text-gray-400 hover:bg-dark-800'
                                }`}
                              >
                                {ratio}
                              </button>
                            ))}
                          </div>
                       </div>
                    </div>

                    <div className="space-y-3">
                        <label className="text-xs font-bold text-gray-500 uppercase tracking-wider ml-1">Референс (Фото)</label>
                        <div className="relative h-full min-h-[120px] group">
                           <input type="file" accept="image/*" onChange={handleRefImageUpload} className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-20" />
                           <div className={`absolute inset-0 rounded-2xl border-2 border-dashed transition-all flex flex-col items-center justify-center gap-2 p-4 ${
                              refImage ? 'border-banana-500/30 bg-dark-900/30' : 'border-white/10 bg-dark-900/30 hover:border-banana-500/30'
                           }`}>
                              {refImage ? (
                                <div className="flex items-center gap-2 text-banana-500"><Check className="w-5 h-5" /><span className="text-sm font-bold">Загружено</span></div>
                              ) : (
                                <><UploadCloud className="w-6 h-6 text-gray-500" /><span className="text-xs text-gray-500">Загрузить</span></>
                              )}
                           </div>
                        </div>
                    </div>
                 </div>
              </div>
            )}

            {/* SORA FORM */}
            {activeSection === MODEL_SORA && (
               <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
                  <div className="space-y-2">
                     <label className="text-xs font-bold text-gray-500 uppercase tracking-wider ml-1">Sora Video URL</label>
                     <div className="relative">
                        <input
                           type="text"
                           value={soraUrl}
                           onChange={(e) => setSoraUrl(e.target.value)}
                           className="w-full bg-dark-900 border border-white/10 text-gray-100 rounded-xl pl-12 pr-4 py-4 text-sm focus:ring-2 focus:ring-pink-500/30 outline-none"
                           placeholder="https://sora.chatgpt.com/..."
                        />
                        <Video className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" />
                     </div>
                  </div>
               </div>
            )}

            {/* TOPAZ FORM */}
            {activeSection === MODEL_TOPAZ && (
               <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
                   <div className="space-y-2">
                     <label className="text-xs font-bold text-gray-500 uppercase tracking-wider ml-1">Видео URL (MP4)</label>
                     <div className="relative">
                        <input
                           type="text"
                           value={topazUrl}
                           onChange={(e) => setTopazUrl(e.target.value)}
                           className="w-full bg-dark-900 border border-white/10 text-gray-100 rounded-xl pl-12 pr-4 py-4 text-sm focus:ring-2 focus:ring-cyan-500/30 outline-none"
                           placeholder="https://..."
                        />
                        <MonitorPlay className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" />
                     </div>
                  </div>

                  <div className="space-y-2">
                     <label className="text-xs font-bold text-gray-500 uppercase tracking-wider ml-1">Фактор увеличения</label>
                     <div className="flex gap-4">
                        <button
                           className="w-full py-4 rounded-xl border font-bold text-sm transition-all bg-cyan-500/10 border-cyan-500 text-cyan-400 cursor-default"
                        >
                           4x (4K Ultra)
                        </button>
                     </div>
                  </div>
               </div>
            )}

            {/* GENERATE BUTTON */}
            <div className="mt-10 pt-6 border-t border-white/5">
               <button
                  onClick={handleGenerate}
                  disabled={loading}
                  className={`w-full py-5 font-extrabold text-lg uppercase tracking-wide rounded-2xl shadow-xl disabled:opacity-50 disabled:cursor-not-allowed transition-all transform hover:-translate-y-1 active:scale-[0.98] flex items-center justify-center gap-3 ${
                     activeSection === MODEL_NANO ? 'bg-banana-500 text-dark-950 hover:bg-banana-400' :
                     activeSection === MODEL_SORA ? 'bg-pink-600 text-white hover:bg-pink-500' :
                     'bg-cyan-500 text-dark-950 hover:bg-cyan-400'
                  }`}
               >
                  {loading ? (
                     <><Loader2 className="w-6 h-6 animate-spin" /> {statusMsg}</>
                  ) : (
                     <><Zap className="w-6 h-6 fill-current" /> {activeSection === MODEL_NANO ? 'Сгенерировать' : 'Запустить обработку'}</>
                  )}
               </button>
            </div>
        </div>
      </div>
      )}

      {/* RESULT AREA */}
      {(resultUrl || error) && (
         <div ref={resultRef} className="animate-in fade-in slide-in-from-bottom-8 duration-500">
            {error ? (
                <div className="bg-red-900/20 border border-red-500/30 p-6 rounded-2xl text-center text-red-200">
                   <AlertTriangle className="w-8 h-8 mx-auto mb-2 text-red-500" />
                   {error}
                </div>
            ) : (
                <div className="bg-dark-900 rounded-[2rem] overflow-hidden border border-white/10 shadow-2xl">
                   <div className="p-4 bg-black/50 flex justify-end gap-2 backdrop-blur absolute w-full z-10">
                      <a href={resultUrl!} target="_blank" rel="noreferrer" className="p-2 bg-white/10 rounded-full hover:bg-white/20 text-white"><Maximize2 className="w-5 h-5" /></a>
                      <a href={resultUrl!} download className="p-2 bg-banana-500 rounded-full text-black hover:bg-banana-400"><Download className="w-5 h-5" /></a>
                   </div>
                   {isVideoResult ? (
                      <video src={resultUrl!} controls className="w-full aspect-video object-contain bg-black" />
                   ) : (
                      <img src={resultUrl!} alt="Result" className="w-full h-auto object-contain bg-black" />
                   )}
                </div>
            )}
         </div>
      )}

      {/* NANO PRESETS FEED (Instagram Style) - ONLY FOR NANO */}
      {activeSection === MODEL_NANO && (
         <div className="space-y-6 pt-8 animate-in fade-in slide-in-from-bottom-8 duration-700 delay-100">
            <div className="flex items-center gap-4">
               <div className="h-px bg-white/10 flex-1"></div>
               <span className="text-gray-500 text-xs font-bold uppercase tracking-widest">Лента идей</span>
               <div className="h-px bg-white/10 flex-1"></div>
            </div>

            <div className="grid gap-8 max-w-2xl mx-auto">
               {NANO_PRESETS.map((preset) => (
                  <div key={preset.id} className="bg-dark-900 rounded-[2rem] overflow-hidden border border-white/5 shadow-2xl group">
                     {/* Header */}
                     <div className="p-4 flex items-center gap-3 border-b border-white/5">
                        <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-banana-500 to-orange-500 p-0.5">
                           <div className="w-full h-full rounded-full bg-black overflow-hidden">
                              <img src={preset.image} className="w-full h-full object-cover opacity-80" alt="avatar" />
                           </div>
                        </div>
                        <div>
                           <h4 className="text-white font-bold text-sm">{preset.label}</h4>
                           <p className="text-xs text-gray-500">Nano Banana Pro • 8K</p>
                        </div>
                        <button 
                           onClick={() => {
                              setPrompt(preset.prompt);
                              window.scrollTo({ top: 0, behavior: 'smooth' });
                           }}
                           className="ml-auto px-4 py-1.5 bg-white/5 hover:bg-banana-500 hover:text-black rounded-full text-xs font-bold text-banana-500 transition-all"
                        >
                           Использовать
                        </button>
                     </div>

                     {/* Image */}
                     <div className="aspect-square md:aspect-[4/5] relative overflow-hidden">
                        <img src={preset.image} alt={preset.label} className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105" />
                     </div>

                     {/* Content */}
                     <div className="p-5 space-y-3">
                        <div className="flex gap-4">
                           <button 
                             onClick={() => {
                              setPrompt(preset.prompt);
                              window.scrollTo({ top: 0, behavior: 'smooth' });
                             }}
                             className="flex items-center gap-2 text-white hover:text-banana-500 transition-colors"
                           >
                              <Zap className="w-6 h-6" />
                           </button>
                           <button className="text-gray-500 hover:text-white transition-colors">
                              <ExternalLink className="w-6 h-6" />
                           </button>
                        </div>
                        <div className="space-y-1">
                           <p className="text-sm text-gray-300 line-clamp-3">
                              <span className="font-bold text-white mr-2">Prompt:</span>
                              {preset.prompt}
                           </p>
                        </div>
                        <button 
                           onClick={() => {
                              setPrompt(preset.prompt);
                              window.scrollTo({ top: 0, behavior: 'smooth' });
                           }}
                           className="text-xs text-gray-500 uppercase font-bold tracking-wider hover:text-banana-500 transition-colors flex items-center gap-1"
                        >
                           Применить этот стиль <ChevronRight className="w-3 h-3" />
                        </button>
                     </div>
                  </div>
               ))}
            </div>
         </div>
      )}

    </div>
  );
};
