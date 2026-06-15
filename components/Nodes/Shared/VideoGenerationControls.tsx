import React, { useEffect, useMemo, useState } from 'react';
import type { InputMedia, NodeData, VideoGenerationMode, VideoPromptReference } from '../../../types';
import { getVisibleModels, MODEL_REGISTRY } from '../../../services/geminiService';
import { VIDEO_HANDLERS } from '../../../services/mode/video/configurations';
import { getAutoCorrectedVideoSettings, getVideoConstraints } from '../../../services/mode/video/rules';
import {
    getVideoModeDisabledReason,
    getVideoModelCapability,
    inferVideoMode,
    resolveVideoMode,
    VIDEO_MODE_LABELS,
} from '../../../services/mode/video/capabilities';
import { Icons } from '../../Icons';
import { LocalCustomDropdown } from './LocalNodeComponents';
import { VideoReferencePromptEditor } from './VideoReferencePromptEditor';

// Text-to-video and image-to-video stay implemented but are temporarily hidden.
const VIDEO_MODES: VideoGenerationMode[] = ['start_end', 'omni'];
const ACTIVE_VIDEO_MODELS = ['Seedance 2.0', 'Seedance 2.0 Fast'];

const getMediaId = (item: InputMedia) =>
    item.id || `${item.sourceNodeId || 'media'}:${item.type}:${item.url}`;

const getCreditEstimate = (data: NodeData, mode: VideoGenerationMode) => {
    const duration = Number.parseInt(data.duration || '5', 10) || 5;
    const durationFactor = Math.max(1, duration / 5);
    const resolutionCost = data.resolution === '1080p' ? 4 : 0;
    const modeCost = mode === 'omni' ? 6 : mode === 'start_end' ? 4 : mode === 'image' ? 2 : 0;
    return Math.round((14 + resolutionCost + modeCost) * durationFactor) * (data.count || 1);
};

interface VideoGenerationControlsProps {
    data: NodeData;
    updateData: (id: string, updates: Partial<NodeData>) => void;
    onGenerate: (id: string) => void;
    inputMedia: InputMedia[];
    progress: number;
    hasResult: boolean;
    isDark: boolean;
    onPreviewReference?: (item: InputMedia) => void;
}

export const VideoGenerationControls: React.FC<VideoGenerationControlsProps> = ({
    data,
    updateData,
    onGenerate,
    inputMedia,
    progress,
    hasResult,
    isDark,
    onPreviewReference,
}) => {
    const [activeDropdown, setActiveDropdown] = useState<string | null>(null);
    const currentModel = ACTIVE_VIDEO_MODELS.includes(data.model || '') ? data.model! : 'Seedance 2.0';
    const connectedImages = inputMedia.filter(item => item.type === 'image');
    const connectedMedia = inputMedia.filter(item => item.type === 'image' || item.type === 'video' || item.type === 'audio');
    const hasConnectedImage = connectedImages.length > 0;
    const requestedMode = inferVideoMode(data);
    const mode = resolveVideoMode(requestedMode, currentModel, hasConnectedImage);
    const capability = getVideoModelCapability(currentModel);

    useEffect(() => {
        const updates: Partial<NodeData> = {};
        if (data.model !== currentModel) updates.model = currentModel;
        if (data.videoMode !== mode) updates.videoMode = mode;
        if (Object.keys(updates).length) updateData(data.id, updates);
    }, [currentModel, data.id, data.model, data.videoMode, mode, updateData]);

    const getVideoModels = () => getVisibleModels().filter(name => (
        ACTIVE_VIDEO_MODELS.includes(name) && MODEL_REGISTRY[name]?.category === 'VIDEO'
    ));
    const [videoModels, setVideoModels] = useState<string[]>(getVideoModels);

    useEffect(() => {
        const updateModels = () => setVideoModels(getVideoModels());
        window.addEventListener('modelRegistryUpdated', updateModels);
        return () => window.removeEventListener('modelRegistryUpdated', updateModels);
    }, []);

    const orderedVideoModels = useMemo(
        () => ACTIVE_VIDEO_MODELS.filter(model => videoModels.includes(model)),
        [videoModels],
    );

    const handler = VIDEO_HANDLERS[currentModel] || VIDEO_HANDLERS['Seedance 1.5 Pro'];
    const rules = handler?.rules || { resolutions: ['720p'], durations: ['5s'], ratios: ['16:9'] };
    const resOptions: string[] = rules.resolutions || ['720p'];
    const durOptions: string[] = rules.durations || ['5s'];
    const ratioOptions: string[] = rules.ratios || ['16:9'];
    const constraints = getVideoConstraints(currentModel, data.resolution, data.duration, connectedImages.length);
    const displayResValue = currentModel.includes('海螺') && (data.resolution === '720p' || data.resolution === '768p')
        ? '768p'
        : data.resolution;

    useEffect(() => {
        const updates: Partial<NodeData> = {};
        const corrections = getAutoCorrectedVideoSettings(currentModel, data.resolution, data.duration, connectedImages.length);
        if (corrections.resolution) updates.resolution = corrections.resolution;
        if (corrections.duration) updates.duration = corrections.duration;
        if (data.resolution && !resOptions.includes(data.resolution)) updates.resolution = resOptions[0];
        if (data.duration && !durOptions.includes(data.duration)) updates.duration = durOptions[0];
        if (data.aspectRatio && !ratioOptions.includes(data.aspectRatio)) updates.aspectRatio = ratioOptions[0];
        if (Object.keys(updates).length) updateData(data.id, updates);
    }, [
        connectedImages.length,
        currentModel,
        data.aspectRatio,
        data.duration,
        data.id,
        data.resolution,
        durOptions,
        ratioOptions,
        resOptions,
        updateData,
    ]);

    const creditEstimate = getCreditEstimate(data, mode);
    useEffect(() => {
        if (data.creditEstimate !== creditEstimate && data.creditStatus !== 'reserved') {
            updateData(data.id, { creditEstimate, creditStatus: data.creditStatus === 'confirmed' ? 'confirmed' : 'estimated' });
        }
    }, [creditEstimate, data.creditEstimate, data.creditStatus, data.id, updateData]);

    const connectedIds = new Set(connectedMedia.map(getMediaId));
    const explicitReferences = data.videoPromptReferences;
    const activeReferences = (explicitReferences || []).filter(reference =>
        mode === 'image' ? reference.type === 'image' : mode === 'omni',
    );
    const validReferences = activeReferences.filter(reference => connectedIds.has(reference.id));
    const effectiveImages = explicitReferences === undefined
        ? connectedImages
        : validReferences.filter(reference => reference.type === 'image');
    const effectiveVideos = explicitReferences === undefined
        ? connectedMedia.filter(item => item.type === 'video')
        : validReferences.filter(reference => reference.type === 'video');
    const effectiveAudio = explicitReferences === undefined
        ? connectedMedia.filter(item => item.type === 'audio')
        : validReferences.filter(reference => reference.type === 'audio');

    let validationMessage = '';
    if (mode === 'image' && effectiveImages.length === 0) validationMessage = '请连接并 @ 引用至少一张图片';
    if (mode === 'start_end' && connectedImages.length < 2) validationMessage = '请连接两张图片作为首帧和尾帧';
    if (mode === 'omni' && effectiveImages.length + effectiveVideos.length + effectiveAudio.length === 0) {
        validationMessage = '请连接并 @ 引用至少一个图片、视频或音频素材';
    }
    if (!validationMessage && effectiveImages.length > capability.maxImages) {
        validationMessage = `当前模型最多支持 ${capability.maxImages} 张图片`;
    }
    if (!validationMessage && effectiveVideos.length > capability.maxVideos) {
        validationMessage = `当前模型最多支持 ${capability.maxVideos} 个视频`;
    }
    if (!validationMessage && effectiveAudio.length > capability.maxAudio) {
        validationMessage = `当前模型最多支持 ${capability.maxAudio} 个音频`;
    }
    if (!validationMessage && activeReferences.some(reference => !connectedIds.has(reference.id))) {
        validationMessage = '存在已断开连接的引用，请移除或重新连接';
    }

    const orderedImages = data.swapFrames && connectedImages.length >= 2
        ? [connectedImages[1], connectedImages[0], ...connectedImages.slice(2)]
        : connectedImages;

    const handleRatioChange = (ratio: string) => {
        const currentShort = Math.min(data.width, data.height);
        const baseSize = Math.max(currentShort, 400);
        const [widthRatio, heightRatio] = ratio.split(':').map(Number);
        const numericRatio = widthRatio / heightRatio;
        const width = numericRatio >= 1 ? baseSize * numericRatio : baseSize;
        const height = numericRatio >= 1 ? baseSize : baseSize / numericRatio;
        updateData(data.id, { aspectRatio: ratio, width: Math.round(width), height: Math.round(height) });
    };

    const updateReferences = (references: VideoPromptReference[]) => {
        updateData(data.id, { videoPromptReferences: references });
    };

    const tabClass = (tabMode: VideoGenerationMode, disabled: boolean) => {
        if (disabled) {
            return isDark
                ? 'cursor-not-allowed text-zinc-600'
                : 'cursor-not-allowed text-gray-400';
        }
        if (tabMode === mode) {
            return 'bg-gradient-to-b from-[#5557DB] to-[#4446CE] text-white shadow-[0_5px_14px_rgba(68,70,206,0.28),inset_0_1px_0_rgba(255,255,255,0.18)]';
        }
        return isDark
            ? 'text-zinc-400 hover:bg-white/[0.055] hover:text-zinc-100'
            : 'text-gray-500 hover:bg-white hover:text-gray-900';
    };

    const startEndHeader = mode === 'start_end' ? (
        <div className="flex items-center gap-2">
            {(['首帧', '尾帧'] as const).map((label, index) => {
                const item = orderedImages[index];
                return (
                    <React.Fragment key={label}>
                        {index === 1 && (
                            <button
                                type="button"
                                className={`flex h-7 w-7 items-center justify-center rounded-full border transition-all disabled:cursor-not-allowed disabled:opacity-30 ${
                                    isDark
                                        ? 'border-zinc-700 bg-zinc-900/80 text-zinc-500 hover:border-[#4446CE]/60 hover:text-[#B9BAFF]'
                                        : 'border-gray-200 bg-white text-gray-400 hover:border-[#4446CE]/40 hover:text-[#4446CE]'
                                }`}
                                disabled={connectedImages.length < 2}
                                title="交换首尾帧"
                                onClick={() => updateData(data.id, { swapFrames: !data.swapFrames })}
                            >
                                <Icons.ArrowRightLeft size={13} />
                            </button>
                        )}
                        <div className={`flex h-11 items-center gap-2 rounded-xl border p-1 pr-2.5 ${
                            item
                                ? isDark
                                    ? 'border-zinc-700 bg-zinc-950/65'
                                    : 'border-gray-200 bg-white'
                                : isDark
                                    ? 'border-dashed border-zinc-700 bg-zinc-900/45'
                                    : 'border-dashed border-gray-300 bg-gray-50'
                        }`}>
                            {item ? (
                                <img src={item.url} className="h-8 w-8 rounded-lg object-cover ring-1 ring-[#4446CE]/35" draggable={false} />
                            ) : (
                                <span className={`flex h-8 w-8 items-center justify-center rounded-lg ${
                                    isDark ? 'bg-zinc-800/80 text-zinc-600' : 'bg-gray-100 text-gray-400'
                                }`}>
                                    <Icons.Frame size={13} />
                                </span>
                            )}
                            <span className={`text-[10px] font-semibold ${isDark ? 'text-zinc-400' : 'text-gray-500'}`}>{label}</span>
                        </div>
                    </React.Fragment>
                );
            })}
        </div>
    ) : undefined;

    return (
        <>
            <div className={`inline-flex w-fit items-center gap-0.5 self-start rounded-xl border p-1 ${
                isDark
                    ? 'border-zinc-800 bg-black/20 shadow-inner shadow-black/20'
                    : 'border-gray-200 bg-gray-100/80 shadow-inner shadow-gray-200/50'
            }`}>
                {VIDEO_MODES.map(tabMode => {
                    const disabledReason = getVideoModeDisabledReason(tabMode, currentModel, hasConnectedImage);
                    return (
                        <button
                            key={tabMode}
                            type="button"
                            disabled={Boolean(disabledReason)}
                            title={disabledReason || VIDEO_MODE_LABELS[tabMode]}
                            className={`h-7 min-w-[82px] rounded-lg px-3 text-[11px] font-semibold tracking-[0.01em] transition-all duration-200 ${tabClass(tabMode, Boolean(disabledReason))}`}
                            onClick={() => updateData(data.id, { videoMode: tabMode })}
                        >
                            {VIDEO_MODE_LABELS[tabMode]}
                        </button>
                    );
                })}
            </div>

            <VideoReferencePromptEditor
                value={data.prompt || ''}
                onChange={prompt => updateData(data.id, { prompt })}
                references={data.videoPromptReferences}
                onReferencesChange={updateReferences}
                inputMedia={inputMedia}
                mode={mode}
                placeholder={
                    mode === 'text'
                        ? '描述你想生成的视频场景...'
                        : mode === 'image'
                            ? '描述图片中的运动变化，输入 @ 引用图片...'
                            : mode === 'start_end'
                                ? '描述从首帧到尾帧的运动变化...'
                                : '描述视频并输入 @ 引用图片、视频或音频...'
                }
                isDark={isDark}
                onPreviewReference={onPreviewReference}
                headerContent={startEndHeader}
            />

            {validationMessage && (
                <div className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-[11px] ${
                    isDark ? 'border-amber-500/30 bg-amber-500/10 text-amber-300' : 'border-amber-200 bg-amber-50 text-amber-700'
                }`}>
                    <Icons.AlertCircle size={13} />
                    <span>{validationMessage}</span>
                </div>
            )}

            <div className="flex items-center gap-2">
                <LocalCustomDropdown
                    options={orderedVideoModels}
                    value={currentModel}
                    onChange={(model: string) => {
                        const nextMode = resolveVideoMode(mode, model, hasConnectedImage);
                        updateData(data.id, { model, videoMode: nextMode });
                    }}
                    isOpen={activeDropdown === 'model'}
                    onToggle={() => setActiveDropdown(activeDropdown === 'model' ? null : 'model')}
                    onClose={() => setActiveDropdown(null)}
                    align="left"
                    width="w-[190px]"
                    isDark={isDark}
                />
                <LocalCustomDropdown
                    icon={Icons.Crop}
                    options={ratioOptions}
                    value={data.aspectRatio || '16:9'}
                    onChange={handleRatioChange}
                    isOpen={activeDropdown === 'ratio'}
                    onToggle={() => setActiveDropdown(activeDropdown === 'ratio' ? null : 'ratio')}
                    onClose={() => setActiveDropdown(null)}
                    disabledOptions={constraints.disabledRatios}
                    isDark={isDark}
                />
                <LocalCustomDropdown
                    icon={Icons.Monitor}
                    options={resOptions}
                    value={displayResValue || resOptions[0]}
                    onChange={(resolution: string) => updateData(data.id, { resolution })}
                    isOpen={activeDropdown === 'res'}
                    onToggle={() => setActiveDropdown(activeDropdown === 'res' ? null : 'res')}
                    onClose={() => setActiveDropdown(null)}
                    disabledOptions={constraints.disabledRes}
                    isDark={isDark}
                />
                <LocalCustomDropdown
                    icon={Icons.Clock}
                    options={durOptions}
                    value={data.duration || durOptions[0]}
                    onChange={(duration: string) => updateData(data.id, { duration })}
                    isOpen={activeDropdown === 'duration'}
                    onToggle={() => setActiveDropdown(activeDropdown === 'duration' ? null : 'duration')}
                    onClose={() => setActiveDropdown(null)}
                    disabledOptions={constraints.disabledDurations}
                    isDark={isDark}
                />
                <div className="flex-1" />
                <button
                    type="button"
                    disabled={data.isLoading || Boolean(validationMessage)}
                    title={validationMessage || (hasResult ? '基于当前参数生成一个新版本' : '开始生成')}
                    className={`h-9 shrink-0 rounded-lg px-4 text-sm font-semibold transition-all ${
                        data.isLoading || validationMessage
                            ? 'cursor-not-allowed bg-zinc-600 text-zinc-300'
                            : 'bg-[#4446CE] text-white shadow-lg shadow-[#4446CE]/25 hover:bg-[#5557DB]'
                    }`}
                    onClick={() => onGenerate(data.id)}
                >
                    <span className="flex items-center gap-2">
                        {data.isLoading ? <Icons.Loader2 size={15} className="animate-spin" /> : <Icons.Wand2 size={15} />}
                        <span>{data.isLoading ? `${Math.floor(progress)}%` : '生成'}</span>
                        <span className="h-4 w-px bg-white/25" />
                        <Icons.Coins size={14} />
                        <span>{creditEstimate}</span>
                    </span>
                </button>
            </div>
        </>
    );
};
