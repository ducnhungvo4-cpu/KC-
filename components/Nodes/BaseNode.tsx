import React, { useState } from 'react';
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
  onAddToAssetLibrary?: (nodeId: string) => void;
  children: React.ReactNode;
  scale: number;
  isDark?: boolean;
  auditState?: 'auditing' | 'passed' | 'failed';
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
        group-hover/port:border-[#8F91F4]
        group-hover/port:text-[#B9BAFF]
        group-hover/port:shadow-[0_0_18px_rgba(68,70,206,0.45)]
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
  data, selected, onMouseDown, onContextMenu, onConnectStart, onPortMouseUp, children, onResizeStart, onAttachInput, onAddToAssetLibrary, isDark = true, auditState
}) => {
  const showInputPort = data.type !== NodeType.ORIGINAL_IMAGE;
  const hasContent = Boolean(data.imageSrc || data.videoSrc || data.audioSrc);
  const [isAuditDetailOpen, setIsAuditDetailOpen] = useState(false);
  const [auditErrorCopied, setAuditErrorCopied] = useState(false);

  const copyAuditError = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!data.auditErrorDetail) return;
    try {
      await navigator.clipboard.writeText(data.auditErrorDetail);
      setAuditErrorCopied(true);
      window.setTimeout(() => setAuditErrorCopied(false), 1400);
    } catch (error) {
      console.error('Failed to copy audit error', error);
    }
  };

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
          {/* Seedance audit badge — top-left corner, outside the node */}
          {auditState && (
            <div className="absolute -top-2 -left-2 z-[200] group/audit pointer-events-auto">
              {auditState === 'auditing' && (
                <div className="w-5 h-5 rounded-full bg-zinc-800/90 border border-zinc-600 flex items-center justify-center shadow-lg cursor-default">
                  <svg className="w-3 h-3 animate-spin text-zinc-400" viewBox="0 0 24 24" fill="none">
                    <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeDasharray="40 20"/>
                  </svg>
                  <div className="absolute left-full ml-1.5 top-1/2 -translate-y-1/2 px-1.5 py-0.5 rounded text-[9px] whitespace-nowrap bg-zinc-900/95 border border-zinc-700 text-zinc-300 opacity-0 group-hover/audit:opacity-100 transition-opacity pointer-events-none shadow-lg">
                    审核中
                  </div>
                </div>
              )}
              {auditState === 'passed' && (
                <div className="w-5 h-5 rounded-full bg-emerald-500/20 border border-emerald-500/60 flex items-center justify-center shadow-lg cursor-default" title="合规审核通过">
                  <svg viewBox="0 0 24 24" fill="none" className="w-3.5 h-3.5 text-emerald-400">
                    <path d="M12 2L3 7v5c0 5.25 3.75 10.15 9 11.25C17.25 22.15 21 17.25 21 12V7L12 2z" fill="currentColor" opacity="0.3"/>
                    <path d="M12 2L3 7v5c0 5.25 3.75 10.15 9 11.25C17.25 22.15 21 17.25 21 12V7L12 2z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round"/>
                    <path d="M9 12l2 2 4-4" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                </div>
              )}
              {auditState === 'failed' && (
                <div className="relative">
                  <button
                    type="button"
                    className="w-5 h-5 rounded-full bg-red-500/25 border border-red-500/70 flex items-center justify-center shadow-lg cursor-pointer hover:bg-red-500/35 transition-colors"
                    aria-label="查看审核未通过原因"
                    onMouseDown={(e) => e.stopPropagation()}
                    onClick={(e) => {
                      e.stopPropagation();
                      setIsAuditDetailOpen(open => !open);
                    }}
                  >
                    <svg viewBox="0 0 24 24" fill="none" className="w-3 h-3 text-red-400">
                      <path d="M8 8l8 8M16 8l-8 8" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"/>
                    </svg>
                  </button>
                  {isAuditDetailOpen && (
                    <div
                      className="absolute left-0 top-full mt-2 w-[280px] rounded-xl border border-red-500/30 bg-zinc-950/95 px-3 py-2.5 shadow-2xl backdrop-blur-xl"
                      onMouseDown={(e) => e.stopPropagation()}
                      onClick={(e) => e.stopPropagation()}
                    >
                      <div className="flex items-start gap-2">
                        <p className="min-w-0 flex-1 text-[11px] leading-5 text-red-300">
                          审核未通过：{data.auditFailureReason || '图片未通过平台内容安全审核'}
                        </p>
                        {data.auditErrorDetail && (
                          <div className="relative shrink-0 group/copy-audit">
                            <button
                              type="button"
                              className="w-6 h-6 rounded-md flex items-center justify-center text-red-300 hover:text-white hover:bg-red-500/20 transition-colors"
                              aria-label="复制具体报错信息"
                              onClick={copyAuditError}
                            >
                              <Icons.Copy size={13} />
                            </button>
                            <div className="absolute right-0 bottom-full mb-1.5 rounded-md border border-zinc-700 bg-zinc-900 px-2 py-1 text-[9px] text-zinc-200 whitespace-nowrap opacity-0 pointer-events-none group-hover/copy-audit:opacity-100 transition-opacity">
                              {auditErrorCopied ? '已复制' : '复制具体报错信息'}
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
          {/* Red outline overlay when audit failed */}
          {auditState === 'failed' && (
            <div className="pointer-events-none absolute inset-0 z-[60] rounded-xl ring-2 ring-red-500/80" />
          )}
          {children}

          {onAttachInput && !hasContent && (
            <button
              className={`absolute left-1/2 top-0 -translate-x-1/2 -translate-y-[calc(100%+12px)] z-[80] h-9 px-3 rounded-full border backdrop-blur-xl shadow-lg flex items-center gap-2 text-sm font-semibold transition-all duration-200 ${
                selected ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none group-hover:opacity-100 group-hover:pointer-events-auto'
              } ${
                isDark
                  ? 'bg-zinc-950/90 border-zinc-700 text-zinc-200 hover:border-[#8F91F4] hover:text-white'
                  : 'bg-white/95 border-gray-200 text-gray-700 hover:border-[#8F91F4] hover:text-gray-950'
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
