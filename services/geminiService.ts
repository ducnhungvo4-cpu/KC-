
import { MODEL_REGISTRY, getModelConfig, saveModelConfig, registerCustomModel, deleteModel, isCustomModel, getVisibleModels } from "./mode/config";
import type { ModelConfig } from "./mode/config";
import type { InputMedia, MultiAngleOptions, MultiAngleResult } from "../types";
import { generateMockImage } from "./mockGeneration";
import { apiFetch } from "./authService";

// Re-export for UI
export { MODEL_REGISTRY, getModelConfig, saveModelConfig, registerCustomModel, deleteModel, isCustomModel, getVisibleModels };
export type { ModelConfig };

// --- Generators ---

export const generateCreativeDescription = async (input: string, mode: 'IMAGE' | 'VIDEO', modelName?: string): Promise<string> => {
  const prompt = `Optimize this ${mode.toLowerCase()} description for professional AI generation. Input: "${input}". Provide ONLY the optimized prompt text.`;
  try {
     const res = await apiFetch('/api/generate/text', {
       method: 'POST',
       body: JSON.stringify({ task: 'text', prompt, mode, modelName }),
     });
     return res.text || input;
  } catch (e) {
    return input;
  }
};

const blobToDataUrl = (blob: Blob) => new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
});

const normalizeMediaForModel = async (media: InputMedia): Promise<InputMedia> => {
    if (!media.url.startsWith('blob:')) return media;
    const response = await fetch(media.url);
    const blob = await response.blob();
    return { ...media, url: await blobToDataUrl(blob) };
};

export const analyzeConnectedMedia = async (
    prompt: string,
    inputMedia: InputMedia[],
    modelName?: string
): Promise<string> => {
    const normalizedMedia = await Promise.all(inputMedia.map(normalizeMediaForModel));
    const result = await apiFetch('/api/generate/text', {
        method: 'POST',
        body: JSON.stringify({
            task: 'media-analysis',
            prompt,
            inputMedia: normalizedMedia,
            modelName,
        }),
    });
    return result.text || '';
};

export const analyzeScriptAssets = async (script: string, modelName?: string): Promise<string> => {
    const result = await apiFetch('/api/generate/text', {
        method: 'POST',
        body: JSON.stringify({
            task: 'script-assets',
            prompt: script,
            modelName,
        }),
    });
    return result.text || '';
};

export const generateImage = async (
    prompt: string, 
    aspectRatio: string = "1:1", 
    modelName: string = "Seedream 5.0", 
    resolution: string = "1k", 
    count: number = 1,
    inputImages: string[] = [],
    promptOptimize: boolean = false
): Promise<string[]> => {
  try {
      const result = await apiFetch('/api/generate/image', {
        method: 'POST',
        body: JSON.stringify({ prompt, aspectRatio, modelName, resolution, count, inputImages, promptOptimize }),
      });
      return result.urls || [];
  } catch (e) {
      if (modelName === 'Seedream 5.0') {
          const total = Math.max(1, Math.min(count, 4));
          await new Promise(resolve => setTimeout(resolve, 650));
          return Array.from({ length: total }, (_, index) =>
              generateMockImage(prompt, aspectRatio, resolution, index, inputImages.length)
          );
      }
      console.error(`Error generating image with ${modelName}`, e);
      throw e;
  }
};

const VIDEO_POLL_INTERVAL_MS = 6000;
const VIDEO_POLL_TIMEOUT_MS = 30 * 60 * 1000;

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

const getVideoStatus = (result: any): string => {
    return String(
        result?.status ||
        result?.data?.status ||
        result?.state ||
        result?.data?.state ||
        result?.task_status ||
        result?.data?.task_status ||
        result?.output?.task_status ||
        ''
    ).toLowerCase();
};

const getVideoUrl = (result: any): string => {
    return (
        result?.video_url ||
        result?.videoUrl ||
        result?.remixed_from_video_id ||
        result?.url ||
        result?.data?.video_url ||
        result?.data?.videoUrl ||
        result?.data?.remixed_from_video_id ||
        result?.data?.url ||
        result?.output?.video_url ||
        result?.output?.videoUrl ||
        result?.output?.remixed_from_video_id ||
        result?.output?.url ||
        result?.result?.video_url ||
        result?.result?.remixed_from_video_id ||
        result?.result?.url ||
        result?.urls?.[0] ||
        result?.data?.urls?.[0] ||
        ''
    );
};

const pollVideoTask = async (taskId: string): Promise<string> => {
    const deadline = Date.now() + VIDEO_POLL_TIMEOUT_MS;
    let lastError: unknown = null;
    let lastStatus = '';
    let lastProgress: unknown = null;

    while (Date.now() < deadline) {
        await sleep(VIDEO_POLL_INTERVAL_MS);

        try {
            const result = await apiFetch(`/api/generate/video/poll?taskId=${encodeURIComponent(taskId)}`);
            const status = getVideoStatus(result);
            lastStatus = status || lastStatus;
            lastProgress = result?.progress ?? result?.data?.progress ?? result?.output?.progress ?? lastProgress;

            if (['completed', 'succeeded', 'success', 'done'].includes(status)) {
                const url = getVideoUrl(result);
                if (!url) throw new Error('AGNES_VIDEO_NO_URL_RETURNED');
                return url;
            }

            if (['failed', 'failure', 'error', 'cancelled', 'canceled'].includes(status)) {
                const message = result?.error?.message || result?.message || result?.error || 'Unknown error';
                throw new Error(`AGNES_VIDEO_TASK_FAILED: ${message}`);
            }
        } catch (error: any) {
            lastError = error;
            const message = String(error?.message || '');
            if (
                message.includes('AGNES_VIDEO_TASK_FAILED') ||
                message.includes('AGNES_VIDEO_NO_URL_RETURNED') ||
                message.includes('VIDEO_API_NOT_CONFIGURED') ||
                message.includes('TASK_ID_REQUIRED') ||
                /AGNES_VIDEO_4\d\d/.test(message)
            ) {
                throw error;
            }
        }
    }

    const suffix = lastError instanceof Error ? ` (最后一次轮询: ${lastError.message})` : '';
    const statusSuffix = lastStatus ? `，最后状态: ${lastStatus}${lastProgress !== null ? ` ${lastProgress}%` : ''}` : '';
    throw new Error(`AGNES_VIDEO_TIMEOUT${statusSuffix}${suffix}`);
};

export const generateVideo = async (
    prompt: string, 
    inputImages: string[] = [], 
    aspectRatio: string = "16:9", 
    modelName: string = "Seedance 1.5 Pro", 
    resolution: string = "720p", 
    duration: string = "5s",
    count: number = 1,
    promptOptimize: boolean = false
): Promise<string[]> => {
    let realModelName = modelName;
    const isStartEndMode = modelName.endsWith('_FL');
    if (isStartEndMode) realModelName = modelName.replace('_FL', '');
    
    try {
        const result = await apiFetch('/api/generate/video', {
          method: 'POST',
          body: JSON.stringify({
            prompt, inputImages, aspectRatio, modelName: realModelName, resolution, duration, count, promptOptimize, isStartEndMode
          }),
        });
        if (Array.isArray(result.urls) && result.urls.length > 0) return result.urls;
        if (Array.isArray(result.taskIds) && result.taskIds.length > 0) {
            return await Promise.all(result.taskIds.map((taskId: string) => pollVideoTask(taskId)));
        }
        return [];
    } catch (e) {
        console.error(`Error generating video with ${modelName}`, e);
        throw e;
    }
};

export const generateAudio = async (
    text: string,
    modelName: string = "Minimax-speech-2.8-hd",
    voiceId: string = "male-qn-qingse",
    speed: number = 1,
    pitch: number = 0,
    volume: number = 1
): Promise<string[]> => {
    const result = await apiFetch('/api/generate/audio', {
        method: 'POST',
        body: JSON.stringify({
            text,
            modelName,
            voiceId,
            speed,
            pitch,
            volume,
        }),
    });
    return result.urls || [];
};

export const generateMultiAngleImages = async (
    image: string,
    options: MultiAngleOptions
): Promise<MultiAngleResult[]> => {
    const result = await apiFetch('/api/generate/multi-angle', {
        method: 'POST',
        body: JSON.stringify({ image, ...options }),
    });
    return result.results || [];
};
