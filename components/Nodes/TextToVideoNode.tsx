
import React, { useState, useEffect } from 'react';
import { InputMedia, NodeData } from '../../types';
import { Icons } from '../Icons';
import { LocalEditableTitle, LocalInputThumbnails, LocalMediaStack } from './Shared/LocalNodeComponents';
import { VideoGenerationControls } from './Shared/VideoGenerationControls';
import { inferVideoMode, resolveVideoMode } from '../../services/mode/video/capabilities';

interface TextToVideoNodeProps {
  data: NodeData;
  updateData: (id: string, updates: Partial<NodeData>) => void;
  onGenerate: (id: string) => void;
  selected?: boolean;
  showControls?: boolean;
  inputs?: string[];
  inputMedia?: InputMedia[];
  onPreviewReference?: (item: InputMedia) => void;
  onMaximize?: (id: string) => void;
  onPreviewMedia?: (url: string, type: 'image' | 'video') => void;
  onUseVideoVersion?: (nodeId: string, src: string) => void;
  onDownload?: (id: string) => void;
  onUpload?: (id: string) => void;
  onSaveResult?: (id: string) => void;
  onExtractFrames?: (id: string) => void;
  onExtractSingleFrame?: (id: string, imageDataUrl: string, timeSeconds: number) => void;
  onRemoveSubtitles?: (id: string) => void;
  onEnhanceVideo?: (id: string) => void;
  onRemoveBGM?: (id: string) => void;
  onToggleFavoriteArtifact?: (nodeId: string, url: string, type: 'image' | 'video') => void;
  isArtifactFavorited?: (nodeId: string, url: string) => boolean;
  onAddToAssetLibrary?: (nodeId: string) => void;
  isDark?: boolean;
  isSelecting?: boolean;
  canvasScale?: number;
}

export const TextToVideoNode: React.FC<TextToVideoNodeProps> = ({
    data, updateData, onGenerate, selected, showControls, inputs = [], inputMedia = [], onPreviewReference, onMaximize, onPreviewMedia, onUseVideoVersion, onDownload, onUpload, onSaveResult, onExtractFrames, onExtractSingleFrame, onRemoveSubtitles, onEnhanceVideo, onRemoveBGM, onToggleFavoriteArtifact, isArtifactFavorited, onAddToAssetLibrary, isDark = true, isSelecting, canvasScale = 1
}) => {
    const [deferredInputs, setDeferredInputs] = useState(false);
    const [progress, setProgress] = useState(0);

    const isSelectedAndStable = selected && !isSelecting;
    // Panel stays a constant screen size while zooming via the --panel-inverse-scale CSS var,
    // so zoom no longer re-renders the node (heavy base64 media stays off the hot path).
    const panelTransform: React.CSSProperties = {
        transform: 'translateX(-50%) scale(var(--panel-inverse-scale, 1))',
        transformOrigin: 'top center',
    };
    const topToolbarTransform: React.CSSProperties = {
        transform: 'translateX(-50%) scale(var(--panel-inverse-scale, 1))',
        transformOrigin: 'bottom center',
    };

    useEffect(() => { if (isSelectedAndStable && showControls) { const t = setTimeout(() => setDeferredInputs(true), 100); return () => clearTimeout(t); } else setDeferredInputs(false); }, [isSelectedAndStable, showControls]);
    useEffect(() => { let interval: any; if (data.isLoading) { setProgress(0); interval = setInterval(() => { setProgress(prev => (prev >= 95 ? 95 : prev + Math.max(0.5, (95 - prev) / 20))); }, 200); } else setProgress(0); return () => clearInterval(interval); }, [data.isLoading]);

    const containerBg = isDark ? 'bg-[#1a1a1a]' : 'bg-white';
    const containerBorder = selected ? 'border-[#4446CE] ring-2 ring-[#4446CE]/30' : (isDark ? 'border-zinc-700/50' : 'border-gray-200');
    const controlPanelBg = isDark ? 'bg-[#1a1a1a]/95 backdrop-blur-xl border-zinc-700/50' : 'bg-white/95 backdrop-blur-xl border-gray-200 shadow-xl';
    const emptyStateIconColor = isDark ? 'bg-zinc-800/50 text-zinc-500' : 'bg-gray-100 text-gray-400';
    const emptyStateTextColor = isDark ? 'text-zinc-500' : 'text-gray-400';
    const hasResult = !!data.videoSrc && !data.isLoading;
    const resolvedVideoMode = resolveVideoMode(
        inferVideoMode(data),
        data.model,
        inputMedia.some(item => item.type === 'image'),
    );
    const hasShotContext = Boolean(data.shotId);
    const shotLabel = hasShotContext
        ? `第${data.episodeNo || '-'}集 / 第${data.sceneNo || '-'}场 / 分镜${String(data.shotNo || '-').padStart(2, '0')}`
        : '';

    return (
      <>
        <div className={`w-full h-full relative rounded-2xl border ${containerBorder} ${containerBg} ${data.isStackOpen ? 'overflow-visible' : 'overflow-hidden'} shadow-xl group transition-all duration-200`}>
            {hasShotContext && (
                <div className={`absolute left-3 top-3 z-10 max-w-[calc(100%-24px)] rounded-xl border px-3 py-2 shadow-lg backdrop-blur-md pointer-events-none ${isDark ? 'bg-black/45 border-white/10 text-zinc-100' : 'bg-white/85 border-gray-200 text-gray-800'}`}>
                    <div className="flex items-center gap-1.5 text-[11px] font-semibold">
                        <Icons.Clapperboard size={13} />
                        <span className="truncate">{shotLabel}</span>
                    </div>
                    <div className={`mt-0.5 text-[10px] truncate ${isDark ? 'text-zinc-400' : 'text-gray-500'}`}>{data.shotId}</div>
                </div>
            )}
            {hasResult ? (
                 <>
                     <LocalMediaStack
                         data={data}
                         updateData={updateData}
                         currentSrc={data.videoSrc}
                         onMaximize={onMaximize}
                         isDark={isDark}
                         selected={selected}
                         onToggleFavorite={(src, type) => onToggleFavoriteArtifact?.(data.id, src, type)}
                         isFavorite={(src) => isArtifactFavorited?.(data.id, src) || false}
                         onPreviewMedia={onPreviewMedia}
                         onUseVideoVersion={onUseVideoVersion}
                     />
                     
                     {/* Hover Overlay with Title & Actions */}
                     <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none">
                         {/* Top Gradient */}
                         <div className="absolute inset-x-0 top-0 h-20 bg-gradient-to-b from-black/60 to-transparent" />
                         
                         {/* Title */}
                         <div className="absolute top-3 left-3 pointer-events-auto">
                             <LocalEditableTitle title={data.title} onUpdate={(t) => updateData(data.id, { title: t })} isDark={true} />
                         </div>
                         
                          {/* Action Buttons */}
                          <div className="absolute top-3 right-3 flex items-center gap-1.5 pointer-events-auto">
                              <button 
                                  title="下载" 
                                  className="w-8 h-8 rounded-lg bg-black/40 hover:bg-black/60 backdrop-blur-md text-white/80 hover:text-white flex items-center justify-center transition-all"
                                  onClick={(e) => { e.stopPropagation(); onDownload?.(data.id); }}
                              >
                                  <Icons.Download size={16} />
                              </button>
                              <button 
                                  title="最大化" 
                                  className="w-8 h-8 rounded-lg bg-black/40 hover:bg-black/60 backdrop-blur-md text-white/80 hover:text-white flex items-center justify-center transition-all"
                                  onClick={(e) => { e.stopPropagation(); onMaximize?.(data.id); }}
                              >
                                  <Icons.Maximize2 size={16} />
                              </button>
                          </div>
                          </div>
                      </>
                  ) : (
                <div className={`w-full h-full flex flex-col items-center justify-center ${emptyStateTextColor}`}>
                    <div className={`w-16 h-16 rounded-2xl flex items-center justify-center mb-4 ${emptyStateIconColor}`}>
                        <Icons.Film size={28} className="opacity-60"/>
                    </div>
                    <span className="text-sm font-medium opacity-70">{hasShotContext ? data.shotName || data.title : '生视频'}</span>
                    <span className="text-xs opacity-45 mt-1 px-8 text-center line-clamp-2">
                        {hasShotContext ? data.shotDescription : '选中节点开始创作'}
                    </span>
                </div>
            )}
            
            {/* Loading Overlay with Progress */}
            {data.isLoading && (
                <div className="absolute inset-0 bg-black/60 backdrop-blur-sm flex flex-col items-center justify-center z-20">
                    <div className="relative w-16 h-16 mb-4">
                        <svg className="w-full h-full -rotate-90" viewBox="0 0 64 64">
                            <circle cx="32" cy="32" r="28" fill="none" stroke={isDark ? '#3f3f46' : '#e5e7eb'} strokeWidth="4" />
                            <circle 
                                cx="32" cy="32" r="28" fill="none" 
                                stroke="#a855f7" strokeWidth="4" 
                                strokeLinecap="round"
                                strokeDasharray={`${progress * 1.76} 176`}
                                className="transition-all duration-300"
                            />
                        </svg>
                        <div className="absolute inset-0 flex items-center justify-center">
                            <span className="text-white font-bold text-sm tabular-nums">{Math.floor(progress)}%</span>
                        </div>
                    </div>
                    <span className="text-white/80 text-sm font-medium">视频生成中...</span>
                </div>
            )}
        </div>

        {isSelectedAndStable && showControls && hasResult && (
            <div className={`absolute bottom-full left-1/2 mb-2 z-[75] flex items-center gap-1.5 rounded-2xl border px-3 py-2 shadow-2xl backdrop-blur-xl pointer-events-auto ${isDark ? 'bg-[#202020]/95 border-zinc-700 text-zinc-100' : 'bg-white/95 border-gray-200 text-gray-900'}`} style={topToolbarTransform} onMouseDown={(e) => e.stopPropagation()}>
                <button className={`h-9 px-2.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 whitespace-nowrap transition-colors ${isDark ? 'hover:bg-zinc-800' : 'hover:bg-gray-100'}`} onClick={() => onRemoveSubtitles?.(data.id)} title="AI 检测并移除硬字幕和水印">
                    <Icons.Subtitles size={16} />
                    <span>去字幕</span>
                </button>
                <button className={`h-9 px-2.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 whitespace-nowrap transition-colors ${isDark ? 'hover:bg-zinc-800' : 'hover:bg-gray-100'}`} onClick={() => onEnhanceVideo?.(data.id)} title="帧插值提升帧率 / 超分辨率提升画质">
                    <Icons.TrendingUp size={16} />
                    <span>高清修复</span>
                </button>
                <button className={`h-9 px-2.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 whitespace-nowrap transition-colors ${isDark ? 'hover:bg-zinc-800' : 'hover:bg-gray-100'}`} onClick={() => onExtractFrames?.(data.id)} title="逐帧浏览视频并抽取为图片">
                    <Icons.Frame size={16} />
                    <span>视频截帧</span>
                </button>
                <button className={`h-9 px-2.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 whitespace-nowrap transition-colors ${isDark ? 'hover:bg-zinc-800' : 'hover:bg-gray-100'}`} onClick={() => onRemoveBGM?.(data.id)} title="移除背景音乐，保留人声对白">
                    <Icons.VolumeX size={16} />
                    <span>去BGM</span>
                </button>
                <button className={`h-9 px-2.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 whitespace-nowrap transition-colors ${isDark ? 'hover:bg-zinc-800' : 'hover:bg-gray-100'}`} onClick={() => onUpload?.(data.id)} title="上传替换当前视频">
                    <Icons.Upload size={16} />
                    <span>上传</span>
                </button>
            </div>
        )}

        {/* Control Panel */}
        {isSelectedAndStable && showControls && (
          <div className="absolute top-full left-1/2 w-[680px] max-w-[calc(100vw-32px)] pt-4 z-[70] pointer-events-auto" style={panelTransform} onMouseDown={(e) => e.stopPropagation()}>
               {inputMedia.length > 0 && resolvedVideoMode !== 'start_end' && (
                   <LocalInputThumbnails inputs={inputs} items={inputMedia} ready={deferredInputs} isDark={isDark} onPreview={onPreviewReference} />
               )}
              <div className={`${controlPanelBg} rounded-[20px] p-4 flex flex-col gap-3 border shadow-[0_18px_55px_rgba(0,0,0,0.28)]`}>
                  {hasShotContext && (
                      <div className={`rounded-xl border px-3 py-2.5 ${isDark ? 'bg-zinc-900/70 border-zinc-800' : 'bg-gray-50 border-gray-200'}`}>
                          <div className="flex items-center justify-between gap-3">
                              <div className="min-w-0">
                                  <div className={`text-xs font-semibold flex items-center gap-1.5 ${isDark ? 'text-zinc-100' : 'text-gray-900'}`}>
                                      <Icons.Clapperboard size={14} />
                                      <span className="truncate">{shotLabel}</span>
                                  </div>
                                  <div className={`mt-1 text-[11px] truncate ${isDark ? 'text-zinc-400' : 'text-gray-500'}`}>
                                      {data.shotDescription || '已从线性分镜页带入，可继续在画布中精修。'}
                                  </div>
                              </div>
                              <div className="shrink-0 flex items-center gap-2">
                                  <span className={`rounded-lg px-2 py-1 text-[11px] font-semibold ${isDark ? 'bg-amber-500/10 text-amber-300' : 'bg-amber-50 text-amber-700'}`}>
                                      {data.creditEstimate || 0}分
                                  </span>
                                  <button
                                      className={`rounded-lg px-2 py-1 text-[11px] font-semibold ${isDark ? 'bg-zinc-800 text-zinc-300 hover:bg-zinc-700' : 'bg-white text-gray-600 hover:bg-gray-100 border border-gray-200'}`}
                                      onClick={() => alert('原型演示：正式系统会跳回线性系统对应分镜页。')}
                                  >
                                      打开线性页
                                  </button>
                              </div>
                          </div>
                      </div>
                  )}

                  <VideoGenerationControls
                      data={data}
                      updateData={updateData}
                      onGenerate={onGenerate}
                      inputMedia={inputMedia}
                      progress={progress}
                      hasResult={hasResult}
                      isDark={isDark}
                  />
              </div>
          </div>
        )}

      </>
    );
};
