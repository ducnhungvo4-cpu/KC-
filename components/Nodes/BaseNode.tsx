import React from 'react';
import { NodeData, NodeType } from '../../types';
import { Icons } from '../Icons';

interface BaseNodeProps {
  data: NodeData;
  selected: boolean;
  onMouseDown: (e: React.MouseEvent) => void;
  onContextMenu: (e: React.MouseEvent) => void;
  onConnectStart: (e: React.MouseEvent, type: 'source' | 'target') => void;
  onPortMouseUp?: (e: React.MouseEvent, nodeId: string, type: 'source' | 'target') => void;
  onResizeStart?: (e: React.MouseEvent) => void;
  onAttachInput?: (nodeId: string) => void;
  children: React.ReactNode;
  scale: number;
  isDark?: boolean;
}

// Port component for cleaner code
const ConnectionPort: React.FC<{
  type: 'input' | 'output';
  isDark: boolean;
  onMouseDown?: (e: React.MouseEvent) => void;
  onMouseUp?: (e: React.MouseEvent) => void;
}> = ({ type, isDark, onMouseDown, onMouseUp }) => {
  const isInput = type === 'input';
  const label = isInput ? '连接输入' : '拖出连接';
  
  return (
    <div 
      className={`absolute ${isInput ? '-left-9' : '-right-9'} top-1/2 -translate-y-1/2 z-50 group/port`}
      onMouseDown={(e) => {
        e.stopPropagation();
        onMouseDown?.(e);
      }}
      onMouseUp={onMouseUp}
      title={label}
    >
      {/* Hover area for easier targeting */}
      <div className="absolute -inset-4 cursor-crosshair" />
      
      {/* Port visual */}
      <div className={`
        relative w-12 h-12 rounded-full cursor-crosshair flex items-center justify-center
        opacity-0 scale-90 pointer-events-none
        transition-all duration-200 ease-out
        ${isDark 
          ? 'bg-black/40 border-[3px] border-zinc-500 text-zinc-400 shadow-[0_8px_24px_rgba(0,0,0,0.45)] backdrop-blur-sm' 
          : 'bg-white/75 border-[3px] border-gray-400 text-gray-500 shadow-[0_8px_24px_rgba(0,0,0,0.18)] backdrop-blur-sm'
        }
        group-hover:opacity-100
        group-hover:scale-100
        group-hover/port:pointer-events-auto
        group-hover/port:scale-110
        group-hover/port:border-cyan-400
        group-hover/port:text-cyan-300
        group-hover/port:shadow-[0_0_18px_rgba(34,211,238,0.45)]
      `}>
        <div className="relative w-7 h-7">
          <span className="absolute left-0 top-1/2 h-[3px] w-full -translate-y-1/2 rounded-full bg-current" />
          <span className="absolute top-0 left-1/2 h-full w-[3px] -translate-x-1/2 rounded-full bg-current" />
        </div>
      </div>
      <div className={`absolute ${isInput ? 'right-full mr-2' : 'left-full ml-2'} top-1/2 -translate-y-1/2 px-2 py-1 rounded-md text-[10px] font-medium whitespace-nowrap opacity-0 group-hover/port:opacity-100 transition-opacity pointer-events-none ${isDark ? 'bg-zinc-900 text-zinc-200 border border-zinc-700' : 'bg-white text-gray-700 border border-gray-200 shadow-sm'}`}>
        {label}
      </div>
    </div>
  );
};

const BaseNode: React.FC<BaseNodeProps> = ({ 
  data, selected, onMouseDown, onContextMenu, onConnectStart, onPortMouseUp, children, onResizeStart, onAttachInput, isDark = true
}) => {
  const showInputPort = data.type !== NodeType.ORIGINAL_IMAGE;
  const hasContent = Boolean(data.imageSrc || data.videoSrc);

  return (
    <div 
      className="absolute flex flex-col group"
      style={{
        left: data.x,
        top: data.y,
        width: data.width,
        height: data.height,
        zIndex: data.isStackOpen ? 100 : (selected ? 50 : 10), 
        overflow: 'visible' 
      }}
      onMouseDown={onMouseDown}
      onContextMenu={onContextMenu}
    >
      {/* Main Content Area */}
      <div className="relative w-full h-full">
          {children}

          {onAttachInput && !hasContent && (
            <button
              className={`absolute left-1/2 top-0 -translate-x-1/2 -translate-y-[calc(100%+12px)] z-[80] h-9 px-3 rounded-full border backdrop-blur-xl shadow-lg flex items-center gap-2 text-sm font-semibold opacity-0 pointer-events-none transition-all duration-200 group-hover:opacity-100 group-hover:pointer-events-auto ${
                isDark
                  ? 'bg-zinc-950/90 border-zinc-700 text-zinc-200 hover:border-cyan-400 hover:text-white'
                  : 'bg-white/95 border-gray-200 text-gray-700 hover:border-cyan-400 hover:text-gray-950'
              }`}
              title="上传本地素材到当前节点"
              onMouseDown={(e) => e.stopPropagation()}
              onClick={(e) => {
                e.stopPropagation();
                onAttachInput(data.id);
              }}
            >
              <Icons.Upload size={14} />
              <span>上传</span>
            </button>
          )}

          {/* Connection Ports */}
          {showInputPort && (
            <ConnectionPort
              type="input"
              isDark={isDark}
              onMouseDown={(e) => onConnectStart(e, 'target')}
              onMouseUp={(e) => onPortMouseUp?.(e, data.id, 'target')}
            />
          )}

          <ConnectionPort
            type="output"
            isDark={isDark}
            onMouseDown={(e) => onConnectStart(e, 'source')}
            onMouseUp={(e) => onPortMouseUp?.(e, data.id, 'source')}
          />

          {/* Resize Handle */}
          <div 
              className={`
                absolute -right-1 -bottom-1 w-5 h-5 cursor-se-resize z-50 
                flex items-center justify-center
                opacity-0 group-hover:opacity-100 transition-opacity duration-200
              `}
              onMouseDown={onResizeStart}
          >
              <svg width="10" height="10" viewBox="0 0 10 10" className={isDark ? 'text-zinc-500' : 'text-gray-400'}>
                <path d="M9 1L1 9M9 5L5 9M9 9L9 9" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
              </svg>
          </div>
      </div>
    </div>
  );
};

export default BaseNode;
