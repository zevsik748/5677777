
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
  RESOLUTIONS,
  DEFAULT_PROMPT, 
  DEFAULT_SORA_URL,
  MODEL_NANO,
  MODEL_SORA,
  MODEL_TOPAZ,
  SECTION_FULL_ACCESS,
  SECTION_BUSINESS,
  NANO_PRESETS,
  SECRET_TELEGRAM_LINK
} from '../constants';
import { createTask, getTaskStatus, parseResultJson } from '../services/kieService';
import { 
  Wand2, Download, Maximize2, Loader2, AlertTriangle, 
  UploadCloud, Video, Zap, X, Check,
  MonitorPlay, ExternalLink, ChevronRight, Crown,
  Link as LinkIcon, FileVideo, Briefcase, Globe, ShieldCheck, Users, RefreshCw, Star, Rocket
} from 'lucide-react';

interface ImageGeneratorProps {
  apiKey: string;
  onHistoryUpdate: (item: HistoryItem) => void;
  balance: number;
  onDeductBalance: (amount: number) => void;
  onReqTopUp: () => void;
  selectedItem?: HistoryItem | null;
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
  balance,
  onDeductBalance,
  onReqTopUp,
  selectedItem
}) => {
  const [activeSection, setActiveSection] = useState<SectionType>(MODEL_NANO);

  // Nano Form State
  const [prompt, setPrompt] = useState(DEFAULT_PROMPT);
  const [aspectRatio, setAspectRatio] = useState<AspectRatio>(AspectRatio.Square);
  const [resolution, setResolution] = useState<Resolution>(Resolution.Res_1K);
  const [format, setFormat] = useState<OutputFormat>(OutputFormat.PNG);
  const [refImage, setRefImage] = useState<string | null>(null);

  // Sora Form State
  const [soraMode, setSoraMode] = useState<'link' | 'file'>('link');
  const [soraUrl, setSoraUrl] = useState(DEFAULT_SORA_URL);
  const [soraFile, setSoraFile] = useState<string | null>(null);

  // Topaz Form State
  const [topazFile, setTopazFile] = useState<string | null>(null);
  const [upscaleFactor, setUpscaleFactor] = useState<UpscaleFactor>(UpscaleFactor.X4);

  // Execution State
  const [loading, setLoading] = useState(false);
  
  // Stores the final result
  const [resultData, setResultData] = useState<{ url: string; isVideo: boolean } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [statusMsg, setStatusMsg] = useState<string>('');

  const pollingRef = useRef<number | null>(null);
  const resultRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    return () => {
      if (pollingRef.current) window.clearInterval(pollingRef.current);
    };
  }, []);

  // Restore state from history selection
  useEffect(() => {
    if (selectedItem) {
      setActiveSection(selectedItem.model);
      
      if (selectedItem.status === 'success' && (selectedItem.resultUrl || selectedItem.imageUrl)) {
        const url = selectedItem.resultUrl || selectedItem.imageUrl;
        const isVideo = selectedItem.model === MODEL_SORA || selectedItem.model === MODEL_TOPAZ;
        setResultData({ url: url!, isVideo });
        setError(null);
      } else if (selectedItem.status === 'fail') {
        setError('Эта задача завершилась ошибкой.');
        setResultData(null);
      }

      // Restore inputs
      if (selectedItem.model === MODEL_NANO && selectedItem.prompt) {
        setPrompt(selectedItem.prompt);
      }
      if (selectedItem.model === MODEL_SORA && selectedItem.videoInputUrl) {
         if (selectedItem.videoInputUrl.startsWith('http')) {
           setSoraMode('link');
           setSoraUrl(selectedItem.videoInputUrl);
         }
      }
    }
  }, [selectedItem]);

  useEffect(() => {
    if ((resultData || error) && resultRef.current) {
      setTimeout(() => {
        resultRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, 300);
    }
  }, [resultData, error]);

  const handleFileRead = (file: File, callback: (base64: string) => void) => {
    if (file.size > 50 * 1024 * 1024) {
      setError('Файл слишком большой (макс 50MB)');
      return;
    }
    const reader = new FileReader();
    reader.onloadend = () => {
      callback(reader.result as string);
    };
    reader.readAsDataURL(file);
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
    if (model === MODEL_SORA || model === MODEL_TOPAZ) historyItemBase.videoInputUrl = currentVideoUrl || "File Upload";

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
            const isVideo = model === MODEL_SORA || model === MODEL_TOPAZ;
            setResultData({ url: finalUrl, isVideo });
            onHistoryUpdate({
              ...historyItemBase,
              status: 'success',
              resultUrl: finalUrl
            });
          } else {
            setError('Результат не найден в ответе сервера.');
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
    if (activeSection === SECTION_FULL_ACCESS || activeSection === SECTION_BUSINESS) return;
    
    const model = activeSection as ModelType;
    const price = PRICES[model] || 0;

    if (!apiKey) {
      onReqTopUp();
      return;
    }

    if (balance < price) {
      onReqTopUp();
      return;
    }

    setLoading(true);
    setError(null);
    setResultData(null);
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
        if (soraMode === 'link') {
          if (!soraUrl.trim()) throw new Error("Введите URL видео");
          input = { video_url: soraUrl };
        } else {
          if (!soraFile) throw new Error("Загрузите видео файл");
          input = { video_base64: soraFile };
        }
      } else if (model === MODEL_TOPAZ) {
         if (!topazFile) throw new Error("Загрузите видео файл");
         input = { video_base64: topazFile, upscale_factor: upscaleFactor };
      } else {
         throw new Error("Unknown model");
      }

      onDeductBalance(price);

      const taskId = await createTask(apiKey, model, input);
      
      const promptLabel = model === MODEL_NANO ? prompt : undefined;
      let urlLabel = undefined;
      if (model === MODEL_SORA) urlLabel = soraMode === 'link' ? soraUrl : 'Sora File';
      if (model === MODEL_TOPAZ) urlLabel = 'Topaz File';

      startPolling(taskId, model, promptLabel, urlLabel);

    } catch (err: any) {
      setLoading(false);
      setError(err.message || "Ошибка при создании задачи");
    }
  };

  // ------------------------------------------
  // RENDER: BUSINESS TURNKEY SECTION
  // ------------------------------------------
  if (activeSection === SECTION_BUSINESS) {
    return (
      <div className="space-y-4 md:space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500 pb-20">
         <NavigationTabs activeSection={activeSection} setActiveSection={setActiveSection} setResultData={setResultData} setError={setError} />

         <div className="bg-gradient-to-br from-blue-600 to-indigo-700 p-[1px] rounded-[1.5rem] md:rounded-[2.5rem] shadow-[0_0_80px_rgba(79,70,229,0.3)] relative mx-auto w-full max-w-4xl">
            <div className="absolute inset-0 blur-2xl bg-gradient-to-r from-blue-600 to-indigo-600 opacity-40"></div>
            <div className="bg-dark-950 rounded-[1.4rem] md:rounded-[2.4rem] p-6 md:p-12 relative overflow-hidden z-10">
               
               {/* Background Elements */}
               <div className="absolute top-0 right-0 w-64 h-64 bg-blue-500/10 blur-[80px] rounded-full pointer-events-none"></div>

               {/* Header */}
               <div className="text-center mb-8 md:mb-10 relative">
                  <div className="inline-flex items-center gap-2 bg-blue-500/10 border border-blue-500/20 text-blue-400 px-4 py-1.5 rounded-full text-[10px] md:text-xs font-bold uppercase tracking-widest mb-4 md:mb-6">
                      <Rocket className="w-3 h-3 md:w-4 md:h-4" /> Trend 2025
                  </div>
                  <h2 className="text-3xl md:text-5xl font-black text-white mb-4 leading-tight">
                     ГОТОВЫЙ БИЗНЕС <br/>
                     <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-cyan-400">ПОД КЛЮЧ</span>
                  </h2>
                  <p className="text-gray-400 max-w-xl mx-auto text-sm md:text-base leading-relaxed">
                     Забудь про блокировки VPN и сложные настройки. Я сделаю всё за тебя.
                     Твой личный AI-сервис — это независимость и стабильность.
                  </p>
               </div>

               {/* Features Grid */}
               <div className="grid grid-cols-1 md:grid-cols-3 gap-4 md:gap-6 mb-8 md:mb-12">
                  <div className="bg-white/5 border border-white/10 p-5 md:p-6 rounded-2xl hover:bg-white/10 transition-colors group">
                     <div className="w-10 h-10 md:w-12 md:h-12 bg-blue-500/20 rounded-xl flex items-center justify-center mb-4 text-blue-400 group-hover:scale-110 transition-transform">
                        <Globe className="w-5 h-5 md:w-6 md:h-6" />
                     </div>
                     <h3 className="text-lg md:text-xl font-bold text-white mb-2">Упаковка в сайт</h3>
                     <p className="text-xs md:text-sm text-gray-400">Подключу любые нейросети (Gemini, ChatGPT, Midjourney) к твоему личному сайту. Полностью готовое решение.</p>
                  </div>
                  <div className="bg-white/5 border border-white/10 p-5 md:p-6 rounded-2xl hover:bg-white/10 transition-colors group">
                     <div className="w-10 h-10 md:w-12 md:h-12 bg-cyan-500/20 rounded-xl flex items-center justify-center mb-4 text-cyan-400 group-hover:scale-110 transition-transform">
                        <ShieldCheck className="w-5 h-5 md:w-6 md:h-6" />
                     </div>
                     <h3 className="text-lg md:text-xl font-bold text-white mb-2">Без блокировок</h3>
                     <p className="text-xs md:text-sm text-gray-400">Доступы к VPN постоянно блокируют, а с собственным сервисом таких проблем не будет никогда.</p>
                  </div>
                  <div className="bg-white/5 border border-white/10 p-5 md:p-6 rounded-2xl hover:bg-white/10 transition-colors group">
                     <div className="w-10 h-10 md:w-12 md:h-12 bg-indigo-500/20 rounded-xl flex items-center justify-center mb-4 text-indigo-400 group-hover:scale-110 transition-transform">
                        <Users className="w-5 h-5 md:w-6 md:h-6" />
                     </div>
                     <h3 className="text-lg md:text-xl font-bold text-white mb-2">Трафик и Клиенты</h3>
                     <p className="text-xs md:text-sm text-gray-400">Покажу, как гнать трафик и монетизировать этот инструмент. Полное сопровождение.</p>
                  </div>
               </div>

               {/* Call to Action */}
               <div className="bg-gradient-to-r from-dark-900 to-dark-800 border border-white/10 rounded-2xl p-6 md:p-8 flex flex-col md:flex-row items-center justify-between gap-6 relative overflow-hidden">
                  <div className="absolute inset-0 bg-blue-500/5"></div>
                  <div className="text-center md:text-left relative z-10">
                     <h4 className="text-xl md:text-2xl font-bold text-white mb-2">Готов обсудить проект?</h4>
                     <p className="text-gray-400 text-xs md:text-sm">Напиши мне в Telegram, разберем твою идею и условия.</p>
                  </div>
                  <a 
                    href={SECRET_TELEGRAM_LINK}
                    target="_blank"
                    rel="noreferrer"
                    className="w-full md:w-auto px-8 py-4 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-xl transition-all shadow-lg hover:shadow-blue-500/30 flex items-center justify-center gap-2 whitespace-nowrap relative z-10"
                  >
                     <Briefcase className="w-5 h-5" />
                     Обсудить проект
                  </a>
               </div>

            </div>
         </div>
      </div>
    )
  }

  // ------------------------------------------
  // RENDER: FULL ACCESS (PRO UNLIMITED) SECTION
  // ------------------------------------------
  if (activeSection === SECTION_FULL_ACCESS) {
    return (
      <div className="space-y-4 md:space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500 pb-20">
        <NavigationTabs activeSection={activeSection} setActiveSection={setActiveSection} setResultData={setResultData} setError={setError} />

        {/* PRO CARD */}
        <div className="bg-gradient-to-br from-yellow-500 via-orange-500 to-red-500 p-[1px] md:p-[2px] rounded-[1.5rem] md:rounded-[2.5rem] shadow-[0_0_80px_rgba(234,179,8,0.4)] relative w-full max-w-4xl mx-auto">
          <div className="absolute inset-0 blur-xl bg-gradient-to-r from-yellow-500 to-red-600 opacity-50"></div>
          <div className="bg-dark-950 rounded-[1.4rem] md:rounded-[2.4rem] p-6 md:p-12 text-center relative overflow-hidden z-10">
             
             {/* Dynamic background effect */}
             <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full h-full bg-[radial-gradient(circle_at_50%_0%,rgba(234,179,8,0.15),transparent_70%)] pointer-events-none"></div>

             {/* Live Indicator */}
             <div className="absolute top-6 right-6 flex items-center gap-2">
                <span className="relative flex h-3 w-3">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-3 w-3 bg-green-500"></span>
                </span>
                <span className="text-[10px] font-bold text-green-500 uppercase tracking-widest hidden sm:block">Live</span>
             </div>

             {/* Badge */}
             <div className="inline-flex items-center gap-2 bg-yellow-500/10 border border-yellow-500/20 text-yellow-400 px-4 py-1.5 rounded-full text-[10px] md:text-xs font-bold uppercase tracking-widest mb-6 animate-pulse">
                <Crown className="w-3 h-3 md:w-4 md:h-4" /> Google Ultra AI
             </div>

             {/* Title */}
             <h2 className="text-3xl md:text-6xl font-black text-white mb-6 leading-tight">
               PRO <span className="text-transparent bg-clip-text bg-gradient-to-r from-yellow-400 to-orange-400">UNLIMITED</span>
             </h2>
             
             {/* Description Box */}
             <div className="bg-white/5 border border-white/10 rounded-2xl p-5 md:p-8 mb-8 max-w-3xl mx-auto backdrop-blur-sm text-left">
                <p className="text-gray-200 text-sm md:text-lg leading-relaxed mb-6 font-medium text-center">
                  Эксклюзивная <span className="text-yellow-400 font-bold uppercase">Складчина</span> на доступ к мощностям Google Ultra AI.
                  <br className="hidden md:block"/> Вы получаете <span className="underline decoration-yellow-500 underline-offset-4">БЕЗЛИМИТНЫЙ</span> доступ к Nano Banana Pro и Veo на месяц.
                </p>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="bg-black/30 p-4 rounded-xl flex items-start gap-3 border border-white/5">
                        <RefreshCw className="w-5 h-5 text-banana-500 shrink-0 mt-0.5" />
                        <div className="text-xs md:text-sm text-gray-300">
                           <span className="text-white font-bold block mb-1">Вечный двигатель</span>
                           Если кредиты заканчиваются — я мгновенно выдаю <b>НОВЫЙ</b> аккаунт. Доступ не прерывается.
                        </div>
                    </div>
                    <div className="bg-black/30 p-4 rounded-xl flex items-start gap-3 border border-white/5">
                        <Users className="w-5 h-5 text-banana-500 shrink-0 mt-0.5" />
                        <div className="text-xs md:text-sm text-gray-300">
                           <span className="text-white font-bold block mb-1">Комьюнити</span>
                           Беспроблемный доступ участников складчины приближается к цифре <span className="text-banana-400 font-mono text-lg font-bold">100</span>.
                        </div>
                    </div>
                </div>
             </div>

             {/* Price & Button */}
             <div className="flex flex-col items-center gap-3 mb-8">
                <div className="flex items-end gap-2">
                   <span className="text-5xl md:text-7xl font-black text-white tracking-tighter">1000 ₽</span>
                   <span className="text-lg md:text-xl text-gray-400 font-medium mb-1.5">/ месяц</span>
                </div>
                <span className="text-[10px] md:text-xs text-green-400 font-bold bg-green-900/30 px-3 py-1 rounded-full border border-green-500/30 flex items-center gap-1">
                   <ShieldCheck className="w-3 h-3" /> Гарантия замены аккаунта
                </span>
             </div>

             <button 
               onClick={onReqTopUp}
               className="w-full max-w-md py-4 md:py-5 bg-gradient-to-r from-yellow-500 to-red-600 text-white font-black text-lg md:text-xl rounded-2xl shadow-[0_10px_40px_rgba(234,179,8,0.3)] hover:shadow-[0_20px_60px_rgba(234,179,8,0.5)] active:scale-95 transition-all flex items-center justify-center gap-3 mx-auto"
             >
               <Zap className="w-6 h-6 fill-current" />
               ВСТУПИТЬ В СКЛАДЧИНУ
             </button>
          </div>
        </div>

        {/* PERSONAL ACCOUNT OFFER CARD */}
        <div className="w-full max-w-4xl mx-auto border border-purple-500/20 rounded-[1.5rem] md:rounded-[2rem] bg-dark-900/50 p-6 md:p-8 relative overflow-hidden group hover:border-purple-500/40 transition-colors">
            {/* Background Icon */}
            <div className="absolute -right-4 -top-4 opacity-10 group-hover:opacity-20 transition-opacity">
               <Star className="w-40 h-40 text-purple-500 rotate-12" />
            </div>
            
            <div className="relative z-10 flex flex-col md:flex-row items-center justify-between gap-6 md:gap-8">
               <div className="text-center md:text-left">
                  <h3 className="text-xl md:text-2xl font-bold text-white mb-3 flex items-center justify-center md:justify-start gap-3">
                     Личный Аккаунт <span className="text-purple-300 text-[10px] font-black border border-purple-500/30 px-2 py-0.5 rounded bg-purple-500/20 tracking-wider">PREMIUM</span>
                  </h3>
                  <div className="space-y-2 mb-4 text-sm text-gray-400 max-w-md">
                     <p>Гарантированный безлимит на месяц в одни руки.</p>
                     <p className="flex items-center justify-center md:justify-start gap-2 text-white font-medium">
                        <Check className="w-4 h-4 text-purple-500" /> Включено 25,000 кредитов (~2500 видео)
                     </p>
                  </div>
                  <p className="text-xs text-purple-300 font-bold bg-purple-900/20 p-2 rounded-lg inline-block border border-purple-500/20">
                     🔥 Если кредиты закончатся — выдам ЕЩЁ ОДИН аккаунт бесплатно.
                  </p>
               </div>
               
               <div className="flex flex-col items-center gap-3 shrink-0 w-full md:w-auto">
                  <span className="text-3xl font-black text-white">4000 ₽</span>
                  <a 
                     href={SECRET_TELEGRAM_LINK}
                     target="_blank"
                     rel="noreferrer"
                     className="w-full md:w-auto px-6 py-3 bg-white/5 hover:bg-purple-600 border border-purple-500/30 hover:border-purple-500 text-white font-bold rounded-xl transition-all flex items-center justify-center gap-2"
                  >
                     <Briefcase className="w-4 h-4" />
                     Купить Личный
                  </a>
               </div>
            </div>
        </div>
      </div>
    );
  }

  const currentPrice = PRICES[activeSection as ModelType];

  return (
    <div className="space-y-4 md:space-y-8 pb-20">
      
      <NavigationTabs activeSection={activeSection} setActiveSection={setActiveSection} setResultData={setResultData} setError={setError} />

      {/* MAIN TOOLS INTERFACE */}
      <div className="bg-dark-900/40 backdrop-blur-xl border border-white/10 rounded-[1.5rem] md:rounded-[2.5rem] p-1 shadow-2xl relative overflow-hidden ring-1 ring-white/5 w-full max-w-4xl mx-auto">
        <div className={`absolute top-0 left-0 right-0 h-1 opacity-75 ${
           activeSection === MODEL_NANO ? 'bg-gradient-to-r from-transparent via-banana-500 to-transparent' : 
           activeSection === MODEL_SORA ? 'bg-gradient-to-r from-transparent via-pink-500 to-transparent' :
           'bg-gradient-to-r from-transparent via-cyan-400 to-transparent'
        }`}></div>

        <div className="bg-dark-950/80 rounded-[1.4rem] md:rounded-[2.3rem] p-5 md:p-10">
            
            {/* Header & Price */}
            <div className="flex flex-col md:flex-row md:items-start justify-between gap-6 mb-8">
               <div className="flex-1 text-center md:text-left">
                  {activeSection === MODEL_NANO && (
                     <>
                        <h2 className="text-2xl md:text-4xl font-extrabold text-white">Nano <span className="text-banana-500">Banana Pro</span></h2>
                        <p className="text-gray-400 mt-2 text-xs md:text-sm">Профессиональная нейрофотосессия для брендов.</p>
                     </>
                  )}
                  {activeSection === MODEL_SORA && (
                     <>
                        <h2 className="text-2xl md:text-4xl font-extrabold text-white">Sora <span className="text-pink-500">Watermark Remover</span></h2>
                        <p className="text-gray-400 mt-2 text-xs md:text-sm">Очистка видео от водяных знаков.</p>
                     </>
                  )}
                  {activeSection === MODEL_TOPAZ && (
                     <>
                        <h2 className="text-2xl md:text-4xl font-extrabold text-white">Topaz <span className="text-cyan-400">Video Upscale</span></h2>
                        <p className="text-gray-400 mt-2 text-xs md:text-sm">Улучшение качества видео до 4K (AI Restore).</p>
                     </>
                  )}
               </div>
               
               {/* Price Display - FIXED PRICE ONLY */}
               <div 
                  className="relative group cursor-pointer transform hover:scale-105 transition-transform duration-300 mx-auto md:mx-0 w-full md:w-auto" 
                  onClick={onReqTopUp}
               >
                  <div className={`absolute -inset-0.5 bg-gradient-to-r blur-lg opacity-40 group-hover:opacity-80 transition duration-500 animate-pulse ${
                     activeSection === MODEL_NANO ? 'from-yellow-400 via-orange-500 to-red-500' :
                     activeSection === MODEL_SORA ? 'from-pink-400 via-purple-500 to-indigo-500' :
                     'from-cyan-400 via-blue-500 to-teal-400'
                  }`}></div>
                  
                  <div className="relative bg-dark-900 border border-white/20 px-6 md:px-8 py-3 md:py-4 rounded-xl md:rounded-2xl flex flex-row md:flex-col items-center justify-between md:justify-center gap-4 md:gap-0 shadow-2xl">
                     <span className="text-[10px] text-gray-400 font-bold uppercase tracking-widest md:hidden">
                        Стоимость
                     </span>
                     <div className="flex items-baseline gap-1">
                        <span className={`text-3xl md:text-5xl font-black leading-none tracking-tighter ${balance < currentPrice ? 'text-red-500' : 'text-white'}`}>
                           {currentPrice}
                        </span>
                        <span className="text-lg md:text-xl font-bold text-gray-400">₽</span>
                     </div>
                     <span className="text-[9px] text-gray-500 font-bold uppercase tracking-widest mt-1 hidden md:block">
                        за генерацию
                     </span>
                  </div>
               </div>
            </div>

            {/* NANO FORM */}
            {activeSection === MODEL_NANO && (
              <div className="space-y-6 md:space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
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
                      className="w-full bg-dark-900/50 border border-white/10 text-gray-100 rounded-2xl p-4 md:p-5 h-32 md:h-32 text-sm leading-relaxed focus:ring-2 focus:ring-banana-500/30 outline-none resize-none placeholder:text-dark-700 shadow-inner"
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
                       
                       <div className="space-y-3">
                          <label className="text-xs font-bold text-gray-500 uppercase tracking-wider ml-1">Разрешение</label>
                          <div className="grid grid-cols-3 gap-2">
                            {RESOLUTIONS.map((res) => (
                              <button
                                key={res}
                                onClick={() => setResolution(res)}
                                className={`text-xs py-2.5 rounded-lg border transition-all ${
                                  resolution === res 
                                    ? 'bg-banana-500 text-dark-950 border-banana-500 font-bold' 
                                    : 'bg-dark-900/50 border-white/5 text-gray-400 hover:bg-dark-800'
                                }`}
                              >
                                {res}
                              </button>
                            ))}
                          </div>
                       </div>
                    </div>

                    <div className="space-y-3">
                        <label className="text-xs font-bold text-gray-500 uppercase tracking-wider ml-1">Референс (Фото)</label>
                        <div className="relative h-32 md:h-full min-h-[120px] group">
                           <input type="file" accept="image/*" onChange={(e) => {
                             if(e.target.files?.[0]) handleFileRead(e.target.files[0], setRefImage)
                           }} className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-20" />
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
                  <div className="flex bg-dark-950 p-1 rounded-xl w-full md:w-fit border border-white/5 md:mx-auto">
                     <button 
                       onClick={() => setSoraMode('link')}
                       className={`flex-1 md:flex-none px-6 py-2 rounded-lg text-sm font-bold transition-all flex items-center justify-center gap-2 ${soraMode === 'link' ? 'bg-pink-600 text-white shadow-lg' : 'text-gray-400 hover:text-white'}`}
                     >
                       <LinkIcon className="w-4 h-4" /> По ссылке
                     </button>
                     <button 
                       onClick={() => setSoraMode('file')}
                       className={`flex-1 md:flex-none px-6 py-2 rounded-lg text-sm font-bold transition-all flex items-center justify-center gap-2 ${soraMode === 'file' ? 'bg-pink-600 text-white shadow-lg' : 'text-gray-400 hover:text-white'}`}
                     >
                       <FileVideo className="w-4 h-4" /> Файл
                     </button>
                  </div>

                  {soraMode === 'link' ? (
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
                          <LinkIcon className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" />
                       </div>
                    </div>
                  ) : (
                    <div className="space-y-2">
                       <label className="text-xs font-bold text-gray-500 uppercase tracking-wider ml-1">Загрузить видео</label>
                       <div className="relative h-48 group">
                           <input type="file" accept="video/*" onChange={(e) => {
                             if(e.target.files?.[0]) handleFileRead(e.target.files[0], setSoraFile)
                           }} className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-20" />
                           <div className={`absolute inset-0 rounded-2xl border-2 border-dashed transition-all flex flex-col items-center justify-center gap-2 p-4 ${
                              soraFile ? 'border-pink-500/30 bg-dark-900/30' : 'border-white/10 bg-dark-900/30 hover:border-pink-500/30'
                           }`}>
                              {soraFile ? (
                                <div className="flex flex-col items-center gap-2 text-pink-500">
                                   <div className="w-12 h-12 bg-pink-500/20 rounded-full flex items-center justify-center">
                                      <Check className="w-6 h-6" />
                                   </div>
                                   <span className="text-sm font-bold">Видео выбрано</span>
                                   <span className="text-xs text-pink-400/70">Нажмите чтобы заменить</span>
                                </div>
                              ) : (
                                <div className="flex flex-col items-center gap-2 text-gray-500 group-hover:text-pink-400 transition-colors">
                                   <UploadCloud className="w-10 h-10 mb-2" />
                                   <span className="text-sm font-bold">Перетащите видео или нажмите</span>
                                   <span className="text-xs opacity-50">Максимальный размер 50MB</span>
                                </div>
                              )}
                           </div>
                       </div>
                    </div>
                  )}
               </div>
            )}

            {/* TOPAZ FORM */}
            {activeSection === MODEL_TOPAZ && (
               <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
                   <div className="space-y-2">
                     <label className="text-xs font-bold text-gray-500 uppercase tracking-wider ml-1">Загрузка видео (MP4/MOV)</label>
                     <div className="relative h-48 group">
                           <input type="file" accept="video/*" onChange={(e) => {
                             if(e.target.files?.[0]) handleFileRead(e.target.files[0], setTopazFile)
                           }} className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-20" />
                           <div className={`absolute inset-0 rounded-2xl border-2 border-dashed transition-all flex flex-col items-center justify-center gap-2 p-4 ${
                              topazFile ? 'border-cyan-500/30 bg-dark-900/30' : 'border-white/10 bg-dark-900/30 hover:border-cyan-500/30'
                           }`}>
                              {topazFile ? (
                                <div className="flex flex-col items-center gap-2 text-cyan-500">
                                  <div className="w-12 h-12 bg-cyan-500/20 rounded-full flex items-center justify-center">
                                      <Check className="w-6 h-6" />
                                   </div>
                                  <span className="text-sm font-bold">Видео готово к обработке</span>
                                  <span className="text-xs text-cyan-400/70">Нажмите чтобы заменить</span>
                                </div>
                              ) : (
                                <div className="flex flex-col items-center gap-2 text-gray-500 group-hover:text-cyan-400 transition-colors">
                                  <UploadCloud className="w-10 h-10 mb-2" />
                                  <span className="text-sm font-medium">Перетащите видео или нажмите</span>
                                  <span className="text-[10px] uppercase opacity-70">Макс 50MB</span>
                                </div>
                              )}
                           </div>
                       </div>
                  </div>

                  <div className="space-y-2">
                     <label className="text-xs font-bold text-gray-500 uppercase tracking-wider ml-1">Фактор увеличения</label>
                     <div className="flex gap-4">
                        <button
                           className="w-full py-4 rounded-xl border font-bold text-sm transition-all bg-cyan-500/10 border-cyan-500 text-cyan-400 cursor-default flex items-center justify-center gap-2"
                        >
                           <MonitorPlay className="w-4 h-4" /> 4x (4K Ultra)
                        </button>
                     </div>
                  </div>
               </div>
            )}

            {/* GENERATE BUTTON */}
            <div className="mt-8 md:mt-10 pt-6 border-t border-white/5">
               <button
                  onClick={handleGenerate}
                  disabled={loading}
                  className={`w-full py-5 font-extrabold text-lg uppercase tracking-wide rounded-xl md:rounded-2xl shadow-xl disabled:opacity-50 disabled:cursor-not-allowed transition-all transform hover:-translate-y-1 active:scale-[0.98] flex items-center justify-center gap-3 ${
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

      {/* RESULT AREA - Visible whenever there is a resultData */}
      {(resultData || error) && (
         <div ref={resultRef} className="animate-in fade-in slide-in-from-bottom-8 duration-500 scroll-mt-24 w-full max-w-4xl mx-auto">
            {error ? (
                <div className="bg-red-900/20 border border-red-500/30 p-6 rounded-2xl text-center text-red-200">
                   <AlertTriangle className="w-8 h-8 mx-auto mb-2 text-red-500" />
                   {error}
                </div>
            ) : (
                <div className="bg-dark-900 rounded-[1.5rem] md:rounded-[2rem] overflow-hidden border border-white/10 shadow-2xl relative group">
                   <div className="p-4 bg-black/50 flex justify-end gap-2 backdrop-blur absolute w-full z-10 top-0 left-0 opacity-0 group-hover:opacity-100 transition-opacity">
                      <a href={resultData!.url} target="_blank" rel="noreferrer" className="p-2 bg-white/10 rounded-full hover:bg-white/20 text-white"><Maximize2 className="w-5 h-5" /></a>
                      <a href={resultData!.url} download className="p-2 bg-banana-500 rounded-full text-black hover:bg-banana-400"><Download className="w-5 h-5" /></a>
                   </div>
                   
                   {resultData!.isVideo ? (
                      <video 
                        src={resultData!.url} 
                        controls 
                        autoPlay 
                        loop 
                        className="w-full aspect-video object-contain bg-black/90" 
                      />
                   ) : (
                      <img 
                        src={resultData!.url} 
                        alt="Result" 
                        className="w-full h-auto object-contain bg-black/90 min-h-[300px]" 
                      />
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

            <p className="text-center text-gray-500 text-sm">
               Тут я буду добавлять все промпты для нейросъемок
            </p>

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

const NavigationTabs = ({ 
  activeSection, 
  setActiveSection, 
  setResultData, 
  setError 
}: { 
  activeSection: string, 
  setActiveSection: (s: SectionType) => void,
  setResultData: (d: any) => void,
  setError: (e: any) => void
}) => (
   <div className="flex justify-start md:justify-center overflow-x-auto pb-4 scrollbar-hide -mx-4 px-4 md:mx-0 md:px-0">
      <div className="bg-dark-900 p-1.5 rounded-2xl border border-white/10 flex shadow-2xl min-w-max">
         {[
            { id: MODEL_NANO, label: 'Nano Pro', icon: Wand2, color: 'text-banana-500' },
            { id: MODEL_SORA, label: 'Sora', icon: Video, color: 'text-pink-500' },
            { id: MODEL_TOPAZ, label: 'Topaz', icon: MonitorPlay, color: 'text-cyan-400' },
            { id: SECTION_FULL_ACCESS, label: 'UNLIMITED', icon: Crown, color: 'text-yellow-400' },
            { id: SECTION_BUSINESS, label: 'Бизнес', icon: Briefcase, color: 'text-blue-400' },
         ].map((tab) => (
            <button
               key={tab.id}
               onClick={() => {
                  setActiveSection(tab.id as SectionType);
                  setResultData(null); 
                  setError(null);
               }}
               className={`flex items-center gap-2 px-3 md:px-5 py-2.5 md:py-3 rounded-xl text-xs md:text-sm font-bold transition-all duration-300 ${
                  activeSection === tab.id 
                     ? 'bg-dark-800 text-white shadow-lg border border-white/5' 
                     : 'text-gray-500 hover:text-gray-300 hover:bg-white/5'
               }`}
            >
               <tab.icon className={`w-3.5 h-3.5 md:w-4 md:h-4 ${activeSection === tab.id ? tab.color : 'text-gray-600'}`} />
               <span className="whitespace-nowrap">{tab.label}</span>
            </button>
         ))}
      </div>
   </div>
);