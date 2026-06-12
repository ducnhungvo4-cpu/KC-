import type { NodeData, VideoGenerationMode } from '../../../types';

export interface VideoModeCapability {
    modes: VideoGenerationMode[];
    defaultMode: VideoGenerationMode;
    maxImages: number;
    maxVideos: number;
    maxAudio: number;
}

export const VIDEO_MODE_LABELS: Record<VideoGenerationMode, string> = {
    text: '文生视频',
    image: '图生视频',
    start_end: '首尾帧',
    omni: '全能参考',
};

const ACTIVE_MODES: VideoGenerationMode[] = ['start_end', 'omni'];
const ALL_MODES: VideoGenerationMode[] = ['text', 'image', 'omni', 'start_end'];
const TEXT_IMAGE_MODES: VideoGenerationMode[] = ['text', 'image'];

const CAPABILITIES: Record<string, VideoModeCapability> = {
    'Seedance 2.0': {
        modes: ACTIVE_MODES,
        defaultMode: 'omni',
        maxImages: 99,
        maxVideos: 99,
        maxAudio: 99,
    },
    'Seedance 2.0 Fast': {
        modes: ACTIVE_MODES,
        defaultMode: 'omni',
        maxImages: 99,
        maxVideos: 99,
        maxAudio: 99,
    },
    'Kling O3': {
        modes: ALL_MODES,
        defaultMode: 'text',
        maxImages: 99,
        maxVideos: 99,
        maxAudio: 99,
    },
    'Happy Horse 1.0': {
        modes: TEXT_IMAGE_MODES,
        defaultMode: 'text',
        maxImages: 99,
        maxVideos: 0,
        maxAudio: 0,
    },
    'Wan2.7': {
        modes: ALL_MODES,
        defaultMode: 'text',
        maxImages: 99,
        maxVideos: 99,
        maxAudio: 99,
    },
};

const LEGACY_CAPABILITY: VideoModeCapability = {
    modes: ['text', 'image', 'start_end'],
    defaultMode: 'text',
    maxImages: 2,
    maxVideos: 0,
    maxAudio: 0,
};

export const getVideoModelCapability = (modelName?: string): VideoModeCapability =>
    CAPABILITIES[modelName || ''] || LEGACY_CAPABILITY;

export const inferVideoMode = (node: Pick<NodeData, 'type' | 'videoMode'>): VideoGenerationMode => {
    if (node.videoMode) return node.videoMode;
    if (node.type === 'IMAGE_TO_VIDEO') return 'image';
    if (node.type === 'START_END_TO_VIDEO') return 'start_end';
    return 'text';
};

export const getAvailableVideoModes = (
    modelName: string | undefined,
    hasConnectedImage: boolean,
): VideoGenerationMode[] => {
    const capability = getVideoModelCapability(modelName);
    return capability.modes.filter(mode => mode !== 'text' || !hasConnectedImage);
};

export const getVideoModeDisabledReason = (
    mode: VideoGenerationMode,
    modelName: string | undefined,
    hasConnectedImage: boolean,
): string | undefined => {
    const capability = getVideoModelCapability(modelName);
    if (!capability.modes.includes(mode)) return `${modelName || '当前模型'}不支持${VIDEO_MODE_LABELS[mode]}`;
    if (mode === 'text' && hasConnectedImage) return '当前节点已连接图片，文生视频不可用';
    return undefined;
};

export const resolveVideoMode = (
    requestedMode: VideoGenerationMode,
    modelName: string | undefined,
    hasConnectedImage: boolean,
): VideoGenerationMode => {
    const available = getAvailableVideoModes(modelName, hasConnectedImage);
    if (available.includes(requestedMode)) return requestedMode;
    const preferred = getVideoModelCapability(modelName).defaultMode;
    if (available.includes(preferred)) return preferred;
    return available[0] || 'text';
};

export const VIDEO_MODELS_WITH_CAPABILITY_MATRIX = Object.keys(CAPABILITIES);
