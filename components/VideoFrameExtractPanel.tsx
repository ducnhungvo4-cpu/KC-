import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Icons } from './Icons';

interface VideoFrameExtractPanelProps {
  isOpen: boolean;
  videoSrc: string;
  isDark: boolean;
  onClose: () => void;
  onExtractFrame: (imageDataUrl: string, timeSeconds: number, videoWidth: number, videoHeight: number) => void;
}

interface TimelineThumbnail {
  time: number;
  url: string;
}

const formatTime = (seconds: number): string => {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
};

const waitForEvent = (target: EventTarget, eventName: string) => new Promise<void>((resolve, reject) => {
  const cleanup = () => {
    target.removeEventListener(eventName, handleSuccess);
    target.removeEventListener('error', handleError);
  };
  const handleSuccess = () => {
    cleanup();
    resolve();
  };
  const handleError = () => {
    cleanup();
    reject(new Error(`Failed while waiting for ${eventName}`));
  };
  target.addEventListener(eventName, handleSuccess, { once: true });
  target.addEventListener('error', handleError, { once: true });
});

const seekVideoForThumbnail = async (video: HTMLVideoElement, time: number) => {
  if (Math.abs(video.currentTime - time) < 0.01 && video.readyState >= 2) return;
  video.currentTime = time;
  await waitForEvent(video, 'seeked');
};

const drawVideoCover = (
  ctx: CanvasRenderingContext2D,
  video: HTMLVideoElement,
  width: number,
  height: number,
) => {
  const videoRatio = video.videoWidth / video.videoHeight;
  const targetRatio = width / height;
  let sx = 0;
  let sy = 0;
  let sw = video.videoWidth;
  let sh = video.videoHeight;

  if (videoRatio > targetRatio) {
    sw = video.videoHeight * targetRatio;
    sx = (video.videoWidth - sw) / 2;
  } else {
    sh = video.videoWidth / targetRatio;
    sy = (video.videoHeight - sh) / 2;
  }

  ctx.drawImage(video, sx, sy, sw, sh, 0, 0, width, height);
};

export const VideoFrameExtractPanel: React.FC<VideoFrameExtractPanelProps> = ({
  isOpen,
  videoSrc,
  isDark,
  onClose,
  onExtractFrame,
}) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const timelineRef = useRef<HTMLDivElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const [thumbnails, setThumbnails] = useState<TimelineThumbnail[]>([]);

  const MIN_FRAME_STEP = 1 / 24;

  const seekTo = useCallback((time: number) => {
    const video = videoRef.current;
    if (!video) return;
    const clamped = Math.max(0, Math.min(time, video.duration || 0));
    video.currentTime = clamped;
    setCurrentTime(clamped);
  }, []);

  const togglePlay = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;
    if (video.paused) {
      video.play();
      setIsPlaying(true);
    } else {
      video.pause();
      setIsPlaying(false);
    }
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
  }, [isOpen, seekTo, togglePlay, onClose]);

  useEffect(() => {
    if (!isOpen || !videoSrc) return;
    let cancelled = false;

    const generateThumbnails = async () => {
      try {
        const video = document.createElement('video');
        video.crossOrigin = 'anonymous';
        video.muted = true;
        video.preload = 'auto';
        video.src = videoSrc;
        video.playsInline = true;

        if (video.readyState < 1) {
          await waitForEvent(video, 'loadedmetadata');
        }
        if (video.readyState < 2) {
          await waitForEvent(video, 'loadeddata');
        }

        const total = Number.isFinite(video.duration) ? video.duration : 0;
        const count = Math.max(1, Math.min(15, Math.floor(total) + 1));
        const canvas = document.createElement('canvas');
        canvas.width = 96;
        canvas.height = 54;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        const nextThumbnails: TimelineThumbnail[] = [];
        for (let i = 0; i < count; i += 1) {
          const time = Math.min(i, Math.max(0, total - 0.05));
          await seekVideoForThumbnail(video, time);
          drawVideoCover(ctx, video, canvas.width, canvas.height);
          nextThumbnails.push({ time, url: canvas.toDataURL('image/jpeg', 0.72) });
        }

        if (!cancelled) setThumbnails(nextThumbnails);
      } catch {
        if (!cancelled) setThumbnails([]);
      }
    };

    setThumbnails([]);
    generateThumbnails();
    return () => {
      cancelled = true;
    };
  }, [isOpen, videoSrc]);

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
    seekTo(ratio * duration);
  };

  const handleTimelinePointerDown = (e: React.PointerEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
    const video = videoRef.current;
    if (video && !video.paused) {
      video.pause();
      setIsPlaying(false);
    }
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
  const tickCount = Math.max(1, Math.min(14, Math.ceil(duration || 14)));
  const timelineTicks = Array.from({ length: tickCount + 1 }, (_, index) => {
    const time = duration > 0 ? Math.min(index, duration) : index;
    return { time, label: formatTime(time) };
  });
  const shellClass = isDark ? 'bg-[#f8fafc] text-zinc-950' : 'bg-white text-gray-950';
  const mutedClass = isDark ? 'text-zinc-500' : 'text-gray-500';

  return (
    <div className="fixed inset-0 z-[260] flex items-center justify-center bg-black/55 backdrop-blur-sm px-5 py-6" onClick={onClose}>
      <div
        className={`flex max-h-[94vh] w-[min(920px,calc(100vw-48px))] flex-col overflow-hidden rounded-[28px] shadow-2xl ${shellClass}`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex h-16 shrink-0 items-center justify-between px-7">
          <h2 className="text-2xl font-bold tracking-normal">视频截帧</h2>
          <button
            className="flex h-9 w-9 items-center justify-center rounded-full text-zinc-500 transition-colors hover:bg-zinc-100 hover:text-zinc-900"
            onClick={onClose}
            title="关闭"
          >
            <Icons.X size={22} strokeWidth={2.8} />
          </button>
        </div>

        <div className="px-7">
          <div className="relative flex h-[min(500px,52vh)] items-center justify-center overflow-hidden rounded-2xl bg-black">
            <video
              ref={videoRef}
              src={videoSrc}
              className="h-full w-full object-contain"
              onTimeUpdate={handleTimeUpdate}
              onLoadedMetadata={handleLoadedMetadata}
              onEnded={() => setIsPlaying(false)}
              preload="auto"
              playsInline
            />
            <div className="absolute bottom-5 left-1/2 flex -translate-x-1/2 items-center gap-7 rounded-[28px] bg-black/42 px-8 py-4 text-white shadow-2xl backdrop-blur-md">
              <button className="flex h-8 w-8 items-center justify-center rounded-full hover:bg-white/10" onClick={() => seekTo(currentTime - MIN_FRAME_STEP)} title="上一帧">
                <Icons.SkipBack size={20} fill="currentColor" />
              </button>
              <button className="flex h-14 w-14 items-center justify-center rounded-full bg-white text-zinc-950 shadow-lg transition-transform active:scale-95" onClick={togglePlay} title={isPlaying ? '暂停' : '播放'}>
                {isPlaying ? <Icons.Pause size={26} fill="currentColor" /> : <Icons.Play size={27} fill="currentColor" className="ml-1" />}
              </button>
              <button className="flex h-8 w-8 items-center justify-center rounded-full hover:bg-white/10" onClick={() => seekTo(currentTime + MIN_FRAME_STEP)} title="下一帧">
                <Icons.SkipForward size={20} fill="currentColor" />
              </button>
            </div>
            <canvas ref={canvasRef} className="hidden" />
          </div>
        </div>

        <div className="px-7 pt-7">
          <div className="rounded-2xl border border-zinc-200 bg-white px-6 pb-5 pt-4 shadow-sm">
            <div className="relative pb-1">
              <div className="flex justify-between text-sm font-medium text-zinc-500">
                {timelineTicks.map(tick => (
                  <span key={tick.label}>{tick.label}</span>
                ))}
              </div>
              <div
                ref={timelineRef}
                className="relative mt-2 h-[86px] cursor-pointer select-none"
                onPointerDown={handleTimelinePointerDown}
                onPointerMove={handleTimelinePointerMove}
                onPointerUp={handleTimelinePointerUp}
                onPointerCancel={handleTimelinePointerUp}
              >
                <div className="absolute left-0 right-0 top-0 flex justify-between">
                  {timelineTicks.map(tick => (
                    <div key={tick.label} className="h-4 w-px bg-zinc-400/60" />
                  ))}
                </div>
                <div className="absolute left-0 right-0 top-3 flex justify-between">
                  {Array.from({ length: Math.max(20, tickCount * 8) }).map((_, index) => (
                    <div key={index} className="h-2 w-px bg-zinc-300/80" />
                  ))}
                </div>
                <div className="absolute left-0 top-0 z-20 h-[76px] w-0.5 rounded-full bg-black" style={{ left: `calc(${progress}% - 1px)` }}>
                  <span className="absolute -left-[3px] -top-1 h-3 w-3 rounded-full bg-black" />
                </div>
                <div className="absolute inset-x-0 bottom-0 flex h-10 items-center gap-1 overflow-hidden rounded-lg">
                  {thumbnails.length > 0 ? (
                    thumbnails.map(thumbnail => (
                      <button
                        key={`${thumbnail.time}-${thumbnail.url}`}
                        className="h-10 flex-1 overflow-hidden rounded-md bg-zinc-200 ring-1 ring-white transition-opacity hover:opacity-85"
                        onClick={(event) => {
                          event.stopPropagation();
                          seekTo(thumbnail.time);
                        }}
                        title={formatTime(thumbnail.time)}
                      >
                        <img src={thumbnail.url} className="h-full w-full object-cover" alt="" draggable={false} />
                      </button>
                    ))
                  ) : (
                    Array.from({ length: 12 }).map((_, index) => (
                      <div key={index} className="h-10 flex-1 rounded-md bg-zinc-200" />
                    ))
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="flex flex-col items-center gap-5 px-7 pb-8 pt-6">
          <p className={`text-base ${mutedClass}`}>截图当前帧并保存至「视频帧库」，支持多次截图</p>
          <button
            onClick={handleExtract}
            className="flex h-14 w-24 items-center justify-center rounded-2xl bg-indigo-600 text-white shadow-lg shadow-indigo-500/25 transition-all hover:bg-indigo-500 active:scale-95"
            title="截图当前帧"
          >
            <Icons.Camera size={28} fill="currentColor" />
          </button>
        </div>
      </div>
    </div>
  );
};
