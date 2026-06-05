import React, { useState, useRef, useEffect, memo, useMemo } from 'react';
import { Icons } from './Icons';
import { AssetLibraryItem, AssetLibraryScope, AssetLibraryType, MaterialLibraryItem, NodeType, NodeData, PromptTemplate } from '../types';

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
  onApplyPrompt?: (prompt: string) => void;
  isDark?: boolean;
}

type ActivePanel = 'ADD' | 'HISTORY' | 'ASSET_LIBRARY' | 'ASSETS' | 'PROJECT' | 'PROMPT_LIBRARY' | null;

const PROMPT_TEMPLATES: PromptTemplate[] = [
  { id: 'p1', category: '人物', title: '电影级人物特写', prompt: '电影级人物特写，柔和的伦勃朗光，浅景深，肤色自然，眼神有故事感，35mm 镜头质感' },
  { id: 'p2', category: '人物', title: '赛博朋克角色', prompt: '赛博朋克风格角色全身像，霓虹灯反射，机械改造细节，雨夜街道背景，高对比度' },
  { id: 'p3', category: '人物', title: '古风人像', prompt: '中国古风人像，汉服造型，水墨画背景，自然光线，淡雅色调，意境悠远' },
  { id: 'p4', category: '场景', title: '电影级室内', prompt: '电影级室内场景，暖色调台灯光，木质家具，窗外夜景，胶片质感，景深柔和' },
  { id: 'p5', category: '场景', title: '末日废土', prompt: '末日废土场景，荒芜城市废墟，锈蚀金属，雾气弥漫，戏剧性天光，超写实风格' },
  { id: 'p6', category: '场景', title: '奇幻森林', prompt: '奇幻森林场景，巨型蘑菇和发光植物，萤火虫飞舞，薄雾缭绕，魔幻氛围' },
  { id: 'p7', category: '产品', title: '高端产品摄影', prompt: '高端产品摄影，纯黑背景，单侧主光，产品轮廓光，反射面材质，商业广告品质' },
  { id: 'p8', category: '产品', title: '美食特写', prompt: '美食特写摄影，顶光 + 侧面补光，食材纹理清晰，微距浅景深，暖色调，令人食欲大开' },
  { id: 'p9', category: '风格', title: '日式动漫', prompt: '日式动漫风格，细腻线条，柔和渐变色彩，樱花背景，角色表情生动' },
  { id: 'p10', category: '风格', title: '水彩手绘', prompt: '水彩手绘风格，笔触自然随性，颜料晕染效果，留白意境，纸张纹理' },
  { id: 'p11', category: '风格', title: '像素艺术', prompt: '16-bit 像素艺术风格，复古游戏画面，有限调色板，清晰像素边缘，怀旧氛围' },
  { id: 'p12', category: '风格', title: '3D 写实渲染', prompt: '3D 写实渲染，Octane Render 品质，全局光照，PBR 材质，8K 细节纹理' },
];

const PROMPT_CATEGORIES = ['全部', '人物', '场景', '产品', '风格'];
type AssetItem = MaterialLibraryItem & {
    nodeId: string;
    type: 'image' | 'video';
};

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
                   <video src={node.videoSrc} className="w-full h-full object-cover opacity-90 group-hover:opacity-100 transition-opacity" muted preload="metadata" />
                   <div className="absolute inset-0 flex items-center justify-center">
                       <div className={`w-8 h-8 rounded-full flex items-center justify-center ${isDark ? 'bg-white/20' : 'bg-black/20'} backdrop-blur-sm`}>
                           <Icons.Play size={14} className="text-white ml-0.5"/>
                       </div>
                   </div>
                </div>
            )}
            
            {stackCount > 1 && (
                <div className={`absolute top-1.5 right-1.5 text-[10px] px-1.5 py-0.5 rounded-md flex items-center gap-1 ${isDark ? 'bg-black/60 text-white' : 'bg-white/80 text-gray-700'} backdrop-blur-sm`}>
                    <Icons.Layers size={10} />
                    <span className="font-semibold">{stackCount}</span>
                </div>
            )}

            <div className={`absolute inset-x-0 bottom-0 p-2 ${isDark ? 'bg-gradient-to-t from-black/80 to-transparent' : 'bg-gradient-to-t from-white/90 to-transparent'}`}>
                <div className={`text-[11px] truncate font-medium ${isDark ? 'text-white' : 'text-gray-800'}`}>{node.title}</div>
            </div>
        </div>
    );
}, (prev, next) => {
    return prev.type === next.type && 
           prev.node.id === next.node.id && 
           prev.node.imageSrc === next.node.imageSrc && 
           prev.node.videoSrc === next.node.videoSrc &&
           prev.node.title === next.node.title &&
           prev.isDark === next.isDark &&
           (prev.node.outputArtifacts?.length || 0) === (next.node.outputArtifacts?.length || 0);
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
  onApplyPrompt,
  isDark = true
}) => {
  const [activePanel, setActivePanel] = useState<ActivePanel>(null);
  const [historyTab, setHistoryTab] = useState<'image' | 'video'>('image');
  const [assetScope, setAssetScope] = useState<AssetLibraryScope | 'all'>('project');
  const [assetTab, setAssetTab] = useState<AssetLibraryType | 'all'>('all');
  const [assetSearch, setAssetSearch] = useState('');
  const [materialTab, setMaterialTab] = useState<'all' | 'image' | 'video' | 'favorite'>('all');
  const [assetMenu, setAssetMenu] = useState<{ x: number; y: number; item: AssetItem } | null>(null);
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

  const materialAssets = useMemo(() => {
      const map = new Map<string, AssetItem>();
      uniqueNodes.forEach(node => {
          const nodeType: 'image' | 'video' = node.videoSrc ? 'video' : 'image';
          const favoriteSet = new Set(node.favoriteArtifacts || []);
          const isAudioUrl = (url: string) => /^(data:audio)/.test(url) || /\.(mp3|wav|m4a|aac|ogg|flac)(\?|$)/i.test(url);
          const isImageOrVideoUrl = (url: string) => /^(data:image|data:video|https?:|blob:)/.test(url) && !isAudioUrl(url);
          const urls = [
              ...(node.imageSrc ? [node.imageSrc] : []),
              ...(node.videoSrc ? [node.videoSrc] : []),
              ...(node.outputArtifacts || []).filter(isImageOrVideoUrl),
          ].filter(Boolean);
          urls.forEach((url, index) => {
              const type: 'image' | 'video' = node.videoSrc === url || /\.(mp4|webm|mov|mkv)(\?|$)/i.test(url) ? 'video' : nodeType;
              const id = `${node.id}:${url}`;
              if (!map.has(id)) {
                  map.set(id, {
                      id,
                      nodeId: node.id,
                      url,
                      type,
                      title: index === 0 ? node.title : `${node.title} #${index + 1}`,
                      isFavorite: favoriteSet.has(url),
                  });
              }
          });
      });
      return Array.from(map.values());
  }, [uniqueNodes]);

  const filteredMaterialAssets = useMemo(() => {
      return materialAssets.filter(item => {
          if (materialTab === 'favorite') return item.isFavorite;
          if (materialTab === 'image') return item.type === 'image';
          if (materialTab === 'video') return item.type === 'video';
          return true;
      });
  }, [materialAssets, materialTab]);

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
        setAssetMenu(null);
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

  const renderAssetLibraryPanel = () => {
    const scopeTabs: { key: AssetLibraryScope | 'all'; label: string }[] = [
      { key: 'project', label: '项目库' },
      { key: 'public', label: '公共库' },
      { key: 'all', label: '全部' },
    ];
    const tabs: { key: AssetLibraryType | 'all'; label: string }[] = [
      { key: 'all', label: '全部' },
      { key: 'role', label: '角色' },
      { key: 'scene', label: '场景' },
      { key: 'prop', label: '道具' },
    ];
    const typeLabel: Record<AssetLibraryType, string> = {
      role: '角色',
      scene: '场景',
      prop: '道具',
    };

    return (
      <div className="h-full flex flex-col gap-3">
        <div className={`flex items-center gap-2 rounded-xl border px-3 py-2 ${isDark ? 'border-zinc-800 bg-zinc-950/40' : 'border-gray-200 bg-gray-50'}`}>
          <Icons.Search size={15} className={textMuted} />
          <input
            value={assetSearch}
            onChange={(event) => setAssetSearch(event.target.value)}
            placeholder="搜索角色、场景、道具"
            className={`min-w-0 flex-1 bg-transparent text-xs outline-none ${isDark ? 'text-zinc-100 placeholder:text-zinc-600' : 'text-gray-900 placeholder:text-gray-400'}`}
          />
        </div>

        <div className={`grid grid-cols-3 gap-1 rounded-xl p-1 ${isDark ? 'bg-zinc-950/45' : 'bg-gray-100'}`}>
          {scopeTabs.map(tab => (
            <button
              key={tab.key}
              className={`h-8 rounded-lg text-xs font-semibold transition-all ${
                assetScope === tab.key
                  ? (isDark ? 'bg-blue-500/20 text-blue-300' : 'bg-white text-blue-600 shadow-sm')
                  : (isDark ? 'text-zinc-500 hover:bg-zinc-800 hover:text-zinc-200' : 'text-gray-500 hover:bg-white/70 hover:text-gray-800')
              }`}
              onClick={() => setAssetScope(tab.key)}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div className="flex gap-1">
          {tabs.map(tab => (
            <button
              key={tab.key}
              className={`h-8 flex-1 rounded-lg text-xs font-semibold transition-all ${
                assetTab === tab.key
                  ? (isDark ? 'bg-blue-500/20 text-blue-300' : 'bg-blue-50 text-blue-600')
                  : (isDark ? 'text-zinc-500 hover:bg-zinc-800 hover:text-zinc-200' : 'text-gray-500 hover:bg-gray-100 hover:text-gray-800')
              }`}
              onClick={() => setAssetTab(tab.key)}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div className="flex-1 overflow-y-auto custom-scrollbar pr-1 space-y-3">
          {filteredAssetLibrary.length === 0 ? (
            <div className={`h-full flex flex-col items-center justify-center ${textMuted}`}>
              <Icons.Database size={28} className="opacity-40" />
              <p className="mt-3 text-sm font-medium">没有匹配资产</p>
            </div>
          ) : (
            filteredAssetLibrary.map(asset => (
              <div
                key={asset.id}
                draggable
                onDragStart={(event) => {
                  event.dataTransfer.setData('application/kc-asset', asset.id);
                  event.dataTransfer.effectAllowed = 'copy';
                }}
                className={`group rounded-2xl border p-2 transition-all cursor-grab active:cursor-grabbing ${
                  isDark ? 'border-zinc-800 bg-zinc-950/35 hover:border-zinc-700 hover:bg-zinc-900/70' : 'border-gray-200 bg-white hover:border-gray-300 hover:shadow-sm'
                }`}
              >
                <div className="flex gap-3">
                  <button
                    className="relative h-20 w-20 shrink-0 overflow-hidden rounded-xl"
                    onClick={() => onPreviewMedia(asset.previewUrl, 'image')}
                    title="查看资产预览"
                  >
                    <img src={asset.previewUrl} className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105" loading="lazy" decoding="async" />
                    <div className="absolute inset-0 bg-black/0 group-hover:bg-black/15 transition-colors" />
                  </button>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <span className={`truncate text-sm font-semibold ${textMain}`}>{asset.name}</span>
                      <span className={`shrink-0 rounded-md px-1.5 py-0.5 text-[10px] font-bold ${isDark ? 'bg-zinc-800 text-zinc-300' : 'bg-gray-100 text-gray-600'}`}>{asset.version}</span>
                    </div>
                    <div className={`mt-1 flex items-center gap-2 text-[10px] ${textMuted}`}>
                      <span>{typeLabel[asset.type]}</span>
                      <span className={`h-1 w-1 rounded-full ${isDark ? 'bg-zinc-700' : 'bg-gray-300'}`} />
                      <span>{asset.updatedAt}</span>
                    </div>
                    <p className={`mt-2 line-clamp-2 text-[11px] leading-4 ${textSub}`}>{asset.description}</p>
                  </div>
                </div>
                <div className="mt-2 flex items-center justify-between">
                  <span className={`text-[10px] ${textMuted}`}>拖到画布或点击放入</span>
                  <button
                    className={`h-7 rounded-lg px-2.5 text-xs font-semibold transition-all ${
                      isDark ? 'bg-blue-500/15 text-blue-300 hover:bg-blue-500/25' : 'bg-blue-50 text-blue-600 hover:bg-blue-100'
                    }`}
                    onClick={() => onAddAssetToCanvas(asset)}
                  >
                    放到画布
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    );
  };

  const renderAssetsPanel = () => {
    const materialTabs: { key: typeof materialTab; label: string; count: number }[] = [
      { key: 'all', label: '全部', count: materialAssets.length },
      { key: 'image', label: '图片', count: materialAssets.filter(item => item.type === 'image').length },
      { key: 'video', label: '视频', count: materialAssets.filter(item => item.type === 'video').length },
      { key: 'favorite', label: '收藏', count: materialAssets.filter(item => item.isFavorite).length },
    ];

    return (
    <div className="h-full flex flex-col gap-3">
      <div className={`grid grid-cols-4 gap-1 rounded-xl p-1 shrink-0 ${isDark ? 'bg-zinc-950/45' : 'bg-gray-100'}`}>
        {materialTabs.map(tab => (
          <button
            key={tab.key}
            className={`h-8 rounded-lg text-[11px] font-semibold transition-all ${
              materialTab === tab.key
                ? (isDark ? 'bg-blue-500/20 text-blue-300' : 'bg-white text-blue-600 shadow-sm')
                : (isDark ? 'text-zinc-500 hover:bg-zinc-800 hover:text-zinc-200' : 'text-gray-500 hover:bg-white/70 hover:text-gray-800')
            }`}
            onClick={() => setMaterialTab(tab.key)}
            title={`${tab.label}素材 ${tab.count} 个`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {materialAssets.length === 0 ? (
        <div className={`flex-1 flex flex-col items-center justify-center py-10 ${textMuted}`}>
          <div className={`w-14 h-14 rounded-2xl flex items-center justify-center mb-3 ${isDark ? 'bg-zinc-800' : 'bg-gray-100'}`}>
            <Icons.Images size={24} className="opacity-45" />
          </div>
          <p className="text-sm font-medium">暂无素材</p>
          <p className="text-xs mt-1">上传或生成后会出现在这里</p>
        </div>
      ) : filteredMaterialAssets.length === 0 ? (
        <div className={`flex-1 flex flex-col items-center justify-center py-10 ${textMuted}`}>
          <div className={`w-14 h-14 rounded-2xl flex items-center justify-center mb-3 ${isDark ? 'bg-zinc-800' : 'bg-gray-100'}`}>
            <Icons.Star size={24} className="opacity-45" />
          </div>
          <p className="text-sm font-medium">暂无{materialTab === 'favorite' ? '收藏' : ''}素材</p>
          <p className="text-xs mt-1">点击节点素材角标即可收藏</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3 overflow-y-auto custom-scrollbar pr-1">
          {filteredMaterialAssets.map(item => (
            <div
              key={item.id}
              draggable
              className="group"
              onDragStart={(event) => {
                event.dataTransfer.setData('application/kc-material', JSON.stringify(item));
                event.dataTransfer.effectAllowed = 'copy';
              }}
              onContextMenu={(event) => {
                event.preventDefault();
                event.stopPropagation();
                setAssetMenu({ x: event.clientX, y: event.clientY, item });
              }}
            >
              <div
                role="button"
                tabIndex={0}
                className={`relative aspect-square w-full rounded-xl overflow-hidden text-left ${isDark ? 'bg-zinc-900' : 'bg-gray-100'}`}
                onClick={() => onPreviewMedia(item.url, item.type)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault();
                    onPreviewMedia(item.url, item.type);
                  }
                }}
                title="查看素材"
              >
                {item.type === 'video' ? (
                  <>
                    <video src={item.url} className="w-full h-full object-cover opacity-90 group-hover:opacity-100 transition-opacity" muted preload="metadata" />
                    <div className="absolute inset-0 flex items-center justify-center">
                      <div className="w-8 h-8 rounded-full bg-black/30 backdrop-blur-sm flex items-center justify-center">
                        <Icons.Play size={14} className="text-white ml-0.5" />
                      </div>
                    </div>
                  </>
                ) : (
                  <img src={item.url} className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105" loading="lazy" decoding="async" />
                )}
                <button
                  className={`absolute top-1.5 right-1.5 z-20 w-7 h-7 rounded-lg border backdrop-blur-md flex items-center justify-center transition-all ${
                    item.isFavorite ? 'bg-amber-400/90 border-amber-200 text-zinc-950' : 'bg-black/35 border-white/10 text-white/70 hover:bg-black/60 hover:text-white'
                  }`}
                  title={item.isFavorite ? '取消收藏' : '收藏素材'}
                  onClick={(event) => {
                    event.preventDefault();
                    event.stopPropagation();
                    onToggleMaterialFavorite(item.nodeId, item.url, item.type);
                  }}
                >
                  <Icons.Star size={13} fill={item.isFavorite ? 'currentColor' : 'none'} />
                </button>
                <div className={`absolute inset-x-0 bottom-0 p-2 ${isDark ? 'bg-gradient-to-t from-black/80 to-transparent' : 'bg-gradient-to-t from-white/90 to-transparent'}`}>
                  <div className={`text-[11px] truncate font-medium ${isDark ? 'text-white' : 'text-gray-800'}`}>{item.title}</div>
                </div>
              </div>
              <div className="mt-1.5 flex items-center gap-1.5">
                <button
                  className={`min-w-0 flex-1 h-7 rounded-lg text-[11px] font-semibold transition-all ${
                    isDark ? 'bg-blue-500/15 text-blue-300 hover:bg-blue-500/25' : 'bg-blue-50 text-blue-600 hover:bg-blue-100'
                  }`}
                  onClick={() => onAddMaterialToCanvas(item)}
                  title="把该素材作为新节点添加到画布"
                >
                  添加到画布
                </button>
                <button
                  className={`h-7 w-7 rounded-lg flex items-center justify-center transition-all ${
                    item.isFavorite
                      ? (isDark ? 'bg-amber-400/15 text-amber-300 hover:bg-amber-400/25' : 'bg-amber-50 text-amber-600 hover:bg-amber-100')
                      : (isDark ? 'bg-zinc-800 text-zinc-400 hover:text-white hover:bg-zinc-700' : 'bg-gray-100 text-gray-500 hover:text-gray-800 hover:bg-gray-200')
                  }`}
                  onClick={() => onToggleMaterialFavorite(item.nodeId, item.url, item.type)}
                  title={item.isFavorite ? '取消收藏' : '收藏素材'}
                >
                  <Icons.Star size={13} fill={item.isFavorite ? 'currentColor' : 'none'} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
    );
  };

  const [promptCategory, setPromptCategory] = useState<string>('全部');

  const filteredPrompts = useMemo(() => {
    if (promptCategory === '全部') return PROMPT_TEMPLATES;
    return PROMPT_TEMPLATES.filter(t => t.category === promptCategory);
  }, [promptCategory]);

  const renderPromptLibraryPanel = () => (
    <div className="h-full flex flex-col gap-3">
      <div className={`flex gap-1 rounded-xl p-1 ${isDark ? 'bg-zinc-950/45' : 'bg-gray-100'}`}>
        {PROMPT_CATEGORIES.map(cat => (
          <button
            key={cat}
            className={`h-7 px-2.5 rounded-lg text-[11px] font-semibold transition-all ${
              promptCategory === cat
                ? (isDark ? 'bg-blue-500/20 text-blue-300' : 'bg-white text-blue-600 shadow-sm')
                : (isDark ? 'text-zinc-500 hover:bg-zinc-800 hover:text-zinc-200' : 'text-gray-500 hover:bg-white/70 hover:text-gray-800')
            }`}
            onClick={() => setPromptCategory(cat)}
          >
            {cat}
          </button>
        ))}
      </div>
      <div className="flex-1 overflow-y-auto space-y-2 no-scrollbar">
        {filteredPrompts.map(template => (
          <button
            key={template.id}
            className={`w-full text-left p-3 rounded-xl border transition-all group ${
              isDark
                ? 'border-zinc-800 hover:border-zinc-600 hover:bg-zinc-800/50'
                : 'border-gray-100 hover:border-gray-300 hover:bg-gray-50'
            }`}
            onClick={() => { onApplyPrompt?.(template.prompt); setActivePanel(null); }}
          >
            <div className="flex items-center justify-between mb-1">
              <span className={`text-xs font-semibold ${textMain}`}>{template.title}</span>
              <span className={`text-[10px] px-1.5 py-0.5 rounded-md ${isDark ? 'bg-zinc-800 text-zinc-400' : 'bg-gray-100 text-gray-500'}`}>{template.category}</span>
            </div>
            <div className={`text-[11px] leading-relaxed line-clamp-2 ${textSub}`}>{template.prompt}</div>
          </button>
        ))}
      </div>
    </div>
  );

  // 渲染面板内容
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
      case 'ASSET_LIBRARY':
        title = '资产库';
        content = renderAssetLibraryPanel();
        break;
      case 'ASSETS':
        title = '素材库';
        content = renderAssetsPanel();
        break;
      case 'PROMPT_LIBRARY':
        title = '提示词库';
        content = renderPromptLibraryPanel();
        break;
    }

    return (
      <div 
        ref={panelRef}
        className={`fixed left-[76px] top-1/2 -translate-y-1/2 ${activePanel === 'ASSETS' || activePanel === 'ASSET_LIBRARY' || activePanel === 'PROMPT_LIBRARY' ? 'w-80 h-[70vh]' : 'w-64 max-h-[80vh]'} ${bgMain} backdrop-blur-xl border ${borderColor} rounded-2xl z-[190] flex flex-col shadow-xl animate-in slide-in-from-left-2 duration-200`}
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
        <SidebarButton icon={Icons.Database} panel="ASSET_LIBRARY" tooltip="资产库" />
        <SidebarButton icon={Icons.Images} panel="ASSETS" tooltip="素材库" />
        <SidebarButton icon={Icons.Library} panel="PROMPT_LIBRARY" tooltip="提示词库" />
        <SidebarButton icon={Icons.Upload} tooltip="导入素材" onClick={onImportAsset} />
        
      </div>

      {/* Panel */}
      {renderPanel()}
      {assetMenu && (
        <div
          className={`fixed z-[260] min-w-[150px] rounded-xl border py-1.5 shadow-2xl backdrop-blur-xl ${isDark ? 'bg-zinc-900/95 border-zinc-700/80' : 'bg-white/95 border-gray-200'}`}
          style={{ left: assetMenu.x, top: assetMenu.y }}
          onMouseDown={(event) => event.stopPropagation()}
        >
          <button
            className={`w-full text-left px-3 py-2 text-xs flex items-center gap-2.5 rounded-lg ${isDark ? 'text-gray-300 hover:bg-zinc-800 hover:text-white' : 'text-gray-700 hover:bg-gray-100 hover:text-black'}`}
            onClick={() => { onAddMaterialToCanvas(assetMenu.item); setAssetMenu(null); }}
          >
            <Icons.ImagePlus size={14} /> 添加到画布
          </button>
          <button
            className={`w-full text-left px-3 py-2 text-xs flex items-center gap-2.5 rounded-lg ${isDark ? 'text-gray-300 hover:bg-zinc-800 hover:text-white' : 'text-gray-700 hover:bg-gray-100 hover:text-black'}`}
            onClick={() => { onToggleMaterialFavorite(assetMenu.item.nodeId, assetMenu.item.url, assetMenu.item.type); setAssetMenu(null); }}
          >
            <Icons.Star size={14} fill={assetMenu.item.isFavorite ? 'currentColor' : 'none'} /> {assetMenu.item.isFavorite ? '取消收藏' : '收藏'}
          </button>
          <div className={`h-px my-1 mx-2 ${isDark ? 'bg-zinc-700' : 'bg-gray-200'}`} />
          <button
            className={`w-full text-left px-3 py-2 text-xs flex items-center gap-2.5 rounded-lg ${isDark ? 'text-gray-300 hover:bg-zinc-800 hover:text-white' : 'text-gray-700 hover:bg-gray-100 hover:text-black'}`}
            onClick={() => { onOpenSaveResult(assetMenu.item.nodeId); setAssetMenu(null); }}
          >
            <Icons.Database size={14} /> 存入项目/更新资产
          </button>
          <button
            className={`w-full text-left px-3 py-2 text-xs flex items-center gap-2.5 rounded-lg ${isDark ? 'text-gray-300 hover:bg-zinc-800 hover:text-white' : 'text-gray-700 hover:bg-gray-100 hover:text-black'}`}
            onClick={() => { onSaveAsset(assetMenu.item.url, assetMenu.item.type, assetMenu.item.title); setAssetMenu(null); }}
          >
            <Icons.Save size={14} /> 保存到本地
          </button>
          <button
            className={`w-full text-left px-3 py-2 text-xs flex items-center gap-2.5 rounded-lg ${isDark ? 'text-gray-300 hover:bg-zinc-800 hover:text-white' : 'text-gray-700 hover:bg-gray-100 hover:text-black'}`}
            onClick={() => { onCopyAsset(assetMenu.item.url, assetMenu.item.type); setAssetMenu(null); }}
          >
            <Icons.Copy size={14} /> 复制
          </button>
          <div className={`h-px my-1 mx-2 ${isDark ? 'bg-zinc-700' : 'bg-gray-200'}`} />
          <button
            className={`w-full text-left px-3 py-2 text-xs flex items-center gap-2.5 rounded-lg text-red-400 ${isDark ? 'hover:bg-red-500/10 hover:text-red-300' : 'hover:bg-red-50 hover:text-red-600'}`}
            onClick={() => { onDeleteAsset(assetMenu.item.nodeId, assetMenu.item.url, assetMenu.item.type); setAssetMenu(null); }}
          >
            <Icons.Trash2 size={14} /> 删除
          </button>
        </div>
      )}
    </>
  );
};

export default Sidebar;
