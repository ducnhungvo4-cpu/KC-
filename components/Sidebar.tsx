import React, { useState, useRef, useEffect, memo, useMemo } from 'react';
import { Icons } from './Icons';
import { AssetLibraryItem, AssetLibraryType, MaterialLibraryItem, NodeType, NodeData, ShotClip, AddToAssetType } from '../types';

interface SidebarProps {
  onAddNode: (type: NodeType) => void;
  onNewWorkflow: () => void;
  onSaveProject: () => void;
  onBackToProjects: () => void;
  onOpenCreditDashboard: () => void;
  onImportAsset: () => void;
  onOpenExportImport: () => void;
  nodes: NodeData[];
  onPreviewMedia: (url: string, type: 'image' | 'video') => void;
  onPreviewText: (title: string, text: string) => void;
  onSaveAsset: (url: string, type: 'image' | 'video', title: string) => void;
  onOpenSaveResult: (nodeId: string) => void;
  onCopyAsset: (url: string, type: 'image' | 'video') => void;
  onDeleteAsset: (nodeId: string, url: string, type: 'image' | 'video') => void;
  assetLibrary: AssetLibraryItem[];
  onAddAssetToCanvas: (asset: AssetLibraryItem) => void;
  onAddMaterialToCanvas: (item: MaterialLibraryItem) => void;
  onToggleMaterialFavorite: (nodeId: string, url: string, type: 'image' | 'video') => void;
  onAddShotClipToCanvas?: (clip: ShotClip) => void;
  isDark?: boolean;
}

type ActivePanel = 'ADD' | 'HISTORY' | 'ASSET_MATERIAL' | 'PROJECT' | null;
type HistoryTab = 'image' | 'video' | 'text' | 'audio';


const HistoryItem = memo(({ node, type, onClick, isDark }: { node: NodeData, type: 'image' | 'video', onClick: () => void, isDark: boolean }) => {
    const stackCount = node.outputArtifacts?.length || 0;
    
    return (
        <div 
           className={`relative aspect-square rounded-xl overflow-hidden cursor-pointer group ${isDark ? 'bg-zinc-900' : 'bg-gray-100'}`}
           onClick={onClick}
        >
            {type === 'image' ? (
                <img src={node.imageSrc} className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105" loading="lazy" decoding="async"/>
            ) : (
                <div className="w-full h-full relative">
                   <video src={node.videoSrc} className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105" muted preload="metadata"/>
                   <div className="absolute inset-0 flex items-center justify-center">
                      <div className={`w-10 h-10 rounded-full flex items-center justify-center transition-transform duration-300 group-hover:scale-110 ${isDark ? 'bg-black/70 text-white' : 'bg-white/70 text-black'}`}>
                        <Icons.Play size={18} fill="currentColor" />
                      </div>
                   </div>
                </div>
            )}
            {/* Stack badge */}
            {stackCount > 0 && (
                <div className={`absolute top-2 right-2 px-1.5 py-0.5 rounded-md text-[10px] font-bold backdrop-blur-md ${isDark ? 'bg-white/10 text-white' : 'bg-black/10 text-black'}`}>
                    {stackCount}
                </div>
            )}
            {/* Title overlay */}
            <div className={`absolute bottom-0 left-0 right-0 px-2 py-1.5 bg-gradient-to-t ${isDark ? 'from-black/80 to-transparent' : 'from-white/80 to-transparent'}`}>
                <p className={`text-[11px] font-medium truncate ${isDark ? 'text-white' : 'text-gray-900'}`}>{node.title}</p>
            </div>
        </div>
    );
});

const TextHistoryItem = memo(({ node, text, onClick, isDark }: { node: NodeData, text: string, onClick: () => void, isDark: boolean }) => (
    <button
        className={`rounded-xl border p-3 text-left transition-all ${isDark ? 'border-zinc-800 bg-zinc-900/45 hover:border-zinc-700 hover:bg-zinc-800/70' : 'border-gray-100 bg-white hover:border-gray-200 hover:bg-gray-50'}`}
        onClick={onClick}
    >
        <div className="flex items-center gap-2">
            <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${isDark ? 'bg-zinc-800 text-zinc-300' : 'bg-gray-100 text-gray-600'}`}>
                <Icons.FileText size={16} />
            </span>
            <span className={`min-w-0 truncate text-xs font-semibold ${isDark ? 'text-zinc-100' : 'text-gray-900'}`}>{node.title || '文本历史'}</span>
        </div>
        <p className={`mt-2 line-clamp-4 text-[11px] leading-5 ${isDark ? 'text-zinc-400' : 'text-gray-500'}`}>{text}</p>
    </button>
));

const AudioHistoryItem = memo(({ node, isDark }: { node: NodeData, isDark: boolean }) => (
    <div className={`rounded-xl border p-3 transition-all ${isDark ? 'border-zinc-800 bg-zinc-900/45' : 'border-gray-100 bg-white'}`}>
        <div className="mb-2 flex items-center gap-2">
            <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${isDark ? 'bg-amber-500/10 text-amber-300' : 'bg-amber-50 text-amber-600'}`}>
                <Icons.Music size={16} />
            </span>
            <span className={`min-w-0 truncate text-xs font-semibold ${isDark ? 'text-zinc-100' : 'text-gray-900'}`}>{node.title || '音频历史'}</span>
        </div>
        <audio src={node.audioSrc} controls className="h-8 w-full" />
    </div>
));

const createShotClipPreview = (label: string, accent = '#475569', background = '#111827') => {
    const svg = `
      <svg xmlns="http://www.w3.org/2000/svg" width="320" height="180" viewBox="0 0 320 180">
        <defs>
          <linearGradient id="bg" x1="0" x2="1" y1="0" y2="1">
            <stop offset="0%" stop-color="${accent}" stop-opacity="0.75"/>
            <stop offset="100%" stop-color="${background}"/>
          </linearGradient>
          <radialGradient id="light" cx="34%" cy="30%" r="70%">
            <stop offset="0%" stop-color="#f8fafc" stop-opacity="0.22"/>
            <stop offset="100%" stop-color="#0f172a" stop-opacity="0"/>
          </radialGradient>
        </defs>
        <rect width="320" height="180" fill="url(#bg)"/>
        <rect width="320" height="180" fill="url(#light)"/>
        <path d="M0 136 C54 112 86 132 134 102 C190 68 246 86 320 46 L320 180 L0 180 Z" fill="#020617" opacity="0.45"/>
        <text x="22" y="148" fill="#e5e7eb" font-family="Arial, sans-serif" font-size="22" font-weight="700">${label}</text>
      </svg>`;
    return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
};



const Sidebar: React.FC<SidebarProps> = ({ 
  onAddNode, 
  onNewWorkflow,
  onSaveProject,
  onBackToProjects,
  onOpenCreditDashboard,
  onImportAsset,
  onOpenExportImport,
  nodes,
  onPreviewMedia,
  onPreviewText,
  onSaveAsset,
  onOpenSaveResult,
  onCopyAsset,
  onDeleteAsset,
  assetLibrary,
  onAddAssetToCanvas,
  onAddMaterialToCanvas,
  onToggleMaterialFavorite,
  onAddShotClipToCanvas,
  isDark = true
}) => {
  const [activePanel, setActivePanel] = useState<ActivePanel>(null);
  const [historyTab, setHistoryTab] = useState<HistoryTab>('image');
  const assetScope = 'project';
  const [assetTab, setAssetTab] = useState<AssetLibraryType>('role');
  const [assetSearch, setAssetSearch] = useState('');
  const [mediaTab, setMediaTab] = useState<'image' | 'video'>('image');
  const [shotEpisode, setShotEpisode] = useState<number | 'all'>('all');
  const [shotSearch, setShotSearch] = useState('');
  const [expandedAssetIds, setExpandedAssetIds] = useState<Set<string>>(() => new Set(['asset_role_001']));
  const [selectedAssetIds, setSelectedAssetIds] = useState<Set<string>>(new Set());
  const [selectedShotClipIds, setSelectedShotClipIds] = useState<Set<string>>(new Set());
  const sidebarRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  // Deduplicate nodes for history display
  const uniqueNodes = useMemo(() => {
      const map = new Map<string, NodeData>();
      nodes.forEach(n => {
          if (!map.has(n.id)) map.set(n.id, n);
      });
      return Array.from(map.values());
  }, [nodes]);

  const imageNodes = useMemo(() => 
      uniqueNodes.filter(n => n.imageSrc && !n.isLoading), 
  [uniqueNodes]);
  
  const videoNodes = useMemo(() => 
      uniqueNodes.filter(n => n.videoSrc && !n.isLoading), 
  [uniqueNodes]);

  const textNodes = useMemo(() =>
      uniqueNodes.filter(n => n.type === NodeType.CREATIVE_DESC && !n.isLoading && (n.optimizedPrompt || n.prompt)),
  [uniqueNodes]);

  const audioNodes = useMemo(() =>
      uniqueNodes.filter(n => n.audioSrc && !n.isLoading),
  [uniqueNodes]);

  // Mock shot clips for demo - will be replaced by real data
  const shotClips = useMemo<ShotClip[]>(() => {
    return [
      { id: 'shot_001', episodeNo: 6, sceneNo: 3, shotNo: 1, shotName: '06-03-v01', videoUrl: '', prompt: '古宅窗前，人物背影，低照度悬疑氛围。', keyframeUrls: [createShotClipPreview('06-03-v01', '#334155', '#0f172a')], audioUrl: '', description: '第6集第3场版本01' },
      { id: 'shot_002', episodeNo: 6, sceneNo: 3, shotNo: 2, shotName: '06-03-v02', videoUrl: '', prompt: '夜巷火光，群像围站，手持镜头推进。', keyframeUrls: [createShotClipPreview('06-03-v02', '#7c2d12', '#111827')], audioUrl: '', description: '第6集第3场版本02' },
      { id: 'shot_003', episodeNo: 6, sceneNo: 3, shotNo: 3, shotName: '06-03-v03', videoUrl: '', prompt: '雾气森林，人物对峙，冷色逆光。', keyframeUrls: [createShotClipPreview('06-03-v03', '#365314', '#111827')], audioUrl: '', description: '第6集第3场版本03' },
      { id: 'shot_004', episodeNo: 6, sceneNo: 3, shotNo: 4, shotName: '06-03-v04', videoUrl: '', prompt: '军阵旗帜，雨雾远景，史诗感横移。', keyframeUrls: [createShotClipPreview('06-03-v04', '#475569', '#1f2937')], audioUrl: '', description: '第6集第3场版本04' },
      { id: 'shot_005', episodeNo: 6, sceneNo: 3, shotNo: 5, shotName: '06-03-v05', videoUrl: '', prompt: '夜市街道，角色穿行，人群与灯笼背景。', keyframeUrls: [createShotClipPreview('06-03-v05', '#92400e', '#111827')], audioUrl: '', description: '第6集第3场版本05' },
    ];
  }, []);

  const formatShotClipName = (clip: ShotClip) => `${clip.episodeNo}集-片段${clip.shotNo}-V${clip.shotNo}`;

  const filteredShotClips = useMemo(() => {
    return shotClips.filter(s => {
      if (shotEpisode !== 'all' && s.episodeNo !== shotEpisode) return false;
      if (shotSearch.trim()) {
        const kw = shotSearch.trim().toLowerCase();
        const match = `${formatShotClipName(s)} ${s.shotName} ${s.description || ''} ${s.prompt || ''} ${s.episodeNo} ${s.shotNo}`.toLowerCase().includes(kw);
        if (!match) return false;
      }
      return true;
    });
  }, [shotClips, shotEpisode, shotSearch]);

  const episodes = useMemo(() => {
    const set = new Set(shotClips.map(s => s.episodeNo));
    return Array.from(set).sort((a: number, b: number) => a - b);
  }, [shotClips]);


  const filteredAssetLibrary = useMemo(() => {
      const keyword = assetSearch.trim().toLowerCase();
      return assetLibrary.filter(item => {
          const scope = item.scope || 'project';
          const matchScope = scope === assetScope;
          const matchType = assetTab === 'all' || item.type === assetTab;
          const matchKeyword = !keyword || `${item.name} ${item.description} ${item.version}`.toLowerCase().includes(keyword);
          return matchScope && matchType && matchKeyword;
      });
  }, [assetLibrary, assetScope, assetSearch, assetTab]);

  // Close panel when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node;
      if (
        sidebarRef.current && 
        !sidebarRef.current.contains(target) &&
        panelRef.current &&
        !panelRef.current.contains(target)
      ) {
        setActivePanel(null);
        
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const togglePanel = (panel: ActivePanel) => {
    setActivePanel(prev => prev === panel ? null : panel);
  };

  // 样式
  const bgMain = isDark ? 'bg-[#111318]/95' : 'bg-white/95';
  const borderColor = isDark ? 'border-white/10' : 'border-gray-200';
  const textMain = isDark ? 'text-white' : 'text-gray-900';
  const textSub = isDark ? 'text-gray-400' : 'text-gray-500';
  const textMuted = isDark ? 'text-gray-600' : 'text-gray-400';
  const hoverBg = isDark ? 'hover:bg-white/5' : 'hover:bg-gray-100';
  const activeBg = isDark ? 'bg-[#8F91F4]/10 text-[#C7C8FF] ring-1 ring-[#B9BAFF]/20' : 'bg-[#F0F1FF] text-[#3739B0] ring-1 ring-[#E1E3FF]';

  // 侧边栏按钮
  const SidebarButton = ({ 
    icon: Icon, 
    panel, 
    tooltip,
    onClick
  }: { 
    icon: any, 
    panel?: ActivePanel, 
    tooltip: string,
    onClick?: () => void
  }) => {
    const isActive = panel && activePanel === panel;
    
    return (
      <button 
        title={tooltip}
        className={`relative w-11 h-11 flex items-center justify-center rounded-xl transition-all duration-200 group ${
          isActive ? activeBg : `${textSub} ${hoverBg}`
        }`}
        onClick={() => {
          if (onClick) {
            onClick();
          } else if (panel) {
            togglePanel(panel);
          }
        }}
      >
        <Icon size={20} />
        <div className={`absolute left-full ml-3 px-2.5 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap opacity-0 group-hover:opacity-100 transition-all pointer-events-none z-50 ${
          isDark ? 'bg-zinc-900 text-white border border-zinc-700' : 'bg-white text-gray-900 border border-gray-200 shadow-lg'
        }`}>
          {tooltip}
        </div>
      </button>
    );
  };

  // 渲染添加节点面板
  const renderAddPanel = () => {
    const NodeButton = ({ icon: Icon, label, description, type, color }: { icon: any, label: string, description: string, type: NodeType, color: string }) => (
      <button
        draggable
        onDragStart={(event: React.DragEvent) => {
          event.dataTransfer.setData('application/kc-node-type', type);
          event.dataTransfer.setData('text/plain', type);
          event.dataTransfer.effectAllowed = 'copy';
        }}
        onClick={() => { onAddNode(type); setActivePanel(null); }}
        className={`w-full flex items-center gap-3 p-3 rounded-xl border transition-all group ${
          isDark 
            ? 'border-zinc-800 hover:border-zinc-700 hover:bg-zinc-800/50 cursor-grab active:cursor-grabbing' 
            : 'border-gray-100 hover:border-gray-200 hover:bg-gray-50 cursor-grab active:cursor-grabbing'
        }`}
      >
        <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${color}`}>
          <Icon size={20} />
        </div>
        <div className="flex-1 text-left">
          <div className={`text-sm font-semibold ${textMain}`}>{label}</div>
          <div className={`text-[11px] ${textMuted}`}>{description}</div>
        </div>
        <Icons.ChevronRight size={16} className={`${textMuted} group-hover:translate-x-0.5 transition-transform`} />
      </button>
    );

    return (
      <div className="space-y-2">
        <div className="space-y-2">
          <NodeButton 
            icon={Icons.FileText} 
            label="文本" 
            description="文本输入与模型生成"
            type={NodeType.CREATIVE_DESC} 
            color={isDark ? 'bg-zinc-500/15 text-zinc-300' : 'bg-zinc-100 text-zinc-700'} 
          />
          <NodeButton 
            icon={Icons.Image} 
            label="生图" 
            description="文本/图片生成图片"
            type={NodeType.TEXT_TO_IMAGE} 
            color={isDark ? 'bg-[#4446CE]/15 text-[#8F91F4]' : 'bg-[#E1E3FF] text-[#4446CE]'}
          />
          <NodeButton 
            icon={Icons.Video} 
            label="生视频" 
            description="文本/图片生成视频"
            type={NodeType.TEXT_TO_VIDEO} 
            color={isDark ? 'bg-[#4446CE]/15 text-[#8F91F4]' : 'bg-[#E1E3FF] text-[#4446CE]'}
          />
          <NodeButton
            icon={Icons.Music}
            label="音频"
            description="文本生成语音"
            type={NodeType.TEXT_TO_AUDIO}
            color={isDark ? 'bg-amber-500/15 text-amber-300' : 'bg-amber-100 text-amber-600'}
          />
        </div>
      </div>
    );
  };

  // 渲染项目面板
  const renderProjectPanel = () => (
    <div className="space-y-2">
      <button
        onClick={() => { onSaveProject(); setActivePanel(null); }}
        className={`w-full flex items-center gap-3 p-3 rounded-xl transition-all ${hoverBg}`}
      >
        <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${isDark ? 'bg-[#4446CE]/10 text-[#8F91F4]' : 'bg-[#F0F1FF] text-[#4446CE]'}`}>
          <Icons.Save size={18} />
        </div>
        <div className="text-left">
          <div className={`text-sm font-medium ${textMain}`}>保存项目</div>
          <div className={`text-[11px] ${textMuted}`}>保存到当前项目</div>
        </div>
      </button>

      <button
        onClick={() => { onBackToProjects(); setActivePanel(null); }}
        className={`w-full flex items-center gap-3 p-3 rounded-xl transition-all ${hoverBg}`}
      >
        <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${isDark ? 'bg-zinc-500/10 text-zinc-300' : 'bg-gray-100 text-gray-600'}`}>
          <Icons.FolderOpen size={18} />
        </div>
        <div className="text-left">
          <div className={`text-sm font-medium ${textMain}`}>返回项目管理</div>
          <div className={`text-[11px] ${textMuted}`}>切换其他项目</div>
        </div>
      </button>

      <button
        onClick={() => { onNewWorkflow(); setActivePanel(null); }}
        className={`w-full flex items-center gap-3 p-3 rounded-xl transition-all ${hoverBg}`}
      >
        <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${isDark ? 'bg-red-500/10 text-red-400' : 'bg-red-50 text-red-600'}`}>
          <Icons.FilePlus size={18} />
        </div>
        <div className="text-left">
          <div className={`text-sm font-medium ${textMain}`}>清空画布</div>
          <div className={`text-[11px] ${textMuted}`}>保留项目，只清空节点</div>
        </div>
      </button>
      
      <button
        onClick={() => { onOpenExportImport(); setActivePanel(null); }}
        className={`w-full flex items-center gap-3 p-3 rounded-xl transition-all ${hoverBg}`}
      >
        <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${isDark ? 'bg-emerald-500/10 text-emerald-400' : 'bg-emerald-50 text-emerald-600'}`}>
          <Icons.FolderOpen size={18} />
        </div>
        <div className="text-left">
          <div className={`text-sm font-medium ${textMain}`}>导出 / 导入</div>
          <div className={`text-[11px] ${textMuted}`}>项目文件管理</div>
        </div>
      </button>
    </div>
  );

  const renderAssetMaterialPanel = () => {
    const typeLabel: Record<AssetLibraryType, string> = {
      role: "角色",
      scene: "场景",
      prop: "道具",
    };
    const typeIcons: Record<AssetLibraryType, typeof Icons.User> = { role: Icons.User, scene: Icons.Image, prop: Icons.Box };
    const typeColors: Record<AssetLibraryType, string> = {
      role: isDark ? "bg-gradient-to-r from-[#4446CE]/20 to-[#8F91F4]/10 text-[#E1E3FF] ring-1 ring-[#B9BAFF]/25 shadow-sm" : "bg-gradient-to-r from-[#F0F1FF] to-[#F0F1FF] text-[#3739B0] ring-1 ring-[#C7C8FF] shadow-sm",
      scene: isDark ? "bg-gradient-to-r from-amber-500/20 to-yellow-400/10 text-amber-100 ring-1 ring-amber-300/25 shadow-sm" : "bg-gradient-to-r from-amber-50 to-yellow-50 text-amber-700 ring-1 ring-amber-200 shadow-sm",
      prop: isDark ? "bg-gradient-to-r from-emerald-500/20 to-teal-400/10 text-emerald-100 ring-1 ring-emerald-300/25 shadow-sm" : "bg-gradient-to-r from-emerald-50 to-teal-50 text-emerald-700 ring-1 ring-emerald-200 shadow-sm",
    };
    const addButtonClass = isDark
      ? "border border-[#B9BAFF]/15 bg-[#B9BAFF]/10 text-[#E1E3FF]/80 hover:border-[#B9BAFF]/35 hover:bg-[#B9BAFF]/15 hover:text-[#E1E3FF]"
      : "border border-[#E1E3FF] bg-[#F0F1FF]/70 text-[#3739B0] hover:border-[#C7C8FF] hover:bg-[#E1E3FF]";
    const toggleExpanded = (assetId: string) => {
      setExpandedAssetIds(prev => {
        const next = new Set(prev);
        if (next.has(assetId)) next.delete(assetId);
        else next.add(assetId);
        return next;
      });
    };
    const startAssetDrag = (event: React.DragEvent, assetId: string) => {
      event.dataTransfer.setData("application/kc-asset", assetId);
      event.dataTransfer.effectAllowed = "copy";
    };
    const toggleAssetSelected = (assetId: string) => {
      setSelectedAssetIds(prev => {
        const next = new Set(prev);
        if (next.has(assetId)) next.delete(assetId);
        else next.add(assetId);
        return next;
      });
    };
    const toggleShotSelected = (clipId: string) => {
      setSelectedShotClipIds(prev => {
        const next = new Set(prev);
        if (next.has(clipId)) next.delete(clipId);
        else next.add(clipId);
        return next;
      });
    };
    const selectButtonClass = (selected: boolean) => `h-6 w-6 shrink-0 rounded-[9px] border flex items-center justify-center transition-all ${
      selected
        ? (isDark ? 'border-[#B9BAFF]/60 bg-[#B9BAFF]/15 text-[#E1E3FF] shadow-[0_0_16px_rgba(68,70,206,0.2)]' : 'border-[#4446CE] bg-[#F0F1FF] text-[#4446CE] shadow-sm')
        : (isDark ? 'border-white/10 bg-white/5 text-zinc-600 hover:border-[#B9BAFF]/30 hover:text-[#E1E3FF]' : 'border-gray-200 bg-white text-gray-300 hover:text-gray-600 hover:border-[#C7C8FF]')
    }`;

    return (
      <div className="h-full flex flex-col gap-3">
        {/* Top-level media type tabs */}
        <div className={"flex rounded-2xl border p-1 shrink-0 shadow-inner " + (isDark ? "border-white/10 bg-black/20" : "border-gray-200 bg-gray-50")}>
          {[
            { key: "image" as const, label: "图片资产", icon: Icons.Image },
            { key: "video" as const, label: "分镜视频", icon: Icons.Video },
          ].map(tab => (
            <button
              key={tab.key}
              className={"h-9 flex-1 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 transition-all duration-200 " + (
                mediaTab === tab.key
                  ? (isDark ? "bg-gradient-to-r from-[#4446CE]/20 to-[#8F91F4]/10 text-[#E1E3FF] ring-1 ring-[#B9BAFF]/20 shadow-sm" : "bg-white text-[#3739B0] ring-1 ring-[#E1E3FF] shadow-sm")
                  : (isDark ? "text-zinc-500 hover:bg-white/5 hover:text-zinc-200" : "text-gray-400 hover:bg-white hover:text-gray-600")
              )}
              onClick={() => { setMediaTab(tab.key); setSelectedAssetIds(new Set()); setSelectedShotClipIds(new Set()); }}
            >
              <tab.icon size={13} />
              {tab.label}
            </button>
          ))}
        </div>

        {/* Image tab — Assets with hierarchy */}
        {mediaTab === "image" && (
          <div className="flex-1 flex flex-col gap-2.5 overflow-hidden">
            {/* Type pills */}
            <div className="flex gap-1.5 shrink-0">
              {(["role", "scene", "prop"] as AssetLibraryType[]).map(key => {
                const Icon = typeIcons[key];
                const isActive = assetTab === key;
                return (
                  <button key={key} className={"h-8 flex-1 rounded-[10px] text-xs font-semibold flex items-center justify-center gap-1.5 transition-all duration-200 " + (
                    isActive ? typeColors[key] : (isDark ? "text-zinc-500 hover:text-zinc-200 hover:bg-white/5" : "text-gray-400 hover:text-gray-600 hover:bg-gray-50")
                  )} onClick={() => { setAssetTab(key); setAssetSearch(''); setSelectedAssetIds(new Set()); }}>
                    <Icon size={12} />
                    {typeLabel[key]}
                  </button>
                );
              })}
            </div>

            {/* Search */}
            <div className={"flex items-center gap-2.5 rounded-2xl border px-3 py-2 shrink-0 shadow-inner transition-all focus-within:border-[#B9BAFF]/45 focus-within:ring-2 focus-within:ring-[#8F91F4]/10 " + (isDark ? "border-white/10 bg-black/20" : "border-gray-200 bg-gray-50/80")}>
              <Icons.Search size={14} className={textMuted} />
              <input value={assetSearch} onChange={(e) => setAssetSearch(e.target.value)}
                placeholder={`在项目库中搜索${typeLabel[assetTab]}...`}
                className={"min-w-0 flex-1 bg-transparent text-xs outline-none " + (isDark ? "text-zinc-100 placeholder:text-zinc-600" : "text-gray-900 placeholder:text-gray-400")} />
              {assetSearch && (
                <button onClick={() => setAssetSearch('')} className={isDark ? "text-zinc-600 hover:text-zinc-300" : "text-gray-400 hover:text-gray-600"}><Icons.X size={12} /></button>
              )}
            </div>

            {selectedAssetIds.size > 0 && (
              <div className={`flex items-center justify-between rounded-2xl border px-3 py-2 text-xs shadow-sm ${isDark ? 'border-[#B9BAFF]/25 bg-[#8F91F4]/10 text-[#E1E3FF]' : 'border-[#C7C8FF] bg-[#F0F1FF] text-[#3739B0]'}`}>
                <span>已选择 {selectedAssetIds.size} 个资产</span>
                <div className="flex items-center gap-2">
                  <button className="font-semibold hover:opacity-80" onClick={() => setSelectedAssetIds(new Set())}>清空</button>
                  <button
                    className={`h-7 rounded-xl px-3 font-semibold shadow-sm ${isDark ? 'bg-[#8F91F4] text-slate-950 hover:bg-[#B9BAFF]' : 'bg-[#4446CE] text-white hover:bg-[#4446CE]'}`}
                    onClick={() => {
                      Array.from(selectedAssetIds).forEach(assetId => {
                        const asset = assetLibrary.find(item => item.id === assetId);
                        if (asset) onAddAssetToCanvas(asset);
                      });
                      setSelectedAssetIds(new Set());
                      setActivePanel(null);
                    }}
                  >
                    批量添加到画布
                  </button>
                </div>
              </div>
            )}

            {/* Asset list */}
            <div className="flex-1 overflow-y-auto custom-scrollbar pr-0.5 space-y-1.5">
              {filteredAssetLibrary.length === 0 ? (
                <div className={"h-full flex flex-col items-center justify-center " + textMuted}>
                  <Icons.Database size={24} className="opacity-30" />
                  <p className="mt-2.5 text-xs font-medium">没有匹配的{typeLabel[assetTab]}资产</p>
                </div>
              ) : (
                (() => {
                  const sourceItems = assetLibrary.filter(item => {
                    const scope = item.scope || 'project';
                    return scope === assetScope && (assetTab === 'all' || item.type === assetTab);
                  });
                  const keyword = assetSearch.trim().toLowerCase();
                  const matchesAsset = (item: AssetLibraryItem) => {
                    if (!keyword) return true;
                    return `${item.name} ${item.description} ${item.version} ${item.voiceTimbre || ''}`.toLowerCase().includes(keyword);
                  };
                  const getChildren = (parentId: string) => sourceItems.filter((a: AssetLibraryItem) => a.parentId === parentId);
                  const parents = sourceItems
                    .filter((a: AssetLibraryItem) => !a.parentId)
                    .filter((asset: AssetLibraryItem) => matchesAsset(asset) || getChildren(asset.id).some(matchesAsset));

                  return parents.map((asset: AssetLibraryItem) => {
                    const children = getChildren(asset.id);
                    const visibleChildren = children.filter(matchesAsset);
                    const isExpanded = expandedAssetIds.has(asset.id);
                    const hasChildren = children.length > 0;

                    if (assetTab === 'role') {
                      return (
                        <div
                          key={asset.id}
                          className={"overflow-hidden rounded-2xl border transition-all duration-200 " + (isDark ? "border-white/10 bg-white/[0.035] shadow-[0_16px_40px_rgba(2,6,23,0.18)] hover:border-[#B9BAFF]/20 hover:bg-white/[0.055]" : "border-gray-200 bg-white shadow-sm hover:border-[#E1E3FF] hover:shadow-md")}
                        >
                          <div
                            draggable
                            onDragStart={(event: React.DragEvent) => startAssetDrag(event, asset.id)}
                            className="cursor-grab active:cursor-grabbing"
                          >
                            <div className="flex items-center gap-3 p-2.5">
                              <button
                                type="button"
                                className={selectButtonClass(selectedAssetIds.has(asset.id))}
                                onClick={(e) => { e.stopPropagation(); toggleAssetSelected(asset.id); }}
                                title={selectedAssetIds.has(asset.id) ? '取消选择' : '选择资产'}
                              >
                                {selectedAssetIds.has(asset.id) && <Icons.Check size={13} />}
                              </button>
                              <img src={asset.previewUrl} className="h-20 w-24 rounded-xl object-cover shrink-0 ring-1 ring-black/10 shadow-sm" loading="lazy" />
                              <div className="min-w-0 flex-1">
                                <div className="flex items-center justify-between gap-2">
                                  <button
                                    type="button"
                                    onClick={() => hasChildren && toggleExpanded(asset.id)}
                                    className={"min-w-0 truncate text-left text-sm font-bold " + textMain}
                                  >
                                    {asset.name}
                                  </button>
                                  {hasChildren && (
                                    <button
                                      type="button"
                                      onClick={() => toggleExpanded(asset.id)}
                                      className={"h-7 w-7 shrink-0 rounded-xl flex items-center justify-center " + (isDark ? "text-zinc-400 hover:bg-[#8F91F4]/10 hover:text-[#E1E3FF]" : "text-gray-500 hover:bg-[#F0F1FF] hover:text-[#3739B0]")}
                                      aria-label={isExpanded ? '收起子形象' : '展开子形象'}
                                    >
                                      <Icons.ChevronDown size={16} className={"transition-transform " + (isExpanded ? "rotate-180" : "")} />
                                    </button>
                                  )}
                                </div>
                                {asset.voiceTimbre && (
                                  <div className={"mt-2 flex items-center gap-1.5 text-[11px] font-medium " + textSub}>
                                    <Icons.Volume2 size={12} />
                                    {asset.voiceTimbre}
                                  </div>
                                )}
                                <button
                                  type="button"
                                  onClick={(e) => { e.stopPropagation(); onAddAssetToCanvas(asset); setActivePanel(null); }}
                                  className={"mt-2 h-8 rounded-lg px-3 text-xs font-semibold transition-colors " + addButtonClass}
                                >
                                  添加到画布
                                </button>
                              </div>
                            </div>
                          </div>

                          {hasChildren && isExpanded && (
                            <div className={"relative ml-6 border-l pl-3 pb-2 " + (isDark ? "border-[#B9BAFF]/15" : "border-[#E1E3FF]")}>
                              {(visibleChildren.length ? visibleChildren : children).map((child: AssetLibraryItem) => (
                                <div
                                  key={child.id}
                                  draggable
                                  onDragStart={(event: React.DragEvent) => startAssetDrag(event, child.id)}
                                  className={"relative flex items-center gap-3 rounded-xl border-b py-2 pr-2 cursor-grab active:cursor-grabbing " + (isDark ? "border-white/10 hover:bg-white/5" : "border-gray-100 hover:bg-gray-50")}
                                >
                                  <span className={"absolute -left-3 top-1/2 h-px w-3 " + (isDark ? "bg-[#B9BAFF]/20" : "bg-[#E1E3FF]")} />
                                  <button
                                    type="button"
                                    className={selectButtonClass(selectedAssetIds.has(child.id))}
                                    onClick={(e) => { e.stopPropagation(); toggleAssetSelected(child.id); }}
                                    title={selectedAssetIds.has(child.id) ? '取消选择' : '选择资产'}
                                  >
                                    {selectedAssetIds.has(child.id) && <Icons.Check size={13} />}
                                  </button>
                                  <img src={child.previewUrl} className="h-16 w-20 rounded-xl object-cover shrink-0 ring-1 ring-black/10 shadow-sm" loading="lazy" />
                                  <div className="min-w-0 flex-1">
                                    <div className={"truncate text-xs font-bold " + textMain}>{child.name}</div>
                                    {child.voiceTimbre && (
                                      <div className={"mt-1 flex items-center gap-1.5 text-[11px] " + textSub}>
                                        <Icons.Volume2 size={11} />
                                        {child.voiceTimbre}
                                      </div>
                                    )}
                                  </div>
                                  <button
                                    type="button"
                                    onClick={(e) => { e.stopPropagation(); onAddAssetToCanvas(child); setActivePanel(null); }}
                                    className={"h-8 shrink-0 rounded-lg px-3 text-xs font-semibold transition-colors " + addButtonClass}
                                  >
                                    添加到画布
                                  </button>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      );
                    }

                    return (
                      <div key={asset.id}>
                        <div draggable
                          onDragStart={(event: React.DragEvent) => startAssetDrag(event, asset.id)}
                          className={"group/card rounded-2xl border p-3 transition-all duration-200 cursor-grab active:cursor-grabbing " + (isDark ? "border-white/10 bg-white/[0.035] hover:border-[#B9BAFF]/20 hover:bg-white/[0.055] shadow-[0_14px_34px_rgba(2,6,23,0.16)]" : "border-gray-100 bg-white hover:bg-gray-50 hover:border-[#E1E3FF] hover:shadow-md")}
                        >
                          <div className="flex items-center gap-3">
                            <button
                              type="button"
                              className={selectButtonClass(selectedAssetIds.has(asset.id))}
                              onClick={(e) => { e.stopPropagation(); toggleAssetSelected(asset.id); }}
                              title={selectedAssetIds.has(asset.id) ? '取消选择' : '选择资产'}
                            >
                              {selectedAssetIds.has(asset.id) && <Icons.Check size={13} />}
                            </button>
                            <img src={asset.previewUrl} className="h-10 w-10 rounded-xl object-cover shrink-0 ring-1 ring-black/10 shadow-sm" loading="lazy" />
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-1.5">
                                <span className={"truncate text-sm font-semibold " + textMain}>{asset.name}</span>
                                <span className={"text-[10px] font-medium shrink-0 " + textMuted}>{asset.version}</span>
                              </div>
                              {asset.voiceTimbre && (
                                <span className={"inline-flex items-center gap-1 mt-0.5 text-[10px] rounded-md px-1.5 py-0.5 " + (isDark ? "bg-amber-500/10 text-amber-300" : "bg-amber-50 text-amber-700")}>
                                  <Icons.Mic size={9} />
                                  {asset.voiceTimbre}
                                </span>
                              )}
                              {asset.description && (
                                <p className={"mt-1 text-[11px] truncate " + textMuted}>{asset.description}</p>
                              )}
                            </div>
                            <button
                              type="button"
                              onClick={(e) => { e.stopPropagation(); onAddAssetToCanvas(asset); setActivePanel(null); }}
                              className={"h-8 shrink-0 rounded-lg px-3 text-xs font-semibold transition-colors " + addButtonClass}
                            >
                              添加
                            </button>
                          </div>
                        </div>
                        {children.length > 0 && (
                          <div className={"ml-4 mt-1 space-y-1 border-l-2 pl-3 " + (isDark ? "border-[#B9BAFF]/10" : "border-[#E1E3FF]")}>
                            {children.map((child: AssetLibraryItem) => (
                              <div key={child.id} draggable
                                onDragStart={(event: React.DragEvent) => startAssetDrag(event, child.id)}
                                className={"group/card rounded-xl border p-2 transition-all duration-200 cursor-grab active:cursor-grabbing " + (isDark ? "border-white/10 bg-white/[0.025] hover:bg-white/[0.055] hover:border-[#B9BAFF]/20" : "border-gray-100 bg-gray-50/50 hover:bg-white hover:border-[#E1E3FF]")}
                              >
                                <div className="flex items-center gap-2">
                                  <button
                                    type="button"
                                    className={selectButtonClass(selectedAssetIds.has(child.id))}
                                    onClick={(e) => { e.stopPropagation(); toggleAssetSelected(child.id); }}
                                    title={selectedAssetIds.has(child.id) ? '取消选择' : '选择资产'}
                                  >
                                    {selectedAssetIds.has(child.id) && <Icons.Check size={13} />}
                                  </button>
                                  <img src={child.previewUrl} className="h-8 w-8 rounded-xl object-cover shrink-0 ring-1 ring-black/10 shadow-sm" loading="lazy" />
                                  <span className={"truncate text-xs font-medium flex-1 " + textMain}>{child.name}</span>
                                  {child.voiceTimbre && (
                                    <span className={"text-[10px] shrink-0 " + textMuted} title={child.voiceTimbre}>
                                      <Icons.Mic size={9} className="inline" />
                                    </span>
                                  )}
                                  <button
                                    type="button"
                                    onClick={(e) => { e.stopPropagation(); onAddAssetToCanvas(child); setActivePanel(null); }}
                                    className={"h-7 shrink-0 rounded-md px-2 text-[11px] font-semibold transition-colors " + addButtonClass}
                                  >
                                    添加
                                  </button>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  });
                })()
              )}
            </div>
          </div>
        )}

        {/* Video tab — Shot clips */}
        {mediaTab === "video" && (
          <div className="flex-1 flex flex-col gap-2.5 overflow-hidden">
            <div className="flex gap-2 shrink-0">
              <select className={"h-9 flex-1 rounded-xl text-xs px-3 outline-none border transition-colors " + (isDark ? "bg-zinc-900/60 border-zinc-800 text-zinc-200 focus:border-zinc-600" : "bg-gray-50 border-gray-200 text-gray-700 focus:border-gray-300")}
                value={String(shotEpisode)} onChange={(e) => setShotEpisode(e.target.value === "all" ? "all" : Number(e.target.value))}>
                <option value="all">全部集数</option>
                {episodes.map((ep: number) => <option key={ep} value={String(ep)}>第{ep} 集</option>)}
              </select>
              <div className={"flex items-center gap-2 rounded-xl border px-3 flex-1 transition-colors focus-within:border-[#4446CE]/40 " + (isDark ? "border-zinc-800 bg-zinc-900/50" : "border-gray-200 bg-gray-50/80")}>
                <Icons.Search size={13} className={textMuted} />
                <input value={shotSearch} onChange={(e) => setShotSearch(e.target.value)}
                  className={"min-w-0 flex-1 bg-transparent text-xs outline-none py-2 " + (isDark ? "text-zinc-100 placeholder:text-zinc-600" : "text-gray-900 placeholder:text-gray-400")} placeholder="搜索镜次..." />
              </div>
            </div>
            {selectedShotClipIds.size > 0 && (
              <div className={`flex items-center justify-between rounded-xl border px-3 py-2 text-xs ${isDark ? 'border-[#4446CE]/30 bg-[#4446CE]/10 text-[#C7C8FF]' : 'border-[#C7C8FF] bg-[#F0F1FF] text-[#3739B0]'}`}>
                <span>已选择 {selectedShotClipIds.size} 个视频</span>
                <div className="flex items-center gap-2">
                  <button className="font-semibold hover:opacity-80" onClick={() => setSelectedShotClipIds(new Set())}>清空</button>
                  <button
                    className={`h-7 rounded-lg px-3 font-semibold ${isDark ? 'bg-[#4446CE] text-white hover:bg-[#8F91F4]' : 'bg-[#4446CE] text-white hover:bg-[#4446CE]'}`}
                    onClick={() => {
                      Array.from(selectedShotClipIds).forEach(clipId => {
                        const clip = shotClips.find(item => item.id === clipId);
                        if (clip) onAddShotClipToCanvas?.(clip);
                      });
                      setSelectedShotClipIds(new Set());
                      setActivePanel(null);
                    }}
                  >
                    批量添加到画布
                  </button>
                </div>
              </div>
            )}
            <div className="flex-1 overflow-y-auto custom-scrollbar pr-0.5 space-y-1.5">
              {filteredShotClips.length === 0 ? (
                <div className={"h-full flex flex-col items-center justify-center " + textMuted}>
                  <Icons.Clapperboard size={24} className="opacity-30" />
                  <p className="mt-2.5 text-xs font-medium">暂无分镜视频片段</p>
                  <p className="text-[11px] mt-1 opacity-60">从空间管理导入分镜后显示</p>
                </div>
              ) : (
                filteredShotClips.map((clip: ShotClip) => {
                  const displayName = formatShotClipName(clip);
                  return (
                  <div key={clip.id} draggable
                    onDragStart={(event: React.DragEvent) => { event.dataTransfer.setData("application/kc-shot-clip", JSON.stringify(clip)); event.dataTransfer.effectAllowed = "copy"; }}
                    className={"group/card rounded-xl border p-2.5 transition-all duration-200 cursor-grab active:cursor-grabbing " + (isDark ? "border-zinc-800/70 bg-zinc-900/35 hover:bg-zinc-800/60 hover:border-zinc-700" : "border-gray-100 bg-white hover:bg-gray-50 hover:border-gray-200 hover:shadow-sm")}
                  >
                    <div className="flex items-center gap-4">
                      <button
                        type="button"
                        className={selectButtonClass(selectedShotClipIds.has(clip.id))}
                        onClick={(e) => { e.stopPropagation(); toggleShotSelected(clip.id); }}
                        title={selectedShotClipIds.has(clip.id) ? '取消选择' : '选择视频'}
                      >
                        {selectedShotClipIds.has(clip.id) && <Icons.Check size={13} />}
                      </button>
                      <div className={"relative h-[78px] w-[138px] shrink-0 overflow-hidden rounded-lg ring-1 " + (isDark ? "ring-black/30 bg-zinc-950" : "ring-gray-200 bg-gray-100")}>
                        <img
                          src={clip.keyframeUrls?.[0] || createShotClipPreview(displayName)}
                          className="h-full w-full object-cover transition-transform duration-500 group-hover/card:scale-105"
                          loading="lazy"
                        />
                        <div className="absolute inset-0 flex items-center justify-center bg-black/5">
                          <span className="flex h-10 w-10 items-center justify-center rounded-full border border-white/70 bg-black/35 text-white shadow-lg backdrop-blur-sm">
                            <Icons.Play size={19} fill="currentColor" />
                          </span>
                        </div>
                      </div>
                      <div className="flex min-w-0 flex-1 flex-col justify-between self-stretch py-1">
                        <div className={"truncate text-sm font-bold leading-6 " + textMain}>{displayName}</div>
                        <button
                          className={"h-9 w-full rounded-lg text-xs font-semibold transition-colors " + addButtonClass}
                          onClick={(e) => { e.stopPropagation(); onAddShotClipToCanvas?.(clip); setActivePanel(null); }}
                        >
                          添加到画布
                        </button>
                      </div>
                    </div>
                  </div>
                  );
                })
              )}
            </div>
          </div>
        )}
      </div>
    );
  };

  const renderPanel = () => {
    if (!activePanel) return null;

    // 生成历史面板 - 独立的大面板
    if (activePanel === 'HISTORY') {
      const historyMeta: Record<HistoryTab, { label: string; icon: any; count: number; emptyLabel: string }> = {
        image: { label: '图片', icon: Icons.Image, count: imageNodes.length, emptyLabel: '图片' },
        video: { label: '视频', icon: Icons.Video, count: videoNodes.length, emptyLabel: '视频' },
        text: { label: '文字', icon: Icons.FileText, count: textNodes.length, emptyLabel: '文字' },
        audio: { label: '音频', icon: Icons.Music, count: audioNodes.length, emptyLabel: '音频' },
      };
      const activeHistoryMeta = historyMeta[historyTab];

      return (
        <div 
          ref={panelRef}
          className={`fixed left-[76px] top-4 bottom-4 w-80 ${bgMain} backdrop-blur-xl border ${borderColor} rounded-2xl z-[190] flex flex-col shadow-2xl animate-in slide-in-from-left-2 duration-200`}
        >
          {/* Header */}
          <div className={`px-5 py-4 border-b ${borderColor} flex items-center justify-between shrink-0`}>
            <div className="flex items-center gap-3">
              <div className={`p-2 rounded-lg ${isDark ? 'bg-[#4446CE]/10' : 'bg-[#F0F1FF]'}`}>
                <Icons.Clock size={18} className={isDark ? 'text-[#8F91F4]' : 'text-[#4446CE]'} />
              </div>
              <h3 className={`text-base font-bold ${textMain}`}>生成历史</h3>
            </div>
            <button 
              onClick={() => setActivePanel(null)}
              className={`p-2 rounded-lg ${hoverBg} ${textSub}`}
            >
              <Icons.X size={18} />
            </button>
          </div>
          
          {/* Tabs */}
          <div className={`px-4 pt-4 shrink-0`}>
            <div className={`flex p-1 rounded-xl ${isDark ? 'bg-zinc-900' : 'bg-gray-100'}`}>
              {(Object.keys(historyMeta) as HistoryTab[]).map(tab => {
                const Icon = historyMeta[tab].icon;
                return (
                  <button
                    key={tab}
                    className={`flex-1 py-2.5 text-[11px] font-semibold rounded-lg transition-all flex items-center justify-center gap-1.5 ${
                      historyTab === tab
                        ? (isDark ? 'bg-zinc-700 text-white shadow-sm' : 'bg-white text-gray-900 shadow-sm')
                        : textSub
                    }`}
                    onClick={() => setHistoryTab(tab)}
                  >
                    <Icon size={13} />
                    {historyMeta[tab].label} ({historyMeta[tab].count})
                  </button>
                );
              })}
            </div>
          </div>

          {/* Content Grid */}
          <div className="flex-1 p-4 overflow-y-auto custom-scrollbar">
            {activeHistoryMeta.count === 0 ? (
              <div className={`flex flex-col items-center justify-center h-full ${textMuted}`}>
                <div className={`w-16 h-16 rounded-2xl flex items-center justify-center mb-4 ${isDark ? 'bg-zinc-800' : 'bg-gray-100'}`}>
                  <activeHistoryMeta.icon size={28} className="opacity-40" />
                </div>
                <p className="text-sm font-medium">暂无生成历史</p>
                <p className={`text-xs mt-1 ${textMuted}`}>生成的{activeHistoryMeta.emptyLabel}将显示在这里</p>
              </div>
            ) : historyTab === 'image' || historyTab === 'video' ? (
              <div className="grid grid-cols-2 gap-3">
                {(historyTab === 'image' ? imageNodes : videoNodes).map(node => (
                  <HistoryItem 
                    key={node.id} 
                    node={node} 
                    type={historyTab} 
                    isDark={isDark}
                    onClick={() => onPreviewMedia(
                      (historyTab === 'image' ? node.imageSrc : node.videoSrc) || '', 
                      historyTab
                    )}
                  />
                ))}
              </div>
            ) : historyTab === 'text' ? (
              <div className="space-y-3">
                {textNodes.map(node => {
                  const text = node.optimizedPrompt || node.prompt || '';
                  return (
                    <TextHistoryItem
                      key={node.id}
                      node={node}
                      text={text}
                      isDark={isDark}
                      onClick={() => onPreviewText(node.title || '文本历史', text)}
                    />
                  );
                })}
              </div>
            ) : (
              <div className="space-y-3">
                {audioNodes.map(node => (
                  <AudioHistoryItem key={node.id} node={node} isDark={isDark} />
                ))}
              </div>
            )}
          </div>

          {/* Footer Stats */}
          <div className={`px-4 py-3 border-t ${borderColor} shrink-0`}>
            <div className={`flex items-center justify-between text-xs ${textMuted}`}>
              <span>共 {activeHistoryMeta.count} 项</span>
              <span>{activeHistoryMeta.label}历史</span>
            </div>
          </div>
        </div>
      );
    }

    // 其他面板 - 紧凑型
    let title = '';
    let content = null;

    switch (activePanel) {
      case 'ADD':
        title = '添加节点';
        content = renderAddPanel();
        break;
      case 'PROJECT':
        title = '项目';
        content = renderProjectPanel();
        break;
      case 'ASSET_MATERIAL':
        title = '项目资产库';
        content = renderAssetMaterialPanel();
        break;

    }

    return (
      <div 
        ref={panelRef}
        className={`fixed left-[76px] top-1/2 -translate-y-1/2 ${activePanel === 'ASSET_MATERIAL' ? 'w-[380px] h-[70vh]' : 'w-64 max-h-[80vh]'} ${bgMain} backdrop-blur-xl border ${borderColor} rounded-2xl z-[190] flex flex-col shadow-xl animate-in slide-in-from-left-2 duration-200`}
      >
        {/* Panel Header */}
        <div className={`px-4 py-3 border-b ${borderColor} flex items-center justify-between shrink-0`}>
          <h3 className={`text-sm font-bold ${textMain}`}>{title}</h3>
          <button 
            onClick={() => setActivePanel(null)}
            className={`p-1.5 rounded-lg ${hoverBg} ${textSub}`}
          >
            <Icons.X size={16} />
          </button>
        </div>
        
        {/* Panel Content */}
        <div className="flex-1 p-4 overflow-hidden">
          {content}
        </div>
      </div>
    );
  };

  return (
    <>
      {/* Sidebar */}
      <div 
        ref={sidebarRef}
        className={`fixed left-4 top-1/2 -translate-y-1/2 z-[200] ${bgMain} backdrop-blur-xl border ${borderColor} rounded-2xl p-2 flex flex-col items-center gap-1 shadow-xl`}
      >
        <SidebarButton icon={Icons.LayoutGrid} panel="ADD" tooltip="添加" />
        
        <div className={`w-8 h-px my-1 ${isDark ? 'bg-zinc-800' : 'bg-gray-200'}`} />
        
        <SidebarButton icon={Icons.Clock} panel="HISTORY" tooltip="生成历史" />
        <SidebarButton icon={Icons.Database} panel="ASSET_MATERIAL" tooltip="项目资产库" />
<SidebarButton icon={Icons.Upload} tooltip="导入素材" onClick={onImportAsset} />
        
      </div>

      {/* Panel */}
      {renderPanel()}
    </>
  );
};

export default Sidebar;
