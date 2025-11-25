
import { CreateTaskRequest, CreateTaskResponse, TaskInput, TaskRecordResponse, TaskRecordData, ModelType } from "../types";

const BASE_URL = "https://api.kie.ai/api/v1";

export class ApiServiceError extends Error {
  code?: number;
  constructor(message: string, code?: number) {
    super(message);
    this.name = "ApiServiceError";
    this.code = code;
  }
}

const getHeaders = (apiKey: string) => ({
  "Content-Type": "application/json",
  "Authorization": `Bearer ${apiKey}`
});

export const uploadFile = async (apiKey: string, file: File): Promise<string> => {
  const formData = new FormData();
  formData.append('file', file);

  try {
    // Do not set Content-Type header manually for FormData; browser does it with boundary
    const response = await fetch(`${BASE_URL}/file/upload`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`
      },
      body: formData
    });

    if (!response.ok) {
      throw new ApiServiceError(`Upload HTTP Error: ${response.status}`);
    }

    const json = await response.json();

    if (json.code !== 200) {
      throw new ApiServiceError(json.msg || "Failed to upload file", json.code);
    }

    // Assuming response structure based on typical Kie API patterns for file upload
    // Adjust path if documentation specifies data.url or data.fileUrl
    return json.data?.url || json.data?.fileUrl || ""; 
  } catch (error: any) {
    console.error("Upload error:", error);
    throw new ApiServiceError(error.message || "File upload failed");
  }
};

export const createTask = async (apiKey: string, model: ModelType, input: TaskInput): Promise<string> => {
  const payload: CreateTaskRequest = {
    model: model,
    input: input
  };

  try {
    const response = await fetch(`${BASE_URL}/jobs/createTask`, {
      method: "POST",
      headers: getHeaders(apiKey),
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      throw new ApiServiceError(`HTTP Error: ${response.status}`);
    }

    const data: CreateTaskResponse = await response.json();

    if (data.code !== 200) {
      throw new ApiServiceError(data.msg || "Failed to create task", data.code);
    }

    return data.data.taskId;
  } catch (error: any) {
    throw new ApiServiceError(error.message || "Network error");
  }
};

export const getTaskStatus = async (apiKey: string, taskId: string): Promise<TaskRecordData> => {
  try {
    const response = await fetch(`${BASE_URL}/jobs/recordInfo?taskId=${taskId}`, {
      method: "GET",
      headers: getHeaders(apiKey)
    });

    if (!response.ok) {
      throw new ApiServiceError(`HTTP Error: ${response.status}`);
    }

    const data: TaskRecordResponse = await response.json();

    if (data.code !== 200) {
      throw new ApiServiceError(data.msg || "Failed to fetch task status", data.code);
    }

    return data.data;
  } catch (error: any) {
    throw new ApiServiceError(error.message || "Network error");
  }
};

export const parseResultJson = (jsonString?: string): string[] => {
  if (!jsonString) return [];
  try {
    let parsed: any = jsonString;
    if (typeof jsonString === 'string') {
        try {
            parsed = JSON.parse(jsonString);
        } catch {
            if (jsonString.startsWith('http')) return [jsonString];
            return [];
        }
    }
    
    if (!parsed) return [];

    if (Array.isArray(parsed)) {
      return parsed.map(String);
    }
    
    if (typeof parsed === 'object') {
        if (parsed.resultUrls && Array.isArray(parsed.resultUrls)) {
          return parsed.resultUrls;
        }
        
        const possibleFields = ['url', 'image_url', 'video_url', 'output', 'link', 'download_url'];
        for (const field of possibleFields) {
            if (parsed[field] && typeof parsed[field] === 'string') {
                return [parsed[field]];
            }
        }
    }

    return [];
  } catch (e) {
    console.error("Failed to parse result JSON", e);
    return [];
  }
};
