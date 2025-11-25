
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
  NANO_RATIOS, 
  DEFAULT_SORA_URL,
  MODEL_NANO,
  MODEL_SORA,
  MODEL_TOPAZ,
  SECTION_ULTRA,
  SECTION_BUSINESS,
  MARKETING_COPY,
  SECRET_TELEGRAM_LINK
} from '../constants';
import { createTask, getTaskStatus, parseResultJson } from '../services/kieService';
import { 
  Wand2, Download, Loader2, 
  UploadCloud, Video, Zap, Check,
  MonitorPlay, Crown, Briefcase, Play, Star,
  Link as LinkIcon, Camera, Maximize2, Gem, ThumbsUp, Send
} from 'lucide-react';

interface ImageGeneratorProps {
  apiKey: string;
  onHistoryUpdate: (item: HistoryItem) => void;
  balance: number;
  onDeductBalance: (amount: number) => void;
  onReqTopUp: () => void;
  selectedItem?: HistoryItem | null;
}

const PRICES: Record<string, number> = {
  [MODEL_NANO]: 19,
  [MODEL_SORA]: 5,
  [MODEL_TOPAZ]: 10,
};

const generateId = () => Date.now().toString(36) + Math.random().toString(36).substring(2);

// Utility to strip Data URI header and get raw base64
const cleanBase64 = (str: string | null): string => {
  if (!str) return "";
  // If it contains a comma, likely "data:image/png;base64,AAAA..."
  if (str.includes(',')) {
    return str.split(',')[1];
  }
  return str;
};

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
  const [prompt, setPrompt] = useState(''); 
  const [aspectRatio, setAspectRatio] = useState<AspectRatio>(AspectRatio.Horizontal_16_9);
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

  useEffect(() => {
    // Clear result when switching tabs to avoid confusion
    setResultData(null);
    setError(null);
    setStatusMsg('');
  }, [activeSection]);

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
      if (selectedItem.model === MODEL_NANO && selectedItem.prompt) setPrompt(selectedItem.prompt);
    }
  }, [selectedItem]);

  useEffect(() => {
    if ((resultData || error) && resultRef.current) {
      setTimeout(() => {
        resultRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, 300);
    }
  }, [resultData, error]);

  const startPolling = (taskId: string, model: ModelType, currentPrompt?: string, currentVideoUrl?: string) => {
    setStatusMsg('Обработка задачи...');
    const historyId = generateId();
    const historyItemBase: HistoryItem = {
      id: historyId, taskId, model, status: 'waiting', timestamp: Date.now()
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
          if (urls.length > 0) {
            setResultData({ url: urls[0], isVideo: model === MODEL_SORA || model === MODEL_TOPAZ });
            onHistoryUpdate({ ...historyItemBase, status: 'success', resultUrl: urls[0] });
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
      } catch (err) { console.error(err); }
    }, 2000);
  };

  const handleGenerate = async () => {
    if ([SECTION_ULTRA, SECTION_BUSINESS].includes(activeSection as any)) return;
    const model = activeSection as ModelType;
    const price = PRICES[model] || 0;
    
    // Check balance BEFORE starting
    if (balance < price) { 
        onReqTopUp(); 
        return; 
    }

    setLoading(true); setError(null); setResultData(null); setStatusMsg('Инициализация...');
    try {
      let input: TaskInput;
      if (model === MODEL_NANO) {
        if (!prompt.trim()) throw new Error("Введите промпт");
        
        // FIX: Send RAW BASE64 (stripped header) for Nano to fix "file type not supported"
        const cleanImages = refImage ? [cleanBase64(refImage)] : [];
        
        input = { 
            prompt, 
            aspect_ratio: aspectRatio, 
            resolution: Resolution.Res_4K, 
            output_format: format, 
            image_input: cleanImages 
        };
      } else if (model === MODEL_SORA) {
        const vidUrl = soraMode === 'link' ? soraUrl : (soraFile || undefined);
        if (!vidUrl) throw new Error("Укажите видео");
        // For Sora video upload, usually best to send Full Data URI if using video_url field client side
        input = { video_url: vidUrl };
      } else if (model === MODEL_TOPAZ) {
        if (!topazFile) throw new Error("Загрузите видео");
         // For Topaz video upload, usually best to send Full Data URI if using video_url field client side
        input = { video_url: topazFile, upscale_factor: upscaleFactor };
      } else throw new Error("Unknown model");
      
      // API CALL
      const taskId = await createTask(apiKey, model, input);
      
      // DEDUCT BALANCE ONLY IF SUCCESSFUL
      onDeductBalance(price);

      const promptLabel = model === MODEL_NANO ? prompt : undefined;
      const urlLabel = model === MODEL_SORA ? (soraMode === 'link' ? soraUrl : 'Sora File') : 'Topaz File';
      startPolling(taskId, model, promptLabel, urlLabel);
    } catch (err: any) {
      setLoading(false); 
      setError(err.message || "Ошибка");
      // Balance is NOT deducted here
    }
  };

  if (activeSection === SECTION_BUSINESS) return <BusinessView activeSection={activeSection} setActiveSection={setActiveSection} setResultData={setResultData} setError={setError} />;
  if (activeSection === SECTION_ULTRA) return <UltraAccessView activeSection={activeSection} setActiveSection={setActiveSection} setResultData={setResultData} setError={setError} onReqTopUp={onReqTopUp} />;

  const currentPrice = PRICES[activeSection as ModelType] || 0;

  return (
    <div className="space-y-6 pb-24 md:pb-12">
      <NavigationTabs activeSection={activeSection} setActiveSection={setActiveSection} setResultData={setResultData} setError={setError} />

      {/* MAIN GENERATOR CARD - ULTRA DESIGN */}
      <div className="relative w-full max-w-4xl mx-auto group perspective-1000">
        {/* Massive Glow */}
        <div className={`absolute -inset-4 bg-gradient-to-b opacity-40 blur-3xl rounded-[3rem] transition-all duration-700 ${
           activeSection === MODEL_NANO ? 'from-banana-500/60 to-transparent' : 
           activeSection === MODEL_SORA ? 'from-pink-500/60 to-transparent' :
           'from-blue-500/60 to-transparent'
        }`}></div>

        <div className="relative bg-dark-950/80 backdrop-blur-3xl border border-white/10 rounded-[2.5rem] p-6 md:p-10 shadow-2xl overflow-hidden ring-1 ring-white/5">
            {/* Header Area */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 mb-10 border-b border-white/5 pb-8">
               <div>
                  {activeSection === MODEL_NANO && <h2 className="text-4xl md:text-5xl font-black text-white tracking-tighter drop-shadow-xl">Nano <span className="text-banana-500">Banana Pro</span></h2>}
                  {activeSection === MODEL_SORA && <h2 className="text-4xl md:text-5xl font-black text-white tracking-tighter drop-shadow-xl">Sora <span className="text-pink-500">Remover</span></h2>}
                  {activeSection === MODEL_TOPAZ && <h2 className="text-4xl md:text-5xl font-black text-white tracking-tighter drop-shadow-xl">Topaz <span className="text-blue-500">4K</span></h2>}
                  <div className="mt-3 inline-flex items-center gap-2 px-3 py-1 bg-white/5 rounded-full border border-white/5">
                      <div className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse"></div>
                      <span className="text-xs font-bold text-gray-400 uppercase tracking-widest">Сохраняем доступ к лучшим инструментам</span>
                  </div>
               </div>
               
               <div className="relative group/price self-end md:self-auto">
                   <div className={`absolute inset-0 blur-xl opacity-60 rounded-2xl ${
                       activeSection === MODEL_NANO ? 'bg-banana-500' : 
                       activeSection === MODEL_SORA ? 'bg-pink-500' : 'bg-blue-500'
                   }`}></div>
                   <div className="relative bg-black/60 backdrop-blur-md border border-white/10 px-8 py-4 rounded-2xl flex flex-col items-center min-w-[120px]">
                       <span className="text-[10px] text-gray-400 font-bold uppercase tracking-widest mb-1">СТОИМОСТЬ</span>
                       <span className="text-3xl font-black text-white tracking-tight">{currentPrice}₽</span>
                   </div>
               </div>
            </div>

            {/* MARKETING BULLETS */}
            <div className="mb-10 grid gap-4 bg-white/5 rounded-3xl p-6 border border-white/5 shadow-inner">
               {MARKETING_COPY[activeSection as ModelType]?.map((point, i) => (
                  <div key={i} className="flex items-start gap-4 text-sm md:text-base text-gray-200 font-medium">
                     <div className={`mt-0.5 p-1 rounded-full shrink-0 ${
                         activeSection === MODEL_NANO ? 'bg-banana-500 text-black' :
                         activeSection === MODEL_SORA ? 'bg-pink-500 text-white' :
                         'bg-blue-500 text-white'
                     }`}>
                        <Check className="w-3 h-3 stroke-[3]" />
                     </div>
                     <span className="leading-snug">{point}</span>
                  </div>
               ))}
            </div>

            {/* FORM INPUTS */}
            <div className="space-y-8">
                {activeSection === MODEL_NANO && (
                   <div className="space-y-8 animate-in fade-in zoom-in-95 duration-500">
                      <div className="relative group">
                        <div className={`absolute -inset-0.5 rounded-3xl bg-gradient-to-r opacity-30 group-focus-within:opacity-100 transition-opacity duration-500 ${
                            activeSection === MODEL_NANO ? 'from-banana-500 to-banana-600' : 'from-gray-700 to-gray-600'
                        }`}></div>
                        <textarea value={prompt} onChange={(e) => setPrompt(e.target.value)} 
                          className="relative w-full bg-black border border-white/10 rounded-2xl p-6 text-base text-gray-100 focus:outline-none h-40 resize-none placeholder:text-gray-600 shadow-xl" 
                          placeholder="Опишите ваше идеальное изображение..." 
                        />
                      </div>
                      
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                         {/* Aspect Ratio */}
                         <div className="bg-black/40 rounded-3xl p-5 border border-white/5">
                           <label className="text-xs font-black text-gray-500 uppercase mb-4 flex items-center gap-2"><Star className="w-3 h-3" /> Формат</label>
                           <div className="grid grid-cols-2 gap-3">
                                {NANO_RATIOS.map(r => (
                                    <button key={r} onClick={() => setAspectRatio(r)} className={`py-3 text-xs rounded-xl font-bold transition-all border ${aspectRatio === r ? 'bg-banana-500 border-banana-500 text-black shadow-lg shadow-banana-500/30 transform scale-105' : 'bg-white/5 border-transparent text-gray-400 hover:bg-white/10'}`}>{r}</button>
                                ))}
                           </div>
                         </div>

                         {/* Quality (Locked 4K) */}
                         <div className="bg-black/40 rounded-3xl p-5 border border-white/5">
                           <label className="text-xs font-black text-gray-500 uppercase mb-4 flex items-center gap-2"><Zap className="w-3 h-3" /> Качество</label>
                           <div className="h-full flex items-center justify-center pb-6">
                                <div className="px-6 py-3 bg-gradient-to-r from-banana-500/20 to-banana-600/20 border border-banana-500/50 text-banana-500 rounded-xl text-sm font-black flex items-center gap-2 shadow-[0_0_20px_rgba(254,220,0,0.1)]">
                                    <Maximize2 className="w-4 h-4" /> 4K ULTRA
                                </div>
                           </div>
                         </div>

                         {/* Reference */}
                         <div className="bg-black/40 rounded-3xl p-5 border border-white/5">
                           <label className="text-xs font-black text-gray-500 uppercase mb-4 flex items-center gap-2"><Camera className="w-3 h-3" /> Референс</label>
                           <FileUpload color="banana" file={refImage} setFile={setRefImage} small />
                        </div>
                      </div>
                   </div>
                )}

                {activeSection === MODEL_SORA && (
                   <div className="space-y-8 animate-in fade-in zoom-in-95 duration-500">
                      <div className="flex justify-center">
                          <div className="bg-black/60 p-1.5 rounded-2xl border border-white/10 inline-flex">
                             <button onClick={() => setSoraMode('link')} className={`px-8 py-3 rounded-xl text-sm font-bold transition-all ${soraMode === 'link' ? 'bg-pink-600 text-white shadow-lg shadow-pink-500/30' : 'text-gray-400 hover:text-white'}`}>Ссылка</button>
                             <button onClick={() => setSoraMode('file')} className={`px-8 py-3 rounded-xl text-sm font-bold transition-all ${soraMode === 'file' ? 'bg-pink-600 text-white shadow-lg shadow-pink-500/30' : 'text-gray-400 hover:text-white'}`}>Файл</button>
                          </div>
                      </div>
                      {soraMode === 'link' ? (
                         <div className="relative group">
                           <div className="absolute inset-y-0 left-5 flex items-center pointer-events-none text-pink-500"><LinkIcon className="w-5 h-5" /></div>
                           <input type="text" value={soraUrl} onChange={(e) => setSoraUrl(e.target.value)} className="w-full bg-black/40 border border-white/10 rounded-2xl pl-14 pr-6 py-6 text-base focus:border-pink-500/50 focus:ring-1 focus:ring-pink-500/20 outline-none transition-all placeholder:text-gray-600 shadow-inner" placeholder="Вставьте ссылку на видео..." />
                         </div>
                      ) : (
                         <FileUpload color="pink" file={soraFile} setFile={setSoraFile} />
                      )}
                   </div>
                )}

                {activeSection === MODEL_TOPAZ && (
                   <div className="space-y-8 animate-in fade-in zoom-in-95 duration-500">
                      <FileUpload color="blue" file={topazFile} setFile={setTopazFile} />
                      <div className="py-4 px-6 bg-blue-500/10 border border-blue-500/20 rounded-2xl text-center text-blue-300 text-sm font-bold flex items-center justify-center gap-3">
                         <div className="p-1.5 bg-blue-500 rounded-full text-black"><MonitorPlay className="w-4 h-4 fill-current" /></div>
                         Автоматическое улучшение до 4K (Ultra AI)
                      </div>
                   </div>
                )}

                {/* MASSIVE ACTION BUTTON */}
                <button 
                    onClick={handleGenerate} 
                    disabled={loading} 
                    className={`w-full py-6 rounded-2xl font-black text-base uppercase tracking-widest transition-all transform hover:scale-[1.01] active:scale-[0.99] flex items-center justify-center gap-4 relative overflow-hidden group/btn ${
                    activeSection === MODEL_NANO ? 'bg-banana-500 text-black' :
                    activeSection === MODEL_SORA ? 'bg-pink-600 text-white' :
                    'bg-blue-600 text-white'
                } shadow-2xl`}>
                    <div className="absolute inset-0 bg-white/20 translate-y-full group-hover/btn:translate-y-0 transition-transform duration-300 blur-xl"></div>
                    {loading ? <Loader2 className="w-6 h-6 animate-spin relative z-10" /> : <Play className="w-6 h-6 fill-current relative z-10" />}
                    <span className="relative z-10">{loading ? 'ОБРАБОТКА...' : 'ЗАПУСТИТЬ ПРОЦЕСС'}</span>
                </button>
            </div>
        </div>

        {/* ADVERTISING FOOTER */}
        <div className="mt-8 text-center animate-in fade-in slide-in-from-bottom-4 duration-1000">
            <a href={SECRET_TELEGRAM_LINK} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 text-gray-500 hover:text-white transition-colors text-xs uppercase tracking-widest font-bold group">
                Заказать нейро видео креатив под ключ <Send className="w-3 h-3 group-hover:translate-x-1 transition-transform" />
            </a>
        </div>
      </div>

      {/* Result Area */}
      {(resultData || error) && (
         <div ref={resultRef} className="animate-in fade-in slide-in-from-bottom-8 duration-700 ease-out max-w-4xl mx-auto pt-10">
            {error ? (
               <div className="bg-red-950/40 border border-red-500/20 p-8 rounded-[2rem] text-red-300 text-base text-center shadow-2xl backdrop-blur-md">{error}</div>
            ) : (
               <div className="bg-black border border-white/10 rounded-[2.5rem] p-3 shadow-2xl relative group overflow-hidden ring-1 ring-white/10">
                  <div className="rounded-[2rem] overflow-hidden relative shadow-inner bg-dark-900">
                    {resultData!.isVideo ? (
                        <video src={resultData!.url} controls className="w-full aspect-video bg-black" />
                    ) : (
                        <img src={resultData!.url} className="w-full h-auto" alt="Result" />
                    )}
                  </div>
                  <a href={resultData!.url} download className="absolute top-8 right-8 p-4 bg-white text-black rounded-2xl shadow-xl opacity-0 group-hover:opacity-100 transition-all hover:bg-gray-200 transform hover:scale-105 active:scale-95 z-20"><Download className="w-6 h-6" /></a>
               </div>
            )}
         </div>
      )}
    </div>
  );
};

// Sub-components
const FileUpload = ({ color, file, setFile, small }: any) => (
   <div className={`relative group cursor-pointer overflow-hidden rounded-3xl transition-all duration-300 ${small ? 'h-full min-h-[120px]' : 'h-48'}`}>
      <input type="file" onChange={(e) => { if(e.target.files?.[0]) { const r = new FileReader(); r.onload = () => setFile(r.result); r.readAsDataURL(e.target.files[0]); }}} className="absolute inset-0 z-20 opacity-0 w-full h-full cursor-pointer" />
      <div className={`absolute inset-0 border-2 border-dashed flex flex-col items-center justify-center gap-4 transition-all duration-300 ${file ? `border-${color}-500 bg-${color}-500/10` : 'border-white/10 bg-black/40 group-hover:bg-white/5 group-hover:border-white/30'}`}>
         {file && !small && (
             <div className="absolute inset-0 opacity-40 bg-cover bg-center" style={{backgroundImage: `url(${file})`}}></div>
         )}
         <div className={`p-4 rounded-full transition-all relative z-10 shadow-lg ${file ? `bg-${color}-500 text-black` : 'bg-white/5 text-gray-400 group-hover:scale-110 group-hover:bg-white/10 group-hover:text-white'}`}>
            {file ? <Check className="w-6 h-6 stroke-[3]" /> : <UploadCloud className="w-8 h-8" />}
         </div>
         {!small && <div className="text-center relative z-10">
             <span className={`text-sm font-bold block uppercase tracking-wide ${file ? `text-${color}-500` : 'text-gray-400 group-hover:text-white'}`}>{file ? 'Файл загружен' : 'Перетащите файл'}</span>
         </div>}
      </div>
   </div>
);

const BusinessView = ({ activeSection, setActiveSection, setResultData, setError }: any) => (
  <div className="pb-20 space-y-6">
     <NavigationTabs activeSection={activeSection} setActiveSection={setActiveSection} setResultData={setResultData} setError={setError} />
     <div className="max-w-4xl mx-auto px-4">
        <div className="bg-gradient-to-br from-blue-700 to-indigo-950 rounded-[3rem] p-10 md:p-16 text-center relative overflow-hidden shadow-[0_20px_60px_-15px_rgba(63,94,244,0.5)] ring-1 ring-white/20">
            <div className="absolute top-0 right-0 w-96 h-96 bg-blue-400/20 rounded-full blur-[100px] -mr-20 -mt-20 pointer-events-none"></div>
            <div className="absolute bottom-0 left-0 w-96 h-96 bg-indigo-500/20 rounded-full blur-[100px] -ml-20 -mb-20 pointer-events-none"></div>
            
            <div className="relative z-10 flex flex-col items-center">
               <div className="inline-block bg-white/10 backdrop-blur-md px-5 py-2 rounded-full text-xs font-bold uppercase tracking-widest text-blue-200 mb-8 border border-white/20 shadow-lg">
                  Trend 2025
               </div>
               <h2 className="text-4xl md:text-7xl font-black text-white mb-8 leading-[0.9] tracking-tighter drop-shadow-2xl">
                   БИЗНЕС <br/><span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-300 to-white">ПОД КЛЮЧ</span>
               </h2>
               <p className="text-blue-100 text-lg md:text-xl mb-12 max-w-2xl mx-auto leading-relaxed font-medium">
                  Собственный AI-сервис без блокировок VPN. Полная упаковка, подключение нейросетей и обучение трафику. Запустите свой стартап за 1 день.
               </p>
               <a href={SECRET_TELEGRAM_LINK} target="_blank" className="inline-flex items-center gap-4 px-12 py-6 bg-white text-blue-800 font-black text-lg rounded-2xl hover:bg-blue-50 transition-all shadow-xl hover:shadow-2xl hover:-translate-y-1 group">
                  <Briefcase className="w-6 h-6 group-hover:scale-110 transition-transform" /> Обсудить проект
               </a>
            </div>
        </div>
     </div>
  </div>
);

const ProductCard = ({ title, price, features, color, onBuy, recommended }: any) => (
    <div className={`relative bg-dark-950/60 backdrop-blur-xl border ${recommended ? `border-${color}-500/50 shadow-[0_0_40px_rgba(0,0,0,0.3)]` : 'border-white/5'} rounded-[2rem] p-8 flex flex-col hover:transform hover:scale-[1.02] transition-all duration-300 group`}>
        {recommended && (
            <div className={`absolute -top-3 left-1/2 -translate-x-1/2 bg-${color}-500 text-black text-[10px] font-black uppercase px-4 py-1.5 rounded-full tracking-wider shadow-lg`}>
                Выбор профи
            </div>
        )}
        <div className="text-center mb-8 border-b border-white/5 pb-6">
            <h3 className="text-gray-300 font-bold text-lg mb-4 uppercase tracking-wider">{title}</h3>
            <div className="flex items-end justify-center gap-1.5">
                <span className="text-5xl font-black text-white tracking-tighter">{price}</span>
                <span className="text-lg font-bold text-gray-500 mb-1">₽</span>
            </div>
        </div>
        <ul className="flex-1 space-y-4 mb-10">
            {features.map((f: string, i: number) => (
                <li key={i} className="flex items-start gap-4 text-sm text-gray-300 group-hover:text-white transition-colors">
                    <div className={`p-0.5 rounded-full mt-0.5 bg-${color}-500/20`}>
                         <Check className={`w-3 h-3 text-${color}-500 stroke-[3]`} />
                    </div>
                    <span className="leading-snug font-medium">{f}</span>
                </li>
            ))}
        </ul>
        <button onClick={onBuy} className={`w-full py-4 rounded-xl font-bold text-sm uppercase tracking-wider transition-all shadow-lg ${
            recommended 
            ? `bg-${color}-500 hover:bg-${color}-400 text-black shadow-${color}-500/20`
            : 'bg-white/10 hover:bg-white/20 text-white'
        }`}>
            Купить доступ
        </button>
    </div>
);

const UltraAccessView = ({ activeSection, setActiveSection, setResultData, setError, onReqTopUp }: any) => (
  <div className="pb-20 space-y-6">
     <NavigationTabs activeSection={activeSection} setActiveSection={setActiveSection} setResultData={setResultData} setError={setError} />
     <div className="max-w-7xl mx-auto px-4">
        <div className="text-center mb-16 relative">
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[300px] bg-gradient-to-r from-banana-500/10 to-pink-500/10 blur-[80px] rounded-full pointer-events-none"></div>
            
            <div className="relative z-10">
                <div className="inline-flex items-center gap-2 px-6 py-2 bg-white/5 rounded-full border border-white/10 mb-6 backdrop-blur-md">
                    <Gem className="w-4 h-4 text-banana-500" />
                    <span className="text-xs font-bold text-gray-300 tracking-widest uppercase">Premium Membership</span>
                </div>
                
                <h2 className="text-5xl md:text-7xl font-black text-white mb-6 tracking-tighter">
                    GOOGLE <span className="text-transparent bg-clip-text bg-gradient-to-r from-banana-500 to-pink-500">ULTRA AI</span>
                </h2>
                <p className="text-gray-400 max-w-3xl mx-auto text-lg md:text-xl leading-relaxed font-light">
                    Полный безлимит на генерацию видео в <strong className="text-white">Veo</strong> и фото в <strong className="text-white">Nano Banana Pro</strong> через официальную платформу Google Labs. 
                    <span className="block mt-2 text-gray-300 font-medium">В комплекте подробные инструкции.</span>
                </p>

                <div className="mt-8 flex items-center justify-center gap-2 text-green-400 font-bold text-xs uppercase tracking-wider animate-pulse">
                    <ThumbsUp className="w-4 h-4" />
                    Более 1000 положительных отзывов
                </div>
            </div>
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-2 gap-8 px-2 max-w-4xl mx-auto">
            {/* SKLADCHINA CARD */}
            <ProductCard 
                title="СКЛАДЧИНА БЕЗЛИМИТ" 
                price="1000" 
                color="pink"
                recommended={true}
                onBuy={onReqTopUp}
                features={[
                    "Veo Video Generator (Full)",
                    "Nano Banana Pro (Full)",
                    "Google Labs Platform",
                    "Инструкции по использованию",
                    "Гарантия замены"
                ]} 
            />

            {/* PERSONAL CARD */}
            <ProductCard 
                title="ЛИЧНЫЙ АККАУНТ БЕЗЛИМИТ" 
                price="4000" 
                color="banana"
                recommended={true}
                onBuy={onReqTopUp}
                features={[
                    "Приватный доступ (Только вы)",
                    "Veo Video Generator (Full)",
                    "Nano Banana Pro (Full)",
                    "Приоритетная поддержка",
                    "Гарантия 30 дней"
                ]} 
            />
        </div>
     </div>
  </div>
);

const NavigationTabs = ({ 
  activeSection, 
  setActiveSection, 
  setResultData, 
  setError 
}: any) => {
   const tabs = [
      { id: MODEL_NANO, label: 'Nano', icon: Wand2, color: 'text-banana-500', activeBg: 'bg-banana-500/10' },
      { id: MODEL_SORA, label: 'Sora', icon: Video, color: 'text-pink-500', activeBg: 'bg-pink-500/10' },
      { id: MODEL_TOPAZ, label: 'Topaz', icon: MonitorPlay, color: 'text-blue-500', activeBg: 'bg-blue-500/10' },
      { id: SECTION_ULTRA, label: 'ULTRA', icon: Crown, color: 'text-banana-500', activeBg: 'bg-banana-500/10' },
   ];

   const handleSwitch = (id: SectionType) => {
      setActiveSection(id);
      setResultData(null); 
      setError(null);
      window.scrollTo({top: 0, behavior: 'smooth'});
   };

   return (
      <>
         <div className="hidden md:flex justify-center bg-dark-950/80 p-2 rounded-2xl border border-white/10 w-fit mx-auto shadow-2xl backdrop-blur-xl mb-12 ring-1 ring-white/5">
            {tabs.map(tab => (
               <button key={tab.id} onClick={() => handleSwitch(tab.id as SectionType)} className={`flex items-center gap-2 px-8 py-3.5 rounded-xl text-sm font-bold transition-all duration-300 ${activeSection === tab.id ? `bg-white/10 text-white shadow-lg border border-white/10` : 'text-gray-500 hover:text-gray-300 hover:bg-white/5'}`}>
                  <tab.icon className={`w-4 h-4 ${activeSection === tab.id ? tab.color : 'text-gray-600'}`} />
                  {tab.label}
               </button>
            ))}
            <button onClick={() => handleSwitch(SECTION_BUSINESS)} className={`ml-3 flex items-center gap-2 px-8 py-3.5 rounded-xl text-sm font-bold transition-all duration-300 ${activeSection === SECTION_BUSINESS ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/30' : 'text-blue-500 hover:bg-blue-500/10'}`}>
               <Briefcase className="w-4 h-4" /> Бизнес
            </button>
         </div>

         <div className="fixed bottom-0 left-0 right-0 bg-dark-950/90 backdrop-blur-3xl border-t border-white/10 px-6 pb-8 pt-4 flex justify-between items-center z-50 md:hidden safe-area-bottom shadow-[0_-10px_40px_rgba(0,0,0,0.8)]">
            {tabs.map(tab => (
               <button key={tab.id} onClick={() => handleSwitch(tab.id as SectionType)} className="flex flex-col items-center gap-1.5 w-16 group">
                  <div className={`p-3 rounded-2xl transition-all duration-300 ${activeSection === tab.id ? `${tab.activeBg} scale-110 border border-white/10 shadow-lg shadow-${tab.color.split('-')[1]}-500/20` : 'hover:bg-white/5'}`}>
                     <tab.icon className={`w-5 h-5 ${activeSection === tab.id ? tab.color : 'text-gray-500 group-hover:text-gray-300'}`} />
                  </div>
                  <span className={`text-[10px] font-bold transition-colors ${activeSection === tab.id ? 'text-white' : 'text-gray-600'}`}>{tab.label}</span>
               </button>
            ))}
            <button onClick={() => handleSwitch(SECTION_BUSINESS)} className="flex flex-col items-center gap-1.5 w-16 group">
               <div className={`p-3 rounded-2xl transition-all duration-300 ${activeSection === SECTION_BUSINESS ? 'bg-blue-500/10 scale-110 border border-white/10 shadow-lg shadow-blue-500/20' : 'hover:bg-white/5'}`}>
                  <Briefcase className={`w-5 h-5 ${activeSection === SECTION_BUSINESS ? 'text-blue-500' : 'text-gray-500'}`} />
               </div>
               <span className={`text-[10px] font-bold transition-colors ${activeSection === SECTION_BUSINESS ? 'text-white' : 'text-gray-600'}`}>Бизнес</span>
            </button>
         </div>
      </>
   );
};
