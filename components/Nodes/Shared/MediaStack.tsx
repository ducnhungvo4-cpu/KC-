
import React, { useRef, useEffect } from 'react';
import { NodeData } from '../../../types';
import { Icons } from '../../Icons';
import { VideoPreview } from './NodeComponents';

interface MediaStackProps {
    data: NodeData;
    updateData: (id: string, updates: Partial<NodeData>) => void;
    currentSrc: string | undefined;
    type: 'image' | 'video';
    onMaximize?: (id: string) => void;
    isDark?: boolean;
    selected?: boolean;
    onToggleFavorite?: (src: string, type: 'image' | 'video') => void;
    isFavorite?: (src: string) => boolean;
    onPreviewMedia?: (src: string, type: 'image' | 'video') => void;
}

export const MediaStack: React.FC<MediaStackProps> = ({ 
    data, updateData, currentSrc, type, isDark = true, selected, onPreviewMedia
}) => {
    const stackRef = useRef<HTMLDivElement>(null);
    const artifacts = data.outputArtifacts || [];
    const sortedArtifacts = currentSrc ? [currentSrc, ...artifacts.filter(a => a !== currentSrc)] : artifacts;
    const showBadge = !!selected && !data.isStackOpen && artifacts.length > 1;

    // Handle click outside to close stack
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (data.isStackOpen && stackRef.current && !stackRef.current.contains(event.target as Node)) {
                 updateData(data.id, { isStackOpen: false });
            }
        };
        if (data.isStackOpen) document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [data.isStackOpen, data.id, updateData]);

    // Close stack when deselected
    useEffect(() => {
        if (!selected && data.isStackOpen) updateData(data.id, { isStackOpen: false });
    }, [selected, data.isStackOpen, data.id, updateData]);

    if (data.isStackOpen) {
        return (
            <div ref={stackRef} className={`absolute left-1/2 top-10 z-[100] w-[560px] max-w-[calc(100vw-48px)] -translate-x-1/2 rounded-2xl border p-3 shadow-2xl backdrop-blur-xl animate-in fade-in zoom-in-95 duration-200 ${isDark ? 'border-zinc-700 bg-[#181818]/95' : 'border-gray-200 bg-white/95'}`} onMouseDown={(event) => event.stopPropagation()}>
                <div className="mb-2 flex items-center justify-between">
                    <span className={`text-xs font-semibold ${isDark ? 'text-zinc-200' : 'text-gray-800'}`}>历史版本</span>
                    <button className={`h-7 w-7 rounded-lg flex items-center justify-center ${isDark ? 'text-zinc-400 hover:bg-zinc-800 hover:text-white' : 'text-gray-500 hover:bg-gray-100 hover:text-gray-900'}`} onClick={(e) => { e.stopPropagation(); updateData(data.id, { isStackOpen: false }); }}><Icons.X size={16} /></button>
                </div>
                <div className="grid grid-cols-5 gap-2">
                    {sortedArtifacts.map((src, index) => {
                    const isMain = index === 0;
                    return (
                      <div key={src + index} className={`relative aspect-square overflow-hidden rounded-xl border group/card ${isMain ? 'border-cyan-400 ring-1 ring-cyan-400/40' : (isDark ? 'border-zinc-700 bg-black' : 'border-gray-200 bg-white')}`}>
                           <button
                               className="absolute inset-0"
                               title={type === 'image' ? '查看原图' : '查看视频'}
                               onClick={(e) => {
                                   e.stopPropagation();
                                   onPreviewMedia?.(src, type);
                               }}
                           >
                           {type === 'image' ? (
                               <img src={src} className={`h-full w-full object-cover ${isDark ? 'bg-[#09090b]' : 'bg-gray-50'}`} draggable={false} />
                           ) : (
                               <video src={src} className="h-full w-full object-cover" muted playsInline preload="metadata" />
                           )}
                           </button>
                           <div className="absolute left-1.5 top-1.5 rounded bg-black/60 px-1.5 py-0.5 text-[9px] font-semibold text-white backdrop-blur-md">{isMain ? '当前' : `版本 ${index + 1}`}</div>
                           {!isMain && <button className="absolute bottom-1.5 left-1.5 right-1.5 h-6 rounded-md border border-white/10 bg-black/55 text-[10px] font-bold text-white shadow-sm backdrop-blur-md hover:bg-black/75" onClick={(e) => { e.stopPropagation(); const update = type === 'image' ? { imageSrc: src } : { videoSrc: src }; updateData(data.id, { ...update, isStackOpen: false }); }}>设为当前</button>}
                      </div>
                    );
                    })}
                </div>
            </div>
        );
    }
    
    // Improved detection logic: Use type prop first, then node type, then file extension. 
    // Avoid naive .includes('video') which flags signed URLs containing 'video' in hash.
    const isVideo = type === 'video' || data.type === 'TEXT_TO_VIDEO' || (currentSrc && /\.(mp4|webm|mov|mkv)(\?|$)/i.test(currentSrc));
    return (
        <>
           {isVideo ? (
               currentSrc && <VideoPreview src={currentSrc} isDark={isDark || false} />
           ) : (
               currentSrc && <img src={currentSrc} className={`w-full h-full object-contain pointer-events-none ${isDark ? 'bg-[#09090b]' : 'bg-gray-50'}`} alt="Generated" draggable={false} />
           )}
           {showBadge && (
               <div className="absolute left-1/2 top-2 z-30 flex -translate-x-1/2 cursor-pointer select-none items-center gap-1 rounded-full border border-white/10 bg-black/30 px-2 py-1 text-[10px] text-white shadow-lg backdrop-blur-md transition-colors hover:bg-black/50" onClick={(e) => { e.stopPropagation(); updateData(data.id, { isStackOpen: true }); }}>
                   <Icons.Layers size={10} className="text-cyan-400"/>
                   <span className="font-bold">版本</span>
                   <span className="font-bold tabular-nums">{artifacts.length}</span>
                   <Icons.ChevronRight size={10} className="text-zinc-400" />
               </div>
           )}

        </>
    );
};
