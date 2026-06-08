import React, { useEffect, useRef, useState } from 'react';
import { InputMedia, NodeData } from '../../types';
import { Icons } from '../Icons';
import { LocalCustomDropdown, LocalInputThumbnails, LocalPromptTextarea } from './Shared/LocalNodeComponents';

interface CreativeDescNodeProps {
  data: NodeData;
  updateData: (id: string, updates: Partial<NodeData>) => void;
  onGenerate: (id: string) => void;
  onAnalyzeMedia?: (id: string) => void;
  onAnalyzeScript?: (id: string) => void;
  onPreviewReference?: (item: InputMedia) => void;
  selected?: boolean;
  showControls?: boolean;
  isDark?: boolean;
  isSelecting?: boolean;
  inputMedia?: InputMedia[];
  canvasScale?: number;
}

const TEXT_MODELS = ['Xiaomi MiMo 2.5 Pro', 'Xiaomi MiMo 2.5', 'Prompt Helper'];

export const CreativeDescNode: React.FC<CreativeDescNodeProps> = ({
    data, updateData, onGenerate, onAnalyzeMedia, onAnalyzeScript, onPreviewReference, selected, showControls, isDark = true, isSelecting, inputMedia = [], canvasScale = 1
}) => {
    const [activeDropdown, setActiveDropdown] = useState<string | null>(null);
    const [isEditingBody, setIsEditingBody] = useState(false);
    const bodyInputRef = useRef<HTMLTextAreaElement>(null);
    const isSelectedAndStable = selected && showControls && !isSelecting;
    const titleColor = isDark ? 'text-zinc-300' : 'text-gray-700';
    const containerBg = isDark ? 'bg-[#1f1f1f]' : 'bg-white';
    const border = selected
        ? (isDark ? 'border-zinc-400 ring-2 ring-zinc-400/20' : 'border-gray-500 ring-2 ring-gray-400/20')
        : (isDark ? 'border-zinc-600' : 'border-gray-300');
    const inputText = isDark ? 'text-zinc-200 placeholder-zinc-500' : 'text-gray-800 placeholder-gray-400';
    const panelBg = isDark ? 'bg-[#202020]/95 border-zinc-700 text-zinc-200' : 'bg-white/95 border-gray-200 text-gray-900 shadow-xl';
    const actionButton = isDark
        ? 'border-zinc-700 text-zinc-300 hover:bg-zinc-800 hover:text-white'
        : 'border-gray-200 text-gray-600 hover:bg-gray-100 hover:text-gray-900';
    const disabledButton = 'opacity-45 cursor-not-allowed hover:bg-transparent';
    const mediaInputCount = inputMedia.filter(item => item.type === 'image' || item.type === 'video').length;
    const creditLabel = data.creditStatus === 'reserved'
        ? '已预扣'
        : data.creditStatus === 'confirmed'
            ? '已扣减'
            : data.creditStatus === 'refunded'
                ? '已返还'
                : '预计';
    // Panel stays a constant screen size while zooming via the --panel-inverse-scale CSS var,
    // so zoom no longer re-renders the node (heavy base64 media stays off the hot path).
    const panelTransform: React.CSSProperties = {
        transform: 'translateX(-50%) scale(var(--panel-inverse-scale, 1))',
        transformOrigin: 'top center',
    };

    useEffect(() => {
        if (isEditingBody) {
            bodyInputRef.current?.focus();
        }
    }, [isEditingBody]);

    useEffect(() => {
        if (!selected) {
            setIsEditingBody(false);
        }
    }, [selected]);

    return (
        <>
            <div className="absolute bottom-full left-4 mb-3 flex items-center gap-2 pointer-events-auto">
                <Icons.FileText size={18} className={titleColor} />
                <input
                    value={data.title || 'Text'}
                    onChange={(event) => updateData(data.id, { title: event.target.value })}
                    className={`w-44 bg-transparent border-none outline-none text-lg font-semibold ${titleColor}`}
                    onMouseDown={(event) => event.stopPropagation()}
                    onWheel={(event) => event.stopPropagation()}
                />
            </div>

            <div className={`w-full h-full relative rounded-[32px] border-[3px] ${border} ${containerBg} shadow-xl overflow-hidden transition-colors`}>
                {isEditingBody ? (
                    <textarea
                        ref={bodyInputRef}
                        className={`w-full h-full resize-none bg-transparent px-10 py-10 text-3xl leading-relaxed outline-none no-scrollbar ${inputText}`}
                        placeholder="双击开始编辑..."
                        value={data.prompt || ''}
                        onChange={(event) => updateData(data.id, { prompt: event.target.value })}
                        onMouseDown={(event) => event.stopPropagation()}
                        onWheel={(event) => event.stopPropagation()}
                        onBlur={() => setIsEditingBody(false)}
                        onKeyDown={(event) => {
                            if (event.key === 'Escape') {
                                setIsEditingBody(false);
                            }
                        }}
                    />
                ) : (
                    <div
                        className={`w-full h-full px-10 py-10 text-3xl leading-relaxed whitespace-pre-wrap break-words select-none ${data.prompt ? inputText : isDark ? 'text-zinc-500' : 'text-gray-400'}`}
                        onDoubleClick={(event) => {
                            event.stopPropagation();
                            setIsEditingBody(true);
                        }}
                    >
                        {data.prompt || '双击开始编辑...'}
                    </div>
                )}

                {data.isLoading && (
                    <div className="absolute inset-0 bg-black/45 backdrop-blur-sm flex flex-col items-center justify-center z-20">
                        <Icons.Loader2 size={34} className="text-zinc-100 animate-spin mb-3" />
                        <span className="text-zinc-100 text-sm font-medium">生成中...</span>
                    </div>
                )}
            </div>

            {isSelectedAndStable && (
                <div className="absolute top-full left-1/2 min-w-[760px] pt-7 z-[70] pointer-events-auto" style={panelTransform} onMouseDown={(event) => event.stopPropagation()}>
                    {inputMedia.length > 0 && <LocalInputThumbnails inputs={[]} items={inputMedia} ready={true} isDark={isDark} label="参考内容" onPreview={onPreviewReference} />}
                    <div className={`${panelBg} rounded-[22px] border p-4 flex flex-col gap-4`}>
                        <LocalPromptTextarea
                            className={`w-full min-h-[96px] resize-none bg-transparent text-base leading-relaxed outline-none ${inputText}`}
                            placeholder="描述任何你想要生成的内容"
                            value={data.prompt || ''}
                            onChange={(value) => updateData(data.id, { prompt: value })}
                            isDark={isDark}
                            expandedTitle="编辑创意描述"
                        />
                        <div className="flex items-center gap-3">
                            <LocalCustomDropdown
                                options={TEXT_MODELS}
                                value={data.model || TEXT_MODELS[0]}
                                onChange={(value: string) => updateData(data.id, { model: value })}
                                isOpen={activeDropdown === 'model'}
                                onToggle={() => setActiveDropdown(activeDropdown === 'model' ? null : 'model')}
                                onClose={() => setActiveDropdown(null)}
                                align="left"
                                width="w-[190px]"
                                isDark={isDark}
                            />
                            <button
                                onClick={() => onAnalyzeMedia?.(data.id)}
                                disabled={data.isLoading || mediaInputCount === 0}
                                className={`h-8 px-3 rounded-lg border text-xs font-medium flex items-center gap-2 transition-colors ${actionButton} ${mediaInputCount === 0 ? disabledButton : ''}`}
                                title={mediaInputCount === 0 ? '连接图片或视频节点后可分析' : '分析前置图片/视频并生成复刻提示词或分镜表'}
                            >
                                <Icons.Scan size={14} />
                                媒体分析
                            </button>
                            <button
                                onClick={() => onAnalyzeScript?.(data.id)}
                                disabled={data.isLoading || !data.prompt?.trim()}
                                className={`h-8 px-3 rounded-lg border text-xs font-medium flex items-center gap-2 transition-colors ${actionButton} ${!data.prompt?.trim() ? disabledButton : ''}`}
                                title="基于剧本生成角色资产表"
                            >
                                <Icons.BookOpen size={14} />
                                角色表
                            </button>
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
                                {data.creditEstimate || 1}分
                            </div>
                            <button
                                className={`w-8 h-8 rounded-lg flex items-center justify-center ${isDark ? 'text-zinc-300 hover:bg-zinc-800' : 'text-gray-500 hover:bg-gray-100'}`}
                                title="语音输入"
                            >
                                <Icons.Mic size={16} />
                            </button>
                            <div className={`w-px h-6 ${isDark ? 'bg-zinc-700' : 'bg-gray-200'}`} />
                            <LocalCustomDropdown
                                options={[1, 2, 3, 4]}
                                value={data.count || 1}
                                onChange={(value: number) => updateData(data.id, { count: value })}
                                isOpen={activeDropdown === 'count'}
                                onToggle={() => setActiveDropdown(activeDropdown === 'count' ? null : 'count')}
                                onClose={() => setActiveDropdown(null)}
                                icon={Icons.Layers}
                                isDark={isDark}
                            />
                            <button
                                onClick={() => onGenerate(data.id)}
                                disabled={data.isLoading}
                                className={`h-10 w-10 rounded-full flex items-center justify-center transition-all ${
                                    data.isLoading
                                        ? 'bg-zinc-500 text-white cursor-wait'
                                        : isDark ? 'bg-zinc-200 text-zinc-900 hover:bg-white' : 'bg-gray-900 text-white hover:bg-black'
                                }`}
                                title="生成"
                            >
                                {data.isLoading ? <Icons.Loader2 size={18} className="animate-spin" /> : <Icons.ArrowUp size={20} />}
                            </button>
                        </div>
                    </div>

                    {data.optimizedPrompt && (
                        <div className={`${panelBg} mt-3 rounded-2xl border p-4 text-sm leading-relaxed`}>
                            {data.optimizedPrompt}
                        </div>
                    )}
                </div>
            )}
        </>
    );
};
