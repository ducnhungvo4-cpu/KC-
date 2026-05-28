import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Icons } from './Icons';

interface CropRect {
  x: number;
  y: number;
  w: number;
  h: number;
}

interface CropModalProps {
  imageSrc: string;
  sourceTitle: string;
  initialAspectRatio: string;
  isDark: boolean;
  onClose: () => void;
  onConfirm: (dataUrl: string, width: number, height: number, aspectRatio: string) => void;
}

const CROP_ASPECT_RATIOS = ['1:1', '3:4', '4:3', '9:16', '16:9'];
const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), max);
const parseRatio = (ratio: string) => {
  const [wRaw, hRaw] = ratio.split(':').map(Number);
  const width = Number.isFinite(wRaw) && wRaw > 0 ? wRaw : 1;
  const height = Number.isFinite(hRaw) && hRaw > 0 ? hRaw : 1;
  return width / height;
};

const fitRectToAspect = (
  rect: CropRect,
  naturalSize: { width: number; height: number },
  aspectRatio: string
) => {
  const naturalRatio = naturalSize.width && naturalSize.height ? naturalSize.width / naturalSize.height : 1;
  const targetRatio = parseRatio(aspectRatio);
  let w = clamp(rect.w, 8, 96);
  let h = w * naturalRatio / targetRatio;

  if (h > 96) {
    h = 96;
    w = h * targetRatio / naturalRatio;
  }

  return {
    w,
    h,
    x: clamp(rect.x, 0, 100 - w),
    y: clamp(rect.y, 0, 100 - h),
  };
};

const getInitialRect = (naturalSize: { width: number; height: number }, aspectRatio: string): CropRect => {
  const fitted = fitRectToAspect({ x: 12, y: 12, w: 76, h: 76 }, naturalSize, aspectRatio);
  return {
    ...fitted,
    x: (100 - fitted.w) / 2,
    y: (100 - fitted.h) / 2,
  };
};

export const CropModal: React.FC<CropModalProps> = ({
  imageSrc,
  sourceTitle,
  initialAspectRatio,
  isDark,
  onClose,
  onConfirm,
}) => {
  const imageRef = useRef<HTMLImageElement>(null);
  const dragRef = useRef<{ startX: number; startY: number; rect: CropRect } | null>(null);
  const [rect, setRect] = useState<CropRect>({ x: 12, y: 12, w: 76, h: 76 });
  const [naturalSize, setNaturalSize] = useState({ width: 0, height: 0 });
  const [aspectRatio, setAspectRatio] = useState(
    CROP_ASPECT_RATIOS.includes(initialAspectRatio) ? initialAspectRatio : '1:1'
  );
  const [isDragging, setIsDragging] = useState(false);

  useEffect(() => {
    const nextRatio = CROP_ASPECT_RATIOS.includes(initialAspectRatio) ? initialAspectRatio : '1:1';
    setAspectRatio(nextRatio);
    setRect(getInitialRect({ width: 1, height: 1 }, nextRatio));
    setNaturalSize({ width: 0, height: 0 });
  }, [imageSrc, initialAspectRatio]);

  const cropPixels = useMemo(() => {
    return {
      x: Math.round(naturalSize.width * rect.x / 100),
      y: Math.round(naturalSize.height * rect.y / 100),
      width: Math.round(naturalSize.width * rect.w / 100),
      height: Math.round(naturalSize.height * rect.h / 100),
    };
  }, [naturalSize, rect]);

  const updateRect = (updates: Partial<CropRect>) => {
    setRect(prev => {
      return fitRectToAspect({ ...prev, ...updates }, naturalSize, aspectRatio);
    });
  };

  const handleAspectRatioChange = (nextRatio: string) => {
    setAspectRatio(nextRatio);
    setRect(prev => {
      const fitted = fitRectToAspect(prev, naturalSize, nextRatio);
      return {
        ...fitted,
        x: clamp(prev.x + (prev.w - fitted.w) / 2, 0, 100 - fitted.w),
        y: clamp(prev.y + (prev.h - fitted.h) / 2, 0, 100 - fitted.h),
      };
    });
  };

  const handlePointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    event.stopPropagation();
    dragRef.current = { startX: event.clientX, startY: event.clientY, rect };
    setIsDragging(true);
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const handlePointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!dragRef.current || !imageRef.current) return;
    const bounds = imageRef.current.getBoundingClientRect();
    const dx = ((event.clientX - dragRef.current.startX) / bounds.width) * 100;
    const dy = ((event.clientY - dragRef.current.startY) / bounds.height) * 100;
    updateRect({
      x: dragRef.current.rect.x + dx,
      y: dragRef.current.rect.y + dy,
    });
  };

  const handlePointerUp = (event: React.PointerEvent<HTMLDivElement>) => {
    dragRef.current = null;
    setIsDragging(false);
    event.currentTarget.releasePointerCapture(event.pointerId);
  };

  const handleConfirm = () => {
    const image = imageRef.current;
    if (!image || cropPixels.width <= 0 || cropPixels.height <= 0) return;

    const canvas = document.createElement('canvas');
    canvas.width = cropPixels.width;
    canvas.height = cropPixels.height;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    try {
      ctx.drawImage(
        image,
        cropPixels.x,
        cropPixels.y,
        cropPixels.width,
        cropPixels.height,
        0,
        0,
        cropPixels.width,
        cropPixels.height
      );
      onConfirm(canvas.toDataURL('image/png'), cropPixels.width, cropPixels.height, aspectRatio);
    } catch (error) {
      alert('裁剪失败：当前图片不允许在浏览器中读取像素。请先下载或替换为本地图片后再裁剪。');
      console.error(error);
    }
  };

  const bgCard = isDark ? 'bg-[#18181b] border-zinc-700 text-white' : 'bg-white border-gray-200 text-gray-900';
  const panelBg = isDark ? 'bg-zinc-900/70 border-zinc-700' : 'bg-gray-50 border-gray-200';
  const textSub = isDark ? 'text-zinc-400' : 'text-gray-500';
  const inputClass = isDark ? 'bg-zinc-900 border-zinc-700 text-white' : 'bg-white border-gray-200 text-gray-900';

  return (
    <div
      className="fixed inset-0 z-[280] flex items-center justify-center bg-black/70 backdrop-blur-md p-4"
      onMouseDown={event => event.stopPropagation()}
      onClick={onClose}
    >
      <div
        className={`w-full max-w-5xl max-h-[92vh] rounded-2xl border shadow-2xl overflow-hidden flex flex-col ${bgCard}`}
        onClick={event => event.stopPropagation()}
      >
        <div className={`px-5 py-4 border-b flex items-center justify-between ${isDark ? 'border-zinc-700' : 'border-gray-200'}`}>
          <div>
            <h3 className="text-base font-bold">图片裁剪</h3>
            <p className={`text-xs mt-1 ${textSub}`}>{sourceTitle}</p>
          </div>
          <button
            className={`w-9 h-9 rounded-xl flex items-center justify-center ${isDark ? 'hover:bg-white/5 text-zinc-400' : 'hover:bg-gray-100 text-gray-500'}`}
            onClick={onClose}
            title="关闭"
          >
            <Icons.X size={18} />
          </button>
        </div>

        <div className="flex-1 min-h-0 grid grid-cols-[1fr_300px] gap-0">
          <div className="relative min-h-[520px] flex items-center justify-center p-6 bg-black/90 overflow-hidden">
            <div className="relative max-w-full max-h-full select-none">
              <img
                ref={imageRef}
                src={imageSrc}
                crossOrigin="anonymous"
                className="max-w-full max-h-[70vh] object-contain block"
                draggable={false}
                onLoad={event => {
                  const nextNaturalSize = {
                    width: event.currentTarget.naturalWidth,
                    height: event.currentTarget.naturalHeight,
                  };
                  setNaturalSize(nextNaturalSize);
                  setRect(getInitialRect(nextNaturalSize, aspectRatio));
                }}
              />
              <div className="absolute inset-0 pointer-events-none">
                <div className="absolute inset-0 bg-black/45" />
                <div
                  className="absolute bg-transparent"
                  style={{
                    left: `${rect.x}%`,
                    top: `${rect.y}%`,
                    width: `${rect.w}%`,
                    height: `${rect.h}%`,
                    boxShadow: '0 0 0 9999px rgba(0,0,0,0.45)',
                  }}
                />
              </div>
              <div
                className={`absolute border-2 border-cyan-400 bg-cyan-400/10 cursor-move ${isDragging ? 'ring-4 ring-cyan-400/20' : ''}`}
                style={{ left: `${rect.x}%`, top: `${rect.y}%`, width: `${rect.w}%`, height: `${rect.h}%` }}
                onPointerDown={handlePointerDown}
                onPointerMove={handlePointerMove}
                onPointerUp={handlePointerUp}
              >
                <div className="absolute inset-0 grid grid-cols-3 grid-rows-3">
                  {Array.from({ length: 9 }).map((_, index) => (
                    <div key={index} className="border border-white/25" />
                  ))}
                </div>
              </div>
            </div>
          </div>

          <div className={`p-5 border-l flex flex-col gap-5 ${isDark ? 'border-zinc-700' : 'border-gray-200'}`}>
            <div className={`rounded-xl border p-4 ${panelBg}`}>
              <div className="text-xs font-bold uppercase tracking-wider mb-3">裁剪画幅</div>
              <div className="grid grid-cols-3 gap-2">
                {CROP_ASPECT_RATIOS.map(ratio => (
                  <button
                    key={ratio}
                    className={`h-9 rounded-lg text-xs font-semibold border transition-colors ${
                      aspectRatio === ratio
                        ? 'border-cyan-500 bg-cyan-500/15 text-cyan-500'
                        : isDark ? 'border-zinc-700 text-zinc-300 hover:bg-zinc-800' : 'border-gray-200 text-gray-600 hover:bg-gray-100'
                    }`}
                    onClick={() => handleAspectRatioChange(ratio)}
                  >
                    {ratio}
                  </button>
                ))}
              </div>
            </div>

            <div className={`rounded-xl border p-4 ${panelBg}`}>
              <div className="text-xs font-bold uppercase tracking-wider mb-3">裁剪区域</div>
              <div className="space-y-3">
                {([
                  ['x', '左边距'],
                  ['y', '上边距'],
                  ['w', '大小'],
                ] as const).map(([key, label]) => (
                  <label key={key} className="block">
                    <div className="flex items-center justify-between text-xs mb-1">
                      <span className={textSub}>{label}</span>
                      <span className="font-mono">{Math.round(rect[key])}%</span>
                    </div>
                    <input
                      type="range"
                      min={key === 'w' ? 8 : 0}
                      max={key === 'x' ? 100 - rect.w : key === 'y' ? 100 - rect.h : 100}
                      value={rect[key]}
                      onChange={event => updateRect({ [key]: Number(event.target.value) } as Partial<CropRect>)}
                      className="w-full"
                    />
                  </label>
                ))}
              </div>
            </div>

            <div className={`rounded-xl border p-4 ${panelBg}`}>
              <div className="text-xs font-bold uppercase tracking-wider mb-3">输出尺寸</div>
              <div className={`grid grid-cols-2 gap-2 text-xs ${textSub}`}>
                <div className={`rounded-lg border px-3 py-2 ${inputClass}`}>{cropPixels.width || '-'} px</div>
                <div className={`rounded-lg border px-3 py-2 ${inputClass}`}>{cropPixels.height || '-'} px</div>
              </div>
            </div>

            <div className="mt-auto flex items-center justify-end gap-2">
              <button
                className={`px-4 py-2 rounded-xl text-sm font-medium border ${isDark ? 'border-zinc-700 text-zinc-300 hover:bg-zinc-800' : 'border-gray-200 text-gray-600 hover:bg-gray-100'}`}
                onClick={onClose}
              >
                取消
              </button>
              <button
                className="px-4 py-2 rounded-xl text-sm font-semibold bg-cyan-600 hover:bg-cyan-500 text-white flex items-center gap-2"
                onClick={handleConfirm}
                disabled={!naturalSize.width}
              >
                <Icons.Crop size={15} />
                生成裁剪节点
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
