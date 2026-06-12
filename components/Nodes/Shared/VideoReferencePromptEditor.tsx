import React, { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import type { InputMedia, VideoGenerationMode, VideoPromptReference } from '../../../types';
import { Icons } from '../../Icons';

const MEDIA_LABELS = {
    image: '图片',
    video: '视频',
    audio: '音频',
} as const;

const getReferenceId = (item: InputMedia) =>
    item.id || `${item.sourceNodeId || 'media'}:${item.type}:${item.url}`;

const toReference = (item: InputMedia): VideoPromptReference => ({
    id: getReferenceId(item),
    sourceNodeId: item.sourceNodeId || getReferenceId(item),
    type: item.type as VideoPromptReference['type'],
    url: item.url,
    title: item.title,
});

const ReferencePreview: React.FC<{ reference: VideoPromptReference; invalid?: boolean }> = ({ reference, invalid }) => {
    if (reference.type === 'image') {
        return <img src={reference.url} className="h-7 w-7 rounded-md object-cover" draggable={false} />;
    }
    if (reference.type === 'video') {
        return (
            <span className="relative h-7 w-7 overflow-hidden rounded-md bg-black">
                <video src={reference.url} className="h-full w-full object-cover" muted preload="metadata" />
                <Icons.Play size={10} className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 text-white" fill="currentColor" />
            </span>
        );
    }
    return (
        <span className={`flex h-7 w-7 items-center justify-center rounded-md ${invalid ? 'bg-red-500/15 text-red-300' : 'bg-violet-500/15 text-violet-300'}`}>
            <Icons.Music size={14} />
        </span>
    );
};

interface VideoReferencePromptEditorProps {
    value: string;
    onChange: (value: string) => void;
    references: VideoPromptReference[] | undefined;
    onReferencesChange: (references: VideoPromptReference[]) => void;
    inputMedia: InputMedia[];
    mode: VideoGenerationMode;
    placeholder: string;
    isDark: boolean;
    allowExpand?: boolean;
}

export const VideoReferencePromptEditor: React.FC<VideoReferencePromptEditorProps> = ({
    value,
    onChange,
    references,
    onReferencesChange,
    inputMedia,
    mode,
    placeholder,
    isDark,
    allowExpand = true,
}) => {
    const textareaRef = useRef<HTMLTextAreaElement>(null);
    const [mentionStart, setMentionStart] = useState<number | null>(null);
    const [query, setQuery] = useState('');
    const [activeIndex, setActiveIndex] = useState(0);
    const [isExpanded, setIsExpanded] = useState(false);

    const allowedTypes = useMemo(() => {
        if (mode === 'image') return new Set<InputMedia['type']>(['image']);
        if (mode === 'omni') return new Set<InputMedia['type']>(['image', 'video', 'audio']);
        return new Set<InputMedia['type']>();
    }, [mode]);

    const availableMedia = useMemo(() => {
        const seen = new Set<string>();
        return inputMedia.filter(item => {
            if (!allowedTypes.has(item.type)) return false;
            const id = getReferenceId(item);
            if (seen.has(id)) return false;
            seen.add(id);
            return true;
        });
    }, [allowedTypes, inputMedia]);

    const filteredMedia = useMemo(() => {
        const normalizedQuery = query.trim().toLowerCase();
        return availableMedia.filter(item => {
            if (!normalizedQuery) return true;
            return `${item.title || ''} ${MEDIA_LABELS[item.type as keyof typeof MEDIA_LABELS] || ''}`
                .toLowerCase()
                .includes(normalizedQuery);
        });
    }, [availableMedia, query]);

    useEffect(() => {
        setActiveIndex(0);
    }, [query, mode]);

    const closeMention = () => {
        setMentionStart(null);
        setQuery('');
        setActiveIndex(0);
    };

    const handleTextChange = (nextValue: string, caret: number) => {
        onChange(nextValue);
        if (allowedTypes.size === 0) {
            closeMention();
            return;
        }

        const beforeCaret = nextValue.slice(0, caret);
        const match = beforeCaret.match(/@([^\s@]*)$/);
        if (!match) {
            closeMention();
            return;
        }
        setMentionStart(caret - match[0].length);
        setQuery(match[1]);
    };

    const selectMedia = (item: InputMedia) => {
        const nextReference = toReference(item);
        const existing = references || [];
        if (!existing.some(reference => reference.id === nextReference.id)) {
            onReferencesChange([...existing, nextReference]);
        }

        if (mentionStart !== null) {
            const textarea = textareaRef.current;
            const caret = textarea?.selectionStart ?? value.length;
            const nextValue = `${value.slice(0, mentionStart)}${value.slice(caret)}`;
            onChange(nextValue);
            window.setTimeout(() => {
                textarea?.focus();
                textarea?.setSelectionRange(mentionStart, mentionStart);
            }, 0);
        }
        closeMention();
    };

    const groupedMedia = useMemo(() => {
        return (['image', 'video', 'audio'] as const)
            .map(type => ({ type, items: filteredMedia.filter(item => item.type === type) }))
            .filter(group => group.items.length > 0);
    }, [filteredMedia]);

    const selectedIds = new Set((references || []).map(reference => reference.id));
    const connectedIds = new Set(inputMedia.map(getReferenceId));
    const connectedMediaById = new Map(inputMedia.map(item => [getReferenceId(item), item]));
    const visibleReferences = (references || []).filter(reference => allowedTypes.has(reference.type));
    const showMention = mentionStart !== null;
    const border = isDark ? 'border-zinc-700 bg-zinc-800/80 text-zinc-100' : 'border-gray-200 bg-gray-50 text-gray-900';

    return (
        <div className="relative">
            <div className={`min-h-[112px] rounded-xl border px-3 py-2.5 transition-colors focus-within:border-[#4446CE] focus-within:ring-2 focus-within:ring-[#4446CE]/20 ${border}`}>
                {allowExpand && (
                    <button
                        type="button"
                        className={`absolute right-2 top-2 z-10 flex h-6 w-6 items-center justify-center rounded-md border ${
                            isDark ? 'border-zinc-700 bg-zinc-800 text-zinc-400 hover:text-white' : 'border-gray-200 bg-white text-gray-500 hover:text-gray-900'
                        }`}
                        title="展开编辑"
                        onClick={() => setIsExpanded(true)}
                    >
                        <Icons.Maximize2 size={12} />
                    </button>
                )}
                {visibleReferences.length > 0 && (
                    <div className="mb-2 flex flex-wrap gap-1.5">
                        {visibleReferences.map(reference => {
                            const invalid = !connectedIds.has(reference.id);
                            const connectedItem = connectedMediaById.get(reference.id);
                            const displayReference = connectedItem ? toReference(connectedItem) : reference;
                            return (
                                <span
                                    key={reference.id}
                                    className={`inline-flex h-9 max-w-[190px] items-center gap-2 rounded-lg border pl-1 pr-1.5 text-[11px] font-semibold ${
                                        invalid
                                            ? 'border-red-500/30 bg-red-500/10 text-red-300'
                                            : isDark
                                                ? 'border-zinc-600 bg-zinc-900/80 text-zinc-200'
                                                : 'border-gray-200 bg-white text-gray-700'
                                    }`}
                                    title={invalid ? '素材连接已断开' : displayReference.title || MEDIA_LABELS[displayReference.type]}
                                >
                                    <ReferencePreview reference={displayReference} invalid={invalid} />
                                    <span className="truncate">{displayReference.title || MEDIA_LABELS[displayReference.type]}</span>
                                    {invalid && <Icons.AlertCircle size={12} className="shrink-0" />}
                                    <button
                                        type="button"
                                        className="flex h-5 w-5 shrink-0 items-center justify-center rounded hover:bg-white/10"
                                        title="移除引用"
                                        onClick={() => onReferencesChange((references || []).filter(item => item.id !== reference.id))}
                                    >
                                        <Icons.X size={11} />
                                    </button>
                                </span>
                            );
                        })}
                    </div>
                )}
                <textarea
                    ref={textareaRef}
                    className="block min-h-[68px] w-full resize-none bg-transparent text-sm leading-relaxed outline-none placeholder:text-zinc-500"
                    value={value}
                    placeholder={placeholder}
                    onChange={event => handleTextChange(event.target.value, event.target.selectionStart)}
                    onKeyDown={event => {
                        if (!showMention) return;
                        if (event.key === 'ArrowDown') {
                            event.preventDefault();
                            setActiveIndex(index => Math.min(filteredMedia.length - 1, index + 1));
                        } else if (event.key === 'ArrowUp') {
                            event.preventDefault();
                            setActiveIndex(index => Math.max(0, index - 1));
                        } else if (event.key === 'Enter' && filteredMedia[activeIndex]) {
                            event.preventDefault();
                            selectMedia(filteredMedia[activeIndex]);
                        } else if (event.key === 'Escape') {
                            event.preventDefault();
                            closeMention();
                        }
                    }}
                    onMouseDown={event => event.stopPropagation()}
                    onWheelCapture={event => event.stopPropagation()}
                />
                {allowedTypes.size > 0 && (
                    <div className={`mt-1 text-[10px] ${isDark ? 'text-zinc-500' : 'text-gray-400'}`}>
                        输入 @ 引用当前节点已连接的{mode === 'image' ? '图片' : '图片、视频或音频'}
                    </div>
                )}
            </div>

            {showMention && (
                <div
                    className={`absolute left-2 top-[calc(100%-8px)] z-[160] w-[330px] overflow-hidden rounded-xl border shadow-2xl ${
                        isDark ? 'border-zinc-700 bg-[#202020] text-zinc-100' : 'border-gray-200 bg-white text-gray-900'
                    }`}
                    onMouseDown={event => event.stopPropagation()}
                >
                    <div className={`flex items-center gap-2 border-b px-3 py-2 text-xs ${isDark ? 'border-zinc-800 text-zinc-400' : 'border-gray-100 text-gray-500'}`}>
                        <Icons.Search size={13} />
                        <span>{query ? `搜索“${query}”` : '选择当前节点已连接的素材'}</span>
                    </div>
                    <div className="custom-scrollbar max-h-[260px] overflow-y-auto p-1.5">
                        {groupedMedia.length === 0 ? (
                            <div className={`px-3 py-6 text-center text-xs ${isDark ? 'text-zinc-500' : 'text-gray-400'}`}>
                                没有可引用的素材
                            </div>
                        ) : groupedMedia.map(group => (
                            <div key={group.type}>
                                <div className={`px-2 py-1 text-[10px] font-bold ${isDark ? 'text-zinc-500' : 'text-gray-400'}`}>
                                    {MEDIA_LABELS[group.type]}
                                </div>
                                {group.items.map(item => {
                                    const flatIndex = filteredMedia.indexOf(item);
                                    const reference = toReference(item);
                                    const selected = selectedIds.has(reference.id);
                                    return (
                                        <button
                                            key={reference.id}
                                            type="button"
                                            className={`flex w-full items-center gap-2 rounded-lg px-2 py-2 text-left transition-colors ${
                                                flatIndex === activeIndex
                                                    ? 'bg-[#4446CE]/20 text-[#B9BAFF]'
                                                    : isDark ? 'hover:bg-zinc-800' : 'hover:bg-gray-100'
                                            }`}
                                            onMouseEnter={() => setActiveIndex(flatIndex)}
                                            onClick={() => selectMedia(item)}
                                        >
                                            <ReferencePreview reference={reference} />
                                            <span className="min-w-0 flex-1 truncate text-xs font-medium">{item.title || MEDIA_LABELS[group.type]}</span>
                                            {selected && <Icons.Check size={13} className="text-[#8F91F4]" />}
                                        </button>
                                    );
                                })}
                            </div>
                        ))}
                    </div>
                </div>
            )}
            {allowExpand && isExpanded && createPortal(
                <div
                    className="fixed inset-0 z-[1000] flex items-center justify-center bg-black/60 p-6 backdrop-blur-sm"
                    onMouseDown={() => setIsExpanded(false)}
                >
                    <div
                        className={`flex h-[min(680px,calc(100vh-48px))] w-[min(960px,calc(100vw-48px))] flex-col rounded-2xl border p-4 shadow-2xl ${
                            isDark ? 'border-zinc-700 bg-[#1b1b1b]' : 'border-gray-200 bg-white'
                        }`}
                        onMouseDown={event => event.stopPropagation()}
                    >
                        <div className="mb-3 flex items-center justify-between">
                            <span className={`text-sm font-semibold ${isDark ? 'text-zinc-100' : 'text-gray-900'}`}>编辑视频提示词</span>
                            <button
                                type="button"
                                className={`flex h-8 w-8 items-center justify-center rounded-lg ${isDark ? 'text-zinc-400 hover:bg-zinc-800 hover:text-white' : 'text-gray-500 hover:bg-gray-100'}`}
                                onClick={() => setIsExpanded(false)}
                            >
                                <Icons.X size={16} />
                            </button>
                        </div>
                        <div className="min-h-0 flex-1">
                            <VideoReferencePromptEditor
                                value={value}
                                onChange={onChange}
                                references={references}
                                onReferencesChange={onReferencesChange}
                                inputMedia={inputMedia}
                                mode={mode}
                                placeholder={placeholder}
                                isDark={isDark}
                                allowExpand={false}
                            />
                        </div>
                    </div>
                </div>,
                document.body,
            )}
        </div>
    );
};
