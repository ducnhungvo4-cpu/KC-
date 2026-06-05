import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Icons } from './Icons';

interface VideoFrameExtractPanelProps {
  isOpen: boolean;
  videoSrc: string;
  isDark: boolean;
  onClose: () => void;
  onExtractFrame: (imageDataUrl: string, timeSeconds: number, videoWidth: number, videoHeight: number) => void;
}

const formatTime = (seconds: number): string => {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
};

export const VideoFrameExtractPanel: React.FC<VideoFrameExtractPanelProps> = ({
  isOpen, videoSrc, isDark, onClose, onExtractFrame,
}) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const timelineRef = useRef<HTMLDivElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [isDragging, setIsDragging] = useState(false);

  const MIN_FRAME_STEP = 1 / 24;

  const seekTo = useCallback((time: number) => {
    const video = videoRef.current;
    if (!video) return;
    const clamped = Math.max(0, Math.min(time, video.duration || 0));
    video.currentTime = clamped;
    setCurrentTime(clamped);
  }, []);

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft') {
        e.preventDefault();
        seekTo((videoRef.current?.currentTime || 0) - MIN_FRAME_STEP);
      } else if (e.key === 'ArrowRight') {
        e.preventDefault();
        seekTo((videoRef.current?.currentTime || 0) + MIN_FRAME_STEP);
      } else if (e.key === ' ') {
        e.preventDefault();
        togglePlay();
      } else if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, seekTo, onClose]);

  const togglePlay = () => {
    const video = videoRef.current;
    if (!video) return;
    if (video.paused) { video.play(); setIsPlaying(true); }
    else { video.pause(); setIsPlaying(false); }
  };

  const handleTimeUpdate = () => {
    if (!isDragging && videoRef.current) setCurrentTime(videoRef.current.currentTime);
  };

  const handleLoadedMetadata = () => {
    if (videoRef.current) {
      setDuration(videoRef.current.duration);
      videoRef.current.currentTime = 0;
      setCurrentTime(0);
    }
  };

  const handleTimelineInteraction = (clientX: number) => {
    const el = timelineRef.current;
    if (!el || !duration) return;
    const rect = el.getBoundingClientRect();
    const ratio = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
    const snappedTime = Math.round(ratio * duration);
    seekTo(snappedTime);
  };

  const handleTimelinePointerDown = (e: React.PointerEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
    const video = videoRef.current;
    if (video && !video.paused) { video.pause(); setIsPlaying(false); }
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    handleTimelineInteraction(e.clientX);
  };

  const handleTimelinePointerMove = (e: React.PointerEvent) => {
    if (!isDragging) return;
    handleTimelineInteraction(e.clientX);
  };

  const handleTimelinePointerUp = (e: React.PointerEvent) => {
    setIsDragging(false);
    if ((e.target as HTMLElement).hasPointerCapture(e.pointerId)) {
      (e.target as HTMLElement).releasePointerCapture(e.pointerId);
    }
  };

  const handleExtract = () => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas) return;
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.drawImage(video, 0, 0);
    const dataUrl = canvas.toDataURL('image/png');
    onExtractFrame(dataUrl, currentTime, video.videoWidth, video.videoHeight);
  };

  if (!isOpen) return null;

  const progress = duration > 0 ? (currentTime / duration) * 100 : 0;

  return (
    <div className="fixed inset-0 z-[260] flex items-center justify-center bg-black/70 backdrop-blur-sm" onClick={onClose}>
      <div
        className={`w-[560px] max-h-[85vh] rounded-2xl border flex flex-col overflow-hidden ${isDark ? 'bg-[#141416] border-zinc-700/60 text-zinc-100 shadow-[0_25px_60px_-12px_rgba(0,0,0,0.8)]' : 'bg-white border-gray-200 text-gray-900 shadow-[0_25px_60px_-12px_rgba(0,0,0,0.25)]'}`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header toolbar */}
        <div className={`flex items-center gap-1 px-3 py-2 border-b shrink-0 ${isDark ? 'border-zinc-800 bg-[#1a1a1e]' : 'border-gray-100 bg-gray-50'}`}>
          <div className={`h-8 px-3 rounded-lg text-xs font-semibold flex items-center gap-1.5 ${isDark ? 'text-zinc-500' : 'text-gray-400'}`}>
            <Icons.Subtitles size={14} />
            <span>视频去字幕</span>
          </div>
          <div className={`h-8 px-3 rounded-lg text-xs font-semibold flex items-center gap-1.5 ${isDark ? 'text-zinc-500' : 'text-gray-400'}`}>
            <Icons.TrendingUp size={14} />
            <span>视频增分</span>
          </div>
          <div className={`h-8 px-3 rounded-lg text-xs font-semibold flex items-center gap-1.5 ${isDark ? 'bg-blue-500/15 text-blue-300 ring-1 ring-blue-500/30' : 'bg-blue-50 text-blue-600 ring-1 ring-blue-200'}`}>
            <Icons.Frame size={14} />
            <span>视频截帧</span>
          </div>
          <div className="flex-1" />
          <button className={`h-8 px-3 rounded-lg text-xs font-semibold flex items-center gap-1.5 ${isDark ? 'text-zinc-500 hover:text-zinc-200' : 'text-gray-400 hover:text-gray-700'}`}>
            <Icons.Upload size={14} />
            <span>上传</span>
          </button>
          <button className={`h-8 px-3 rounded-lg text-xs font-semibold flex items-center gap-1.5 ${isDark ? 'text-zinc-500 hover:text-zinc-200' : 'text-gray-400 hover:text-gray-700'}`}>
            <Icons.Save size={14} />
            <span>保存</span>
          </button>
          <button className={`w-8 h-8 rounded-lg flex items-center justify-center transition-colors ${isDark ? 'hover:bg-zinc-800 text-zinc-500 hover:text-zinc-200' : 'hover:bg-gray-100 text-gray-400 hover:text-gray-700'}`} onClick={onClose}>
            <Icons.X size={16} />
          </button>
        </div>

        {/* Video area */}
        <div className={`relative flex-1 min-h-[300px] flex items-center justify-center ${isDark ? 'bg-black' : 'bg-gray-950'}`}>
          <video
            ref={videoRef}
            src={videoSrc}
            className="max-w-full max-h-full object-contain"
            onTimeUpdate={handleTimeUpdate}
            onLoadedMetadata={handleLoadedMetadata}
            onEnded={() => setIsPlaying(false)}
            preload="auto"
            playsInline
          />
          <canvas ref={canvasRef} className="hidden" />
        </div>

        {/* Player controls */}
        <div className={`px-4 py-3 border-t shrink-0 ${isDark ? 'border-zinc-800 bg-[#1a1a1e]' : 'border-gray-100 bg-gray-50'}`}>
          <div className="flex items-center gap-3">
            <button onClick={togglePlay} className={`w-9 h-9 rounded-full flex items-center justify-center transition-colors ${isDark ? 'bg-zinc-800 hover:bg-zinc-700 text-white' : 'bg-gray-200 hover:bg-gray-300 text-gray-900'}`}>
              {isPlaying ? <Icons.Pause size={16} fill="currentColor" /> : <Icons.Play size={16} fill="currentColor" />}
            </button>
            <span className={`text-xs font-mono tabular-nums ${isDark ? 'text-zinc-400' : 'text-gray-500'}`}>
              {formatTime(currentTime)} / {formatTime(duration)}
            </span>

            {/* Timeline */}
            <div
              ref={timelineRef}
              className={`flex-1 h-2 rounded-full cursor-pointer relative ${isDark ? 'bg-zinc-800' : 'bg-gray-200'}`}
              onPointerDown={handleTimelinePointerDown}
              onPointerMove={handleTimelinePointerMove}
              onPointerUp={handleTimelinePointerUp}
              onPointerCancel={handleTimelinePointerUp}
            >
              <div className="absolute inset-y-0 left-0 rounded-full bg-blue-500 transition-[width] duration-75" style={{ width: `${progress}%` }} />
              <div
                className="absolute top-1/2 -translate-y-1/2 w-4 h-4 rounded-full bg-blue-500 border-2 border-white shadow-lg transition-[left] duration-75"
                style={{ left: `calc(${progress}% - 8px)` }}
              />
            </div>

            <button onClick={() => seekTo(currentTime - MIN_FRAME_STEP)} className={`w-8 h-8 rounded-lg flex items-center justify-center ${isDark ? 'text-zinc-400 hover:text-white hover:bg-zinc-800' : 'text-gray-500 hover:text-gray-900 hover:bg-gray-200'}`} title="上一帧 (←)">
              <Icons.SkipBack size={14} />
            </button>
            <button onClick={() => seekTo(currentTime + MIN_FRAME_STEP)} className={`w-8 h-8 rounded-lg flex items-center justify-center ${isDark ? 'text-zinc-400 hover:text-white hover:bg-zinc-800' : 'text-gray-500 hover:text-gray-900 hover:bg-gray-200'}`} title="下一帧 (→)">
              <Icons.SkipForward size={14} />
            </button>
            <button className={`w-8 h-8 rounded-lg flex items-center justify-center ${isDark ? 'text-zinc-400 hover:text-white hover:bg-zinc-800' : 'text-gray-500 hover:text-gray-900 hover:bg-gray-200'}`} title="全屏">
              <Icons.Maximize2 size={14} />
            </button>
          </div>
        </div>

        {/* Extract controls */}
        <div className={`px-4 py-3 border-t flex items-center justify-between shrink-0 ${isDark ? 'border-zinc-800 bg-[#141416]' : 'border-gray-100 bg-white'}`}>
          <span className={`text-xs ${isDark ? 'text-zinc-500' : 'text-gray-400'}`}>拖动选择帧</span>
          <div className="flex items-center gap-4">
            <span className={`text-xs ${isDark ? 'text-zinc-400' : 'text-gray-500'}`}>
              当前帧：<span className="font-mono font-semibold">{formatTime(currentTime)}</span>
            </span>
            <button
              onClick={handleExtract}
              className="h-9 px-5 rounded-xl text-sm font-semibold bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-500 hover:to-blue-400 text-white shadow-lg shadow-blue-500/20 transition-all active:scale-[0.98]"
            >
              确定抽取该帧
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
