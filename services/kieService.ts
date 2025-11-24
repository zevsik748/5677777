import { CreateTaskRequest, CreateTaskResponse, TaskInput, TaskRecordResponse, TaskRecordData, ModelType } from "../types";

const BASE_URL = "https://api.kie.ai/api/v1/jobs";

export class KieServiceError extends Error {
  code?: number;
  constructor(message: string, code?: number) {
    super(message);
    this.name = "KieServiceError";
    this.code = code;
  }
}

const getHeaders = (apiKey: string) => ({
  "Content-Type": "application/json",
  "Authorization": `Bearer ${apiKey}`
});

export const createTask = async (apiKey: string, model: ModelType, input: TaskInput): Promise<string> => {
  const payload: CreateTaskRequest = {
    model: model,
    input: input
  };

  try {
    const response = await fetch(`${BASE_URL}/createTask`, {
      method: "POST",
      headers: getHeaders(apiKey),
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      throw new KieServiceError(`HTTP Error: ${response.status}`);
    }

    const data: CreateTaskResponse = await response.json();

    if (data.code !== 200) {
      throw new KieServiceError(data.msg || "Failed to create task", data.code);
    }

    return data.data.taskId;
  } catch (error: any) {
    throw new KieServiceError(error.message || "Network error");
  }
};

export const getTaskStatus = async (apiKey: string, taskId: string): Promise<TaskRecordData> => {
  try {
    const response = await fetch(`${BASE_URL}/recordInfo?taskId=${taskId}`, {
      method: "GET",
      headers: getHeaders(apiKey)
    });

    if (!response.ok) {
      throw new KieServiceError(`HTTP Error: ${response.status}`);
    }

    const data: TaskRecordResponse = await response.json();

    if (data.code !== 200) {
      throw new KieServiceError(data.msg || "Failed to fetch task status", data.code);
    }

    return data.data;
  } catch (error: any) {
    throw new KieServiceError(error.message || "Network error");
  }
};

export const parseResultJson = (jsonString?: string): string[] => {
  if (!jsonString) return [];
  try {
    const parsed = JSON.parse(jsonString);
    if (parsed.resultUrls && Array.isArray(parsed.resultUrls)) {
      return parsed.resultUrls;
    }
    return [];
  } catch (e) {
    console.error("Failed to parse result JSON", e);
    return [];
  }
};