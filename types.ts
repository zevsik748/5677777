
export type ModelType = 
  | "nano-banana-pro" 
  | "sora-watermark-remover"
  | "topaz/video-upscale";

export type SectionType = ModelType | "secret-section";

export enum AspectRatio {
  Square = "1:1",
  Portrait_2_3 = "2:3",
  Landscape_3_2 = "3:2",
  Portrait_3_4 = "3:4",
  Landscape_4_3 = "4:3",
  Portrait_4_5 = "4:5",
  Landscape_5_4 = "5:4",
  Vertical_9_16 = "9:16",
  Horizontal_16_9 = "16:9",
  Cinematic_21_9 = "21:9"
}

export enum Resolution {
  Res_1K = "1K",
  Res_2K = "2K",
  Res_4K = "4K"
}

export enum OutputFormat {
  PNG = "png",
  JPG = "jpg"
}

export enum UpscaleFactor {
  X2 = "2",
  X4 = "4"
}

export interface NanoTaskInput {
  prompt: string;
  image_input?: string[]; // Array of Base64 strings
  aspect_ratio: AspectRatio;
  resolution: Resolution;
  output_format: OutputFormat;
}

export interface SoraTaskInput {
  video_url: string;
}

export interface TopazTaskInput {
  video_url: string;
  upscale_factor: UpscaleFactor;
}

export type TaskInput = 
  | NanoTaskInput 
  | SoraTaskInput
  | TopazTaskInput;

export interface CreateTaskRequest {
  model: ModelType;
  input: TaskInput;
  callBackUrl?: string;
}

export interface CreateTaskResponse {
  code: number;
  msg: string;
  data: {
    taskId: string;
  };
}

export interface TaskRecordData {
  taskId: string;
  model: string;
  state: "waiting" | "success" | "fail";
  param: string; // serialized JSON
  resultJson?: string; // serialized JSON
  failCode?: string | null;
  failMsg?: string | null;
  costTime?: number | null;
  completeTime?: number | null;
  createTime: number;
}

export interface TaskRecordResponse {
  code: number;
  msg: string;
  data: TaskRecordData;
}

export interface ParsedResult {
  resultUrls?: string[];
  resultObject?: any;
}

export interface HistoryItem {
  id: string;
  taskId: string;
  model: ModelType; 
  prompt?: string; // For Nano
  videoInputUrl?: string; // For Sora & Topaz
  status: "waiting" | "success" | "fail";
  resultUrl?: string; 
  imageUrl?: string; // Legacy support
  timestamp: number;
}

export interface WalletState {
  balance: number;
  isUnlimited: boolean;
}
