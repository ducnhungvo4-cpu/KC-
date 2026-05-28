
import { MODEL_REGISTRY, getModelConfig, saveModelConfig, registerCustomModel, deleteModel, isCustomModel, getVisibleModels } from "./mode/config";
import type { ModelConfig } from "./mode/config";
import { generateMockImage } from "./mockGeneration";
import { apiFetch } from "./authService";

// Re-export for UI
export { MODEL_REGISTRY, getModelConfig, saveModelConfig, registerCustomModel, deleteModel, isCustomModel, getVisibleModels };
export type { ModelConfig };

// --- Generators ---

export const generateCreativeDescription = async (input: string, mode: 'IMAGE' | 'VIDEO'): Promise<string> => {
  const prompt = `Optimize this ${mode.toLowerCase()} description for professional AI generation. Input: "${input}". Provide ONLY the optimized prompt text.`;
  try {
     const res = await apiFetch('/api/generate/text', {
       method: 'POST',
       body: JSON.stringify({ prompt, mode }),
     });
     return res.text || input;
  } catch (e) {
    return input;
  }
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
        return result.urls || [];
    } catch (e) {
        console.error(`Error generating video with ${modelName}`, e);
        throw e;
    }
};
