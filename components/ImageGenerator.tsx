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
  NANO_PRESETS,
  MARKETING_COPY
} from '../constants';
import { createTask, getTaskStatus, parseResultJson } from '../services/kieService';
import { 
  Wand2, Download, Maximize2, Loader2, AlertTriangle, 
  UploadCloud, Video, Zap, X, Check, Sparkles, 
  MonitorPlay, ExternalLink, ChevronRight, Crown,
  Link, FileVideo, Flame, Star
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
    if (activeSection === SECTION_FULL_ACCESS) return;
    
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
  // RENDER: FULL ACCESS SECTION
  // ------------------------------------------
  if (activeSection === SECTION_FULL_ACCESS) {
    return (
      <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
        <div className="flex justify-center overflow-x-auto pb-2">
         <div className="bg-dark-900 p-1.5 rounded-2xl border border-white/10 flex shadow-2xl">
            {[
               { id: MODEL_NANO, label: 'Nano Pro', icon: Wand2, color: 'text-banana-500' },
               { id: MODEL_SORA, label: 'Sora Remove', icon: Video, color: 'text-pink-500' },
               { id: MODEL_TOPAZ, label: 'Topaz Upscale', icon: MonitorPlay, color: 'text-cyan-400' },
               { id: SECTION_FULL_ACCESS, label: 'PRO UNLIMITED', icon: Crown, color: 'text-yellow-400' },
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
        <div className="bg-gradient-to-br from-yellow-500 via-orange-500 to-red-500 p-[2px] rounded-[2.5rem] shadow-[0_0_80px_rgba(234,179,8,0.4)] relative">
          <div className="absolute inset-0 blur-xl bg-gradient-to-r from-yellow-500 to-red-600 opacity-50"></div>
          <div className="bg-dark-950 rounded-[2.4rem] p-8 md:p-12 text-center relative overflow-hidden z-10">
             
             {/* Background Effects */}
             <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full h-full bg-[radial-gradient(circle_at_50%_0%,rgba(234,179,8,0.2),transparent_70%)] pointer-events-none"></div>
             
             <div className="inline-flex items-center gap-2 bg-yellow-500/10 border border-yellow-500/20 text-yellow-400 px-4 py-1.5 rounded-full text-xs font-bold uppercase tracking-widest mb-6 animate-pulse">
                <Crown className="w-4 h-4" /> Special Offer
             </div>

             <h2 className="text-4xl md:text-6xl font-black text-white mb-6 leading-tight">
               PRO <span className="text-transparent bg-clip-text bg-gradient-to-r from-yellow-400 to-orange-400">UNLIMITED</span>
             </h2>
             
             <p className="text-gray-400 text-lg md:text-xl max-w-2xl mx-auto mb-10 leading-relaxed">
               Доступ к <b className="text-white">безлимиту</b> Nano Banana Pro и генерации видео <b className="text-white">Veo</b> на месяц.
               <br/><span className="text-sm opacity-70">Мы с вами это обсуждали — теперь это доступно в один клик.</span>
             </p>

             <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-10 max-w-3xl mx-auto">
                <div className="bg-white/5 border border-white/10 p-5 rounded-2xl flex items-center gap-4 text-left">
                   <div className="w-12 h-12 rounded-full bg-banana-500/20 flex items-center justify-center shrink-0">
                      <Wand2 className="w-6 h-6 text-banana-500" />
                   </div>
                   <div>
                      <h3 className="font-bold text-white">Nano Banana Pro</h3>
                      <p className="text-xs text-gray-500">Безлимитные фотосессии</p>
                   </div>
                </div>
                <div className="bg-white/5 border border-white/10 p-5 rounded-2xl flex items-center gap-4 text-left">
                   <div className="w-12 h-12 rounded-full bg-purple-500/20 flex items-center justify-center shrink-0">
                      <Video className="w-6 h-6 text-purple-500" />
                   </div>
                   <div>
                      <h3 className="font-bold text-white">Veo Video</h3>
                      <p className="text-xs text-gray-500">Генерация видео Veo (Sora)</p>
                   </div>
                </div>
             </div>

             <div className="flex flex-col items-center gap-2 mb-10">
                <span className="text-gray-500 text-lg line-through decoration-red-500 decoration-2">5000 ₽</span>
                <div className="flex items-center gap-3">
                   <span className="text-6xl md:text-7xl font-black text-white tracking-tighter">1000 ₽</span>
                   <span className="text-xl text-gray-400 font-medium">/ месяц</span>
                </div>
             </div>

             <button 
               onClick={onReqTopUp}
               className="w-full max-w-md py-6 bg-gradient-to-r from-yellow-500 to-red-600 text-white font-black text-xl md:text-2xl rounded-2xl shadow-[0_10px_40px_rgba(234,179,8,0.3)] hover:shadow-[0_20px_60px_rgba(234,179,8,0.5)] hover:scale-105 transition-all flex items-center justify-center gap-3"
             >
               <Crown className="w-8 h-8" />
               КУПИТЬ ДОСТУП
             </button>
             
             <p className="mt-6 text-xs text-gray-600">
               Предложение ограничено по времени. Активация происходит автоматически после оплаты.
             </p>
          </div>
        </div>
      </div>
    );
  }

  const currentPrice = PRICES[activeSection as ModelType];

  return (
    <div className="space-y-8">
      
      {/* Navigation Switcher */}
      <div className="flex justify-center overflow-x-auto pb-2">
         <div className="bg-dark-900 p-1.5 rounded-2xl border border-white/10 flex shadow-2xl">
            {[
               { id: MODEL_NANO, label: 'Nano Pro', icon: Wand2, color: 'text-banana-500' },
               { id: MODEL_SORA, label: 'Sora Remove', icon: Video, color: 'text-pink-500' },
               { id: MODEL_TOPAZ, label: 'Topaz Upscale', icon: MonitorPlay, color: 'text-cyan-400' },
               { id: SECTION_FULL_ACCESS, label: 'PRO UNLIMITED', icon: Crown, color: 'text-yellow-400' },
            ].map((tab) => (
               <button
                  key={tab.id}
                  onClick={() => {
                     setActiveSection(tab.id as SectionType);
                     setResultData(null); // Clear result when explicitly switching tabs
                     setError(null);
                  }}
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

      {/* MAIN TOOLS INTERFACE */}
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
                        <p className="text-gray-400 mt-2 text-sm">Очистка видео от водяных знаков.</p>
                     </>
                  )}
                  {activeSection === MODEL_TOPAZ && (
                     <>
                        <h2 className="text-3xl md:text-4xl font-extrabold text-white">Topaz <span className="text-cyan-400">Video Upscale</span></h2>
                        <p className="text-gray-400 mt-2 text-sm">Улучшение качества видео до 4K (AI Restore).</p>
                     </>
                  )}
               </div>
               
               {/* Super Cool Price Display */}
               <div 
                  className="relative group cursor-pointer transform hover:scale-105 transition-transform duration-300" 
                  onClick={onReqTopUp}
               >
                  <div className={`absolute -inset-0.5 bg-gradient-to-r blur-lg opacity-60 group-hover:opacity-100 transition duration-500 animate-pulse ${
                     activeSection === MODEL_NANO ? 'from-yellow-400 via-orange-500 to-red-500' :
                     activeSection === MODEL_SORA ? 'from-pink-400 via-purple-500 to-indigo-500' :
                     'from-cyan-400 via-blue-500 to-teal-400'
                  }`}></div>
                  
                  <div className="relative bg-dark-900 border border-white/20 px-8 py-4 rounded-2xl flex flex-col items-center shadow-2xl">
                     <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-red-600 text-white text-[10px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full shadow-lg border border-red-400 animate-bounce">
                        HOT SALE
                     </div>
                     <div className="flex items-center gap-2 opacity-50 mb-1">
                        <span className="text-sm line-through decoration-red-500 decoration-2 font-mono text-gray-400">
                           {currentPrice * 5} ₽
                        </span>
                     </div>
                     <div className="flex items-baseline gap-1">
                        <span className={`text-5xl font-black leading-none tracking-tighter ${balance < currentPrice ? 'text-red-500' : 'text-white'}`}>
                           {currentPrice}
                        </span>
                        <span className="text-xl font-bold text-gray-400">₽</span>
                     </div>
                     <span className="text-[9px] text-gray-400 font-bold uppercase tracking-widest mt-1">
                        за генерацию
                     </span>
                  </div>
               </div>
            </div>

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
                        <div className="relative h-full min-h-[120px] group">
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
                  <div className="flex bg-dark-950 p-1 rounded-xl w-fit border border-white/5 mx-auto">
                     <button 
                       onClick={() => setSoraMode('link')}
                       className={`px-6 py-2 rounded-lg text-sm font-bold transition-all flex items-center gap-2 ${soraMode === 'link' ? 'bg-pink-600 text-white shadow-lg' : 'text-gray-400 hover:text-white'}`}
                     >
                       <Link className="w-4 h-4" /> По ссылке
                     </button>
                     <button 
                       onClick={() => setSoraMode('file')}
                       className={`px-6 py-2 rounded-lg text-sm font-bold transition-all flex items-center gap-2 ${soraMode === 'file' ? 'bg-pink-600 text-white shadow-lg' : 'text-gray-400 hover:text-white'}`}
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
                          <Link className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" />
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

      {/* RESULT AREA - Visible whenever there is a resultData */}
      {(resultData || error) && (
         <div ref={resultRef} className="animate-in fade-in slide-in-from-bottom-8 duration-500 scroll-mt-24">
            {error ? (
                <div className="bg-red-900/20 border border-red-500/30 p-6 rounded-2xl text-center text-red-200">
                   <AlertTriangle className="w-8 h-8 mx-auto mb-2 text-red-500" />
                   {error}
                </div>
            ) : (
                <div className="bg-dark-900 rounded-[2rem] overflow-hidden border border-white/10 shadow-2xl relative group">
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