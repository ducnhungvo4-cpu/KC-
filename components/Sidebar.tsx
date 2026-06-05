import React, { useState, useRef, useEffect, memo, useMemo } from 'react';
import { Icons } from './Icons';
import { AssetLibraryItem, AssetLibraryScope, AssetLibraryType, MaterialLibraryItem, NodeType, NodeData, ShotClip, AddToAssetType } from '../types';

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
  const [historyTab, setHistoryTab] = useState<'image' | 'video'>('image');
  const [assetScope, setAssetScope] = useState<AssetLibraryScope | 'all'>('project');
  const [assetTab, setAssetTab] = useState<AssetLibraryType>('role');
  const [assetSearch, setAssetSearch] = useState('');
  const [mediaTab, setMediaTab] = useState<'image' | 'video'>('image');
  const [shotEpisode, setShotEpisode] = useState<number | 'all'>('all');
  const [shotSearch, setShotSearch] = useState('');
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

  // Mock shot clips for demo - will be replaced by real data
  const shotClips = useMemo<ShotClip[]>(() => {
    return [
      { id: 'shot_001', episodeNo: 1, sceneNo: 1, shotNo: 1, shotName: '开场全景', videoUrl: '', prompt: '电影级全景镜头，清晨的城市天际线', keyframeUrls: [], audioUrl: '', description: '第一集第一场开场镜头' },
      { id: 'shot_002', episodeNo: 1, sceneNo: 1, shotNo: 2, shotName: '主角近景', videoUrl: '', prompt: '男主角面部特写，柔和的侧光', keyframeUrls: [], audioUrl: '', description: '主角登场特写' },
      { id: 'shot_003', episodeNo: 1, sceneNo: 2, shotNo: 1, shotName: '街道跟拍', videoUrl: '', prompt: '手持跟拍，主角穿过繁忙街道', keyframeUrls: [], audioUrl: '', description: '街道追逐戏' },
      { id: 'shot_004', episodeNo: 2, sceneNo: 1, shotNo: 1, shotName: '室内对话', videoUrl: '', prompt: '双人中景，暖色调室内灯光', keyframeUrls: [], audioUrl: '', description: '办公室对话场景' },
    ];
  }, []);

  const filteredShotClips = useMemo(() => {
    return shotClips.filter(s => {
      if (shotEpisode !== 'all' && s.episodeNo !== shotEpisode) return false;
      if (shotSearch.trim()) {
        const kw = shotSearch.trim().toLowerCase();
        const match = `${s.shotName} ${s.description || ''} ${s.prompt || ''} ${s.episodeNo} ${s.shotNo}`.toLowerCase().includes(kw);
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
          const matchScope = assetScope === 'all' || scope === assetScope;
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
  const bgMain = isDark ? 'bg-[#18181b]/95' : 'bg-white/95';
  const borderColor = isDark ? 'border-zinc-800' : 'border-gray-200';
  const textMain = isDark ? 'text-white' : 'text-gray-900';
  const textSub = isDark ? 'text-gray-400' : 'text-gray-500';
  const textMuted = isDark ? 'text-gray-600' : 'text-gray-400';
  const hoverBg = isDark ? 'hover:bg-white/5' : 'hover:bg-gray-100';
  const activeBg = isDark ? 'bg-blue-500/10 text-blue-400' : 'bg-blue-50 text-blue-600';

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
        onClick={() => { onAddNode(type); setActivePanel(null); }}
        className={`w-full flex items-center gap-3 p-3 rounded-xl border transition-all group ${
          isDark 
            ? 'border-zinc-800 hover:border-zinc-700 hover:bg-zinc-800/50' 
            : 'border-gray-100 hover:border-gray-200 hover:bg-gray-50'
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
        <div className={`text-[10px] font-bold uppercase tracking-wider ${textMuted}`}>生成节点</div>
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
            color={isDark ? 'bg-cyan-500/15 text-cyan-400' : 'bg-cyan-100 text-cyan-600'} 
          />
          <NodeButton 
            icon={Icons.Video} 
            label="生视频" 
            description="文本/图片生成视频"
            type={NodeType.TEXT_TO_VIDEO} 
            color={isDark ? 'bg-purple-500/15 text-purple-400' : 'bg-purple-100 text-purple-600'} 
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
        <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${isDark ? 'bg-blue-500/10 text-blue-400' : 'bg-blue-50 text-blue-600'}`}>
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
    const scopeTabs: { key: AssetLibraryScope | "all"; label: string }[] = [
      { key: "project", label: "项目库" },
      { key: "public", label: "公共库" },
      { key: "all", label: "全部" },
    ];

    const typeLabel: Record<AssetLibraryType, string> = {
      role: "角色",
      scene: "场景",
      prop: "道具",
    };

    return (
      <div className="h-full flex flex-col gap-3">
        {/* Top-level media type tabs */}
        <div className={"grid grid-cols-2 gap-1 rounded-xl p-1 shrink-0 " + (isDark ? "bg-zinc-950/45" : "bg-gray-100")}>
          {[
            { key: "image" as const, label: "图片", icon: Icons.Image },
            { key: "video" as const, label: "视频", icon: Icons.Video },
          ].map(tab => (
            <button
              key={tab.key}
              className={"h-9 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition-all " + (
                mediaTab === tab.key
                  ? (isDark ? "bg-blue-500/20 text-blue-300" : "bg-white text-blue-600 shadow-sm")
                  : (isDark ? "text-zinc-500 hover:bg-zinc-800 hover:text-zinc-200" : "text-gray-500 hover:bg-white/70 hover:text-gray-800")
              )}
              onClick={() => setMediaTab(tab.key)}
            >
              <tab.icon size={14} />
              {tab.label}
            </button>
          ))}
        </div>

        {/* Image tab — Assets with hierarchy */}
        {mediaTab === "image" && (
          <div className="flex-1 flex flex-col gap-3 overflow-hidden">
            <div className="flex gap-1 shrink-0">
              {[
                { key: "role" as AssetLibraryType, label: "角色" },
                { key: "scene" as AssetLibraryType, label: "场景" },
                { key: "prop" as AssetLibraryType, label: "道具" },
              ].map(tab => (
                <button key={tab.key} className={"h-8 flex-1 rounded-lg text-xs font-semibold transition-all " + (
                  assetTab === tab.key
                    ? (isDark ? "bg-blue-500/20 text-blue-300" : "bg-blue-50 text-blue-600")
                    : (isDark ? "text-zinc-500 hover:bg-zinc-800 hover:text-zinc-200" : "text-gray-500 hover:bg-gray-100 hover:text-gray-800")
                )} onClick={() => { setAssetTab(tab.key); setAssetSearch(''); }}>{tab.label}</button>
              ))}
            </div>

            <div className={"flex items-center gap-2 rounded-xl border px-3 py-2 shrink-0 " + (isDark ? "border-zinc-800 bg-zinc-950/40" : "border-gray-200 bg-gray-50")}>
              <Icons.Search size={15} className={textMuted} />
              <input value={assetSearch} onChange={(e) => setAssetSearch(e.target.value)}
                placeholder={`搜索${typeLabel[assetTab]}...`}
                className={"min-w-0 flex-1 bg-transparent text-xs outline-none " + (isDark ? "text-zinc-100 placeholder:text-zinc-600" : "text-gray-900 placeholder:text-gray-400")} />
            </div>

            <div className={"grid grid-cols-3 gap-1 rounded-xl p-1 shrink-0 " + (isDark ? "bg-zinc-950/45" : "bg-gray-100")}>
              {scopeTabs.map(tab => (
                <button key={tab.key} className={"h-8 rounded-lg text-xs font-semibold transition-all " + (
                  assetScope === tab.key
                    ? (isDark ? "bg-blue-500/20 text-blue-300" : "bg-white text-blue-600 shadow-sm")
                    : (isDark ? "text-zinc-500 hover:bg-zinc-800 hover:text-zinc-200" : "text-gray-500 hover:bg-white/70 hover:text-gray-800")
                )} onClick={() => setAssetScope(tab.key)}>{tab.label}</button>
              ))}
            </div>

            <div className="flex-1 overflow-y-auto custom-scrollbar pr-1 space-y-2">
              {filteredAssetLibrary.length === 0 ? (
                <div className={"h-full flex flex-col items-center justify-center " + textMuted}>
                  <Icons.Database size={28} className="opacity-40" />
                  <p className="mt-3 text-sm font-medium">没有匹配资产</p>
                </div>
              ) : (
                (() => {
                  const parents = filteredAssetLibrary.filter((a: AssetLibraryItem) => !a.parentId);
                  const getChildren = (parentId: string) => filteredAssetLibrary.filter((a: AssetLibraryItem) => a.parentId === parentId);
                  return parents.map((asset: AssetLibraryItem) => {
                    const children = getChildren(asset.id);
                    return (
                      <div key={asset.id}>
                        <div draggable
                          onDragStart={(event: React.DragEvent) => { event.dataTransfer.setData("application/kc-asset", asset.id); event.dataTransfer.effectAllowed = "copy"; }}
                          className={"group rounded-xl border p-3 transition-all cursor-grab active:cursor-grabbing " + (isDark ? "border-zinc-800 bg-zinc-950/35 hover:border-zinc-700 hover:bg-zinc-900/70" : "border-gray-200 bg-white hover:border-gray-300 hover:shadow-sm")}
                        >
                          <div className="flex items-center gap-3">
                            <img src={asset.previewUrl} className="h-10 w-10 rounded-lg object-cover shrink-0" loading="lazy" />
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-1.5">
                                <span className={"truncate text-sm font-semibold " + textMain}>{asset.name}</span>
                                <span className={"text-[10px] shrink-0 " + textMuted}>{asset.version}</span>
                              </div>
                              {asset.voiceTimbre && (
                                <span className={"inline-flex items-center gap-1 mt-0.5 text-[10px] rounded-md px-1.5 py-0.5 " + (isDark ? "bg-amber-500/15 text-amber-300" : "bg-amber-100 text-amber-700")}>
                                  <Icons.Mic size={9} />
                                  {asset.voiceTimbre}
                                </span>
                              )}
                              {asset.description && (
                                <p className={"mt-1 text-[11px] truncate " + textMuted}>{asset.description}</p>
                              )}
                            </div>
                            <span className={"text-[10px] shrink-0 " + textMuted}>{asset.updatedAt}</span>
                          </div>
                        </div>
                        {children.length > 0 && (
                          <div className="ml-4 mt-1 space-y-1 border-l-2 pl-3" style={{ borderColor: isDark ? 'rgba(63,63,70,0.5)' : 'rgba(229,231,235,0.8)' }}>
                            {children.map((child: AssetLibraryItem) => (
                              <div key={child.id} draggable
                                onDragStart={(event: React.DragEvent) => { event.dataTransfer.setData("application/kc-asset", child.id); event.dataTransfer.effectAllowed = "copy"; }}
                                className={"group rounded-lg border p-2 transition-all cursor-grab active:cursor-grabbing " + (isDark ? "border-zinc-800/60 bg-zinc-950/20 hover:border-zinc-700 hover:bg-zinc-900/50" : "border-gray-100 bg-gray-50 hover:border-gray-200 hover:bg-white")}
                              >
                                <div className="flex items-center gap-2">
                                  <img src={child.previewUrl} className="h-8 w-8 rounded-lg object-cover shrink-0" loading="lazy" />
                                  <span className={"truncate text-xs font-medium " + textMain}>{child.name}</span>
                                  {child.voiceTimbre && (
                                    <span className={"text-[10px] shrink-0 " + textMuted} title={child.voiceTimbre}>
                                      <Icons.Mic size={9} className="inline" />
                                    </span>
                                  )}
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
          <div className="flex-1 flex flex-col gap-3 overflow-hidden">
            <div className="flex gap-2 shrink-0">
              <select className={"h-8 flex-1 rounded-lg text-xs px-2 outline-none " + (isDark ? "bg-zinc-800 border-zinc-700 text-zinc-200" : "bg-gray-100 border-gray-200 text-gray-700")}
                value={String(shotEpisode)} onChange={(e) => setShotEpisode(e.target.value === "all" ? "all" : Number(e.target.value))}>
                <option value="all">全部集数</option>
                {episodes.map((ep: number) => <option key={ep} value={String(ep)}>第{ep} 集</option>)}
              </select>
              <div className={"flex items-center gap-2 rounded-xl border px-3 flex-1 " + (isDark ? "border-zinc-800 bg-zinc-950/40" : "border-gray-200 bg-gray-50")}>
                <Icons.Search size={14} className={textMuted} />
                <input value={shotSearch} onChange={(e) => setShotSearch(e.target.value)}
                  className={"min-w-0 flex-1 bg-transparent text-xs outline-none " + (isDark ? "text-zinc-100 placeholder:text-zinc-600" : "text-gray-900 placeholder:text-gray-400")} placeholder="搜索镜次" />
              </div>
            </div>
            <div className="flex-1 overflow-y-auto custom-scrollbar pr-1 space-y-2">
              {filteredShotClips.length === 0 ? (
                <div className={"h-full flex flex-col items-center justify-center " + textMuted}>
                  <Icons.Clapperboard size={28} className="opacity-40" />
                  <p className="mt-3 text-sm font-medium">暂无分镜视频片段</p>
                  <p className="text-xs mt-1">空间管理中添加分镜后显示</p>
                </div>
              ) : (
                filteredShotClips.map((clip: ShotClip) => (
                  <div key={clip.id} draggable
                    onDragStart={(event: React.DragEvent) => { event.dataTransfer.setData("application/kc-shot-clip", JSON.stringify(clip)); event.dataTransfer.effectAllowed = "copy"; }}
                    className={"group rounded-2xl border p-3 transition-all cursor-grab active:cursor-grabbing " + (isDark ? "border-zinc-800 bg-zinc-950/35 hover:border-zinc-700 hover:bg-zinc-900/70" : "border-gray-200 bg-white hover:border-gray-300 hover:shadow-sm")}
                  >
                    <div className="flex items-start justify-between">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5">
                          <span className={"rounded-md px-1.5 py-0.5 text-[10px] font-bold " + (isDark ? "bg-purple-500/20 text-purple-300" : "bg-purple-100 text-purple-700")}>
                            第{clip.episodeNo}集·第{clip.sceneNo}场·第{String(clip.shotNo).padStart(2, "0")}镜
                          </span>
                        </div>
                        <p className={"mt-1.5 text-sm font-semibold truncate " + textMain}>{clip.shotName}</p>
                        {clip.prompt && <p className={"mt-1 text-[11px] line-clamp-2 " + textSub}>{clip.prompt}</p>}
                      </div>
                    </div>
                    <div className={"mt-2 flex items-center gap-3 text-[10px] " + textMuted}>
                      {clip.keyframeUrls && clip.keyframeUrls.length > 0 && (
                        <span className="flex items-center gap-1"><Icons.Image size={10} />{clip.keyframeUrls.length} 关键帧</span>
                      )}
                      {clip.audioUrl && <span className="flex items-center gap-1"><Icons.Music size={10} />音频</span>}
                      {clip.videoUrl && <span className="flex items-center gap-1"><Icons.Video size={10} />视频</span>}
                    </div>
                    <button 
                      className={"mt-2 w-full h-8 rounded-lg text-xs font-semibold transition-all " + (isDark ? "bg-blue-500/15 text-blue-300 hover:bg-blue-500/25" : "bg-blue-50 text-blue-600 hover:bg-blue-100")}
                      onClick={(e) => { e.stopPropagation(); onAddShotClipToCanvas?.(clip); }}
                    >
                      放到画布
                    </button>
                  </div>
                ))
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
      return (
        <div 
          ref={panelRef}
          className={`fixed left-[76px] top-4 bottom-4 w-80 ${bgMain} backdrop-blur-xl border ${borderColor} rounded-2xl z-[190] flex flex-col shadow-2xl animate-in slide-in-from-left-2 duration-200`}
        >
          {/* Header */}
          <div className={`px-5 py-4 border-b ${borderColor} flex items-center justify-between shrink-0`}>
            <div className="flex items-center gap-3">
              <div className={`p-2 rounded-lg ${isDark ? 'bg-blue-500/10' : 'bg-blue-50'}`}>
                <Icons.Clock size={18} className={isDark ? 'text-blue-400' : 'text-blue-600'} />
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
              <button 
                className={`flex-1 py-2.5 text-xs font-semibold rounded-lg transition-all flex items-center justify-center gap-2 ${
                  historyTab === 'image' 
                    ? (isDark ? 'bg-zinc-700 text-white shadow-sm' : 'bg-white text-gray-900 shadow-sm') 
                    : textSub
                }`}
                onClick={() => setHistoryTab('image')}
              >
                <Icons.Image size={14} />
                图片 ({imageNodes.length})
              </button>
              <button 
                className={`flex-1 py-2.5 text-xs font-semibold rounded-lg transition-all flex items-center justify-center gap-2 ${
                  historyTab === 'video' 
                    ? (isDark ? 'bg-zinc-700 text-white shadow-sm' : 'bg-white text-gray-900 shadow-sm') 
                    : textSub
                }`}
                onClick={() => setHistoryTab('video')}
              >
                <Icons.Video size={14} />
                视频 ({videoNodes.length})
              </button>
            </div>
          </div>

          {/* Content Grid */}
          <div className="flex-1 p-4 overflow-y-auto custom-scrollbar">
            {(historyTab === 'image' ? imageNodes : videoNodes).length === 0 ? (
              <div className={`flex flex-col items-center justify-center h-full ${textMuted}`}>
                <div className={`w-16 h-16 rounded-2xl flex items-center justify-center mb-4 ${isDark ? 'bg-zinc-800' : 'bg-gray-100'}`}>
                  {historyTab === 'image' ? <Icons.Image size={28} className="opacity-40" /> : <Icons.Video size={28} className="opacity-40" />}
                </div>
                <p className="text-sm font-medium">暂无生成历史</p>
                <p className={`text-xs mt-1 ${textMuted}`}>生成的{historyTab === 'image' ? '图片' : '视频'}将显示在这里</p>
              </div>
            ) : (
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
            )}
          </div>

          {/* Footer Stats */}
          <div className={`px-4 py-3 border-t ${borderColor} shrink-0`}>
            <div className={`flex items-center justify-between text-xs ${textMuted}`}>
              <span>共 {(historyTab === 'image' ? imageNodes : videoNodes).length} 项</span>
              <span>{historyTab === 'image' ? '图片' : '视频'}历史</span>
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
        title = '资产素材库';
        content = renderAssetMaterialPanel();
        break;

    }

    return (
      <div 
        ref={panelRef}
        className={`fixed left-[76px] top-1/2 -translate-y-1/2 ${activePanel === 'ASSET_MATERIAL' ? 'w-80 h-[70vh]' : 'w-64 max-h-[80vh]'} ${bgMain} backdrop-blur-xl border ${borderColor} rounded-2xl z-[190] flex flex-col shadow-xl animate-in slide-in-from-left-2 duration-200`}
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
        <SidebarButton icon={Icons.LayoutGrid} panel="ADD" tooltip="添加节点" />
        
        <div className={`w-8 h-px my-1 ${isDark ? 'bg-zinc-800' : 'bg-gray-200'}`} />
        
        <SidebarButton icon={Icons.Clock} panel="HISTORY" tooltip="生成历史" />
        <SidebarButton icon={Icons.Coins} tooltip="积分看板" onClick={onOpenCreditDashboard} />
        <SidebarButton icon={Icons.Database} panel="ASSET_MATERIAL" tooltip="资产素材库" />
<SidebarButton icon={Icons.Upload} tooltip="导入素材" onClick={onImportAsset} />
        
      </div>

      {/* Panel */}
      {renderPanel()}
    </>
  );
};

export default Sidebar;
