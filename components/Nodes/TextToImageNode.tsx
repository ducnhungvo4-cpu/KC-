
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { InputMedia, MultiAngleOptions, NodeData } from '../../types';
import { Icons } from '../Icons';
import { getModelConfig, MODEL_REGISTRY, getVisibleModels } from '../../services/geminiService';
import { IMAGE_HANDLERS } from '../../services/mode/image/configurations';
import { LocalEditableTitle, LocalCustomDropdown, LocalInputThumbnails, LocalMediaStack } from './Shared/LocalNodeComponents';

interface TextToImageNodeProps {
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
  onCrop?: (id: string) => void;
  onMultiAngle?: (id: string, options: MultiAngleOptions) => void;
  isDark?: boolean;
  isSelecting?: boolean;
  canvasScale?: number;
}

export const TextToImageNode: React.FC<TextToImageNodeProps> = ({
    data, updateData, onGenerate, selected, showControls, inputs = [], inputMedia = [], onPreviewReference, onMaximize, onDownload, onUpload, onCrop, onMultiAngle, isDark = true, isSelecting, canvasScale = 1
}) => {
    const [activeDropdown, setActiveDropdown] = useState<string | null>(null);
    const [deferredInputs, setDeferredInputs] = useState(false);
    const [isConfigured, setIsConfigured] = useState(true);
    const [imageModels, setImageModels] = useState<string[]>([]);
    const [isAngleEditorOpen, setIsAngleEditorOpen] = useState(false);
    const [isFunctionMenuOpen, setIsFunctionMenuOpen] = useState(false);
    const [anglePrompt, setAnglePrompt] = useState('');
    const [angleConsistency, setAngleConsistency] = useState<'standard' | 'high'>('high');
    const [angleBackground, setAngleBackground] = useState<'keep' | 'clean' | 'solid'>('clean');
    const [angleAspectRatio, setAngleAspectRatio] = useState('沿原图');
    const [anglePreset, setAnglePreset] = useState('custom');
    const [yaw, setYaw] = useState(0);
    const [pitch, setPitch] = useState(0);
    const [zoom, setZoom] = useState<'wide' | 'medium' | 'close'>('medium');
    const [showAnglePrompt, setShowAnglePrompt] = useState(false);
    const [isAngleDragging, setIsAngleDragging] = useState(false);
    const anglePadRef = useRef<HTMLDivElement>(null);

    const isSelectedAndStable = selected && !isSelecting;
    const panelScale = 1 / Math.max(canvasScale, 0.1);
    const panelTransform: React.CSSProperties = {
        transform: `translateX(-50%) scale(${panelScale})`,
        transformOrigin: 'top center',
    };

    const checkConfig = useCallback(() => {
         const mName = data.model || 'Seedream 5.0';
         const cfg = getModelConfig(mName);
         setIsConfigured(mName === 'Seedream 5.0' || !!cfg.key);
    }, [data.model]);

    const updateModels = useCallback(() => {
        const visibleModels = getVisibleModels();
        const models = visibleModels.filter(k => MODEL_REGISTRY[k]?.category === 'IMAGE');
        setImageModels(models);
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

    useEffect(() => { if (isSelectedAndStable && showControls) { const t = setTimeout(() => setDeferredInputs(true), 100); return () => clearTimeout(t); } else setDeferredInputs(false); }, [isSelectedAndStable, showControls]);

    // Get Rules for current model
    const currentModel = data.model || 'Seedream 5.0';
    const handler = IMAGE_HANDLERS[currentModel] || IMAGE_HANDLERS['Seedream 5.0']; // Fallback rules
    const rules = handler.rules;
    const supportedResolutions = rules.resolutions || ['1k'];
    const supportedRatios = rules.ratios || ['1:1', '16:9'];
    const canOptimize = !!rules.hasPromptExtend;
    const anglePresets = [
        { key: 'custom', label: '自定义', yaw: 0, pitch: 0, zoom: 'medium' as const },
        { key: 'fisheye', label: '鱼眼视角', yaw: 0, pitch: 0, zoom: 'wide' as const },
        { key: 'tilt', label: '倾斜视角', yaw: -25, pitch: 15, zoom: 'medium' as const },
        { key: 'front_top', label: '正面俯拍', yaw: 0, pitch: 35, zoom: 'medium' as const },
        { key: 'front_low', label: '正面仰拍', yaw: 0, pitch: -25, zoom: 'medium' as const },
        { key: 'panorama_top', label: '全景俯拍', yaw: 0, pitch: 55, zoom: 'wide' as const },
        { key: 'back_view', label: '背面视角', yaw: 180, pitch: 0, zoom: 'medium' as const },
    ];
    const angleAspectOptions = ['沿原图', '1:1', '3:4', '4:3', '9:16', '16:9'];
    const consistencyOptions = [
        { value: 'standard' as const, label: '标准' },
        { value: 'high' as const, label: '高一致' },
    ];
    const backgroundOptions = [
        { value: 'keep' as const, label: '保留背景' },
        { value: 'clean' as const, label: '干净背景' },
        { value: 'solid' as const, label: '纯色背景' },
    ];

    const applyAnglePreset = (preset: typeof anglePresets[number]) => {
        setAnglePreset(preset.key);
        setYaw(preset.yaw);
        setPitch(preset.pitch);
        setZoom(preset.zoom);
    };

    const updateAngleFromPointer = (event: React.PointerEvent<HTMLDivElement>) => {
        const target = anglePadRef.current;
        if (!target) return;
        const rect = target.getBoundingClientRect();
        const nx = Math.min(Math.max((event.clientX - rect.left) / rect.width, 0), 1);
        const ny = Math.min(Math.max((event.clientY - rect.top) / rect.height, 0), 1);
        setAnglePreset('custom');
        setYaw(Math.round((nx - 0.5) * 360));
        setPitch(Math.round((0.5 - ny) * 180));
    };

    const handleAnglePointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
        event.stopPropagation();
        setIsAngleDragging(true);
        event.currentTarget.setPointerCapture(event.pointerId);
        updateAngleFromPointer(event);
    };

    const handleAnglePointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
        if (!isAngleDragging) return;
        updateAngleFromPointer(event);
    };

    const handleAnglePointerUp = (event: React.PointerEvent<HTMLDivElement>) => {
        setIsAngleDragging(false);
        if (event.currentTarget.hasPointerCapture(event.pointerId)) {
            event.currentTarget.releasePointerCapture(event.pointerId);
        }
    };

    const handleMultiAngleGenerate = () => {
        if (!data.imageSrc || data.isLoading) return;
        onMultiAngle?.(data.id, {
            angles: [anglePreset],
            prompt: anglePrompt,
            consistency: angleConsistency,
            background: angleBackground,
            aspectRatio: angleAspectRatio === '沿原图' ? 'source' : angleAspectRatio,
            countPerAngle: 1,
            yaw,
            pitch,
            zoom,
            preset: anglePreset,
            targetMode: 'scene',
        });
    };

    const handleRatioChange = (ratio: string) => {
        const currentShort = Math.min(data.width, data.height);
        const baseSize = Math.max(currentShort, 400); // Preserve current scale, min 400px

        const [wStr, hStr] = ratio.split(':');
        const wR = parseFloat(wStr);
        const hR = parseFloat(hStr);
        const r = wR / hR;

        let newW, newH;
        if (r >= 1) {
            // Landscape or Square: Height is limiting factor
            newH = baseSize;
            newW = baseSize * r;
        } else {
            // Portrait: Width is limiting factor
            newW = baseSize;
            newH = baseSize / r;
        }
        updateData(data.id, { aspectRatio: ratio, width: Math.round(newW), height: Math.round(newH) });
    };

    const hasResult = !!data.imageSrc && !data.isLoading;
    const creditLabel = data.creditStatus === 'reserved'
        ? '已预扣'
        : data.creditStatus === 'confirmed'
            ? '已扣减'
            : data.creditStatus === 'refunded'
                ? '已返还'
                : '预计';
    
    // Auto-correct
    useEffect(() => { 
        if (data.aspectRatio && !supportedRatios.includes(data.aspectRatio)) updateData(data.id, { aspectRatio: '1:1' }); 
        if (data.resolution && !supportedResolutions.includes(data.resolution)) updateData(data.id, { resolution: supportedResolutions[0] });
    }, [data.model, data.aspectRatio, data.resolution, data.id, updateData, supportedRatios, supportedResolutions]);

    const containerBg = isDark ? 'bg-[#1a1a1a]' : 'bg-white';
    const containerBorder = selected ? 'border-blue-500 ring-2 ring-blue-500/30' : (isDark ? 'border-zinc-700/50' : 'border-gray-200');
    const controlPanelBg = isDark ? 'bg-[#1a1a1a]/95 backdrop-blur-xl border-zinc-700/50' : 'bg-white/95 backdrop-blur-xl border-gray-200 shadow-xl';
    const inputBg = isDark ? 'bg-zinc-800/80 hover:bg-zinc-800 border-zinc-700 focus:border-blue-500 text-white placeholder-zinc-500' : 'bg-gray-50 hover:bg-white border-gray-200 focus:border-blue-500 text-gray-900 placeholder-gray-400';
    const emptyStateIconColor = isDark ? 'bg-zinc-800/50 text-zinc-500' : 'bg-gray-100 text-gray-400';
    const emptyStateTextColor = isDark ? 'text-zinc-500' : 'text-gray-400';

    return (
      <>
        <div className={`w-full h-full relative rounded-2xl border ${containerBorder} ${containerBg} ${data.isStackOpen ? 'overflow-visible' : 'overflow-hidden'} shadow-xl group transition-all duration-200`}>
             {hasResult ? (
                 <>
                     <LocalMediaStack data={data} updateData={updateData} currentSrc={data.imageSrc} onMaximize={onMaximize} isDark={isDark} selected={selected} />
                     
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
                                 title="最大化" 
                                 className="w-8 h-8 rounded-lg bg-black/40 hover:bg-black/60 backdrop-blur-md text-white/80 hover:text-white flex items-center justify-center transition-all"
                                 onClick={(e) => { e.stopPropagation(); onMaximize?.(data.id); }}
                             >
                                 <Icons.Maximize2 size={16} />
                             </button>
                             <button 
                                 title="下载" 
                                 className="w-8 h-8 rounded-lg bg-black/40 hover:bg-black/60 backdrop-blur-md text-white/80 hover:text-white flex items-center justify-center transition-all"
                                 onClick={(e) => { e.stopPropagation(); onDownload?.(data.id); }}
                             >
                                 <Icons.Download size={16} />
                             </button>
                             <button
                                 title="Crop"
                                 className="w-8 h-8 rounded-lg bg-black/40 hover:bg-black/60 backdrop-blur-md text-white/80 hover:text-white flex items-center justify-center transition-all"
                                 onClick={(e) => { e.stopPropagation(); onCrop?.(data.id); }}
                             >
                                 <Icons.Crop size={16} />
                             </button>
                         </div>
                     </div>
                 </>
             ) : (
                 <div className={`w-full h-full flex flex-col items-center justify-center ${emptyStateTextColor}`}>
                     <div className={`w-16 h-16 rounded-2xl flex items-center justify-center mb-4 ${emptyStateIconColor}`}>
                         <Icons.Image size={28} className="opacity-60"/>
                     </div>
                     <span className="text-sm font-medium opacity-60">生图</span>
                     <span className="text-xs opacity-40 mt-1">选中节点开始创作</span>
                 </div>
             )}
             
             {/* Loading Overlay */}
             {data.isLoading && (
                 <div className="absolute inset-0 bg-black/60 backdrop-blur-sm flex flex-col items-center justify-center z-20">
                     <Icons.Loader2 size={32} className="text-blue-500 animate-spin mb-3" />
                     <span className="text-white/80 text-sm font-medium">生成中...</span>
                 </div>
             )}
        </div>

        {isSelectedAndStable && showControls && hasResult && (
            <div className={`absolute bottom-full left-1/2 mb-4 z-[75] flex items-center gap-1.5 rounded-2xl border px-3 py-2 shadow-2xl backdrop-blur-xl pointer-events-auto ${isDark ? 'bg-[#202020]/95 border-zinc-700 text-zinc-100' : 'bg-white/95 border-gray-200 text-gray-900'}`} style={panelTransform} onMouseDown={(e) => e.stopPropagation()}>
                <button className={`h-9 px-3 rounded-xl text-sm font-semibold flex items-center gap-2 transition-colors ${isDark ? 'hover:bg-zinc-800' : 'hover:bg-gray-100'}`} onClick={() => setIsAngleEditorOpen(true)} title="多角度控制">
                    <Icons.RefreshCw size={16} />
                    <span>多角度</span>
                </button>
                <button className={`h-9 px-3 rounded-xl text-sm font-semibold flex items-center gap-2 transition-colors ${isDark ? 'hover:bg-zinc-800' : 'hover:bg-gray-100'}`} onClick={() => onCrop?.(data.id)} title="图片裁剪">
                    <Icons.Crop size={16} />
                    <span>裁剪</span>
                </button>
                <button className={`h-9 px-3 rounded-xl text-sm font-semibold flex items-center gap-2 transition-colors ${isDark ? 'hover:bg-zinc-800' : 'hover:bg-gray-100'}`} onClick={() => onUpload?.(data.id)} title="上传替换当前图片">
                    <Icons.Upload size={16} />
                    <span>上传</span>
                </button>
                <div className={`w-px h-6 mx-1 ${isDark ? 'bg-zinc-700' : 'bg-gray-200'}`} />
                <button className={`w-9 h-9 rounded-xl flex items-center justify-center transition-colors ${isDark ? 'hover:bg-zinc-800' : 'hover:bg-gray-100'}`} onClick={() => onDownload?.(data.id)} title="下载">
                    <Icons.Download size={17} />
                </button>
                <button className={`w-9 h-9 rounded-xl flex items-center justify-center transition-colors ${isDark ? 'hover:bg-zinc-800' : 'hover:bg-gray-100'}`} onClick={() => onMaximize?.(data.id)} title="放大查看">
                    <Icons.Maximize2 size={17} />
                </button>
            </div>
        )}

        {/* Control Panel */}
        {isSelectedAndStable && showControls && (!hasResult || isAngleEditorOpen) && (
            <div className="absolute top-full left-1/2 min-w-[520px] pt-4 z-[70] pointer-events-auto" style={panelTransform} onMouseDown={(e) => e.stopPropagation()}>
                 {!hasResult && inputMedia.length > 0 && <LocalInputThumbnails inputs={inputs} items={inputMedia} ready={deferredInputs} isDark={isDark} onPreview={onPreviewReference} />}
                 <div className={`${controlPanelBg} rounded-2xl p-4 flex flex-col gap-3 border`}>
                      {!hasResult && (
                      <>
                      {/* Prompt Input */}
                      <textarea 
                          className={`w-full border rounded-xl px-4 py-3 text-sm leading-relaxed resize-none focus:outline-none focus:ring-2 focus:ring-blue-500/20 min-h-[72px] no-scrollbar transition-all ${inputBg}`} 
                          placeholder="描述你想要生成的图片..." 
                          value={data.prompt || ''} 
                          onChange={(e) => updateData(data.id, { prompt: e.target.value })} 
                          onWheel={(e) => e.stopPropagation()} 
                      />
                      
                      {/* Parameters Row - All in one line */}
                      <div className="flex items-center gap-2">
                          <LocalCustomDropdown 
                              options={imageModels} 
                              value={data.model || 'Seedream 5.0'} 
                              onChange={(val: any) => updateData(data.id, { model: val })} 
                              isOpen={activeDropdown === 'model'} 
                              onToggle={() => setActiveDropdown(activeDropdown === 'model' ? null : 'model')} 
                              onClose={() => setActiveDropdown(null)} 
                              align="left" 
                              width="w-[130px]" 
                              isDark={isDark} 
                          />
                          <LocalCustomDropdown icon={Icons.Crop} options={supportedRatios} value={data.aspectRatio || '1:1'} onChange={handleRatioChange} isOpen={activeDropdown === 'ratio'} onToggle={() => setActiveDropdown(activeDropdown === 'ratio' ? null : 'ratio')} onClose={() => setActiveDropdown(null)} isDark={isDark} />
                          <LocalCustomDropdown icon={Icons.Monitor} options={supportedResolutions} value={data.resolution || '1k'} onChange={(val: any) => updateData(data.id, { resolution: val })} isOpen={activeDropdown === 'res'} onToggle={() => setActiveDropdown(activeDropdown === 'res' ? null : 'res')} onClose={() => setActiveDropdown(null)} disabledOptions={['1k', '2k', '4k'].filter(r => !supportedResolutions.includes(r))} isDark={isDark} />
                          <LocalCustomDropdown icon={Icons.Layers} options={[1, 2, 3, 4]} value={data.count || 1} onChange={(val: any) => updateData(data.id, { count: val })} isOpen={activeDropdown === 'count'} onToggle={() => setActiveDropdown(activeDropdown === 'count' ? null : 'count')} onClose={() => setActiveDropdown(null)} isDark={isDark} />
                         <button 
                             className={`shrink-0 w-8 h-8 rounded-lg flex items-center justify-center transition-all border ${
                                  canOptimize 
                                      ? (data.promptOptimize 
                                          ? (isDark ? 'text-blue-400 bg-blue-500/20 border-blue-500/30' : 'text-blue-600 bg-blue-100 border-blue-200') 
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
                          {data.imageSrc && (
                              <div className="relative">
                                  <button
                                      className={`shrink-0 h-8 px-3 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition-all border ${
                                          isDark ? 'text-zinc-300 hover:text-white border-zinc-700 hover:border-cyan-500/60 hover:bg-cyan-500/10' : 'text-gray-600 hover:text-gray-900 border-gray-200 hover:border-cyan-400 hover:bg-cyan-50'
                                      }`}
                                      onClick={() => setIsFunctionMenuOpen(prev => !prev)}
                                      title="图片功能"
                                  >
                                      <Icons.Sliders size={15} />
                                      <span>功能</span>
                                      <Icons.ChevronRight size={12} className={`transition-transform ${isFunctionMenuOpen ? '-rotate-90' : 'rotate-90'}`} />
                                  </button>
                                  {isFunctionMenuOpen && (
                                      <div className={`absolute bottom-full left-0 mb-2 w-36 rounded-xl border p-1.5 shadow-2xl z-[120] ${isDark ? 'bg-[#1a1a1a] border-zinc-700' : 'bg-white border-gray-200'}`} onMouseDown={(event) => event.stopPropagation()}>
                                          <button
                                              className={`w-full h-8 px-2 rounded-lg text-xs font-semibold flex items-center gap-2 transition-colors ${isDark ? 'text-zinc-300 hover:bg-zinc-800 hover:text-white' : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'}`}
                                              onClick={() => { setIsFunctionMenuOpen(false); setIsAngleEditorOpen(true); }}
                                          >
                                              <Icons.RefreshCw size={14} />
                                              <span>多角度控制</span>
                                          </button>
                                          <button
                                              className={`w-full h-8 px-2 rounded-lg text-xs font-semibold flex items-center gap-2 transition-colors ${isDark ? 'text-zinc-300 hover:bg-zinc-800 hover:text-white' : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'}`}
                                              onClick={() => { setIsFunctionMenuOpen(false); onCrop?.(data.id); }}
                                          >
                                              <Icons.Crop size={14} />
                                              <span>图片裁剪</span>
                                          </button>
                                      </div>
                                  )}
                              </div>
                          )}
                          
                          {/* Spacer */}
                          <div className="flex-1" />

                          <div className={`hidden sm:flex h-8 items-center rounded-lg border px-2.5 text-[11px] font-semibold ${
                              data.creditStatus === 'confirmed'
                                  ? (isDark ? 'border-emerald-500/20 bg-emerald-500/10 text-emerald-300' : 'border-emerald-100 bg-emerald-50 text-emerald-700')
                                  : data.creditStatus === 'reserved'
                                      ? (isDark ? 'border-blue-500/20 bg-blue-500/10 text-blue-300' : 'border-blue-100 bg-blue-50 text-blue-700')
                                      : data.creditStatus === 'refunded'
                                          ? (isDark ? 'border-zinc-700 bg-zinc-800 text-zinc-300' : 'border-gray-200 bg-gray-50 text-gray-600')
                                          : (isDark ? 'border-zinc-700 bg-zinc-900/60 text-zinc-400' : 'border-gray-200 bg-gray-50 text-gray-500')
                          }`}>
                              {creditLabel} {data.creditEstimate || ((data.count || 1) * 2)} 积分
                          </div>
                          
                          {/* Generate Button */}
                          <button 
                              onClick={() => onGenerate(data.id)} 
                              disabled={data.isLoading || !isConfigured}
                              title={!isConfigured ? '请在设置中配置 API Key' : '开始生成'}
                              className={`shrink-0 h-8 px-4 rounded-lg text-sm font-semibold flex items-center justify-center gap-2 whitespace-nowrap transition-all active:scale-[0.98] ${
                                  data.isLoading || !isConfigured 
                                      ? 'bg-gray-400 text-white cursor-not-allowed' 
                                      : 'bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-500 hover:to-blue-400 text-white shadow-lg shadow-blue-500/25 hover:shadow-blue-500/40'
                              }`}
                          >
                              {data.isLoading ? <Icons.Loader2 className="animate-spin" size={15}/> : <Icons.Wand2 size={15} />}
                          <span>{data.isLoading ? '生成中' : '生成'}</span>
                          </button>
                      </div>
                      </>
                      )}
                      {data.imageSrc && isAngleEditorOpen && (
                          <div className={`rounded-2xl border p-5 flex flex-col gap-4 ${isDark ? 'border-zinc-700 bg-[#202020]' : 'border-gray-200 bg-white shadow-xl'}`}>
                              <div className="flex items-center justify-between gap-3">
                                  <div className={`text-lg font-semibold ${isDark ? 'text-zinc-100' : 'text-gray-900'}`}>多角度编辑器</div>
                                  <button
                                      className={`w-9 h-9 rounded-lg flex items-center justify-center ${isDark ? 'hover:bg-zinc-800 text-zinc-400' : 'hover:bg-gray-100 text-gray-500'}`}
                                      onClick={() => setIsAngleEditorOpen(false)}
                                      title="收起"
                                  >
                                      <Icons.X size={22} />
                                  </button>
                              </div>
                              <div className="flex flex-wrap gap-3">
                                  {anglePresets.map(preset => {
                                      const active = anglePreset === preset.key;
                                      return (
                                          <button
                                              key={preset.key}
                                              className={`h-9 px-4 rounded-lg text-sm font-semibold border transition-all ${
                                                  active
                                                      ? (isDark ? 'bg-zinc-600 border-zinc-500 text-white' : 'bg-gray-900 border-gray-900 text-white')
                                                      : (isDark ? 'border-zinc-700 text-zinc-400 hover:text-white hover:border-zinc-600' : 'border-gray-200 text-gray-600 hover:text-gray-900 hover:border-gray-300')
                                              }`}
                                              onClick={() => applyAnglePreset(preset)}
                                          >
                                              {preset.label}
                                          </button>
                                      );
                                  })}
                              </div>
                              <div className="grid grid-cols-[360px_minmax(320px,1fr)] gap-6">
                                  <div
                                      ref={anglePadRef}
                                      className={`relative h-[360px] rounded-2xl overflow-hidden flex items-center justify-center cursor-grab active:cursor-grabbing touch-none ${isDark ? 'bg-zinc-800' : 'bg-gray-100'}`}
                                      onPointerDown={handleAnglePointerDown}
                                      onPointerMove={handleAnglePointerMove}
                                      onPointerUp={handleAnglePointerUp}
                                      onPointerCancel={handleAnglePointerUp}
                                      title="拖动预览图区域调整水平环绕和垂直俯仰"
                                  >
                                      <div className={`absolute inset-12 rounded-full border ${isDark ? 'border-zinc-500/60' : 'border-gray-400/60'}`} />
                                      <div className={`absolute inset-16 rounded-full border ${isDark ? 'border-zinc-500/40' : 'border-gray-400/40'}`} />
                                      <div className={`absolute left-1/2 top-12 bottom-12 w-px ${isDark ? 'bg-zinc-500/40' : 'bg-gray-400/40'}`} />
                                      <div className={`absolute top-1/2 left-12 right-12 h-px ${isDark ? 'bg-zinc-500/40' : 'bg-gray-400/40'}`} />
                                      <div className={`absolute top-1/2 left-14 right-14 h-px rounded-full ${isDark ? 'bg-zinc-500/40' : 'bg-gray-400/40'}`} style={{ transform: `rotate(${pitch / 2}deg)` }} />
                                      <div className={`absolute left-1/2 top-14 bottom-14 w-px rounded-full ${isDark ? 'bg-zinc-500/40' : 'bg-gray-400/40'}`} style={{ transform: `rotate(${yaw / 8}deg)` }} />
                                      <button className={`absolute left-8 top-1/2 -translate-y-1/2 z-20 ${isDark ? 'text-zinc-400' : 'text-gray-500'}`} onPointerDown={(event) => event.stopPropagation()} onClick={() => setYaw(v => Math.max(-180, v - 15))}>‹</button>
                                      <button className={`absolute right-8 top-1/2 -translate-y-1/2 z-20 ${isDark ? 'text-zinc-400' : 'text-gray-500'}`} onPointerDown={(event) => event.stopPropagation()} onClick={() => setYaw(v => Math.min(180, v + 15))}>›</button>
                                      <button className={`absolute top-8 left-1/2 -translate-x-1/2 z-20 ${isDark ? 'text-zinc-400' : 'text-gray-500'}`} onPointerDown={(event) => event.stopPropagation()} onClick={() => setPitch(v => Math.min(90, v + 10))}>⌃</button>
                                      <button className={`absolute bottom-8 left-1/2 -translate-x-1/2 z-20 ${isDark ? 'text-zinc-400' : 'text-gray-500'}`} onPointerDown={(event) => event.stopPropagation()} onClick={() => setPitch(v => Math.max(-90, v - 10))}>⌄</button>
                                      <div
                                          className={`absolute z-10 w-3 h-3 rounded-full border ${isDark ? 'border-white/70 bg-white/20' : 'border-gray-700/60 bg-gray-900/10'}`}
                                          style={{
                                              left: `${50 + (yaw / 180) * 34}%`,
                                              top: `${50 - (pitch / 90) * 34}%`,
                                              transform: 'translate(-50%, -50%)',
                                          }}
                                      />
                                      <img
                                          src={data.imageSrc}
                                          className="absolute z-10 max-w-[145px] max-h-[145px] object-contain rounded-lg shadow-2xl transition-[transform,left,top] duration-150 pointer-events-none"
                                          draggable={false}
                                          style={{
                                              left: `${50 + (yaw / 180) * 34}%`,
                                              top: `${50 - (pitch / 90) * 34}%`,
                                              transform: `translate(-50%, -50%) perspective(700px) rotateY(${yaw / 5}deg) rotateX(${-pitch / 5}deg) scale(${zoom === 'wide' ? 0.82 : zoom === 'close' ? 1.18 : 1})`,
                                          }}
                                      />
                                  </div>
                                  <div className="flex flex-col gap-5 justify-center">
                                      {[
                                          { label: '水平环绕', value: yaw, min: -180, max: 180, setter: setYaw, suffix: '°' },
                                          { label: '垂直俯仰', value: pitch, min: -90, max: 90, setter: setPitch, suffix: '°' },
                                      ].map(item => (
                                          <div key={item.label} className="grid grid-cols-[90px_1fr_50px] items-center gap-4">
                                              <span className={`text-sm ${isDark ? 'text-zinc-400' : 'text-gray-500'}`}>{item.label}</span>
                                              <input
                                                  type="range"
                                                  min={item.min}
                                                  max={item.max}
                                                  value={item.value}
                                                  onChange={(event) => {
                                                      setAnglePreset('custom');
                                                      item.setter(Number(event.target.value));
                                                  }}
                                                  className="w-full accent-white"
                                              />
                                              <span className={`text-sm font-semibold text-right ${isDark ? 'text-zinc-100' : 'text-gray-900'}`}>{item.value}{item.suffix}</span>
                                          </div>
                                      ))}
                                      <div className="grid grid-cols-[90px_1fr_50px] items-center gap-4">
                                          <span className={`text-sm ${isDark ? 'text-zinc-400' : 'text-gray-500'}`}>景别缩放</span>
                                          <div className={`h-9 rounded-lg border p-0.5 flex items-center ${isDark ? 'border-zinc-700 bg-zinc-950/30' : 'border-gray-200 bg-white'}`}>
                                              {[
                                                  { value: 'wide' as const, label: '全景' },
                                                  { value: 'medium' as const, label: '中景' },
                                                  { value: 'close' as const, label: '近景' },
                                              ].map(item => (
                                                  <button
                                                      key={item.value}
                                                      className={`flex-1 h-7 rounded-md text-xs font-semibold transition-colors ${zoom === item.value ? 'bg-zinc-100 text-zinc-950' : (isDark ? 'text-zinc-400 hover:text-white' : 'text-gray-500 hover:text-gray-900')}`}
                                                      onClick={() => { setAnglePreset('custom'); setZoom(item.value); }}
                                                  >
                                                      {item.label}
                                                  </button>
                                              ))}
                                          </div>
                                          <span className={`text-sm font-semibold text-right ${isDark ? 'text-zinc-100' : 'text-gray-900'}`}>{zoom === 'wide' ? '全景' : zoom === 'close' ? '近景' : '中景'}</span>
                                      </div>
                                      <div className="grid grid-cols-[90px_1fr] items-center gap-4">
                                          <span className={`text-sm ${isDark ? 'text-zinc-400' : 'text-gray-500'}`}>提示词</span>
                                          <button
                                              className={`relative w-10 h-5 rounded-full transition-colors ${showAnglePrompt ? 'bg-cyan-500' : (isDark ? 'bg-zinc-700' : 'bg-gray-300')}`}
                                              onClick={() => setShowAnglePrompt(value => !value)}
                                              title="展开补充提示词"
                                          >
                                              <span className={`absolute top-0.5 w-4 h-4 rounded-full bg-white transition-transform ${showAnglePrompt ? 'translate-x-5' : 'translate-x-0.5'}`} />
                                          </button>
                                      </div>
                                      <div className="flex flex-wrap items-center gap-2">
                                          <LocalCustomDropdown icon={Icons.Crop} options={angleAspectOptions} value={angleAspectRatio} onChange={(val: any) => setAngleAspectRatio(val)} isOpen={activeDropdown === 'angleAspect'} onToggle={() => setActiveDropdown(activeDropdown === 'angleAspect' ? null : 'angleAspect')} onClose={() => setActiveDropdown(null)} isDark={isDark} />
                                          <div className={`h-8 rounded-lg border p-0.5 flex items-center ${isDark ? 'border-zinc-700 bg-zinc-950/30' : 'border-gray-200 bg-white'}`}>
                                              {backgroundOptions.map(item => (
                                                  <button key={item.value} className={`h-6 px-2.5 rounded-md text-[11px] font-semibold transition-colors ${angleBackground === item.value ? 'bg-blue-600 text-white' : (isDark ? 'text-zinc-400 hover:text-white' : 'text-gray-500 hover:text-gray-900')}`} onClick={() => setAngleBackground(item.value)}>{item.label}</button>
                                              ))}
                                          </div>
                                          <div className={`h-8 rounded-lg border p-0.5 flex items-center ${isDark ? 'border-zinc-700 bg-zinc-950/30' : 'border-gray-200 bg-white'}`}>
                                              {consistencyOptions.map(item => (
                                                  <button key={item.value} className={`h-6 px-2.5 rounded-md text-[11px] font-semibold transition-colors ${angleConsistency === item.value ? 'bg-blue-600 text-white' : (isDark ? 'text-zinc-400 hover:text-white' : 'text-gray-500 hover:text-gray-900')}`} onClick={() => setAngleConsistency(item.value)}>{item.label}</button>
                                              ))}
                                          </div>
                                      </div>
                                  </div>
                              </div>
                              {showAnglePrompt && (
                                  <textarea
                                      className={`w-full border rounded-xl px-3 py-2 text-xs leading-relaxed resize-none focus:outline-none focus:ring-2 focus:ring-cyan-500/20 min-h-[58px] no-scrollbar transition-all ${inputBg}`}
                                      placeholder="补充材质、光线、风格要求，例如：保持场景空间关系、电影感光线、不要改变建筑布局..."
                                      value={anglePrompt}
                                      onChange={(event) => setAnglePrompt(event.target.value)}
                                      onWheel={(event) => event.stopPropagation()}
                                  />
                              )}
                              <div className="flex items-center justify-between">
                                  <button className={`h-8 px-3 rounded-lg text-sm flex items-center gap-2 ${isDark ? 'text-zinc-400 hover:text-white' : 'text-gray-500 hover:text-gray-900'}`} onClick={() => { setAnglePreset('custom'); setYaw(0); setPitch(0); setZoom('medium'); setAnglePrompt(''); }}>
                                      <Icons.RotateCcw size={15} />
                                      <span>重置参数</span>
                                  </button>
                                  <button className={`w-12 h-12 rounded-xl flex items-center justify-center transition-all ${data.isLoading ? 'bg-gray-400 text-white cursor-not-allowed' : 'bg-white text-zinc-950 hover:bg-cyan-100 shadow-lg'}`} disabled={data.isLoading} onClick={handleMultiAngleGenerate} title="生成多角度图片">
                                      {data.isLoading ? <Icons.Loader2 size={22} className="animate-spin" /> : <Icons.ArrowUp size={26} />}
                                  </button>
                              </div>
                          </div>
                      )}
                 </div>
            </div>
        )}
      </>
    );
};
