
import React, { useState, useRef, useEffect } from 'react';
import { 
  AspectRatio, 
  OutputFormat, 
  Resolution, 
  TaskInput,
  HistoryItem,
  ModelType,
  SectionType
} from '../types';
import { 
  NANO_RATIOS, 
  MODEL_NANO,
  SECTION_ULTRA,
  SECTION_BUSINESS,
  MARKETING_COPY,
  SECRET_TELEGRAM_LINK
} from '../constants';
import { createTask, getTaskStatus, parseResultJson } from '../services/kieService';
import { 
  Wand2, Loader2, 
  UploadCloud, Zap, Check,
  Crown, Briefcase, Star,
  Camera, Gem, ThumbsUp, Send, Link as LinkIcon
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
};

const generateId = () => Date.now().toString(36) + Math.random().toString(36).substring(2);

// Helper to convert file to Raw Base64 JPEG (stripping header)
const processFileToRawBase64 = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        canvas.width = img.width;
        canvas.height = img.height;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
            reject(new Error("Canvas context failed"));
            return;
        }
        // Fill white background to handle transparent PNGs
        ctx.fillStyle = '#FFFFFF';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(img, 0, 0);
        
        // Export as JPEG 
        const dataUrl = canvas.toDataURL('image/jpeg', 0.95);
        // Strip header "data:image/jpeg;base64," to get raw base64
        const rawBase64 = dataUrl.replace(/^data:image\/(png|jpeg|jpg|webp);base64,/, '');
        resolve(rawBase64);
      };
      img.onerror = reject;
      img.src = event.target?.result as string;
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
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

  // Nano State
  const [nanoMode, setNanoMode] = useState<'link' | 'file'>('file');
  const [prompt, setPrompt] = useState(''); 
  const [aspectRatio, setAspectRatio] = useState<AspectRatio>(AspectRatio.Horizontal_16_9);
  const [nanoFileObj, setNanoFileObj] = useState<File | null>(null); 
  const [nanoPreview, setNanoPreview] = useState<string | null>(null); 
  const [nanoUrl, setNanoUrl] = useState('');

  // General State
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

  // Cleanup on section switch
  useEffect(() => {
    setResultData(null); setError(null); setStatusMsg('');
  }, [activeSection]);

  // Restore history
  useEffect(() => {
    if (selectedItem) {
      setActiveSection(selectedItem.model);
      if (selectedItem.status === 'success') {
        const url = selectedItem.resultUrl || selectedItem.imageUrl;
        if (url) {
            setResultData({ 
                url, 
                isVideo: false 
            });
        }
      }
      if (selectedItem.model === MODEL_NANO && selectedItem.prompt) {
          setPrompt(selectedItem.prompt);
      }
    }
  }, [selectedItem]);

  // Auto-scroll to result
  useEffect(() => {
    if ((resultData || error) && resultRef.current) {
      setTimeout(() => resultRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 100);
    }
  }, [resultData, error]);

  const startPolling = (taskId: string, model: ModelType) => {
    setStatusMsg('Генерация...');
    const histId = generateId();
    const item: HistoryItem = {
        id: histId, taskId, model, status: 'waiting', timestamp: Date.now(),
        prompt: model === MODEL_NANO ? prompt : undefined
    };
    onHistoryUpdate(item);

    pollingRef.current = window.setInterval(async () => {
        try {
            const data = await getTaskStatus(apiKey, taskId);
            if (data.state === 'success') {
                window.clearInterval(pollingRef.current!);
                setLoading(false);
                const urls = parseResultJson(data.resultJson);
                if (urls[0]) {
                    setResultData({ url: urls[0], isVideo: false });
                    onHistoryUpdate({ ...item, status: 'success', resultUrl: urls[0] });
                } else {
                    setError("API не вернул результат");
                    onHistoryUpdate({ ...item, status: 'fail' });
                }
            } else if (data.state === 'fail') {
                window.clearInterval(pollingRef.current!);
                setLoading(false);
                setError(data.failMsg || "Ошибка генерации");
                onHistoryUpdate({ ...item, status: 'fail' });
            }
        } catch (e) { 
            console.error(e); 
        }
    }, 2000);
  };

  const handleGenerate = async () => {
    if ([SECTION_ULTRA, SECTION_BUSINESS].includes(activeSection as any)) return;
    const model = activeSection as ModelType;
    const price = PRICES[model] || 0;

    if (balance < price) { onReqTopUp(); return; }

    setLoading(true); setError(null); setResultData(null); setStatusMsg('Подготовка...');
    
    try {
        let input: TaskInput;

        if (model === MODEL_NANO) {
            if (!prompt.trim()) throw new Error("Введите описание (промпт)");
            
            const images: string[] = [];
            
            // Case 1: File -> Convert to Jpeg Raw Base64 -> Send
            if (nanoMode === 'file' && nanoFileObj) {
                setStatusMsg('Обработка фото...');
                const rawBase64 = await processFileToRawBase64(nanoFileObj);
                images.push(rawBase64);
            } 
            // Case 2: Direct Link
            else if (nanoMode === 'link' && nanoUrl) {
                images.push(nanoUrl);
            }

            input = {
                prompt,
                aspect_ratio: aspectRatio,
                resolution: Resolution.Res_4K,
                output_format: OutputFormat.PNG,
                image_input: images
            };
        } else {
            throw new Error("Неизвестная модель");
        }

        setStatusMsg('Отправка задачи...');
        const taskId = await createTask(apiKey, model, input);
        onDeductBalance(price); // Deduct only on success
        startPolling(taskId, model);

    } catch (e: any) {
        setLoading(false);
        setError(e.message || "Ошибка запуска");
    }
  };

  // Views
  if (activeSection === SECTION_BUSINESS) return <BusinessView activeSection={activeSection} setActiveSection={setActiveSection} setResultData={setResultData} setError={setError} />;
  if (activeSection === SECTION_ULTRA) return <UltraAccessView activeSection={activeSection} setActiveSection={setActiveSection} setResultData={setResultData} setError={setError} onReqTopUp={onReqTopUp} />;

  return (
    <div className="space-y-8 pb-24 md:pb-12">
        <NavigationTabs activeSection={activeSection} setActiveSection={setActiveSection} setResultData={setResultData} setError={setError} />

        <div className="relative w-full max-w-4xl mx-auto">
            {/* Ambient Glow */}
            <div className="absolute -inset-1 blur-3xl opacity-20 bg-banana-500 rounded-[3rem]" />

            <div className="relative bg-dark-950/90 backdrop-blur-2xl border border-white/10 rounded-[2.5rem] p-6 md:p-10 shadow-2xl ring-1 ring-white/5 overflow-hidden">
                
                {/* Header */}
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 mb-8 border-b border-white/5 pb-6">
                    <div>
                        <h2 className="text-4xl md:text-5xl font-black text-white tracking-tighter drop-shadow-lg">
                            Nano <span className="text-banana-500">Banana Pro</span>
                        </h2>
                        <div className="mt-2 inline-flex items-center gap-2 px-3 py-1 bg-green-500/10 rounded-full border border-green-500/20">
                            <div className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse"></div>
                            <span className="text-[10px] font-bold text-green-400 uppercase tracking-widest">Доступ к лучшим инструментам</span>
                        </div>
                    </div>
                    <div className="bg-banana-500 text-black px-6 py-2 rounded-2xl font-black text-2xl shadow-[0_0_20px_rgba(254,220,0,0.3)] transform rotate-2">
                        {PRICES[MODEL_NANO]}₽
                    </div>
                </div>

                {/* Features */}
                <div className="mb-8 grid gap-2">
                    {MARKETING_COPY[MODEL_NANO]?.map((t, i) => (
                        <div key={i} className="flex items-center gap-3 text-sm font-medium text-gray-400">
                            <Check className="w-4 h-4 text-banana-500 shrink-0" />
                            {t}
                        </div>
                    ))}
                </div>

                {/* Input Area */}
                <div className="space-y-6">
                    <div className="relative group">
                        <textarea 
                            value={prompt} 
                            onChange={e => setPrompt(e.target.value)}
                            className="w-full bg-black/50 border border-white/10 rounded-2xl p-5 text-white focus:border-banana-500/50 focus:ring-1 focus:ring-banana-500/20 outline-none h-32 resize-none placeholder:text-gray-600 transition-all"
                            placeholder="Опишите изображение мечты..."
                        />
                        <div className="absolute bottom-4 right-4 p-2 bg-white/5 rounded-lg border border-white/5 backdrop-blur">
                            <Wand2 className="w-4 h-4 text-banana-500" />
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        {/* Aspect Ratio */}
                        <div className="bg-white/5 rounded-2xl p-4 border border-white/5">
                            <label className="text-[10px] font-bold text-gray-500 uppercase flex items-center gap-2 mb-3">
                                <Star className="w-3 h-3 text-banana-500" /> Формат
                            </label>
                            <div className="grid grid-cols-2 gap-2">
                                {NANO_RATIOS.map(r => (
                                    <button 
                                        key={r} 
                                        onClick={() => setAspectRatio(r)} 
                                        className={`py-2.5 rounded-xl text-xs font-bold border transition-all ${aspectRatio === r ? 'bg-banana-500 text-black border-banana-500 shadow-lg' : 'bg-black/40 border-transparent text-gray-400 hover:bg-white/5'}`}
                                    >
                                        {r}
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* Reference */}
                        <div className="bg-white/5 rounded-2xl p-4 border border-white/5">
                            <div className="flex justify-between items-center mb-3">
                                <label className="text-[10px] font-bold text-gray-500 uppercase flex items-center gap-2">
                                    <Camera className="w-3 h-3 text-banana-500" /> Референс
                                </label>
                                <div className="flex bg-black/40 rounded-lg p-0.5">
                                    <button onClick={() => setNanoMode('file')} className={`px-2 py-0.5 text-[10px] font-bold rounded-md transition-all ${nanoMode === 'file' ? 'bg-white/20 text-white' : 'text-gray-500'}`}>Файл</button>
                                    <button onClick={() => setNanoMode('link')} className={`px-2 py-0.5 text-[10px] font-bold rounded-md transition-all ${nanoMode === 'link' ? 'bg-white/20 text-white' : 'text-gray-500'}`}>Ссылка</button>
                                </div>
                            </div>
                            
                            {nanoMode === 'file' ? (
                                <FileUpload color="banana" filePreview={nanoPreview} setFileObj={setNanoFileObj} setPreview={setNanoPreview} />
                            ) : (
                                <input 
                                    type="text" 
                                    value={nanoUrl} 
                                    onChange={e => setNanoUrl(e.target.value)} 
                                    className="w-full bg-black/40 border border-white/10 rounded-xl p-3 text-xs text-white focus:border-banana-500/50 outline-none placeholder:text-gray-700" 
                                    placeholder="https://..." 
                                />
                            )}
                        </div>
                    </div>

                    <button 
                        onClick={handleGenerate} 
                        disabled={loading} 
                        className="w-full py-5 rounded-2xl bg-gradient-to-r from-banana-500 to-banana-400 hover:from-banana-400 hover:to-banana-300 text-black font-black text-lg uppercase tracking-widest shadow-[0_0_30px_rgba(254,220,0,0.2)] hover:shadow-[0_0_40px_rgba(254,220,0,0.4)] transition-all active:scale-[0.98] flex items-center justify-center gap-3"
                    >
                        {loading ? (
                            <>
                                <Loader2 className="w-5 h-5 animate-spin" />
                                {statusMsg || 'ОБРАБОТКА...'}
                            </>
                        ) : (
                            <>
                                <Zap className="w-5 h-5 fill-black" />
                                ЗАПУСТИТЬ ПРОЦЕСС
                            </>
                        )}
                    </button>
                </div>
            </div>

            {/* Footer Ad */}
            <div className="mt-8 text-center pb-8">
                <a href={SECRET_TELEGRAM_LINK} target="_blank" rel="noreferrer" className="group inline-flex items-center gap-2 text-xs font-bold text-gray-600 hover:text-banana-500 transition-colors uppercase tracking-widest border border-transparent hover:border-banana-500/20 px-4 py-2 rounded-full">
                    Заказать нейро видео креатив под ключ <Send className="w-3 h-3 group-hover:-translate-y-0.5 group-hover:translate-x-0.5 transition-transform" />
                </a>
            </div>
        </div>

        {/* Result Section */}
        {(resultData || error) && (
            <div ref={resultRef} className="max-w-4xl mx-auto pt-8 animate-in fade-in slide-in-from-bottom-8">
                {error ? (
                    <div className="bg-red-500/10 border border-red-500/20 p-6 rounded-2xl text-red-400 text-center font-medium backdrop-blur-sm">
                        {error}
                    </div>
                ) : (
                    <div className="bg-dark-950 border border-white/10 rounded-[2rem] p-2 shadow-2xl">
                        <div className="rounded-[1.5rem] overflow-hidden relative bg-black">
                            <img src={resultData!.url} className="w-full h-auto" alt="Generated Result" />
                        </div>
                        <a 
                            href={resultData!.url} 
                            download 
                            target="_blank"
                            rel="noreferrer"
                            className="block w-full text-center py-4 text-sm font-bold text-white hover:text-banana-500 hover:bg-white/5 transition-colors rounded-b-[1.5rem]"
                        >
                            СКАЧАТЬ В ВЫСОКОМ КАЧЕСТВЕ
                        </a>
                    </div>
                )}
            </div>
        )}
    </div>
  );
};

const FileUpload = ({ color, filePreview, setFileObj, setPreview }: any) => {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFile = (file: File) => {
    if (file) {
        setFileObj(file);
        const reader = new FileReader();
        reader.onload = (e) => setPreview(e.target?.result as string);
        reader.readAsDataURL(file);
    }
  };

  return (
    <div 
        onClick={() => fileInputRef.current?.click()}
        className={`relative group cursor-pointer overflow-hidden rounded-xl border border-dashed transition-all h-32 flex flex-col items-center justify-center gap-2 ${filePreview ? `border-${color}-500` : 'border-white/20 bg-black/40 hover:border-white/40'}`}
    >
        <input 
            ref={fileInputRef}
            type="file" 
            onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])} 
            className="hidden" 
            accept="image/*" 
        />
        
        {filePreview ? (
            <>
                <img src={filePreview} alt="preview" className="absolute inset-0 w-full h-full object-cover opacity-50 group-hover:opacity-30 transition-opacity" />
                <div className="relative z-10 bg-black/70 px-3 py-1 rounded-full text-[10px] text-white font-bold flex items-center gap-1">
                    <Check className="w-3 h-3 text-green-500" /> Выбрано
                </div>
            </>
        ) : (
            <>
                <UploadCloud className="w-5 h-5 text-gray-500 group-hover:text-white transition-colors" />
                <span className="text-[10px] font-bold text-gray-600 group-hover:text-gray-400">Нажмите для загрузки</span>
            </>
        )}
    </div>
  );
};

const BusinessView = ({ activeSection, setActiveSection, setResultData, setError }: any) => (
  <div className="pb-20 space-y-6">
     <NavigationTabs activeSection={activeSection} setActiveSection={setActiveSection} setResultData={setResultData} setError={setError} />
     <div className="max-w-4xl mx-auto px-4 text-center">
        <div className="bg-gradient-to-br from-blue-900 to-blue-950 border border-blue-500/20 rounded-[3rem] p-8 md:p-20 relative overflow-hidden shadow-2xl">
            <div className="relative z-10">
                <div className="inline-flex items-center gap-2 px-4 py-1.5 bg-blue-500/10 rounded-full border border-blue-500/20 mb-8">
                    <span className="w-2 h-2 bg-blue-400 rounded-full animate-pulse"></span>
                    <span className="text-xs font-bold text-blue-300 uppercase tracking-widest">Trend 2025</span>
                </div>
                <h2 className="text-4xl md:text-7xl font-black text-white mb-6 tracking-tighter leading-tight">БИЗНЕС <br/><span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-blue-600">ПОД КЛЮЧ</span></h2>
                <p className="text-blue-100 text-base md:text-xl mb-10 max-w-2xl mx-auto leading-relaxed opacity-80">Собственный AI-сервис без блокировок и VPN. Полная упаковка, подключение нейросетей, настройка трафика.</p>
                <a href={SECRET_TELEGRAM_LINK} target="_blank" className="inline-flex items-center gap-2 px-10 py-4 bg-white text-blue-950 font-black rounded-2xl hover:scale-105 transition-transform shadow-xl">
                    ОБСУДИТЬ ПРОЕКТ <Send className="w-4 h-4" />
                </a>
            </div>
        </div>
     </div>
  </div>
);

const UltraAccessView = ({ activeSection, setActiveSection, setResultData, setError, onReqTopUp }: any) => (
  <div className="pb-20 space-y-6">
     <NavigationTabs activeSection={activeSection} setActiveSection={setActiveSection} setResultData={setResultData} setError={setError} />
     <div className="max-w-6xl mx-auto px-4">
        <div className="text-center mb-12 animate-in slide-in-from-bottom-4 fade-in duration-700">
            <div className="inline-flex items-center gap-2 px-4 py-1 bg-white/5 rounded-full mb-6 border border-white/5 backdrop-blur-md">
                <Gem className="w-4 h-4 text-banana-500" />
                <span className="text-xs font-bold text-gray-300 uppercase tracking-widest">Official Google Labs Access</span>
            </div>
            <h2 className="text-5xl md:text-7xl font-black text-white mb-6 tracking-tighter">GOOGLE <span className="text-transparent bg-clip-text bg-gradient-to-r from-banana-500 to-pink-500">ULTRA AI</span></h2>
            <p className="text-gray-400 max-w-2xl mx-auto text-lg leading-relaxed">
                Полноценный доступ к <strong className="text-white">Veo</strong> (генерация видео) и <strong className="text-white">Nano Banana Pro</strong> через официальную платформу.
            </p>
            <div className="mt-8 flex justify-center items-center gap-2 text-green-500 text-xs font-bold uppercase tracking-widest bg-green-500/5 py-2 px-4 rounded-full inline-flex border border-green-500/10">
                <ThumbsUp className="w-3 h-3" /> Более 1000 положительных отзывов
            </div>
        </div>
        
        <div className="grid md:grid-cols-2 gap-6 max-w-4xl mx-auto">
            {/* Card 1 */}
            <div className="bg-dark-950/80 backdrop-blur-xl border border-white/10 rounded-[2.5rem] p-8 hover:border-pink-500/50 transition-all group hover:shadow-[0_0_30px_rgba(255,115,168,0.15)]">
                <div className="text-center mb-8">
                    <div className="w-12 h-12 bg-pink-500/10 rounded-2xl flex items-center justify-center mx-auto mb-4 text-pink-500 group-hover:scale-110 transition-transform">
                        <Crown className="w-6 h-6" />
                    </div>
                    <h3 className="text-xl font-black text-white uppercase tracking-wide mb-2">Складчина Безлимит</h3>
                    <div className="text-sm text-gray-500 font-medium mb-6">Общий доступ к аккаунту</div>
                    <div className="text-5xl font-black text-white">1000₽</div>
                </div>
                <ul className="space-y-4 mb-8">
                    <li className="flex items-center gap-3 text-sm text-gray-300"><Check className="w-4 h-4 text-pink-500" /> Доступ к Google Labs</li>
                    <li className="flex items-center gap-3 text-sm text-gray-300"><Check className="w-4 h-4 text-pink-500" /> Безлимит Veo и Nano</li>
                    <li className="flex items-center gap-3 text-sm text-gray-300"><Check className="w-4 h-4 text-pink-500" /> Гарантия замены</li>
                </ul>
                <button onClick={onReqTopUp} className="w-full py-4 bg-pink-600 text-white font-bold rounded-2xl hover:bg-pink-500 transition-colors shadow-lg hover:shadow-pink-500/25">КУПИТЬ ДОСТУП</button>
            </div>

            {/* Card 2 */}
            <div className="bg-dark-950/80 backdrop-blur-xl border border-white/10 rounded-[2.5rem] p-8 hover:border-banana-500/50 transition-all group hover:shadow-[0_0_30px_rgba(254,220,0,0.15)] relative overflow-hidden">
                <div className="absolute top-0 right-0 bg-banana-500 text-black text-[10px] font-bold px-3 py-1 rounded-bl-xl">BEST CHOICE</div>
                <div className="text-center mb-8">
                    <div className="w-12 h-12 bg-banana-500/10 rounded-2xl flex items-center justify-center mx-auto mb-4 text-banana-500 group-hover:scale-110 transition-transform">
                        <Star className="w-6 h-6 fill-current" />
                    </div>
                    <h3 className="text-xl font-black text-white uppercase tracking-wide mb-2">Личный Аккаунт</h3>
                    <div className="text-sm text-gray-500 font-medium mb-6">Приватный доступ в одни руки</div>
                    <div className="text-5xl font-black text-white">4000₽</div>
                </div>
                <ul className="space-y-4 mb-8">
                    <li className="flex items-center gap-3 text-sm text-gray-300"><Check className="w-4 h-4 text-banana-500" /> Полная приватность</li>
                    <li className="flex items-center gap-3 text-sm text-gray-300"><Check className="w-4 h-4 text-banana-500" /> Все лимиты ваши (2TB)</li>
                    <li className="flex items-center gap-3 text-sm text-gray-300"><Check className="w-4 h-4 text-banana-500" /> Приоритетная поддержка</li>
                </ul>
                <button onClick={onReqTopUp} className="w-full py-4 bg-banana-500 text-black font-bold rounded-2xl hover:bg-banana-400 transition-colors shadow-lg hover:shadow-banana-500/25">КУПИТЬ АККАУНТ</button>
            </div>
        </div>
     </div>
  </div>
);

const NavigationTabs = ({ activeSection, setActiveSection, setResultData, setError }: any) => {
   const tabs = [
      { id: MODEL_NANO, label: 'Nano Banana Pro', icon: Wand2, color: 'text-banana-500' },
      { id: SECTION_ULTRA, label: 'ULTRA', icon: Crown, color: 'text-pink-500' },
   ];
   
   const handleSwitch = (id: SectionType) => { setActiveSection(id); setResultData(null); setError(null); };
   
   return (
      <div className="flex justify-center mb-10 sticky top-20 z-30">
         <div className="bg-black/60 backdrop-blur-xl p-1.5 rounded-2xl border border-white/10 flex gap-1 shadow-2xl">
            {tabs.map(t => (
                <button key={t.id} onClick={() => handleSwitch(t.id as SectionType)} className={`px-5 py-2.5 rounded-xl flex items-center gap-2 text-xs md:text-sm font-bold transition-all ${activeSection === t.id ? 'bg-white/15 text-white shadow-inner' : 'text-gray-500 hover:text-gray-300'}`}>
                    <t.icon className={`w-4 h-4 ${activeSection === t.id ? t.color : 'text-gray-600'}`} /> {t.label}
                </button>
            ))}
            <button onClick={() => handleSwitch(SECTION_BUSINESS)} className={`px-5 py-2.5 rounded-xl flex items-center gap-2 text-xs md:text-sm font-bold transition-all ${activeSection === SECTION_BUSINESS ? 'bg-blue-600 text-white shadow-lg shadow-blue-900/20' : 'text-blue-500 hover:bg-blue-500/10'}`}>
                <Briefcase className="w-4 h-4" /> Бизнес
            </button>
         </div>
      </div>
   );
};
