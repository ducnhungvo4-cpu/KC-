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

const VIDEO_MODES: VideoGenerationMode[] = ['text', 'image', 'omni', 'start_end'];

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
}

export const VideoGenerationControls: React.FC<VideoGenerationControlsProps> = ({
    data,
    updateData,
    onGenerate,
    inputMedia,
    progress,
    hasResult,
    isDark,
}) => {
    const [activeDropdown, setActiveDropdown] = useState<string | null>(null);
    const currentModel = data.model || 'Seedance 2.0';
    const connectedImages = inputMedia.filter(item => item.type === 'image');
    const connectedMedia = inputMedia.filter(item => item.type === 'image' || item.type === 'video' || item.type === 'audio');
    const hasConnectedImage = connectedImages.length > 0;
    const requestedMode = inferVideoMode(data);
    const mode = resolveVideoMode(requestedMode, currentModel, hasConnectedImage);
    const capability = getVideoModelCapability(currentModel);

    useEffect(() => {
        if (data.videoMode !== mode) updateData(data.id, { videoMode: mode });
    }, [data.id, data.videoMode, mode, updateData]);

    const getVideoModels = () => getVisibleModels().filter(name => MODEL_REGISTRY[name]?.category === 'VIDEO');
    const [videoModels, setVideoModels] = useState<string[]>(getVideoModels);

    useEffect(() => {
        const updateModels = () => setVideoModels(getVideoModels());
        window.addEventListener('modelRegistryUpdated', updateModels);
        return () => window.removeEventListener('modelRegistryUpdated', updateModels);
    }, []);

    const groupedVideoModels = useMemo(() => {
        const primary = ['Seedance 2.0', 'Kling O3', 'Happy Horse 1.0', 'Wan2.7'].filter(model => videoModels.includes(model));
        const legacy = videoModels.filter(model => !primary.includes(model));
        return [
            ...(primary.length ? [{ label: '模式能力模型', items: primary }] : []),
            ...(legacy.length ? [{ label: '其他模型', items: legacy }] : []),
        ];
    }, [videoModels]);

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
                ? 'cursor-not-allowed border-zinc-800 bg-zinc-900/50 text-zinc-600'
                : 'cursor-not-allowed border-gray-200 bg-gray-100 text-gray-400';
        }
        if (tabMode === mode) return 'border-[#4446CE] bg-[#4446CE] text-white shadow-md shadow-[#4446CE]/20';
        return isDark
            ? 'border-zinc-700 bg-zinc-800/80 text-zinc-300 hover:border-zinc-600 hover:text-white'
            : 'border-gray-200 bg-white text-gray-600 hover:border-gray-300 hover:text-gray-900';
    };

    return (
        <>
            <div className="grid grid-cols-4 gap-2">
                {VIDEO_MODES.map(tabMode => {
                    const disabledReason = getVideoModeDisabledReason(tabMode, currentModel, hasConnectedImage);
                    return (
                        <button
                            key={tabMode}
                            type="button"
                            disabled={Boolean(disabledReason)}
                            title={disabledReason || VIDEO_MODE_LABELS[tabMode]}
                            className={`h-9 rounded-lg border px-3 text-xs font-semibold transition-all ${tabClass(tabMode, Boolean(disabledReason))}`}
                            onClick={() => updateData(data.id, { videoMode: tabMode })}
                        >
                            {VIDEO_MODE_LABELS[tabMode]}
                        </button>
                    );
                })}
            </div>

            {mode === 'start_end' && (
                <div className={`flex items-center justify-center gap-4 rounded-xl border p-3 ${isDark ? 'border-zinc-700 bg-zinc-900/50' : 'border-gray-200 bg-gray-50'}`}>
                    {(['首帧', '尾帧'] as const).map((label, index) => {
                        const item = orderedImages[index];
                        return (
                            <React.Fragment key={label}>
                                {index === 1 && (
                                    <button
                                        type="button"
                                        className="rounded-lg p-2 text-zinc-400 transition-colors hover:bg-zinc-700 hover:text-white disabled:cursor-not-allowed disabled:opacity-30"
                                        disabled={connectedImages.length < 2}
                                        title="交换首尾帧"
                                        onClick={() => updateData(data.id, { swapFrames: !data.swapFrames })}
                                    >
                                        <Icons.ArrowRightLeft size={18} />
                                    </button>
                                )}
                                <div className="flex items-center gap-2">
                                    {index === 0 && <span className="text-xs font-semibold text-zinc-400">{label}</span>}
                                    {item ? (
                                        <img src={item.url} className="h-14 w-14 rounded-lg border-2 border-[#4446CE]/60 object-cover" draggable={false} />
                                    ) : (
                                        <span className="flex h-14 w-14 items-center justify-center rounded-lg border border-dashed border-zinc-600 text-zinc-500">
                                            <Icons.Frame size={18} />
                                        </span>
                                    )}
                                    {index === 1 && <span className="text-xs font-semibold text-zinc-400">{label}</span>}
                                </div>
                            </React.Fragment>
                        );
                    })}
                </div>
            )}

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
                    options={groupedVideoModels}
                    value={currentModel}
                    onChange={(model: string) => {
                        const nextMode = resolveVideoMode(mode, model, hasConnectedImage);
                        updateData(data.id, { model, videoMode: nextMode });
                    }}
                    isOpen={activeDropdown === 'model'}
                    onToggle={() => setActiveDropdown(activeDropdown === 'model' ? null : 'model')}
                    onClose={() => setActiveDropdown(null)}
                    align="left"
                    width="w-[150px]"
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
