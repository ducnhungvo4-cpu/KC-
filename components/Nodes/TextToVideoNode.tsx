
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { InputMedia, NodeData } from '../../types';
import { Icons } from '../Icons';
import { getModelConfig, MODEL_REGISTRY, getVisibleModels } from '../../services/geminiService';
import { VIDEO_HANDLERS } from '../../services/mode/video/configurations';
import { getVideoConstraints, getAutoCorrectedVideoSettings } from '../../services/mode/video/rules';
import { LocalEditableTitle, LocalCustomDropdown, LocalInputThumbnails, LocalMediaStack } from './Shared/LocalNodeComponents';

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
  isDark?: boolean;
  isSelecting?: boolean;
  canvasScale?: number;
}

export const TextToVideoNode: React.FC<TextToVideoNodeProps> = ({
    data, updateData, onGenerate, selected, showControls, inputs = [], inputMedia = [], onPreviewReference, onMaximize, onDownload, onUpload, onSaveResult, onExtractFrames, onExtractSingleFrame, onRemoveSubtitles, onEnhanceVideo, onRemoveBGM, onToggleFavoriteArtifact, isArtifactFavorited, isDark = true, isSelecting, canvasScale = 1
}) => {
    const [activeDropdown, setActiveDropdown] = useState<string | null>(null);
    const [deferredInputs, setDeferredInputs] = useState(false);
    const [progress, setProgress] = useState(0);
    const [isConfigured, setIsConfigured] = useState(true);
    const [videoModels, setVideoModels] = useState<string[]>([]);

    const isSelectedAndStable = selected && !isSelecting;
    // Panel stays a constant screen size while zooming via the --canvas-scale CSS var,
    // so zoom no longer re-renders the node (heavy base64 media stays off the hot path).
    const panelTransform: React.CSSProperties = {
        transform: 'translateX(-50%) scale(calc(1 / var(--canvas-scale, 1)))',
        transformOrigin: 'top center',
    };

    const checkConfig = useCallback(() => {
         const mName = data.model || 'Agnes Video V2.0';
         const cfg = getModelConfig(mName);
         // KC backend-proxied video models run through /api/generate/video, so the API key
         // lives on the backend (Cloudflare AGNES_VIDEO_API_KEY), not in the browser.
         const isBackendModel = mName === 'Agnes Video V2.0' || mName === 'Seedance 1.5 Pro';
         setIsConfigured(isBackendModel || !!cfg.key);
    }, [data.model]);

    const updateModels = useCallback(() => {
        const visibleModels = getVisibleModels();
        const models = visibleModels.filter(k => MODEL_REGISTRY[k]?.category === 'VIDEO');
        setVideoModels(models);
    }, []);

    useEffect(() => { 
        checkConfig(); 
        updateModels();
        window.addEventListener('modelConfigUpdated', checkConfig); 
        window.addEventListener('modelRegistryUpdated', updateModels);
        return () => {
            window.removeEventListener('modelConfigUpdated', checkConfig);
            window.removeEventListener('modelRegistryUpdated', updateModels);
        };
    }, [checkConfig, updateModels]);

    // Group models for split-pane/flyout dropdown
    const groupedVideoModels = useMemo(() => {
        const groups: Record<string, string[]> = {
            'Kling': [],
            'Hailuo': [],
            'Veo': [],
            'Wan': []
        };
        const ungrouped: string[] = [];
        
        videoModels.forEach(m => {
            const lower = m.toLowerCase();
            if (m.startsWith('Kling') || m.includes('可灵')) {
                 groups['Kling'].push(m);
            } else if (m.startsWith('海螺') || lower.includes('hailuo')) {
                 groups['Hailuo'].push(m);
            } else if (m.startsWith('Veo')) {
                 groups['Veo'].push(m);
            } else if (m.startsWith('Wan') || lower.includes('wan')) {
                 groups['Wan'].push(m);
            } else {
                 ungrouped.push(m);
            }
        });
        
        const result = Object.entries(groups)
            .filter(([_, items]) => items.length > 0)
            .map(([label, items]) => ({ label, items }));
            
        // Return mixed array: Objects for groups, Strings for ungrouped items
        return [...result, ...ungrouped];
    }, [videoModels]);

    useEffect(() => { if (isSelectedAndStable && showControls) { const t = setTimeout(() => setDeferredInputs(true), 100); return () => clearTimeout(t); } else setDeferredInputs(false); }, [isSelectedAndStable, showControls]);
    useEffect(() => { let interval: any; if (data.isLoading) { setProgress(0); interval = setInterval(() => { setProgress(prev => (prev >= 95 ? 95 : prev + Math.max(0.5, (95 - prev) / 20))); }, 200); } else setProgress(0); return () => clearInterval(interval); }, [data.isLoading]);

    const handleRatioChange = (ratio: string) => {
        const currentShort = Math.min(data.width, data.height);
        const baseSize = Math.max(currentShort, 400); // Preserve current scale, min 400px

        const [wStr, hStr] = ratio.split(':');
        const wR = parseFloat(wStr);
        const hR = parseFloat(hStr);
        const r = wR / hR;

        let newW, newH;
        if (r >= 1) {
            newH = baseSize;
            newW = baseSize * r;
        } else {
            newW = baseSize;
            newH = baseSize / r;
        }
        updateData(data.id, { aspectRatio: ratio, width: Math.round(newW), height: Math.round(newH) });
    };


    const currentModel = data.model || 'Seedance 1.5 Pro';
    const handler = VIDEO_HANDLERS[currentModel] || VIDEO_HANDLERS['Seedance 1.5 Pro'];
    const rules = handler.rules;

    const resOptions = rules.resolutions || ['720p'];
    const durOptions = rules.durations || ['5s'];
    const ratioOptions = rules.ratios || ['16:9'];
    const canOptimize = !!rules.hasPromptExtend;

    // Constraints & Auto-Correction
    const constraints = getVideoConstraints(currentModel, data.resolution, data.duration, inputs.length);
    const displayResValue = (data.model?.includes('海螺') && (data.resolution === '720p' || data.resolution === '768p')) ? '768p' : data.resolution;

    useEffect(() => {
        let updates: Partial<NodeData> = {};
        const corrections = getAutoCorrectedVideoSettings(currentModel, data.resolution, data.duration, inputs.length);
        if (corrections.resolution) updates.resolution = corrections.resolution;
        if (corrections.duration) updates.duration = corrections.duration;

        // Basic validation
        if (data.resolution && !resOptions.includes(data.resolution)) updates.resolution = resOptions[0];
        if (data.duration && !durOptions.includes(data.duration)) updates.duration = durOptions[0];
        if (data.aspectRatio && !ratioOptions.includes(data.aspectRatio)) updates.aspectRatio = ratioOptions[0];

        if (Object.keys(updates).length > 0) updateData(data.id, updates);
    }, [data.model, data.resolution, data.duration, data.aspectRatio, resOptions, durOptions, ratioOptions, currentModel, inputs.length, updateData, data.id]);

    const containerBg = isDark ? 'bg-[#1a1a1a]' : 'bg-white';
    const containerBorder = selected ? 'border-purple-500 ring-2 ring-purple-500/30' : (isDark ? 'border-zinc-700/50' : 'border-gray-200');
    const controlPanelBg = isDark ? 'bg-[#1a1a1a]/95 backdrop-blur-xl border-zinc-700/50' : 'bg-white/95 backdrop-blur-xl border-gray-200 shadow-xl';
    const inputBg = isDark ? 'bg-zinc-800/80 hover:bg-zinc-800 border-zinc-700 focus:border-purple-500 text-white placeholder-zinc-500' : 'bg-gray-50 hover:bg-white border-gray-200 focus:border-purple-500 text-gray-900 placeholder-gray-400';
    const emptyStateIconColor = isDark ? 'bg-zinc-800/50 text-zinc-500' : 'bg-gray-100 text-gray-400';
    const emptyStateTextColor = isDark ? 'text-zinc-500' : 'text-gray-400';
    const hasResult = !!data.videoSrc && !data.isLoading;
    const hasShotContext = Boolean(data.shotId);
    const shotLabel = hasShotContext
        ? `第${data.episodeNo || '-'}集 / 第${data.sceneNo || '-'}场 / 分镜${String(data.shotNo || '-').padStart(2, '0')}`
        : '';
    const creditLabel = data.creditStatus === 'reserved'
        ? '已预扣'
        : data.creditStatus === 'confirmed'
            ? '已扣减'
            : data.creditStatus === 'refunded'
                ? '已返还'
                : '预计';

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
            <div className={`absolute bottom-full left-1/2 mb-4 z-[75] flex items-center gap-1.5 rounded-2xl border px-3 py-2 shadow-2xl backdrop-blur-xl pointer-events-auto ${isDark ? 'bg-[#202020]/95 border-zinc-700 text-zinc-100' : 'bg-white/95 border-gray-200 text-gray-900'}`} style={panelTransform} onMouseDown={(e) => e.stopPropagation()}>
                <button className={`h-9 px-2.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 whitespace-nowrap transition-colors ${isDark ? 'hover:bg-zinc-800' : 'hover:bg-gray-100'}`} onClick={() => onRemoveSubtitles?.(data.id)} title="AI 检测并移除硬字幕和水印">
                    <Icons.Subtitles size={16} />
                    <span>去字幕</span>
                </button>
                <button className={`h-9 px-2.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 whitespace-nowrap transition-colors ${isDark ? 'hover:bg-zinc-800' : 'hover:bg-gray-100'}`} onClick={() => onEnhanceVideo?.(data.id)} title="帧插值提升帧率 / 超分辨率提升画质">
                    <Icons.TrendingUp size={16} />
                    <span>增分</span>
                </button>
                <button className={`h-9 px-2.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 whitespace-nowrap transition-colors ${isDark ? 'hover:bg-zinc-800' : 'hover:bg-gray-100'}`} onClick={() => onExtractFrames?.(data.id)} title="逐帧浏览视频并抽取为图片">
                    <Icons.Frame size={16} />
                    <span>视频截帧</span>
                </button>
                <button className={`h-9 px-2.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 whitespace-nowrap transition-colors ${isDark ? 'hover:bg-zinc-800' : 'hover:bg-gray-100'}`} onClick={() => onRemoveBGM?.(data.id)} title="移除背景音乐，保留人声对白">
                    <Icons.VolumeX size={16} />
                    <span>去BGM</span>
                </button>
                <div className={`w-px h-6 mx-1 ${isDark ? 'bg-zinc-700' : 'bg-gray-200'}`} />
                <button className={`h-9 px-2.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 whitespace-nowrap transition-colors ${isDark ? 'hover:bg-zinc-800' : 'hover:bg-gray-100'}`} onClick={() => onUpload?.(data.id)} title="上传替换当前视频">
                    <Icons.Upload size={16} />
                    <span>上传</span>
                </button>
            </div>
        )}

        {/* Control Panel */}
        {isSelectedAndStable && showControls && (
          <div className="absolute top-full left-1/2 min-w-[580px] pt-4 z-[70] pointer-events-auto" style={panelTransform} onMouseDown={(e) => e.stopPropagation()}>
               {inputMedia.length > 0 && <LocalInputThumbnails inputs={inputs} items={inputMedia} ready={deferredInputs} isDark={isDark} onPreview={onPreviewReference} />}
              <div className={`${controlPanelBg} rounded-2xl p-4 flex flex-col gap-3 border`}>
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

                  {/* Prompt Input */}
                  <textarea
                      className={`w-full border rounded-xl px-4 py-3 text-sm leading-relaxed resize-none focus:outline-none focus:ring-2 focus:ring-purple-500/20 min-h-[72px] no-scrollbar transition-all ${inputBg}`}
                      placeholder="描述你想要生成的视频场景..."
                      value={data.prompt || ''}
                      onChange={(e) => updateData(data.id, { prompt: e.target.value })}
                      onWheel={(e) => e.stopPropagation()}
                  />
                  
                  {/* Parameters Row - All in one line */}
                  <div className="flex items-center gap-2">
                       <LocalCustomDropdown 
                           options={groupedVideoModels} 
                           value={data.model || 'Seedance 1.5 Pro'} 
                           onChange={(val: any) => updateData(data.id, { model: val })} 
                           isOpen={activeDropdown === 'model'} 
                           onToggle={() => setActiveDropdown(activeDropdown === 'model' ? null : 'model')} 
                           onClose={() => setActiveDropdown(null)} 
                           align="left" 
                           width="w-[130px]" 
                           isDark={isDark} 
                       />
                      <LocalCustomDropdown icon={Icons.Crop} options={ratioOptions} value={data.aspectRatio || '16:9'} onChange={handleRatioChange} isOpen={activeDropdown === 'ratio'} onToggle={() => setActiveDropdown(activeDropdown === 'ratio' ? null : 'ratio')} onClose={() => setActiveDropdown(null)} disabledOptions={constraints.disabledRatios} isDark={isDark} />
                      <LocalCustomDropdown icon={Icons.Monitor} options={resOptions} value={displayResValue || '720p'} onChange={(val: any) => updateData(data.id, { resolution: val })} isOpen={activeDropdown === 'res'} onToggle={() => setActiveDropdown(activeDropdown === 'res' ? null : 'res')} onClose={() => setActiveDropdown(null)} disabledOptions={constraints.disabledRes} isDark={isDark} />
                      <LocalCustomDropdown icon={Icons.Clock} options={durOptions} value={data.duration || '5s'} onChange={(val: any) => updateData(data.id, { duration: val })} isOpen={activeDropdown === 'duration'} onToggle={() => setActiveDropdown(activeDropdown === 'duration' ? null : 'duration')} onClose={() => setActiveDropdown(null)} disabledOptions={constraints.disabledDurations} isDark={isDark} />
                      <LocalCustomDropdown icon={Icons.Layers} options={[1, 2, 3, 4]} value={data.count || 1} onChange={(val: any) => updateData(data.id, { count: val })} isOpen={activeDropdown === 'count'} onToggle={() => setActiveDropdown(activeDropdown === 'count' ? null : 'count')} onClose={() => setActiveDropdown(null)} isDark={isDark} />
                      <button 
                          className={`shrink-0 w-8 h-8 rounded-lg flex items-center justify-center transition-all border ${
                              canOptimize 
                                  ? (data.promptOptimize 
                                      ? (isDark ? 'text-purple-400 bg-purple-500/20 border-purple-500/30' : 'text-purple-600 bg-purple-100 border-purple-200') 
                                      : (isDark ? 'text-zinc-400 hover:text-white border-zinc-700 hover:border-zinc-600 hover:bg-zinc-700' : 'text-gray-400 hover:text-gray-600 border-gray-200 hover:bg-gray-100')
                                    ) 
                                  : (isDark ? 'text-zinc-600 border-zinc-800 opacity-40 cursor-not-allowed' : 'text-gray-300 border-gray-100 opacity-40 cursor-not-allowed')
                          }`} 
                          onClick={() => canOptimize && updateData(data.id, { promptOptimize: !data.promptOptimize })}
                          title={canOptimize ? `提示词优化: ${data.promptOptimize ? '开启' : '关闭'}` : '此模型不支持提示词优化'}
                          disabled={!canOptimize}
                      >
                          <Icons.Sparkles size={15} fill={data.promptOptimize && canOptimize ? "currentColor" : "none"} />
                      </button>
                       
                       {/* Spacer */}
                       <div className="flex-1" />

                       <div className={`hidden sm:flex h-8 items-center rounded-lg border px-2.5 text-[11px] font-semibold whitespace-nowrap ${
                           data.creditStatus === 'confirmed'
                               ? (isDark ? 'border-emerald-500/20 bg-emerald-500/10 text-emerald-300' : 'border-emerald-100 bg-emerald-50 text-emerald-700')
                               : data.creditStatus === 'reserved'
                                   ? (isDark ? 'border-blue-500/20 bg-blue-500/10 text-blue-300' : 'border-blue-100 bg-blue-50 text-blue-700')
                                   : data.creditStatus === 'refunded'
                                       ? (isDark ? 'border-zinc-700 bg-zinc-800 text-zinc-300' : 'border-gray-200 bg-gray-50 text-gray-600')
                                       : (isDark ? 'border-zinc-700 bg-zinc-900/60 text-zinc-400' : 'border-gray-200 bg-gray-50 text-gray-500')
                       }`}>
                           {data.creditEstimate || 14}分
                       </div>
                       
                       {/* Generate Button */}
                       <button
                           onClick={() => onGenerate(data.id)}
                           disabled={data.isLoading}
                           title={'开始生成'}
                           className={`shrink-0 h-8 px-4 rounded-lg text-sm font-semibold flex items-center justify-center gap-2 whitespace-nowrap transition-all active:scale-[0.98] ${
                               data.isLoading
                                   ? 'bg-gray-400 text-white cursor-not-allowed'
                                   : 'bg-gradient-to-r from-purple-600 to-purple-500 hover:from-purple-500 hover:to-purple-400 text-white shadow-lg shadow-purple-500/25 hover:shadow-purple-500/40'
                           }`}
                       >
                           {data.isLoading ? <Icons.Loader2 className="animate-spin" size={15}/> : <Icons.Wand2 size={15} />}
                           <span>{data.isLoading ? `${Math.floor(progress)}%` : '生成'}</span>
                       </button>
                  </div>
              </div>
          </div>
        )}

      </>
    );
};
