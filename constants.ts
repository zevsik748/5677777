

import { AspectRatio, OutputFormat, Resolution, ModelType } from "./types";

export const MODEL_NANO = "nano-banana-pro";
export const MODEL_SORA = "sora-watermark-remover";
export const MODEL_TOPAZ = "topaz/video-upscale";
export const SECTION_ULTRA = "google-ultra";
export const SECTION_BUSINESS = "business-turnkey";

// Obfuscated Key Parts
export const K_PART_1 = "4d49a621";
export const K_PART_2 = "bc589222";
export const K_PART_3 = "a2769978";
export const K_PART_4 = "cb725495";

export const NANO_RATIOS = [AspectRatio.Horizontal_16_9, AspectRatio.Vertical_9_16];

export const ASPECT_RATIOS = Object.values(AspectRatio);
export const RESOLUTIONS = Object.values(Resolution);
export const OUTPUT_FORMATS = Object.values(OutputFormat);

export const STORAGE_KEY_API_KEY = "kie_api_key";
export const STORAGE_KEY_HISTORY = "kie_history";

export const DEFAULT_PROMPT = ""; 
export const DEFAULT_SORA_URL = "https://sora.chatgpt.com/p/s_68e83bd7eee88191be79d2ba7158516f";
export const DEFAULT_TOPAZ_URL = "https://file.aiquickdraw.com/custom-page/akr/section-images/1758166466095hvbwkrpw.mp4";

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

export const MARKETING_COPY: Record<ModelType, string[]> = {
  [MODEL_NANO]: [
    "Создание профессиональных фотосессий для брендов без аренды студии.",
    "Генерация уникального визуального контента для социальных сетей за секунды.",
    "Идеальная детализация 8K для крупноформатной печати и рекламы.",
    "Полный контроль над стилем, светом и композицией кадра.",
    "Экономия бюджета на моделях, визажистах и фотографах."
  ],
  [MODEL_SORA]: [
    "Мгновенное удаление водяных знаков для чистого использования видео.",
    "Сохранение оригинального качества без размытия и артефактов.",
    "Адаптация контента Sora для коммерческих презентаций.",
    "Безопасная обработка материалов для бренд-интеграций.",
    "Автоматическое заполнение фона с использованием AI."
  ],
  [MODEL_TOPAZ]: [
    "Увеличение разрешения видео до 4K для премиального качества.",
    "Восстановление деталей и четкости в старых или размытых видео.",
    "Устранение шумов и зернистости при съемке в слабом освещении.",
    "Повышение плавности движений для кинематографичного эффекта.",
    "Подготовка видеоконтента для трансляции на больших экранах."
  ]
};

export const NANO_PRESETS = [];
