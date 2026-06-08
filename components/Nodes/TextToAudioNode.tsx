import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { InputMedia, NodeData } from '../../types';
import { Icons } from '../Icons';
import { getVisibleModels, MODEL_REGISTRY } from '../../services/geminiService';
import { LocalCustomDropdown, LocalEditableTitle, LocalInputThumbnails, LocalPromptTextarea } from './Shared/LocalNodeComponents';

interface TextToAudioNodeProps {
  data: NodeData;
  updateData: (id: string, updates: Partial<NodeData>) => void;
  onGenerate: (id: string) => void;
  selected?: boolean;
  showControls?: boolean;
  inputMedia?: InputMedia[];
  onPreviewReference?: (item: InputMedia) => void;
  onDownload?: (id: string) => void;
  onUpload?: (id: string) => void;
  isDark?: boolean;
  isSelecting?: boolean;
  canvasScale?: number;
}

const clampText = (value = '') => value.slice(0, 50000);

export const TextToAudioNode: React.FC<TextToAudioNodeProps> = ({
  data,
  updateData,
  onGenerate,
  selected,
  showControls,
  inputMedia = [],
  onPreviewReference,
  onDownload,
  onUpload,
  isDark = true,
  isSelecting,
  canvasScale = 1,
}) => {
  const [activeDropdown, setActiveDropdown] = useState<string | null>(null);
  const [audioModels, setAudioModels] = useState<string[]>([]);
  const isSelectedAndStable = selected && showControls && !isSelecting;
  const hasResult = Boolean(data.audioSrc) && !data.isLoading;
  const prompt = data.prompt || '';
  const charCount = prompt.length;
  // Panel stays a constant screen size while zooming via the --panel-inverse-scale CSS var,
  // so zoom no longer re-renders the node (heavy base64 media stays off the hot path).
  const panelTransform: React.CSSProperties = {
    transform: 'translateX(-50%) scale(var(--panel-inverse-scale, 1))',
    transformOrigin: 'top center',
  };

  const updateModels = useCallback(() => {
    const models = getVisibleModels().filter(key => MODEL_REGISTRY[key]?.category === 'AUDIO');
    setAudioModels(models.length ? models : ['Minimax-speech-2.8-hd']);
  }, []);

  useEffect(() => {
    updateModels();
    window.addEventListener('modelRegistryUpdated', updateModels);
    return () => window.removeEventListener('modelRegistryUpdated', updateModels);
  }, [updateModels]);

  const voiceOptions = useMemo(() => ['male-qn-qingse', 'female-shaonv', 'male-qn-jingying'], []);
  const speedOptions = useMemo(() => [0.8, 1, 1.2], []);

  const appendToken = (token: string) => {
    const next = clampText(`${prompt}${prompt.endsWith(' ') || !prompt ? '' : ' '}${token}`);
    updateData(data.id, { prompt: next });
  };

  const nodeBorder = selected
    ? (isDark ? 'border-zinc-400 ring-2 ring-zinc-400/20' : 'border-gray-500 ring-2 ring-gray-400/20')
    : (isDark ? 'border-zinc-600' : 'border-gray-300');
  const titleColor = isDark ? 'text-zinc-300' : 'text-gray-700';
  const panelBg = isDark ? 'bg-[#202020]/95 border-zinc-700 text-zinc-200' : 'bg-white/95 border-gray-200 text-gray-900 shadow-xl';
  const mutedText = isDark ? 'text-zinc-500' : 'text-gray-400';
  const inputText = isDark ? 'text-zinc-200 placeholder-zinc-500' : 'text-gray-800 placeholder-gray-400';
  const chipClass = isDark
    ? 'bg-zinc-700/80 text-zinc-100 hover:bg-zinc-600'
    : 'bg-gray-100 text-gray-700 hover:bg-gray-200';

  return (
    <>
      <div className="absolute bottom-full left-0 mb-3 flex items-center gap-2 pointer-events-auto">
        <Icons.Music size={18} className={titleColor} />
        <LocalEditableTitle
          title={data.title || '音频节点'}
          onUpdate={(title) => updateData(data.id, { title })}
          isDark={isDark}
        />
      </div>

      <div className={`relative h-full w-full overflow-hidden rounded-xl border-[3px] ${nodeBorder} ${isDark ? 'bg-[#222]' : 'bg-white'} shadow-xl transition-colors`}>
        {hasResult ? (
          <div className="flex h-full flex-col items-center justify-center gap-4 px-8">
            <div className={`h-14 w-14 rounded-2xl flex items-center justify-center ${isDark ? 'bg-zinc-800/80 text-zinc-300' : 'bg-gray-100 text-gray-500'}`}>
              <Icons.Volume2 size={26} />
            </div>
            <audio
              src={data.audioSrc}
              controls
              className="w-full max-w-[260px]"
              onMouseDown={(event) => event.stopPropagation()}
            />
            <button
              className={`h-8 rounded-lg px-3 text-xs font-semibold transition-all ${isDark ? 'bg-zinc-800 text-zinc-300 hover:bg-zinc-700 hover:text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200 hover:text-gray-900'}`}
              onClick={(event) => {
                event.stopPropagation();
                onDownload?.(data.id);
              }}
            >
              下载音频
            </button>
          </div>
        ) : (
          <div className={`flex h-full flex-col justify-center px-10 ${mutedText}`}>
            <div className={`absolute left-1/2 top-1/2 h-14 w-14 -translate-x-1/2 -translate-y-1/2 rounded-2xl flex items-center justify-center ${isDark ? 'bg-zinc-800/50 text-zinc-500' : 'bg-gray-100 text-gray-400'}`}>
              <Icons.Music size={26} className="opacity-60" />
            </div>
            <div className="relative z-10 mt-24 text-sm">
              <div className="mb-3">尝试:</div>
              <div className={`inline-flex items-center gap-2 text-sm font-semibold ${isDark ? 'text-zinc-100' : 'text-gray-800'}`}>
                <Icons.Volume2 size={15} />
                <span>音频生成</span>
              </div>
            </div>
          </div>
        )}

        {data.isLoading && (
          <div className="absolute inset-0 z-20 flex flex-col items-center justify-center bg-black/55 backdrop-blur-sm">
            <Icons.Loader2 size={32} className="mb-3 animate-spin text-blue-400" />
            <span className="text-sm font-medium text-white/85">语音生成中...</span>
          </div>
        )}
      </div>

      {isSelectedAndStable && (
        <div className="absolute top-full left-1/2 z-[70] min-w-[780px] pt-4 pointer-events-auto" style={panelTransform} onMouseDown={(event) => event.stopPropagation()}>
          {inputMedia.length > 0 && (
            <LocalInputThumbnails
              inputs={[]}
              items={inputMedia}
              ready={true}
              isDark={isDark}
              label="参考文本"
              onPreview={onPreviewReference}
            />
          )}
          <div className={`${panelBg} rounded-[22px] border p-4 flex flex-col gap-4`}>
            <LocalPromptTextarea
              className={`min-h-[124px] w-full resize-none bg-transparent text-lg leading-relaxed outline-none ${inputText}`}
              placeholder="输入要合成的文本"
              value={prompt}
              maxLength={50000}
              onChange={(value) => updateData(data.id, { prompt: clampText(value) })}
              isDark={isDark}
              expandedTitle="编辑音频文本"
            />

            <div className="flex flex-wrap items-center gap-2">
              <button
                className={`h-9 rounded-lg px-3 text-sm font-semibold transition-all ${chipClass}`}
                onClick={() => appendToken('<#0.5#>')}
                title="插入停顿标记"
              >
                {'<#> 停顿'}
              </button>
              <button
                className={`h-9 rounded-lg px-3 text-sm font-semibold transition-all ${chipClass}`}
                onClick={() => appendToken('（轻声）')}
                title="插入语气词提示"
              >
                {'() 语气词'}
              </button>
            </div>

            <div className="flex items-center gap-3">
              <LocalCustomDropdown
                options={audioModels}
                value={data.model || 'Minimax-speech-2.8-hd'}
                onChange={(value: string) => updateData(data.id, { model: value })}
                isOpen={activeDropdown === 'model'}
                onToggle={() => setActiveDropdown(activeDropdown === 'model' ? null : 'model')}
                onClose={() => setActiveDropdown(null)}
                align="left"
                width="w-[210px]"
                isDark={isDark}
              />
              <LocalCustomDropdown
                icon={Icons.Mic}
                options={voiceOptions}
                value={data.voiceId || voiceOptions[0]}
                onChange={(value: string) => updateData(data.id, { voiceId: value })}
                isOpen={activeDropdown === 'voice'}
                onToggle={() => setActiveDropdown(activeDropdown === 'voice' ? null : 'voice')}
                onClose={() => setActiveDropdown(null)}
                align="left"
                width="w-[180px]"
                isDark={isDark}
              />
              <LocalCustomDropdown
                icon={Icons.Sliders}
                options={speedOptions}
                value={data.voiceSpeed || 1}
                onChange={(value: number) => updateData(data.id, { voiceSpeed: value })}
                isOpen={activeDropdown === 'speed'}
                onToggle={() => setActiveDropdown(activeDropdown === 'speed' ? null : 'speed')}
                onClose={() => setActiveDropdown(null)}
                isDark={isDark}
              />
              <button
                className={`h-8 w-8 rounded-lg flex items-center justify-center transition-all ${isDark ? 'text-zinc-300 hover:bg-zinc-800' : 'text-gray-500 hover:bg-gray-100'}`}
                title="多语言/翻译设置"
              >
                <Icons.Languages size={17} />
              </button>
              <div className="flex-1" />
              <span className={`text-sm tabular-nums ${mutedText}`}>{charCount}/50000</span>
              <span className={`inline-flex h-8 items-center gap-1 rounded-lg px-2.5 text-sm font-semibold ${isDark ? 'text-zinc-400' : 'text-gray-500'}`}>
                <Icons.Zap size={13} />
                {data.creditEstimate || 1}
              </span>
              <button
                className={`h-11 w-11 rounded-full flex items-center justify-center transition-all ${
                  data.isLoading || !prompt.trim()
                    ? 'bg-zinc-500 text-white cursor-not-allowed'
                    : isDark ? 'bg-zinc-200 text-zinc-950 hover:bg-white' : 'bg-gray-900 text-white hover:bg-black'
                }`}
                onClick={() => onGenerate(data.id)}
                disabled={data.isLoading || !prompt.trim()}
                title={prompt.trim() ? '生成语音' : '请输入要合成的文本'}
              >
                {data.isLoading ? <Icons.Loader2 size={20} className="animate-spin" /> : <Icons.ArrowUp size={23} />}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
