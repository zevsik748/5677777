
import { AspectRatio, OutputFormat, Resolution } from "./types";

export const MODEL_NANO = "nano-banana-pro";
export const MODEL_SORA = "sora-watermark-remover";
export const MODEL_TOPAZ = "topaz/video-upscale";
export const SECTION_ULTRA = "google-ultra";
export const SECTION_BUSINESS = "business-turnkey";

export const K_PART_1 = "4d49a621";
export const K_PART_2 = "bc589222";
export const K_PART_3 = "a2769978";
export const K_PART_4 = "cb725495";

export const NANO_RATIOS = [AspectRatio.Horizontal_16_9, AspectRatio.Vertical_9_16];
export const STORAGE_KEY_HISTORY = "kie_history";

export const DEFAULT_PROMPT = ""; 
export const DEFAULT_SORA_URL = ""; 
export const DEFAULT_TOPAZ_URL = "";

export const SECRET_LINK = "https://ai.studio/apps/drive/1gWNpwbFqxy5bOJZVKuYlzUezhgxd67jV";
export const SECRET_PRICE = 1499;
export const SBP_NUMBER = "89935801642";
export const SBP_BANK = "Альфа Банк";
export const SBP_RECIPIENT = "Дмитрий";
export const SECRET_TELEGRAM_LINK = "https://t.me/ferixdi_ai";

export const PROMO_RATES = {
  "ferixdi100": 100,
  "f1erixdi500": 500,
  "f2erixdi1000": 1000
};

export const MARKETING_COPY = {
  [MODEL_NANO]: ["Фотосессии без студии", "Контент за секунды", "Детализация 8K", "Полный контроль", "Экономия бюджета"],
  [MODEL_SORA]: ["Без водяных знаков", "Оригинальное качество", "Для презентаций", "Безопасно", "AI заполнение фона"],
  [MODEL_TOPAZ]: ["4K разрешение", "Восстановление деталей", "Устранение шумов", "Плавность движений", "Кинематографичность"]
};

export const NANO_PRESETS = [];
