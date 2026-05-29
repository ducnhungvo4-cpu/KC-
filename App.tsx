
import React, { useRef, useState, useEffect, useCallback, useMemo } from 'react';
import Sidebar from './components/Sidebar';
import { InputMedia, MultiAngleOptions, NodeData, Connection, CanvasTransform, Point, DragMode, NodeType } from './types';
import BaseNode from './components/Nodes/BaseNode';
import { NodeContent } from './components/Nodes/NodeContent';
import { Icons } from './components/Icons';
import { analyzeConnectedMedia, analyzeScriptAssets, generateCreativeDescription, generateImage, generateVideo, generateMultiAngleImages } from './services/geminiService';
import { storageService } from './services/storageService';
import { ThemeSwitcher } from './components/ThemeSwitcher';
import { StorageModal } from './components/Settings/StorageModal';
import { ExportImportModal } from './components/Settings/ExportImportModal';
import { WelcomeModal, hasShownWelcome } from './components/Settings/WelcomeModal';
import { CropModal } from './components/CropModal';
import { LoginScreen } from './components/LoginScreen';
import { authService } from './services/authService';

const DEFAULT_NODE_WIDTH = 320;
const DEFAULT_NODE_HEIGHT = 240; 
const EMPTY_ARRAY: string[] = [];
const IMAGE_NODE_BASE_SIZE = 400;
const VIDEO_NODE_BASE_HEIGHT = 400;
const IMAGE_ASPECT_RATIOS = ['1:1', '3:4', '4:3', '9:16', '16:9'];
const VIDEO_ASPECT_RATIOS = ['1:1', '3:4', '4:3', '9:16', '16:9', '21:9', '9:21'];

// 节点媒体类别：正向/反向连接共用同一套合法性校验规则。
type MediaCategory = 'image' | 'video' | 'text';

const NODE_MEDIA_CATEGORY: Record<NodeType, MediaCategory> = {
    [NodeType.TEXT_TO_IMAGE]: 'image',
    [NodeType.IMAGE_TO_IMAGE]: 'image',
    [NodeType.ORIGINAL_IMAGE]: 'image',
    [NodeType.TEXT_TO_VIDEO]: 'video',
    [NodeType.IMAGE_TO_VIDEO]: 'video',
    [NodeType.START_END_TO_VIDEO]: 'video',
    [NodeType.CREATIVE_DESC]: 'text',
};

// 目标节点（下游）允许接收的来源节点（上游）类别：
// - 图片节点：可接图片、文字
// - 视频节点：可接图片、文字
// - 文字节点：可接图片、视频、文字
const ALLOWED_SOURCE_CATEGORIES: Record<MediaCategory, MediaCategory[]> = {
    image: ['image', 'text'],
    video: ['image', 'text'],
    text: ['image', 'video', 'text'],
};

const getNodeSizeForAspectRatio = (aspectRatio = '1:1', baseSize = IMAGE_NODE_BASE_SIZE) => {
    const [wRaw, hRaw] = aspectRatio.split(':').map(Number);
    const wRatio = Number.isFinite(wRaw) && wRaw > 0 ? wRaw : 1;
    const hRatio = Number.isFinite(hRaw) && hRaw > 0 ? hRaw : 1;
    const ratio = wRatio / hRatio;

    if (ratio >= 1) {
        return { width: Math.round(baseSize * ratio), height: baseSize };
    }

    return { width: baseSize, height: Math.round(baseSize / ratio) };
};

const getClosestAspectRatio = (width: number, height: number, options = IMAGE_ASPECT_RATIOS) => {
    const sourceRatio = width / height;
    return options.reduce((best, candidate) => {
        const [w, h] = candidate.split(':').map(Number);
        const [bestW, bestH] = best.split(':').map(Number);
        return Math.abs(w / h - sourceRatio) < Math.abs(bestW / bestH - sourceRatio) ? candidate : best;
    }, options[0]);
};

// Helper for resizing imported media constraints
const calculateImportDimensions = (naturalWidth: number, naturalHeight: number) => {
    const ratio = naturalWidth / naturalHeight;
    const maxSide = 750;
    let width = naturalWidth;
    let height = naturalHeight;

    if (width > height) {
        if (width > maxSide) {
            width = maxSide;
            height = width / ratio;
        }
    } else {
        if (height > maxSide) {
            height = maxSide;
            width = height * ratio;
        }
    }
    return { width, height, ratio };
};

const App: React.FC = () => {
  return (
      <CanvasWithSidebar />
  );
};

const CanvasWithSidebar: React.FC = () => {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isCheckingAuth, setIsCheckingAuth] = useState(true);
  const [nodes, setNodes] = useState<NodeData[]>([]);
  const [connections, setConnections] = useState<Connection[]>([]);
  const [transform, setTransform] = useState<CanvasTransform>({ x: 0, y: 0, k: 1 });
  const [selectedNodeIds, setSelectedNodeIds] = useState<Set<string>>(new Set());
  const [dragMode, setDragMode] = useState<DragMode | 'RESIZE_NODE' | 'SELECT'>('NONE');
  const dragModeRef = useRef(dragMode);
  
  // New Workflow Dialog State
  const [showNewWorkflowDialog, setShowNewWorkflowDialog] = useState(false);
  
  // Project Name State
  const [projectName, setProjectName] = useState('KC画布 MVP 试用项目');
  const [isEditingProjectName, setIsEditingProjectName] = useState(false);
  
  const [isStorageOpen, setIsStorageOpen] = useState(false);
  const [isExportImportOpen, setIsExportImportOpen] = useState(false);
  const [isWelcomeOpen, setIsWelcomeOpen] = useState(() => !hasShownWelcome());
  const [storageDirName, setStorageDirName] = useState<string | null>(null);

  // History State (Persist deleted nodes that have content)
  const [deletedNodes, setDeletedNodes] = useState<NodeData[]>([]);

  useEffect(() => {
      dragModeRef.current = dragMode;
  }, [dragMode]);

  useEffect(() => {
      authService.verify().then(setIsAuthenticated).finally(() => setIsCheckingAuth(false));
      const handleExpired = () => setIsAuthenticated(false);
      window.addEventListener('kc-auth-expired', handleExpired);
      return () => window.removeEventListener('kc-auth-expired', handleExpired);
  }, []);

  // 清除旧版本原型遗留的 Sora 2 配置，避免影响 KC 默认模型。
  useEffect(() => {
      if (typeof window !== 'undefined') {
          try {
              const sora2Key = `API_CONFIG_MODEL_Sora 2`;
              const stored = localStorage.getItem(sora2Key);
              if (stored) {
                  const parsed = JSON.parse(stored);
                  // 如果 endpoint 是旧的 chat completions，清除配置
                  if (parsed.endpoint === '/v1/chat/completions') {
                      localStorage.removeItem(sora2Key);
                      console.log('[App] Cleared old Sora 2 config with old endpoint');
                  }
              }
          } catch(e) {
              // 忽略错误
          }
      }
  }, []);

  // Default to dark theme.
  const [canvasBg, setCanvasBg] = useState('#0B0C0E');
  const isDark = canvasBg === '#0B0C0E';
  
  // Sync body class for CSS variables
  useEffect(() => {
    if (isDark) {
      document.body.classList.add('dark');
    } else {
      document.body.classList.remove('dark');
    }
  }, [isDark]);

  const [selectionBox, setSelectionBox] = useState<{ x: number, y: number, w: number, h: number } | null>(null);
  const [selectedConnectionId, setSelectedConnectionId] = useState<string | null>(null);
  const [suggestedNodes, setSuggestedNodes] = useState<NodeData[]>([]);
  const [previewMedia, setPreviewMedia] = useState<{ url: string, type: 'image' | 'video' } | null>(null);
  const [previewText, setPreviewText] = useState<{ title: string, text: string } | null>(null);
  const [cropTarget, setCropTarget] = useState<{ nodeId: string; imageSrc: string; title: string; aspectRatio: string } | null>(null);
  
  // Quick Add Menu State
  const [quickAddMenu, setQuickAddMenu] = useState<{ sourceId: string, x: number, y: number, worldX: number, worldY: number, direction?: 'forward' | 'backward' } | null>(null);

  const [contextMenu, setContextMenu] = useState<{ 
      type: 'CANVAS' | 'NODE', 
      nodeId?: string, 
      nodeType?: NodeType, 
      x: number, 
      y: number, 
      worldX: number, 
      worldY: number 
  } | null>(null);

  const [internalClipboard, setInternalClipboard] = useState<{ nodes: NodeData[], connections: Connection[] } | null>(null);

  const containerRef = useRef<HTMLDivElement>(null);
  const dragStartRef = useRef<{ x: number, y: number, w?: number, h?: number, nodeId?: string }>({ x: 0, y: 0 });
  const initialTransformRef = useRef<CanvasTransform>({ x: 0, y: 0, k: 1 });
  const initialNodePositionsRef = useRef<{id: string, x: number, y: number}[]>([]);
  const connectionStartRef = useRef<{ nodeId: string, type: 'source' | 'target' } | null>(null);
  const [tempConnection, setTempConnection] = useState<Point | null>(null);
  const lastMousePosRef = useRef<Point>({ x: 0, y: 0 }); 
  
  const workflowInputRef = useRef<HTMLInputElement>(null);
  const assetInputRef = useRef<HTMLInputElement>(null);
  const replaceImageRef = useRef<HTMLInputElement>(null);
  const attachInputRef = useRef<HTMLInputElement>(null);
  const nodeToReplaceRef = useRef<string | null>(null);
  const nodeToAttachInputRef = useRef<string | null>(null);

  const spacePressed = useRef(false);

  const screenToWorld = (x: number, y: number) => ({
    x: (x - transform.x) / transform.k,
    y: (y - transform.y) / transform.k,
  });

  const generateId = () => Math.random().toString(36).substr(2, 9);

  // Memoize inputs map to prevent array recreation on every render
  const inputsMap = useMemo(() => {
    const map: Record<string, string[]> = {};
    nodes.forEach(node => {
        map[node.id] = connections
            .filter(c => c.targetId === node.id)
            .map(c => nodes.find(n => n.id === c.sourceId))
            .filter(n => n && (n.imageSrc || n.videoSrc))
            .map(n => n!.imageSrc || n!.videoSrc || '');
    });
    return map;
  }, [nodes, connections]);

  const inputMediaMap = useMemo(() => {
    const map: Record<string, InputMedia[]> = {};
    nodes.forEach(node => {
        map[node.id] = connections
            .filter(c => c.targetId === node.id)
            .map(c => nodes.find(n => n.id === c.sourceId))
            .filter((n): n is NodeData => Boolean(n && (n.imageSrc || n.videoSrc || n.prompt || n.optimizedPrompt)))
            .map(n => {
                if (n.videoSrc) return { type: 'video', url: n.videoSrc, title: n.title } satisfies InputMedia;
                if (n.imageSrc) return { type: 'image', url: n.imageSrc, title: n.title } satisfies InputMedia;
                const text = n.optimizedPrompt || n.prompt || '';
                return { type: 'text', url: `text://${n.id}`, text, title: n.title } satisfies InputMedia;
            });
    });
    return map;
  }, [nodes, connections]);

  const getInputImages = useCallback((nodeId: string) => {
    return inputsMap[nodeId] || EMPTY_ARRAY;
  }, [inputsMap]);

  const getInputMedia = useCallback((nodeId: string) => {
    return inputMediaMap[nodeId] || [];
  }, [inputMediaMap]);
  
  const performCopy = () => {
      if (selectedNodeIds.size === 0) return;
      
      const selectedNodes = nodes.filter(n => selectedNodeIds.has(n.id));
      const selectedConnections = connections.filter(c => 
          selectedNodeIds.has(c.sourceId) && selectedNodeIds.has(c.targetId)
      );
      
      setInternalClipboard({ nodes: selectedNodes, connections: selectedConnections });
  };

  const performPaste = (targetPos: Point) => {
      if (!internalClipboard || internalClipboard.nodes.length === 0) return;

      const { nodes: clipboardNodes, connections: clipboardConnections } = internalClipboard;
      
      let minX = Infinity, minY = Infinity;
      clipboardNodes.forEach(n => {
          if (n.x < minX) minX = n.x;
          if (n.y < minY) minY = n.y;
      });

      const idMap = new Map<string, string>();
      const newNodes: NodeData[] = [];

      clipboardNodes.forEach(node => {
          const newId = generateId();
          idMap.set(node.id, newId);
          const offsetX = node.x - minX;
          const offsetY = node.y - minY;
          newNodes.push({
              ...node,
              id: newId,
              x: targetPos.x + offsetX,
              y: targetPos.y + offsetY,
              title: node.title.endsWith('(Copy)') ? node.title : `${node.title} (Copy)`,
              isLoading: false,
          });
      });

      const newConnections: Connection[] = clipboardConnections.map(c => ({
          id: generateId(),
          sourceId: idMap.get(c.sourceId)!,
          targetId: idMap.get(c.targetId)!
      }));

      setNodes(prev => [...prev, ...newNodes]);
      setConnections(prev => [...prev, ...newConnections]);
      setSelectedNodeIds(new Set(newNodes.map(n => n.id)));
  };

  const handleAlign = useCallback((direction: 'UP' | 'DOWN' | 'LEFT' | 'RIGHT') => {
      if (selectedNodeIds.size < 2) return;

      setNodes(prevNodes => {
          const selected = prevNodes.filter(n => selectedNodeIds.has(n.id));
          const unselected = prevNodes.filter(n => !selectedNodeIds.has(n.id));
          const updatedNodes = selected.map(n => ({ ...n })); // Shallow clone to mutate

          const isVerticalAlign = direction === 'UP' || direction === 'DOWN';
          
          // Check overlap logic with Threshold to avoid accidental grouping
          const OVERLAP_THRESHOLD = 10;
          const isOverlap = (a: NodeData, b: NodeData) => {
              if (isVerticalAlign) {
                  const overlap = Math.min(a.x + a.width, b.x + b.width) - Math.max(a.x, b.x);
                  return overlap > OVERLAP_THRESHOLD;
              } else {
                  const overlap = Math.min(a.y + a.height, b.y + b.height) - Math.max(a.y, b.y);
                  return overlap > OVERLAP_THRESHOLD;
              }
          };

          const clusters: NodeData[][] = [];
          const visited = new Set<string>();

          for (const node of updatedNodes) {
              if (visited.has(node.id)) continue;
              const cluster = [node];
              visited.add(node.id);
              const queue = [node];

              while (queue.length > 0) {
                  const current = queue.shift()!;
                  for (const other of updatedNodes) {
                      if (!visited.has(other.id) && isOverlap(current, other)) {
                          visited.add(other.id);
                          cluster.push(other);
                          queue.push(other);
                      }
                  }
              }
              clusters.push(cluster);
          }

          const minTop = Math.min(...updatedNodes.map(n => n.y));
          const maxBottom = Math.max(...updatedNodes.map(n => n.y + n.height));
          const minLeft = Math.min(...updatedNodes.map(n => n.x));
          const maxRight = Math.max(...updatedNodes.map(n => n.x + n.width));

          const HORIZONTAL_GAP = 20; 
          const VERTICAL_GAP = 60;   

          clusters.forEach(cluster => {
              if (direction === 'UP') {
                  cluster.sort((a, b) => (a.y - b.y) || a.id.localeCompare(b.id));
                  let currentY = minTop;
                  cluster.forEach((node) => {
                      node.y = currentY;
                      currentY += node.height + VERTICAL_GAP;
                  });
              } else if (direction === 'DOWN') {
                  cluster.sort((a, b) => (b.y - a.y) || a.id.localeCompare(b.id)); 
                  let currentBottom = maxBottom;
                  cluster.forEach((node) => {
                      node.y = currentBottom - node.height;
                      currentBottom -= (node.height + VERTICAL_GAP);
                  });
              } else if (direction === 'LEFT') {
                  cluster.sort((a, b) => (a.x - b.x) || a.id.localeCompare(b.id));
                  let currentX = minLeft;
                  cluster.forEach((node) => {
                      node.x = currentX;
                      currentX += node.width + HORIZONTAL_GAP;
                  });
              } else if (direction === 'RIGHT') {
                  cluster.sort((a, b) => (b.x - a.x) || a.id.localeCompare(b.id)); 
                  let currentRight = maxRight;
                  cluster.forEach((node) => {
                      node.x = currentRight - node.width;
                      currentRight -= (node.width + HORIZONTAL_GAP);
                  });
              }
          });

          return [...unselected, ...updatedNodes];
      });
  }, [selectedNodeIds]);

  const addNode = (type: NodeType, x?: number, y?: number, dataOverride?: Partial<NodeData>) => {
    if (x === undefined || y === undefined) {
      if (containerRef.current) {
        const rect = containerRef.current.getBoundingClientRect();
        const center = screenToWorld(rect.width / 2, rect.height / 2);
        x = center.x - DEFAULT_NODE_WIDTH / 2;
        y = center.y - DEFAULT_NODE_HEIGHT / 2;
      } else {
        x = 0; y = 0;
      }
    }

    let w = dataOverride?.width || DEFAULT_NODE_WIDTH;
    let h = dataOverride?.height || DEFAULT_NODE_HEIGHT;

    if (type === NodeType.ORIGINAL_IMAGE) {
        h = dataOverride?.height || 240;
    } else if (type === NodeType.TEXT_TO_VIDEO || type === NodeType.IMAGE_TO_VIDEO || type === NodeType.START_END_TO_VIDEO) {
        if (!dataOverride?.width) w = 400 * (16/9); 
        if (!dataOverride?.height) h = 400;
    } else if (type === NodeType.TEXT_TO_IMAGE || type === NodeType.IMAGE_TO_IMAGE) {
        if (!dataOverride?.width) w = 400;
        if (!dataOverride?.height) h = 400;
    } else if (type === NodeType.CREATIVE_DESC) {
        if (!dataOverride?.width) w = 520;
        if (!dataOverride?.height) h = 520;
    }
    
    const getDefaultTitle = (t: NodeType) => {
        switch (t) {
            case NodeType.TEXT_TO_IMAGE: return '生图';
            case NodeType.TEXT_TO_VIDEO: return '生视频';
            case NodeType.CREATIVE_DESC: return 'Text';
            default: return `原始图片_${Date.now()}`;
        }
    };

    const getDefaultModel = (t: NodeType) => {
        switch (t) {
            case NodeType.TEXT_TO_IMAGE:
                return 'Seedream 5.0';
            case NodeType.TEXT_TO_VIDEO:
                return 'Seedance 1.5 Pro';
            case NodeType.CREATIVE_DESC:
                return 'Xiaomi MiMo 2.5 Pro';
            default:
                return '';
        }
    };

    const isVideoType = type === NodeType.TEXT_TO_VIDEO;
    
    const newNode: NodeData = {
      id: generateId(),
      type,
      x,
      y,
      width: w,
      height: h, 
      title: dataOverride?.title || getDefaultTitle(type),
      aspectRatio: dataOverride?.aspectRatio || (isVideoType ? '16:9' : '1:1'),
      model: dataOverride?.model || getDefaultModel(type),
      resolution: dataOverride?.resolution || (isVideoType ? '720p' : '1k'),
      duration: dataOverride?.duration || (isVideoType ? '5s' : undefined),
      count: 1,
      prompt: dataOverride?.prompt || '',
      imageSrc: dataOverride?.imageSrc,
      videoSrc: dataOverride?.videoSrc,
      outputArtifacts: dataOverride?.outputArtifacts || (dataOverride?.imageSrc || dataOverride?.videoSrc ? [dataOverride.imageSrc || dataOverride.videoSrc!] : [])
    };
    
    setNodes(prev => [...prev, newNode]);
    setSelectedNodeIds(new Set([newNode.id]));
  };

  const handleQuickAddNode = (type: NodeType) => {
      if (!quickAddMenu) return;

      const newId = generateId();
      let w = DEFAULT_NODE_WIDTH;
      let h = DEFAULT_NODE_HEIGHT;

      const isVideoType = type === NodeType.TEXT_TO_VIDEO;
      const isImageGenType = type === NodeType.TEXT_TO_IMAGE;

      if (type === NodeType.ORIGINAL_IMAGE) {
          h = 240;
      } else if (isVideoType) {
          w = 400 * (16/9); h = 400;
      } else if (isImageGenType) {
          w = 400; h = 400;
      } else if (type === NodeType.CREATIVE_DESC) {
          w = 520; h = 520;
      }

      const getDefaultTitle = (t: NodeType) => {
          switch (t) {
              case NodeType.TEXT_TO_IMAGE: return '生图';
              case NodeType.TEXT_TO_VIDEO: return '生视频';
              case NodeType.CREATIVE_DESC: return 'Text';
              default: return `原始图片_${Date.now()}`;
          }
      };

      const getDefaultModel = (t: NodeType) => {
          switch (t) {
              case NodeType.TEXT_TO_IMAGE:
                  return 'Seedream 5.0';
              case NodeType.TEXT_TO_VIDEO:
                  return 'Seedance 1.5 Pro';
              case NodeType.CREATIVE_DESC:
                  return 'Xiaomi MiMo 2.5 Pro';
              default:
                  return '';
          }
      };

      // 反向新建时，新节点位于锚点上游(左侧)，让其右边缘对齐落点；正向保持原有左边缘对齐落点。
      const isBackward = quickAddMenu.direction === 'backward';
      const newNode: NodeData = {
          id: newId,
          type,
          x: isBackward ? quickAddMenu.worldX - w : quickAddMenu.worldX,
          y: quickAddMenu.worldY - h / 2,
          width: w,
          height: h,
          title: getDefaultTitle(type),
          aspectRatio: isVideoType ? '16:9' : '1:1',
          model: getDefaultModel(type),
          resolution: isVideoType ? '720p' : '1k',
          duration: isVideoType ? '5s' : undefined,
          count: 1,
          prompt: '',
          outputArtifacts: []
      };

      // 反向：新节点作为上游(source)，锚点为下游(target)；正向：保持原有方向。
      const newConnection = isBackward
          ? { id: generateId(), sourceId: newId, targetId: quickAddMenu.sourceId }
          : { id: generateId(), sourceId: quickAddMenu.sourceId, targetId: newId };

      setNodes(prev => [...prev, newNode]);
      setConnections(prev => [...prev, newConnection]);
      setQuickAddMenu(null);
  };

  const handlePaste = useCallback(async (e: ClipboardEvent) => {
    const activeElement = document.activeElement;
    const isInputFocused = activeElement instanceof HTMLInputElement || activeElement instanceof HTMLTextAreaElement;
    if (isInputFocused) return;

    const items = e.clipboardData?.items;
    let hasSystemMedia = false;
    const mousePos = lastMousePosRef.current;
    const worldPos = screenToWorld(mousePos.x, mousePos.y);

    if (items) {
        for (let i = 0; i < items.length; i++) {
            const item = items[i] as DataTransferItem;
            if (item.type.indexOf('image') !== -1) {
                hasSystemMedia = true;
                const file = item.getAsFile();
                if (file) {
                    const reader = new FileReader();
                    reader.onload = (event) => {
                        const img = new Image();
                        img.onload = () => {
                            const aspectRatio = getClosestAspectRatio(img.width, img.height, IMAGE_ASPECT_RATIOS);
                            const { width, height } = getNodeSizeForAspectRatio(aspectRatio);
                            const src = event.target?.result as string;
                            addNode(NodeType.TEXT_TO_IMAGE, worldPos.x, worldPos.y, {
                                width, height, imageSrc: src, title: `图片_${new Date().toLocaleTimeString()}`, aspectRatio, model: 'Seedream 5.0', resolution: '1k', outputArtifacts: [src]
                            });
                        };
                        img.src = event.target?.result as string;
                    };
                    reader.readAsDataURL(file);
                }
            } else if (item.type.indexOf('video') !== -1) {
                hasSystemMedia = true;
                const file = item.getAsFile();
                if (file) {
                    const url = URL.createObjectURL(file);
                    const video = document.createElement('video');
                    video.preload = 'metadata';
                    video.onloadedmetadata = () => {
                         const aspectRatio = getClosestAspectRatio(video.videoWidth, video.videoHeight, VIDEO_ASPECT_RATIOS);
                         const { width, height } = getNodeSizeForAspectRatio(aspectRatio, VIDEO_NODE_BASE_HEIGHT);
                         addNode(NodeType.TEXT_TO_VIDEO, worldPos.x, worldPos.y, {
                             width, height, videoSrc: url, title: file.name, aspectRatio, model: 'Seedance 1.5 Pro', resolution: '720p', duration: '5s', outputArtifacts: [url]
                         });
                    };
                    video.src = url;
                }
            }
        }
    }
    if (!hasSystemMedia && internalClipboard) performPaste(worldPos);
  }, [transform, internalClipboard]); 

  useEffect(() => {
    document.addEventListener('paste', handlePaste);
    return () => document.removeEventListener('paste', handlePaste);
  }, [handlePaste]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
        const target = e.target as HTMLElement;
        const isInput = target.tagName === 'INPUT' || target.tagName === 'TEXTAREA';
        if (!isInput) {
            if (e.key === 'Delete' || e.key === 'Backspace') {
                 if (selectedNodeIds.size > 0) {
                     const nodesToDelete = nodes.filter(n => selectedNodeIds.has(n.id));
                     const withContent = nodesToDelete.filter(n => n.imageSrc || n.videoSrc);
                     if (withContent.length > 0) {
                         setDeletedNodes(prev => [...prev, ...withContent]);
                     }
                     setNodes(prev => prev.filter(n => !selectedNodeIds.has(n.id)));
                     setConnections(prev => prev.filter(c => !selectedNodeIds.has(c.sourceId) && !selectedNodeIds.has(c.targetId)));
                     setSelectedNodeIds(new Set());
                 }
                 if (selectedConnectionId) {
                     setConnections(prev => prev.filter(c => c.id !== selectedConnectionId));
                     setSelectedConnectionId(null);
                 }
            }
            if ((e.ctrlKey || e.metaKey) && e.key === 'c') {
                e.preventDefault();
                performCopy();
            }
            if ((e.ctrlKey || e.metaKey) && !e.shiftKey) {
                if (e.key === 'ArrowUp') { e.preventDefault(); handleAlign('UP'); }
                if (e.key === 'ArrowDown') { e.preventDefault(); handleAlign('DOWN'); }
                if (e.key === 'ArrowLeft') { e.preventDefault(); handleAlign('LEFT'); }
                if (e.key === 'ArrowRight') { e.preventDefault(); handleAlign('RIGHT'); }
            }
        }
        
        if (e.key === 'Escape') {
            if (previewMedia) setPreviewMedia(null);
            if (previewText) setPreviewText(null);
            if (contextMenu) setContextMenu(null);
            if (quickAddMenu) setQuickAddMenu(null);
            if (showNewWorkflowDialog) setShowNewWorkflowDialog(false);
            if (isStorageOpen) setIsStorageOpen(false);
            if (isExportImportOpen) setIsExportImportOpen(false);
        }
        if (e.code === 'Space') spacePressed.current = true;
    };
    const handleKeyUp = (e: KeyboardEvent) => { if (e.code === 'Space') spacePressed.current = false; };
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
        window.removeEventListener('keydown', handleKeyDown);
        window.removeEventListener('keyup', handleKeyUp);
    };
  }, [selectedNodeIds, selectedConnectionId, previewMedia, previewText, contextMenu, nodes, connections, quickAddMenu, showNewWorkflowDialog, isStorageOpen, isExportImportOpen, handleAlign]);

  useEffect(() => {
    // Load storage directory name for the top-right indicator
    const loadStorageInfo = async () => {
        const name = await storageService.getDownloadDirectoryName();
        setStorageDirName(name);
    };
    if (isStorageOpen === false) {
        // Refresh when modal closes
        loadStorageInfo();
    }
    loadStorageInfo();
    
    const handleGlobalMouseUp = () => {
        if (dragModeRef.current !== 'NONE') {
            setDragMode('NONE');
            setTempConnection(null);
            connectionStartRef.current = null;
            dragStartRef.current = { x: 0, y: 0 };
            setSuggestedNodes([]);
            setSelectionBox(null);
        }
    };
    window.addEventListener('mouseup', handleGlobalMouseUp);
    return () => window.removeEventListener('mouseup', handleGlobalMouseUp);
  }, [isStorageOpen]);

  const handleOpenStorageSettings = () => {
      setIsStorageOpen(true);
  };

  const handleImportWorkflow = (data: { nodes: NodeData[], connections: Connection[], transform?: CanvasTransform, projectName?: string }) => {
      // 保存当前有内容的节点到历史
      const withContent = nodes.filter(n => n.imageSrc || n.videoSrc);
      if (withContent.length > 0) setDeletedNodes(prev => [...prev, ...withContent]);
      
      setNodes(data.nodes);
      setConnections(data.connections);
      if (data.transform) setTransform(data.transform);
      if (data.projectName) setProjectName(data.projectName);
      setSelectedNodeIds(new Set());
  };

  const updateNodeData = useCallback((id: string, updates: Partial<NodeData>) => {
    setNodes(prev => prev.map(n => n.id === id ? { ...n, ...updates } : n));
  }, []);

  const handleGenerate = async (nodeId: string) => {
    const node = nodes.find(n => n.id === nodeId);
    if (!node) return;
    updateNodeData(nodeId, { isLoading: true });
    
    const inputs = getInputImages(node.id);
    
    // Debug: Log input images for troubleshooting
    console.log(`[Generation] Node: ${node.title} (${node.type}), Input Images:`, inputs.length > 0 ? inputs.map(i => i.substring(0, 50) + '...') : 'None');

    try {
      if (node.type === NodeType.CREATIVE_DESC) {
        const res = await generateCreativeDescription(node.prompt || '', node.model === 'TEXT_TO_VIDEO' ? 'VIDEO' : 'IMAGE', node.model);
        updateNodeData(nodeId, { optimizedPrompt: res, isLoading: false });
      } else {
          let results: string[] = [];
          
          // Image generation
          if (node.type === NodeType.TEXT_TO_IMAGE) {
            results = await generateImage(
                node.prompt || '', node.aspectRatio, node.model, node.resolution, node.count || 1, inputs, node.promptOptimize 
            );
          }
          // Video generation 
          else if (node.type === NodeType.TEXT_TO_VIDEO) {
            results = await generateVideo(
                node.prompt || '', inputs, node.aspectRatio, node.model, node.resolution, node.duration, node.count || 1, node.promptOptimize
            );
          }
          // Start-End Frame to Video generation (首尾帧模式)
          else if (node.type === NodeType.START_END_TO_VIDEO) {
            // 添加 _FL 后缀来标识首尾帧模式
            const modelWithFL = (node.model || 'Seedance 1.5 Pro') + '_FL';
            // 如果设置了 swapFrames，交换首尾帧顺序
            const orderedInputs = node.swapFrames && inputs.length >= 2 ? [inputs[1], inputs[0]] : inputs;
            results = await generateVideo(
                node.prompt || '', orderedInputs, node.aspectRatio, modelWithFL, node.resolution, node.duration, node.count || 1, node.promptOptimize
            );
          }

          if (results.length > 0) {
              const currentArtifacts = node.outputArtifacts || [];
              if (node.imageSrc && !currentArtifacts.includes(node.imageSrc)) currentArtifacts.push(node.imageSrc);
              if (node.videoSrc && !currentArtifacts.includes(node.videoSrc)) currentArtifacts.push(node.videoSrc);
              const newArtifacts = [...results, ...currentArtifacts];
              
              const updates: Partial<NodeData> = { isLoading: false, outputArtifacts: newArtifacts };
              
              // Set output based on node type
              if (node.type === NodeType.TEXT_TO_IMAGE) {
                  updates.imageSrc = results[0];
              } else if (node.type === NodeType.TEXT_TO_VIDEO || node.type === NodeType.START_END_TO_VIDEO) {
                  updates.videoSrc = results[0];
              }
              
              updateNodeData(nodeId, updates);
          } else {
              throw new Error("未返回结果");
          }
      }
    } catch (e) {
      console.error(e);
      alert(`生成失败: ${(e as Error).message}`);
      updateNodeData(nodeId, { isLoading: false });
    }
  };

  const handleAnalyzeMedia = async (nodeId: string) => {
      const node = nodes.find(n => n.id === nodeId);
      if (!node) return;
      const inputMedia = getInputMedia(node.id).filter(item => item.type === 'image' || item.type === 'video');
      if (!inputMedia.length) {
          alert("请先把图片或视频节点连接到文本节点前面");
          return;
      }

      updateNodeData(nodeId, { isLoading: true });
      try {
          const text = await analyzeConnectedMedia(node.prompt || '', inputMedia, node.model);
          updateNodeData(nodeId, {
              optimizedPrompt: text,
              prompt: node.prompt || text,
              isLoading: false
          });
      } catch (e) {
          console.error(e);
          alert(`分析失败: ${(e as Error).message}`);
          updateNodeData(nodeId, { isLoading: false });
      }
  };

  const handleAnalyzeScript = async (nodeId: string) => {
      const node = nodes.find(n => n.id === nodeId);
      if (!node) return;
      if (!node.prompt?.trim()) {
          alert("请先在文本节点里输入或粘贴剧本内容");
          return;
      }

      updateNodeData(nodeId, { isLoading: true });
      try {
          const text = await analyzeScriptAssets(node.prompt, node.model);
          updateNodeData(nodeId, { optimizedPrompt: text, isLoading: false });
      } catch (e) {
          console.error(e);
          alert(`剧本分析失败: ${(e as Error).message}`);
          updateNodeData(nodeId, { isLoading: false });
      }
  };

  const handleMaximize = (nodeId: string) => {
      const node = nodes.find(n => n.id === nodeId);
      if (!node) return;
      if (node.videoSrc) setPreviewMedia({ url: node.videoSrc, type: 'video' });
      else if (node.imageSrc) setPreviewMedia({ url: node.imageSrc, type: 'image' });
      else alert("没有可预览的内容");
  };
  
  const handleHistoryPreview = (url: string, type: 'image' | 'video') => setPreviewMedia({ url, type });

  const handlePreviewReference = (item: InputMedia) => {
      if (item.type === 'text') {
          setPreviewText({ title: item.title || '参考文本', text: item.text || '' });
          return;
      }
      setPreviewMedia({ url: item.url, type: item.type });
  };

  const handleCropStart = (nodeId: string) => {
      const node = nodes.find(n => n.id === nodeId);
      if (!node?.imageSrc) {
          alert("当前节点没有可裁剪的图片");
          return;
      }
      setCropTarget({ nodeId, imageSrc: node.imageSrc, title: node.title, aspectRatio: node.aspectRatio || '1:1' });
  };

  const handleCropConfirm = (croppedSrc: string, naturalWidth: number, naturalHeight: number, aspectRatio: string) => {
      void naturalWidth;
      void naturalHeight;
      if (!cropTarget) return;
      const source = nodes.find(n => n.id === cropTarget.nodeId);
      const { width, height } = getNodeSizeForAspectRatio(aspectRatio);
      const newId = generateId();
      const newNode: NodeData = {
          id: newId,
          type: NodeType.TEXT_TO_IMAGE,
          x: source ? source.x + source.width + 80 : 80,
          y: source ? source.y : 80,
          width,
          height,
          title: `裁剪_${cropTarget.title}`.slice(0, 24),
          imageSrc: croppedSrc,
          aspectRatio,
          model: source?.model || 'Seedream 5.0',
          resolution: source?.resolution || '1k',
          count: 1,
          prompt: source?.prompt || '',
          outputArtifacts: [croppedSrc]
      };

      setNodes(prev => [...prev, newNode]);
      if (source) {
          setConnections(prev => [...prev, { id: generateId(), sourceId: source.id, targetId: newId }]);
      }
      setSelectedNodeIds(new Set([newId]));
      setCropTarget(null);
  };

  const handleMultiAngleGenerate = async (nodeId: string, options: MultiAngleOptions) => {
      const source = nodes.find(n => n.id === nodeId);
      if (!source?.imageSrc) {
          alert("当前节点没有可用于多角度控制的图片");
          return;
      }
      if (!options.angles.length) {
          alert("请至少选择一个角度");
          return;
      }

      updateNodeData(nodeId, { isLoading: true });
      try {
          const results = await generateMultiAngleImages(source.imageSrc, {
              ...options,
              countPerAngle: 1,
          });
          if (!results.length) throw new Error("未返回多角度结果");

          const baseAspectRatio = options.aspectRatio && options.aspectRatio !== 'source'
              ? options.aspectRatio
              : (source.aspectRatio || '1:1');
          const { width, height } = getNodeSizeForAspectRatio(baseAspectRatio);
          const gapX = width + 80;
          const gapY = height + 70;
          const newNodes = results.map((result, index) => {
              const column = index % 3;
              const row = Math.floor(index / 3);
              const id = generateId();
              const title = `${result.label || result.angle}_${source.title}`.slice(0, 24);
              return {
                  id,
                  type: NodeType.TEXT_TO_IMAGE,
                  x: source.x + source.width + 90 + column * gapX,
                  y: source.y + row * gapY,
                  width,
                  height,
                  title,
                  imageSrc: result.url,
                  aspectRatio: baseAspectRatio,
                  model: source.model || 'Seedream 5.0',
                  resolution: source.resolution || '1k',
                  count: 1,
                  prompt: result.prompt || options.prompt || source.prompt || '',
                  outputArtifacts: [result.url]
              } satisfies NodeData;
          });

          setNodes(prev => [...prev, ...newNodes]);
          setConnections(prev => [
              ...prev,
              ...newNodes.map(node => ({ id: generateId(), sourceId: source.id, targetId: node.id }))
          ]);
          setSelectedNodeIds(new Set(newNodes.map(node => node.id)));
          updateNodeData(nodeId, { isLoading: false });
      } catch (e) {
          console.error(e);
          alert(`多角度生成失败: ${(e as Error).message}`);
          updateNodeData(nodeId, { isLoading: false });
      }
  };

  const copyImageToClipboard = async (nodeId: string) => {
      const node = nodes.find(n => n.id === nodeId);
      if (node && node.imageSrc) {
          try {
              const res = await fetch(node.imageSrc);
              const blob = await res.blob();
              await navigator.clipboard.write([new ClipboardItem({ [blob.type]: blob as Blob })]);
              alert("图片已复制到剪贴板");
          } catch (e) { console.error(e); alert("复制图片失败"); }
      }
  };

  const triggerReplaceImage = (nodeId: string) => {
      nodeToReplaceRef.current = nodeId;
      replaceImageRef.current?.click();
  };

  const handleReplaceImage = (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      const nodeId = nodeToReplaceRef.current;
      if (file && nodeId) {
          if (file.type.startsWith('video/')) {
              const url = URL.createObjectURL(file);
              const video = document.createElement('video');
              video.preload = 'metadata';
              video.onloadedmetadata = () => {
                  const node = nodes.find(n => n.id === nodeId);
                  if (node) {
                      const aspectRatio = getClosestAspectRatio(video.videoWidth, video.videoHeight, VIDEO_ASPECT_RATIOS);
                      const nodeSize = getNodeSizeForAspectRatio(aspectRatio, VIDEO_NODE_BASE_HEIGHT);
                      const currentArtifacts = node.outputArtifacts || [];
                      const newArtifacts = [url, ...currentArtifacts];
                      updateNodeData(nodeId, {
                          type: NodeType.TEXT_TO_VIDEO,
                          videoSrc: url,
                          imageSrc: undefined,
                          title: file.name,
                          width: nodeSize.width,
                          height: nodeSize.height,
                          aspectRatio,
                          model: node.model || 'Seedance 1.5 Pro',
                          resolution: node.resolution || '720p',
                          duration: node.duration || '5s',
                          outputArtifacts: newArtifacts
                      });
                  }
              };
              video.src = url;
          } else if (file.type.startsWith('image/')) {
           const reader = new FileReader();
           reader.onload = (event) => {
               const img = new Image();
               img.onload = () => {
                   const node = nodes.find(n => n.id === nodeId);
                   if (node) {
                        const aspectRatio = getClosestAspectRatio(img.width, img.height, IMAGE_ASPECT_RATIOS);
                        const { width, height } = getNodeSizeForAspectRatio(aspectRatio);
                        const src = event.target?.result as string;
                        const currentArtifacts = node.outputArtifacts || [];
                        const newArtifacts = [src, ...currentArtifacts];
                        updateNodeData(nodeId, { 
                            type: NodeType.TEXT_TO_IMAGE,
                            imageSrc: src,
                            videoSrc: undefined,
                            title: file.name || node.title,
                            width, height,
                            aspectRatio,
                            model: node.model || 'Seedream 5.0',
                            resolution: node.resolution || '1k',
                            outputArtifacts: newArtifacts
                        });
                   }
               };
               img.src = event.target?.result as string;
           };
           reader.readAsDataURL(file);
          }
      }
      if (replaceImageRef.current) replaceImageRef.current.value = '';
      nodeToReplaceRef.current = null;
  };

  const triggerAttachInput = (nodeId: string) => {
      nodeToAttachInputRef.current = nodeId;
      attachInputRef.current?.click();
  };

  const addInputSourceNode = (targetId: string, source: NodeData) => {
      const target = nodes.find(n => n.id === targetId);
      const upstreamCount = connections.filter(c => c.targetId === targetId).length;
      const x = target ? target.x - source.width - 90 : source.x;
      const y = target ? target.y + upstreamCount * 80 : source.y;
      const sourceNode = { ...source, x, y };
      setNodes(prev => [...prev, sourceNode]);
      setConnections(prev => [...prev, { id: generateId(), sourceId: sourceNode.id, targetId }]);
      setSelectedNodeIds(new Set([targetId]));
  };

  const handleAttachInputAsset = (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      const targetId = nodeToAttachInputRef.current;
      if (!file || !targetId) {
          if (attachInputRef.current) attachInputRef.current.value = '';
          nodeToAttachInputRef.current = null;
          return;
      }

      const baseTitle = file.name || `本地素材_${new Date().toLocaleTimeString()}`;
      if (file.type.startsWith('image/')) {
          const reader = new FileReader();
          reader.onload = (event) => {
              const img = new Image();
              img.onload = () => {
                  const aspectRatio = getClosestAspectRatio(img.width, img.height, IMAGE_ASPECT_RATIOS);
                  const { width, height } = getNodeSizeForAspectRatio(aspectRatio);
                  const src = event.target?.result as string;
                  addInputSourceNode(targetId, {
                      id: generateId(),
                      type: NodeType.TEXT_TO_IMAGE,
                      x: 0,
                      y: 0,
                      width,
                      height,
                      title: baseTitle,
                      imageSrc: src,
                      aspectRatio,
                      model: 'Seedream 5.0',
                      resolution: '1k',
                      count: 1,
                      prompt: '',
                      outputArtifacts: [src],
                  });
              };
              img.src = event.target?.result as string;
          };
          reader.readAsDataURL(file);
      } else if (file.type.startsWith('video/')) {
          const url = URL.createObjectURL(file);
          const video = document.createElement('video');
          video.preload = 'metadata';
          video.onloadedmetadata = () => {
              const aspectRatio = getClosestAspectRatio(video.videoWidth, video.videoHeight, VIDEO_ASPECT_RATIOS);
              const { width, height } = getNodeSizeForAspectRatio(aspectRatio, VIDEO_NODE_BASE_HEIGHT);
              addInputSourceNode(targetId, {
                  id: generateId(),
                  type: NodeType.TEXT_TO_VIDEO,
                  x: 0,
                  y: 0,
                  width,
                  height,
                  title: baseTitle,
                  videoSrc: url,
                  aspectRatio,
                  model: 'Seedance 1.5 Pro',
                  resolution: '720p',
                  duration: '5s',
                  count: 1,
                  prompt: '',
                  outputArtifacts: [url],
              });
          };
          video.src = url;
      } else {
          const reader = new FileReader();
          reader.onload = (event) => {
              const text = String(event.target?.result || '');
              addInputSourceNode(targetId, {
                  id: generateId(),
                  type: NodeType.CREATIVE_DESC,
                  x: 0,
                  y: 0,
                  width: 520,
                  height: 520,
                  title: baseTitle,
                  aspectRatio: '1:1',
                  model: 'Xiaomi MiMo 2.5 Pro',
                  count: 1,
                  prompt: text,
                  optimizedPrompt: text,
                  outputArtifacts: [],
              });
          };
          reader.readAsText(file, 'utf-8');
      }

      if (attachInputRef.current) attachInputRef.current.value = '';
      nodeToAttachInputRef.current = null;
  };

  const handleSaveWorkflow = () => {
    const workflowData = { nodes, connections, transform, projectName, version: "1.0" };
    const blob = new Blob([JSON.stringify(workflowData, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    const safeName = projectName.replace(/[<>:"/\\|?*]/g, '_').trim() || '未命名项目';
    link.download = `${safeName}.aistudio-flow`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleNewWorkflow = () => setShowNewWorkflowDialog(true);
  
  const handleConfirmNew = (shouldSave: boolean) => {
    if (shouldSave) handleSaveWorkflow();
    const withContent = nodes.filter(n => n.imageSrc || n.videoSrc);
    if (withContent.length > 0) setDeletedNodes(prev => [...prev, ...withContent]);
    setNodes([]);
    setConnections([]);
    setTransform({ x: 0, y: 0, k: 1 });
    setProjectName('KC画布 MVP 试用项目');
    setShowNewWorkflowDialog(false);
    setSelectedNodeIds(new Set());
    setSelectionBox(null);
  };

  const handleLoadWorkflow = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
        try {
            const data = JSON.parse(event.target?.result as string);
            if (data.nodes && data.connections) {
                setNodes(data.nodes);
                setConnections(data.connections);
                if (data.transform) setTransform(data.transform);
                if (data.projectName) setProjectName(data.projectName);
            }
        } catch (err) { console.error(err); alert("Invalid workflow file"); }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const handleDownload = async (nodeId: string) => {
      const node = nodes.find(n => n.id === nodeId);
      if (!node) return;
      const url = node.videoSrc || node.imageSrc;
      if (!url) { alert("No content to download."); return; }
      
      const ext = node.videoSrc ? 'mp4' : 'png';
      const filename = `${node.title.replace(/\s+/g, '_')}_${Date.now()}.${ext}`;

      try {
          const response = await fetch(url);
          const blob = await response.blob();
          
          // Try storage service first
          const saved = await storageService.saveFile(blob, filename);
          if (saved) return;

          const blobUrl = URL.createObjectURL(blob as Blob);
          const link = document.createElement('a');
          link.href = blobUrl;
          link.download = filename;
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);
          URL.revokeObjectURL(blobUrl);
      } catch (e) {
          const link = document.createElement('a');
          link.href = url;
          link.download = filename;
          link.target = "_blank"; 
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);
      }
  };

  const handleImportAsset = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    const rect = containerRef.current?.getBoundingClientRect();
    const center = rect ? screenToWorld(rect.width / 2, rect.height / 2) : { x: 0, y: 0 };
    
    if (file.type.startsWith('image/')) {
        const reader = new FileReader();
        reader.onload = (event) => {
            const img = new Image();
            img.onload = () => {
                 const aspectRatio = getClosestAspectRatio(img.width, img.height, IMAGE_ASPECT_RATIOS);
                 const { width, height } = getNodeSizeForAspectRatio(aspectRatio);
                 const src = event.target?.result as string;
                 addNode(NodeType.TEXT_TO_IMAGE, center.x - width/2, center.y - height/2, {
                     width, height, imageSrc: src, title: file.name, aspectRatio, model: 'Seedream 5.0', resolution: '1k', outputArtifacts: [src]
                 });
            };
            img.src = event.target?.result as string;
        };
        reader.readAsDataURL(file);
    } else if (file.type.startsWith('video/')) {
        const url = URL.createObjectURL(file);
        const video = document.createElement('video');
        video.preload = 'metadata';
        video.onloadedmetadata = () => {
            const aspectRatio = getClosestAspectRatio(video.videoWidth, video.videoHeight, VIDEO_ASPECT_RATIOS);
            const { width, height } = getNodeSizeForAspectRatio(aspectRatio, VIDEO_NODE_BASE_HEIGHT);
            addNode(NodeType.TEXT_TO_VIDEO, center.x - width/2, center.y - height/2, {
                width, height, videoSrc: url, title: file.name, aspectRatio, model: 'Seedance 1.5 Pro', resolution: '720p', duration: '5s', outputArtifacts: [url]
            });
        };
        video.src = url;
    }
    e.target.value = '';
  };

  const handleDragOver = (e: React.DragEvent) => { e.preventDefault(); e.stopPropagation(); };

  const handleDrop = (e: React.DragEvent) => {
      e.preventDefault(); e.stopPropagation();
      const files: File[] = Array.from(e.dataTransfer.files); 
      if (files.length === 0) return;
      const worldPos = screenToWorld(e.clientX, e.clientY);
      files.forEach((file, index) => {
          const offsetX = index * 20; const offsetY = index * 20;
          if (file.type.startsWith('image/')) {
              const reader = new FileReader();
              reader.onload = (event) => {
                  const src = event.target?.result as string;
                  const img = new Image();
                  img.onload = () => {
                       const aspectRatio = getClosestAspectRatio(img.width, img.height, IMAGE_ASPECT_RATIOS);
                       const { width, height } = getNodeSizeForAspectRatio(aspectRatio);
                       addNode(NodeType.TEXT_TO_IMAGE, worldPos.x - width/2 + offsetX, worldPos.y - height/2 + offsetY, {
                           width, height, imageSrc: src, title: file.name, aspectRatio, model: 'Seedream 5.0', resolution: '1k', outputArtifacts: [src]
                       });
                  };
                  img.src = src;
              };
              reader.readAsDataURL(file);
          } else if (file.type.startsWith('video/')) {
              const url = URL.createObjectURL(file);
              const video = document.createElement('video');
              video.preload = 'metadata';
              video.onloadedmetadata = () => {
                  const aspectRatio = getClosestAspectRatio(video.videoWidth, video.videoHeight, VIDEO_ASPECT_RATIOS);
                  const { width, height } = getNodeSizeForAspectRatio(aspectRatio, VIDEO_NODE_BASE_HEIGHT);
                  addNode(NodeType.TEXT_TO_VIDEO, worldPos.x - width/2 + offsetX, worldPos.y - height/2 + offsetY, {
                       width, height, videoSrc: url, title: file.name, aspectRatio, model: 'Seedance 1.5 Pro', resolution: '720p', duration: '5s', outputArtifacts: [url]
                   });
              };
              video.src = url;
          }
      });
  };

  const handleWheel = (e: React.WheelEvent) => {
    if (e.ctrlKey || e.metaKey) e.preventDefault();
    const zoomIntensity = 0.1;
    const direction = e.deltaY > 0 ? -1 : 1;
    let newK = transform.k + direction * zoomIntensity;
    newK = Math.min(Math.max(0.4, newK), 2); 
    const rect = containerRef.current!.getBoundingClientRect();
    const worldX = (e.clientX - rect.left - transform.x) / transform.k;
    const worldY = (e.clientY - rect.top - transform.y) / transform.k;
    setTransform({ x: (e.clientX - rect.left) - worldX * newK, y: (e.clientY - rect.top) - worldY * newK, k: newK });
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    if (contextMenu) setContextMenu(null);
    if (quickAddMenu) setQuickAddMenu(null);
    if (selectedConnectionId) setSelectedConnectionId(null);
    if (e.button === 1 || (e.button === 0 && spacePressed.current)) {
      setDragMode('PAN');
      dragStartRef.current = { x: e.clientX, y: e.clientY };
      initialTransformRef.current = { ...transform };
      e.preventDefault(); return;
    }
    if (e.target === containerRef.current && e.button === 0) {
        setDragMode('SELECT');
        dragStartRef.current = { x: e.clientX, y: e.clientY };
        setSelectionBox({ x: 0, y: 0, w: 0, h: 0 }); 
        if (!e.shiftKey) setSelectedNodeIds(new Set());
    }
  };

  const handleNodeMouseDown = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    if (contextMenu) setContextMenu(null);
    if (quickAddMenu) setQuickAddMenu(null);
    if (selectedConnectionId) setSelectedConnectionId(null);
    if (e.button === 0) {
        setDragMode('DRAG_NODE');
        dragStartRef.current = { x: e.clientX, y: e.clientY };
        const isAlreadySelected = selectedNodeIds.has(id);
        let newSelection = new Set(selectedNodeIds);
        if (e.shiftKey) { isAlreadySelected ? newSelection.delete(id) : newSelection.add(id); } else { if (!isAlreadySelected) { newSelection.clear(); newSelection.add(id); } }
        setSelectedNodeIds(newSelection);
        initialNodePositionsRef.current = nodes.map(n => ({ id: n.id, x: n.x, y: n.y }));
    }
  };

  const handleNodeContextMenu = (e: React.MouseEvent, id: string, type: NodeType) => {
      e.stopPropagation(); e.preventDefault();
      const worldPos = screenToWorld(e.clientX, e.clientY);
      setContextMenu({ type: 'NODE', nodeId: id, nodeType: type, x: e.clientX, y: e.clientY, worldX: worldPos.x, worldY: worldPos.y });
      if (!selectedNodeIds.has(id)) setSelectedNodeIds(new Set([id]));
  };

  const handleCanvasContextMenu = (e: React.MouseEvent) => {
      e.preventDefault();
      const worldPos = screenToWorld(e.clientX, e.clientY);
      setContextMenu({ type: 'CANVAS', x: e.clientX, y: e.clientY, worldX: worldPos.x, worldY: worldPos.y });
  };

  const handleResizeStart = (e: React.MouseEvent, nodeId: string) => {
      e.stopPropagation(); e.preventDefault();
      const node = nodes.find(n => n.id === nodeId);
      if (!node) return;
      setDragMode('RESIZE_NODE');
      dragStartRef.current = { x: e.clientX, y: e.clientY, w: node.width, h: node.height, nodeId: nodeId };
      setSelectedNodeIds(new Set([nodeId]));
  };

  const handleConnectStart = (e: React.MouseEvent, nodeId: string, type: 'source' | 'target') => {
    e.stopPropagation(); e.preventDefault();
    connectionStartRef.current = { nodeId, type };
    setDragMode('CONNECT');
    setTempConnection(screenToWorld(e.clientX, e.clientY));
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    lastMousePosRef.current = { x: e.clientX, y: e.clientY };
    const worldPos = screenToWorld(e.clientX, e.clientY);
    if (dragMode !== 'NONE' && e.buttons === 0) { setDragMode('NONE'); dragStartRef.current = { x: 0, y: 0 }; return; }
    if (dragMode === 'PAN') {
      setTransform({ ...initialTransformRef.current, x: initialTransformRef.current.x + (e.clientX - dragStartRef.current.x), y: initialTransformRef.current.y + (e.clientY - dragStartRef.current.y) });
    } else if (dragMode === 'DRAG_NODE') {
      const dx = (e.clientX - dragStartRef.current.x) / transform.k;
      const dy = (e.clientY - dragStartRef.current.y) / transform.k;
      setNodes(prev => prev.map(n => { if (selectedNodeIds.has(n.id)) { const initial = initialNodePositionsRef.current.find(init => init.id === n.id); if (initial) return { ...n, x: initial.x + dx, y: initial.y + dy }; } return n; }));
    } else if (dragMode === 'SELECT') {
        const x = Math.min(dragStartRef.current.x, e.clientX);
        const y = Math.min(dragStartRef.current.y, e.clientY);
        const w = Math.abs(e.clientX - dragStartRef.current.x);
        const h = Math.abs(e.clientY - dragStartRef.current.y);
        setSelectionBox({ x: x - containerRef.current!.getBoundingClientRect().left, y: y - containerRef.current!.getBoundingClientRect().top, w, h });
        const worldStartX = (x - containerRef.current!.getBoundingClientRect().left - transform.x) / transform.k;
        const worldStartY = (y - containerRef.current!.getBoundingClientRect().top - transform.y) / transform.k;
        const worldWidth = w / transform.k; const worldHeight = h / transform.k;
        const newSelection = new Set<string>();
        nodes.forEach(n => { if (n.x < worldStartX + worldWidth && n.x + n.width > worldStartX && n.y < worldStartY + worldHeight && n.y + n.height > worldStartY) newSelection.add(n.id); });
        setSelectedNodeIds(newSelection);
    } else if (dragMode === 'CONNECT') {
        setTempConnection(worldPos);
        const start = connectionStartRef.current;
        if (start) {
            const candidates = nodes.filter(n => n.id !== start.nodeId)
                // 正向起点(source)：候选为合法的下游节点；反向起点(target)：候选为合法的上游节点
                .filter(n => start.type === 'source' ? canConnectNodes(start.nodeId, n.id) : canConnectNodes(n.id, start.nodeId))
                .map(n => ({ node: n, dist: Math.sqrt(Math.pow(worldPos.x - (n.x + n.width/2), 2) + Math.pow(worldPos.y - (n.y + n.height/2), 2)) }))
                .filter(item => item.dist < 500).sort((a, b) => a.dist - b.dist).slice(0, 3).map(item => item.node);
            setSuggestedNodes(candidates);
        }
    } else if (dragMode === 'RESIZE_NODE') {
        const nodeId = dragStartRef.current.nodeId;
        const node = nodes.find(n => n.id === nodeId);
        if (node) {
            const dx = (e.clientX - dragStartRef.current.x) / transform.k;
            let ratio = 1.33; 
            if (node.aspectRatio) { const [w, h] = node.aspectRatio.split(':').map(Number); if (!isNaN(w) && !isNaN(h) && h !== 0) ratio = w / h; } 
            else if (node.type === NodeType.ORIGINAL_IMAGE) { ratio = (dragStartRef.current.w || 1) / (dragStartRef.current.h || 1); }
            let minWidth = 150;
            if (node.type !== NodeType.CREATIVE_DESC) {
                const limit1 = ratio >= 1 ? 400 * ratio : 400;
                minWidth = Math.max(limit1, 400); 
            } else minWidth = 280;
            let newWidth = Math.max(minWidth, (dragStartRef.current.w || 0) + dx);
            setNodes(prev => prev.map(n => n.id === nodeId ? { ...n, width: newWidth, height: newWidth / ratio } : n));
        }
    }
  };

  const handleMouseUp = (e: React.MouseEvent) => {
    // 连线拖到空白处释放：弹出快捷新建菜单。正向(从输出端口拖出)新建下游节点，反向(从输入端口拖出)新建上游节点。
    if (dragMode === 'CONNECT' && connectionStartRef.current) {
         const world = screenToWorld(e.clientX, e.clientY);
         const direction = connectionStartRef.current.type === 'source' ? 'forward' : 'backward';
         setQuickAddMenu({ sourceId: connectionStartRef.current.nodeId, x: e.clientX, y: e.clientY, worldX: world.x, worldY: world.y, direction });
    }
    if (dragMode !== 'NONE') { setDragMode('NONE'); setTempConnection(null); connectionStartRef.current = null; setSuggestedNodes([]); setSelectionBox(null); }
  };

  // 校验一条 source→target 连线是否合法（与拖拽方向无关）。
  const canConnectNodes = (sourceId: string, targetId: string): boolean => {
      if (!sourceId || !targetId || sourceId === targetId) return false;
      const source = nodes.find(n => n.id === sourceId);
      const target = nodes.find(n => n.id === targetId);
      if (!source || !target) return false;
      // 原始图片节点为纯输入素材，没有输入端口，不可作为下游目标。
      if (target.type === NodeType.ORIGINAL_IMAGE) return false;
      const sourceCategory = NODE_MEDIA_CATEGORY[source.type];
      const targetCategory = NODE_MEDIA_CATEGORY[target.type];
      return ALLOWED_SOURCE_CATEGORIES[targetCategory]?.includes(sourceCategory) ?? false;
  };

  const createConnection = (sourceId: string, targetId: string) => {
      if (canConnectNodes(sourceId, targetId) && !connections.some(c => c.sourceId === sourceId && c.targetId === targetId)) {
          setConnections(prev => [...prev, { id: generateId(), sourceId, targetId }]);
      }
      setDragMode('NONE'); setTempConnection(null); connectionStartRef.current = null; setSuggestedNodes([]);
  };

  const handlePortMouseUp = (e: React.MouseEvent, nodeId: string, type: 'source' | 'target') => {
      const start = connectionStartRef.current;
      if (dragMode !== 'CONNECT' || !start) return;
      // 在发起连接的同一节点上释放：视为未拖出连线，交由画布默认逻辑处理(如正向的快捷添加菜单)。
      if (start.nodeId === nodeId) return;
      e.stopPropagation(); e.preventDefault();
      // 正向：从输出端口(source)拖出，落到目标节点的输入端口(target)
      if (start.type === 'source' && type === 'target') createConnection(start.nodeId, nodeId);
      // 反向：从输入端口(target)拖出，落到上游节点的输出端口(source)
      else if (start.type === 'target' && type === 'source') createConnection(nodeId, start.nodeId);
  };

  const deleteNode = (id: string) => {
      const node = nodes.find(n => n.id === id);
      if (node && (node.imageSrc || node.videoSrc)) setDeletedNodes(prev => [...prev, node]);
      setNodes(prev => prev.filter(n => n.id !== id));
      setConnections(prev => prev.filter(c => c.sourceId !== id && c.targetId !== id));
  };

  const removeConnection = (id: string) => { setConnections(prev => prev.filter(c => c.id !== id)); setSelectedConnectionId(null); };

  const renderNewWorkflowDialog = () => {
      if (!showNewWorkflowDialog) return null;
      return (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/60 backdrop-blur-sm animate-in fade-in duration-200" onClick={() => setShowNewWorkflowDialog(false)}>
            <div className={`w-[400px] p-6 rounded-2xl shadow-2xl border flex flex-col gap-4 transform transition-all scale-100 ${isDark ? 'bg-[#1A1D21] border-zinc-700 text-gray-200' : 'bg-white border-gray-200 text-gray-800'}`} onClick={(e) => e.stopPropagation()}>
                <div>
                    <h3 className="text-lg font-bold flex items-center gap-2"><Icons.FilePlus size={20} className="text-blue-500"/>新建工作流</h3>
                    <p className={`text-xs mt-2 leading-relaxed ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>是否在创建新工作流之前保存当前工作流？<br/>任何未保存的更改将永久丢失。</p>
                </div>
                <div className={`flex justify-end gap-2 mt-2 pt-4 border-t ${isDark ? 'border-zinc-800' : 'border-gray-100'}`}>
                    <button onClick={() => setShowNewWorkflowDialog(false)} className={`px-4 py-2 rounded-lg text-xs font-medium transition-colors ${isDark ? 'hover:bg-zinc-800 text-gray-400' : 'hover:bg-gray-100 text-gray-600'}`}>取消</button>
                    <button onClick={() => handleConfirmNew(false)} className={`px-4 py-2 rounded-lg text-xs font-bold transition-colors ${isDark ? 'bg-red-500/10 text-red-400 hover:bg-red-500/20 border border-red-500/20' : 'bg-red-50 text-red-600 hover:bg-red-100 border border-red-200'}`}>不保存</button>
                    <button onClick={() => handleConfirmNew(true)} className={`px-4 py-2 rounded-lg text-xs font-bold text-white transition-colors shadow-lg shadow-blue-500/20 flex items-center gap-1.5 ${isDark ? 'bg-blue-600 hover:bg-blue-500' : 'bg-blue-500 hover:bg-blue-400'}`}><Icons.Save size={14}/>保存并新建</button>
                </div>
            </div>
        </div>
      );
  };

  const renderContextMenu = () => {
    if (!contextMenu) return null;
    return (
        <div className={`fixed z-50 border rounded-xl shadow-2xl py-2 min-w-[180px] flex flex-col backdrop-blur-xl animate-in fade-in zoom-in-95 duration-100 ${isDark ? 'bg-zinc-900/95 border-zinc-700/80' : 'bg-white/95 border-gray-200'}`} style={{ left: contextMenu.x, top: contextMenu.y }} onMouseDown={(e) => e.stopPropagation()}>
            {contextMenu.type === 'NODE' && contextMenu.nodeId && (() => {
                const menuItemClass = `text-left px-3 py-2 text-xs transition-all duration-150 flex items-center gap-2.5 rounded-md mx-1 ${isDark ? 'text-gray-300 hover:bg-zinc-800/80 hover:text-white' : 'text-gray-700 hover:bg-gray-100 hover:text-black'}`;
                const node = nodes.find(n => n.id === contextMenu.nodeId);
                const canToggleVideoType = node?.type === NodeType.TEXT_TO_VIDEO || node?.type === NodeType.START_END_TO_VIDEO;
                
                return (
                    <>
                        <button className={menuItemClass} onClick={() => { performCopy(); setContextMenu(null); }}>
                            <Icons.Copy size={14}/> 复制节点
                        </button>
                        {contextMenu.nodeType === NodeType.ORIGINAL_IMAGE && (
                            <button className={menuItemClass} onClick={() => { triggerReplaceImage(contextMenu.nodeId!); setContextMenu(null); }}>
                                <Icons.Upload size={14}/> 替换素材
                            </button>
                        )}
                        {canToggleVideoType && (
                            <button className={menuItemClass} onClick={() => { if (contextMenu.nodeId) { const newNode = nodes.find(n => n.id === contextMenu.nodeId); if (newNode) { const newType = newNode.type === NodeType.TEXT_TO_VIDEO ? NodeType.START_END_TO_VIDEO : NodeType.TEXT_TO_VIDEO; updateNodeData(contextMenu.nodeId, { type: newType, title: newType === NodeType.START_END_TO_VIDEO ? '首尾帧视频' : '生视频' }); } setContextMenu(null); } }}>
                                <Icons.RefreshCw size={14}/> {node?.type === NodeType.TEXT_TO_VIDEO ? '切换为首尾帧模式' : '切换为普通视频模式'}
                            </button>
                        )}
                        <button className={menuItemClass} onClick={() => { if (contextMenu.nodeId) copyImageToClipboard(contextMenu.nodeId); setContextMenu(null); }}>
                            <Icons.Image size={14}/> 复制图片数据
                        </button>
                        <div className={`h-px my-1.5 mx-2 ${isDark ? 'bg-zinc-700' : 'bg-gray-200'}`}></div>
                        <button className={`text-left px-3 py-2 text-xs transition-all duration-150 flex items-center gap-2.5 rounded-md mx-1 text-red-400 ${isDark ? 'hover:bg-red-500/10 hover:text-red-300' : 'hover:bg-red-50 hover:text-red-600'}`} onClick={() => { if (contextMenu.nodeId) deleteNode(contextMenu.nodeId); setContextMenu(null); }}>
                            <Icons.Trash2 size={14}/> 删除
                        </button>
                    </>
                );
            })()}
            {contextMenu.type === 'CANVAS' && (() => {
                const menuItemClass = `text-left px-3 py-2 text-xs transition-all duration-150 flex items-center gap-2.5 rounded-md mx-1 ${isDark ? 'text-gray-300 hover:bg-zinc-800/80 hover:text-white' : 'text-gray-700 hover:bg-gray-100 hover:text-black'}`;
                return (
                    <>
                        <button className={`${menuItemClass} ${!internalClipboard ? 'opacity-40 cursor-not-allowed' : ''}`} onClick={() => { performPaste({ x: contextMenu.worldX, y: contextMenu.worldY }); setContextMenu(null); }} disabled={!internalClipboard}>
                            <Icons.Copy size={14}/> 粘贴
                        </button>
                        <div className={`h-px my-1.5 mx-2 ${isDark ? 'bg-zinc-700' : 'bg-gray-200'}`}></div>
                        <div className={`px-3 py-1 text-[9px] font-semibold uppercase tracking-wider ${isDark ? 'text-zinc-500' : 'text-gray-400'}`}>添加节点</div>
                        <button className={menuItemClass} onClick={() => { addNode(NodeType.TEXT_TO_IMAGE, contextMenu.worldX, contextMenu.worldY); setContextMenu(null); }}>
                            <div className="w-5 h-5 rounded bg-cyan-500/10 flex items-center justify-center"><Icons.Image size={12} className="text-cyan-400"/></div>
                            <span>生图</span>
                        </button>
                        <button className={menuItemClass} onClick={() => { addNode(NodeType.CREATIVE_DESC, contextMenu.worldX, contextMenu.worldY); setContextMenu(null); }}>
                            <div className="w-5 h-5 rounded bg-zinc-500/10 flex items-center justify-center"><Icons.FileText size={12} className={isDark ? 'text-zinc-300' : 'text-zinc-600'}/></div>
                            <span>文本</span>
                        </button>
                        <button className={menuItemClass} onClick={() => { addNode(NodeType.TEXT_TO_VIDEO, contextMenu.worldX, contextMenu.worldY); setContextMenu(null); }}>
                            <div className="w-5 h-5 rounded bg-purple-500/10 flex items-center justify-center"><Icons.Video size={12} className="text-purple-400"/></div>
                            <span>生视频</span>
                        </button>
                        <button className={menuItemClass} onClick={() => { addNode(NodeType.START_END_TO_VIDEO, contextMenu.worldX, contextMenu.worldY); setContextMenu(null); }}>
                            <div className="w-5 h-5 rounded bg-emerald-500/10 flex items-center justify-center"><Icons.Frame size={12} className="text-emerald-400"/></div>
                            <span>首尾帧视频</span>
                        </button>
                    </>
                );
            })()}
        </div>
    );
  };

  const renderQuickAddMenu = () => {
    if (!quickAddMenu) return null;
    
    const menuItemClass = `text-left px-3 py-2 text-xs transition-all duration-150 flex items-center gap-2.5 rounded-lg mx-1 ${isDark ? 'text-gray-300 hover:bg-zinc-800/80 hover:text-white' : 'text-gray-700 hover:bg-gray-100 hover:text-black'}`;
    const groupLabelClass = `px-3 py-1.5 text-[9px] font-semibold uppercase tracking-wider ${isDark ? 'text-zinc-500' : 'text-gray-400'}`;
    
    return (
        <div 
            className={`fixed z-50 border rounded-xl shadow-2xl py-2 min-w-[200px] flex flex-col animate-in fade-in zoom-in-95 duration-150 backdrop-blur-xl ${isDark ? 'bg-zinc-900/95 border-zinc-700/80' : 'bg-white/95 border-gray-200'}`} 
            style={{ left: quickAddMenu.x, top: quickAddMenu.y }} 
            onMouseDown={(e) => e.stopPropagation()}
        >
            <div className={`px-3 pb-2 mb-1 text-[11px] font-semibold border-b ${isDark ? 'text-gray-200 border-zinc-800' : 'text-gray-800 border-gray-100'}`}>
                连接到节点
            </div>
            
            <div className={groupLabelClass}>生成</div>
            <button className={menuItemClass} onClick={() => handleQuickAddNode(NodeType.TEXT_TO_IMAGE)}>
                <div className="w-6 h-6 rounded-md bg-cyan-500/10 flex items-center justify-center"><Icons.Image size={14} className="text-cyan-400"/></div>
                <span>生图</span>
            </button>
            <button className={menuItemClass} onClick={() => handleQuickAddNode(NodeType.CREATIVE_DESC)}>
                <div className="w-6 h-6 rounded-md bg-zinc-500/10 flex items-center justify-center"><Icons.FileText size={14} className={isDark ? 'text-zinc-300' : 'text-zinc-600'}/></div>
                <span>文本</span>
            </button>
            <button className={menuItemClass} onClick={() => handleQuickAddNode(NodeType.TEXT_TO_VIDEO)}>
                <div className="w-6 h-6 rounded-md bg-purple-500/10 flex items-center justify-center"><Icons.Video size={14} className="text-purple-400"/></div>
                <span>生视频</span>
            </button>
            <button className={menuItemClass} onClick={() => handleQuickAddNode(NodeType.START_END_TO_VIDEO)}>
                <div className="w-6 h-6 rounded-md bg-emerald-500/10 flex items-center justify-center"><Icons.Frame size={14} className="text-emerald-400"/></div>
                <span>首尾帧视频</span>
            </button>
            
        </div>
    );
  };

  const toggleTheme = (dark: boolean) => {
      setCanvasBg(dark ? '#0B0C0E' : '#F5F7FA');
  };

  if (isCheckingAuth) {
      return (
          <div className="w-full h-screen flex items-center justify-center bg-[#0b0c0e] text-zinc-300">
              <Icons.Loader2 size={24} className="animate-spin mr-2" />
              加载中...
          </div>
      );
  }

  if (!isAuthenticated) {
      return <LoginScreen onLogin={() => setIsAuthenticated(true)} />;
  }

  return (
    <div className="w-full h-screen overflow-hidden flex relative font-sans text-gray-800">
        <WelcomeModal
            isOpen={isWelcomeOpen}
            onClose={() => setIsWelcomeOpen(false)}
            isDark={isDark}
        />
        <StorageModal
            isOpen={isStorageOpen}
            onClose={() => setIsStorageOpen(false)}
            isDark={isDark}
        />
        <ExportImportModal
            isOpen={isExportImportOpen}
            onClose={() => setIsExportImportOpen(false)}
            isDark={isDark}
            projectName={projectName}
            onProjectNameChange={setProjectName}
            nodes={nodes}
            connections={connections}
            transform={transform}
            onImport={handleImportWorkflow}
        />

        <Sidebar 
          onAddNode={addNode} 
          onNewWorkflow={handleNewWorkflow}
          onImportAsset={() => assetInputRef.current?.click()}
          onOpenExportImport={() => setIsExportImportOpen(true)}
          nodes={[...nodes, ...deletedNodes]}
          onPreviewMedia={handleHistoryPreview}
          isDark={isDark}
        />
        <input type="file" ref={workflowInputRef} hidden accept=".aistudio-flow,.json" onChange={handleLoadWorkflow} />
        <input type="file" ref={assetInputRef} hidden accept="image/*,video/*" onChange={handleImportAsset} />
        <input type="file" ref={replaceImageRef} hidden accept="image/*,video/*" onChange={handleReplaceImage} />
        <input type="file" ref={attachInputRef} hidden accept="image/*,video/*,.txt,.md,text/plain" onChange={handleAttachInputAsset} />
        <div 
            ref={containerRef}
            className={`flex-1 w-full h-full relative grid-pattern select-none ${dragMode === 'PAN' ? 'cursor-grabbing' : 'cursor-grab'}`}
            style={{ 
                backgroundColor: canvasBg,
                '--grid-color': isDark ? '#27272a' : '#E4E4E7'
            } as React.CSSProperties}
            onWheel={handleWheel}
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onContextMenu={handleCanvasContextMenu}
            onDragOver={handleDragOver}
            onDrop={handleDrop}
        >
            <div className="absolute origin-top-left will-change-transform" style={{ transform: `translate(${transform.x}px, ${transform.y}px) scale(${transform.k})` }}>
                {/* Connection Lines - Rendered as absolute positioned divs with SVG */}
                {connections.map(conn => {
                    const source = nodes.find(n => n.id === conn.sourceId);
                    const target = nodes.find(n => n.id === conn.targetId);
                    if (!source || !target) return null;
                    
                    // 源节点右侧输出端口位置
                    const sx = source.x + source.width;
                    const sy = source.y + source.height / 2;
                    // 目标节点左侧输入端口位置
                    const tx = target.x;
                    const ty = target.y + target.height / 2;
                    
                    // 计算贝塞尔曲线控制点
                    const dist = Math.abs(tx - sx);
                    const cp = Math.max(50, dist * 0.4);
                    
                    // 计算SVG边界
                    const minX = Math.min(sx, tx) - cp - 20;
                    const minY = Math.min(sy, ty) - 20;
                    const maxX = Math.max(sx, tx) + cp + 20;
                    const maxY = Math.max(sy, ty) + 20;
                    const svgWidth = maxX - minX;
                    const svgHeight = maxY - minY;
                    
                    // 相对于SVG的坐标
                    const relSx = sx - minX;
                    const relSy = sy - minY;
                    const relTx = tx - minX;
                    const relTy = ty - minY;
                    
                    const d = `M ${relSx} ${relSy} C ${relSx + cp} ${relSy}, ${relTx - cp} ${relTy}, ${relTx} ${relTy}`;
                    const isSelected = selectedConnectionId === conn.id;
                    
                    // 连接线颜色
                    const lineColor = isSelected ? (isDark ? "#d4d4d8" : "#52525b") : (isDark ? "#71717a" : "#9ca3af");
                    
                    // 计算贝塞尔曲线上 t=0.5 的实际中点位置
                    const t = 0.5;
                    const p0x = relSx, p0y = relSy;
                    const p1x = relSx + cp, p1y = relSy;
                    const p2x = relTx - cp, p2y = relTy;
                    const p3x = relTx, p3y = relTy;
                    const midX = Math.pow(1-t,3)*p0x + 3*Math.pow(1-t,2)*t*p1x + 3*(1-t)*Math.pow(t,2)*p2x + Math.pow(t,3)*p3x;
                    const midY = Math.pow(1-t,3)*p0y + 3*Math.pow(1-t,2)*t*p1y + 3*(1-t)*Math.pow(t,2)*p2y + Math.pow(t,3)*p3y;
                    
                    return (
                        <svg 
                            key={conn.id}
                            className="absolute"
                            style={{ 
                                left: minX, 
                                top: minY, 
                                width: svgWidth, 
                                height: svgHeight,
                                zIndex: isSelected ? 20 : 5,
                                overflow: 'visible',
                                pointerEvents: 'none'
                            }}
                        >
                            {/* 点击区域 */}
                            <path 
                                d={d} 
                                stroke="transparent" 
                                strokeWidth={16} 
                                fill="none" 
                                style={{ pointerEvents: 'stroke', cursor: 'pointer' }}
                                onClick={(e) => { e.stopPropagation(); setSelectedConnectionId(conn.id); }}
                            />
                            {/* 主连接线 - 实线 */}
                            <path 
                                d={d} 
                                stroke={lineColor}
                                strokeWidth={isSelected ? 2.5 : 2}
                                fill="none" 
                                strokeLinecap="round"
                                strokeDasharray="2 10"
                                opacity={isSelected ? 0.9 : 0.56}
                                style={{ pointerEvents: 'none' }}
                            >
                                <animate
                                    attributeName="stroke-dashoffset"
                                    from="0"
                                    to="-12"
                                    dur="1.25s"
                                    repeatCount="indefinite"
                                />
                            </path>
                            {/* 选中时的发光效果 */}
                            {isSelected && (
                                <path 
                                    d={d} 
                                    stroke={lineColor}
                                    strokeWidth={5}
                                    fill="none" 
                                    strokeLinecap="round"
                                    strokeDasharray="2 10"
                                    opacity={0.16}
                                    style={{ pointerEvents: 'none' }}
                                >
                                    <animate
                                        attributeName="stroke-dashoffset"
                                        from="0"
                                        to="-12"
                                        dur="1.25s"
                                        repeatCount="indefinite"
                                    />
                                </path>
                            )}
                            {/* 删除按钮 - 使用纯 SVG 实现 */}
                            {isSelected && (
                                <g 
                                    style={{ pointerEvents: 'auto', cursor: 'pointer' }}
                                    onClick={(e) => { e.stopPropagation(); removeConnection(conn.id); }}
                                    onMouseDown={(e) => e.stopPropagation()}
                                >
                                    {/* 按钮背景 */}
                                    <circle 
                                        cx={midX} 
                                        cy={midY} 
                                        r={10}
                                        fill={isDark ? "#27272a" : "#ffffff"}
                                        stroke={isDark ? "#52525b" : "#d1d5db"}
                                        strokeWidth={1}
                                        className="hover:stroke-red-500"
                                    />
                                    {/* X 图标 */}
                                    <line 
                                        x1={midX - 4} y1={midY - 4} 
                                        x2={midX + 4} y2={midY + 4} 
                                        stroke={isDark ? "#a1a1aa" : "#6b7280"}
                                        strokeWidth={2}
                                        strokeLinecap="round"
                                        className="hover:stroke-red-500"
                                    />
                                    <line 
                                        x1={midX + 4} y1={midY - 4} 
                                        x2={midX - 4} y2={midY + 4} 
                                        stroke={isDark ? "#a1a1aa" : "#6b7280"}
                                        strokeWidth={2}
                                        strokeLinecap="round"
                                        className="hover:stroke-red-500"
                                    />
                                </g>
                            )}
                        </svg>
                    );
                })}
                
                {/* 拖拽连接预览线 */}
                {dragMode === 'CONNECT' && connectionStartRef.current && tempConnection && (() => {
                    const sourceNode = nodes.find(n => n.id === connectionStartRef.current?.nodeId);
                    if (!sourceNode) return null;

                    // 反向连接(从输入端口拖出)时，预览线从节点左侧出发，曲线向左弯。
                    const fromSource = connectionStartRef.current?.type === 'source';
                    const sx = fromSource ? sourceNode.x + sourceNode.width : sourceNode.x;
                    const sy = sourceNode.y + sourceNode.height / 2;
                    const tx = tempConnection.x;
                    const ty = tempConnection.y;

                    const dist = Math.abs(tx - sx);
                    const cp = Math.max(30, dist * 0.3);

                    const minX = Math.min(sx, tx) - cp - 20;
                    const minY = Math.min(sy, ty) - 20;
                    const maxX = Math.max(sx, tx) + cp + 20;
                    const maxY = Math.max(sy, ty) + 20;

                    const relSx = sx - minX;
                    const relSy = sy - minY;
                    const relTx = tx - minX;
                    const relTy = ty - minY;

                    const c1x = fromSource ? relSx + cp : relSx - cp;
                    const c2x = fromSource ? relTx - cp : relTx + cp;
                    const d = `M ${relSx} ${relSy} C ${c1x} ${relSy}, ${c2x} ${relTy}, ${relTx} ${relTy}`;
                    
                    return (
                        <svg 
                            className="absolute pointer-events-none"
                            style={{ 
                                left: minX, 
                                top: minY, 
                                width: maxX - minX, 
                                height: maxY - minY,
                                zIndex: 100,
                                overflow: 'visible'
                            }}
                        >
                            {/* 虚线预览 */}
                            <path 
                                d={d} 
                                stroke="#3b82f6" 
                                strokeWidth={2} 
                                fill="none" 
                                strokeDasharray="6,4" 
                                strokeLinecap="round"
                            />
                            {/* 目标点指示器 */}
                            <circle 
                                cx={relTx} 
                                cy={relTy} 
                                r={5} 
                                fill="#3b82f6"
                            />
                        </svg>
                    );
                })()}
                {nodes.map(node => (
                    <BaseNode
                        key={node.id}
                        data={node}
                        selected={selectedNodeIds.has(node.id)}
                        onMouseDown={(e) => handleNodeMouseDown(e, node.id)}
                        onContextMenu={(e) => handleNodeContextMenu(e, node.id, node.type)}
                        onConnectStart={(e, type) => handleConnectStart(e, node.id, type)}
                        onPortMouseUp={handlePortMouseUp}
                        onResizeStart={(e) => handleResizeStart(e, node.id)}
                        onAttachInput={triggerAttachInput}
                        scale={transform.k}
                        isDark={isDark}
                    >
                        <NodeContent 
                            data={node} 
                            updateData={updateNodeData} 
                            onGenerate={handleGenerate} 
                            selected={selectedNodeIds.has(node.id)}
                            showControls={selectedNodeIds.size === 1}
                            inputs={getInputImages(node.id)}
                            inputMedia={getInputMedia(node.id)}
                            onPreviewReference={handlePreviewReference}
                            onMaximize={handleMaximize}
                            onDownload={handleDownload}
                            onUpload={triggerReplaceImage}
                            onCrop={handleCropStart}
                            onMultiAngle={handleMultiAngleGenerate}
                            onAnalyzeMedia={handleAnalyzeMedia}
                            onAnalyzeScript={handleAnalyzeScript}
                            isSelecting={dragMode === 'SELECT'}
                            onDelete={deleteNode}
                            isDark={isDark}
                        />
                    </BaseNode>
                ))}
            </div>
            {dragMode === 'CONNECT' && suggestedNodes.length > 0 && lastMousePosRef.current && (
                <div className={`fixed z-50 border rounded-xl shadow-2xl p-2 flex flex-col gap-1 w-48 pointer-events-auto ${isDark ? 'bg-[#1A1D21] border-zinc-700' : 'bg-white border-gray-200'}`} style={{ left: lastMousePosRef.current.x + 20, top: lastMousePosRef.current.y }}>
                    <div className={`text-[10px] uppercase font-bold px-2 py-1 ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>Quick Connect</div>
                    {suggestedNodes.map(node => (
                        <button key={node.id} className={`flex items-center gap-2 px-2 py-1.5 rounded text-left text-xs transition-colors ${isDark ? 'hover:bg-zinc-800 text-gray-300 hover:text-cyan-400' : 'hover:bg-gray-100 text-gray-700 hover:text-cyan-600'}`} onClick={(e) => { e.stopPropagation(); const start = connectionStartRef.current!; if (start.type === 'source') createConnection(start.nodeId, node.id); else createConnection(node.id, start.nodeId); }}>
                            {node.type === NodeType.TEXT_TO_VIDEO ? <Icons.Video size={12} /> : <Icons.Image size={12} />}<span className="truncate">{node.title}</span>
                        </button>
                    ))}
                </div>
            )}
            {dragMode === 'SELECT' && selectionBox && (
                <div className="fixed border border-cyan-500/50 bg-cyan-500/10 pointer-events-none z-50" style={{ left: containerRef.current!.getBoundingClientRect().left + selectionBox.x, top: containerRef.current!.getBoundingClientRect().top + selectionBox.y, width: selectionBox.w, height: selectionBox.h }}/>
            )}
            
            {/* Top Left Project Name */}
            <div className="absolute top-4 left-4 z-50">
                <div className={`flex items-center gap-2.5 px-2 py-1.5 rounded-2xl backdrop-blur-xl border transition-all duration-300 ${
                    isDark 
                        ? 'bg-[#18181b]/90 border-zinc-800 shadow-xl' 
                        : 'bg-white/90 border-gray-200 shadow-lg'
                }`}>
                    {/* Logo */}
                    <div className={`w-8 h-8 rounded-xl flex items-center justify-center ${
                        isDark ? 'bg-blue-500/20 text-blue-400' : 'bg-blue-100 text-blue-600'
                    }`}>
                        <Icons.Sparkles size={16} />
                    </div>
                    
                    {/* Project Name */}
                    {isEditingProjectName ? (
                        <input
                            type="text"
                            value={projectName}
                            onChange={(e) => setProjectName(e.target.value)}
                            onBlur={() => setIsEditingProjectName(false)}
                            onKeyDown={(e) => {
                                if (e.key === 'Enter') setIsEditingProjectName(false);
                                if (e.key === 'Escape') setIsEditingProjectName(false);
                            }}
                            autoFocus
                            className={`w-36 px-2 py-1 rounded-lg text-sm font-medium border-0 outline-none bg-transparent ${
                                isDark ? 'text-white' : 'text-gray-900'
                            }`}
                            placeholder="项目名称..."
                        />
                    ) : (
                        <button
                            onClick={() => setIsEditingProjectName(true)}
                            className={`text-sm font-medium max-w-[140px] truncate transition-colors ${
                                isDark ? 'text-gray-200 hover:text-white' : 'text-gray-800 hover:text-black'
                            }`}
                        >
                            {projectName}
                        </button>
                    )}
                </div>
            </div>

            {/* Top Right Toolbar */}
            <div className="absolute top-4 right-4 z-50">
                <div className={`flex items-center gap-1 px-2 py-1.5 rounded-2xl backdrop-blur-xl border transition-all ${
                    isDark 
                        ? 'bg-[#18181b]/90 border-zinc-800 shadow-xl' 
                        : 'bg-white/90 border-gray-200 shadow-lg'
                }`}>
                    {/* Zoom */}
                    <span className={`px-3 py-1.5 text-sm font-medium tabular-nums ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                        {Math.round(transform.k * 100)}%
                    </span>
                    
                    <div className={`w-px h-5 ${isDark ? 'bg-zinc-700' : 'bg-gray-200'}`} />
                    
                    {/* Download */}
                    <button
                        onClick={() => setIsExportImportOpen(true)}
                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-sm font-medium transition-all ${
                            isDark ? 'text-gray-400 hover:text-white hover:bg-white/5' : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
                        }`}
                    >
                        <Icons.Download size={15} />
                        <span>下载</span>
                    </button>
                    
                    <div className={`w-px h-5 ${isDark ? 'bg-zinc-700' : 'bg-gray-200'}`} />
                    
                    {/* Theme */}
                    <button
                        onClick={() => toggleTheme(!isDark)}
                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-sm font-medium transition-all ${
                            isDark ? 'text-gray-400 hover:text-white hover:bg-white/5' : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
                        }`}
                    >
                        {isDark ? <Icons.Moon size={15} /> : <Icons.Sun size={15} />}
                        <span>{isDark ? '暗色' : '亮色'}</span>
                    </button>
                    
                    {/* Clear */}
                    <button
                        onClick={handleNewWorkflow}
                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-sm font-medium transition-all ${
                            isDark ? 'text-gray-400 hover:text-white hover:bg-white/5' : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
                        }`}
                    >
                        <span>清空</span>
                    </button>
                    
                    <div className={`w-px h-5 ${isDark ? 'bg-zinc-700' : 'bg-gray-200'}`} />
                    
                    {/* Storage */}
                    <button
                        onClick={handleOpenStorageSettings}
                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-sm font-medium transition-all ${
                            storageDirName 
                                ? (isDark ? 'text-emerald-400 hover:bg-emerald-500/10' : 'text-emerald-600 hover:bg-emerald-50')
                                : (isDark ? 'text-gray-400 hover:text-white hover:bg-white/5' : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100')
                        }`}
                    >
                        <Icons.FolderOpen size={15} />
                        <span>存储</span>
                    </button>
                    
                </div>
            </div>
            {renderContextMenu()}
            {renderQuickAddMenu()}
            {renderNewWorkflowDialog()}
            {previewMedia && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-md animate-in fade-in duration-200" onClick={() => setPreviewMedia(null)}>
                    <div className="relative max-w-[90vw] max-h-[90vh] bg-black rounded-lg shadow-2xl overflow-hidden border border-zinc-700" onClick={(e) => e.stopPropagation()}>
                         <button className="absolute top-2 right-2 bg-black/50 text-white p-2 rounded-full hover:bg-red-500 transition-colors z-10" onClick={() => setPreviewMedia(null)}><Icons.X size={20} /></button>
                         {previewMedia.type === 'video' ? <video src={previewMedia.url} controls autoPlay className="max-w-full max-h-[90vh]" /> : <img src={previewMedia.url} alt="Preview" className="max-w-full max-h-[90vh] object-contain" />}
                    </div>
                </div>
            )}
            {previewText && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-md animate-in fade-in duration-200" onClick={() => setPreviewText(null)}>
                    <div className={`relative w-[min(760px,92vw)] max-h-[86vh] rounded-2xl shadow-2xl border overflow-hidden ${isDark ? 'bg-[#18181b] border-zinc-700 text-zinc-100' : 'bg-white border-gray-200 text-gray-900'}`} onClick={(e) => e.stopPropagation()}>
                        <div className={`h-14 px-5 flex items-center justify-between border-b ${isDark ? 'border-zinc-800' : 'border-gray-100'}`}>
                            <div className="flex items-center gap-2 min-w-0">
                                <Icons.FileText size={18} />
                                <span className="font-semibold truncate">{previewText.title}</span>
                            </div>
                            <button className={`w-9 h-9 rounded-full flex items-center justify-center ${isDark ? 'hover:bg-zinc-800 text-zinc-400 hover:text-white' : 'hover:bg-gray-100 text-gray-500 hover:text-gray-900'}`} onClick={() => setPreviewText(null)}><Icons.X size={20} /></button>
                        </div>
                        <pre className={`max-h-[calc(86vh-56px)] overflow-auto whitespace-pre-wrap break-words p-5 text-sm leading-7 ${isDark ? 'text-zinc-200' : 'text-gray-700'}`}>{previewText.text}</pre>
                    </div>
                </div>
            )}
            {cropTarget && (
                <CropModal
                    imageSrc={cropTarget.imageSrc}
                    sourceTitle={cropTarget.title}
                    initialAspectRatio={cropTarget.aspectRatio}
                    isDark={isDark}
                    onClose={() => setCropTarget(null)}
                    onConfirm={handleCropConfirm}
                />
            )}
        </div>
    </div>
  );
};

export default App;
