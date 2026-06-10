import React, { useEffect, useState, useMemo } from 'react';
import { Icons } from './Icons';
import { AssetLibraryItem, AssetLibraryType, AddToAssetType } from '../types';

interface AssetSelectionModalProps {
  isOpen: boolean;
  nodeId: string;
  nodeType: 'image' | 'video';
  nodeTitle?: string;
  assetLibrary: AssetLibraryItem[];
  shotClips?: { id: string; episodeNo: number; shotNo: number; shotName: string; sceneNo: number; description?: string }[];
  isDark: boolean;
  onClose: () => void;
  onAddToExistingAsset: (nodeId: string, assetId: string, targetType: AddToAssetType, closePanel?: boolean) => void;
  onCreateNewAsset: (nodeId: string, assetType: AssetLibraryType, name: string) => void;
  onAddToShotClip: (nodeId: string, shotClipId: string, closePanel?: boolean) => void;
}

export const AssetSelectionModal: React.FC<AssetSelectionModalProps> = ({
  isOpen,
  nodeId,
  nodeType,
  nodeTitle,
  assetLibrary,
  shotClips = [],
  isDark,
  onClose,
  onAddToExistingAsset,
  onCreateNewAsset,
  onAddToShotClip,
}) => {
  const [mode, setMode] = useState<'existing' | 'new'>('existing');
  const [assetType, setAssetType] = useState<AssetLibraryType>('role');
  const [assetSearch, setAssetSearch] = useState('');
  const [newAssetType, setNewAssetType] = useState<AssetLibraryType>('role');
  const [newAssetName, setNewAssetName] = useState('');
  const [shotEpisode, setShotEpisode] = useState<number | 'all'>('all');
  const [shotSearch, setShotSearch] = useState('');
  const [selectedAssetIds, setSelectedAssetIds] = useState<Set<string>>(new Set());
  const [selectedShotIds, setSelectedShotIds] = useState<Set<string>>(new Set());
  const [showShotConfirm, setShowShotConfirm] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    setSelectedAssetIds(new Set());
    setSelectedShotIds(new Set());
    setShowShotConfirm(false);
  }, [isOpen, nodeId, nodeType]);

  if (!isOpen) return null;

  const typeIcons: Record<AssetLibraryType, typeof Icons.User> = { role: Icons.User, scene: Icons.Image, prop: Icons.Box };
  const typeLabel: Record<AssetLibraryType, string> = { role: '角色', scene: '场景', prop: '道具' };
  const typeColors: Record<AssetLibraryType, { active: string; dot: string }> = {
    role: { active: isDark ? 'bg-[#4446CE]/15 text-[#B9BAFF] ring-1 ring-[#4446CE]/30' : 'bg-[#F0F1FF] text-[#4446CE] ring-1 ring-[#C7C8FF]', dot: 'bg-[#8F91F4]' },
    scene: { active: isDark ? 'bg-amber-500/15 text-amber-300 ring-1 ring-amber-500/30' : 'bg-amber-50 text-amber-600 ring-1 ring-amber-200', dot: 'bg-amber-400' },
    prop: { active: isDark ? 'bg-emerald-500/15 text-emerald-300 ring-1 ring-emerald-500/30' : 'bg-emerald-50 text-emerald-600 ring-1 ring-emerald-200', dot: 'bg-emerald-400' },
  };
  const toggleSelected = (current: Set<string>, id: string) => {
    const next = new Set(current);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    return next;
  };

  if (nodeType === 'image') {
    const filteredAssets = useMemo(() => {
      const kw = assetSearch.trim().toLowerCase();
      return assetLibrary.filter(a => {
        const matchType = a.type === assetType;
        const matchKw = !kw || `${a.name} ${a.description || ''}`.toLowerCase().includes(kw);
        return matchType && matchKw;
      });
    }, [assetLibrary, assetType, assetSearch]);

    const parents = filteredAssets.filter(a => !a.parentId);
    const getChildren = (pid: string) => filteredAssets.filter(a => a.parentId === pid);

    return (
      <div className="fixed inset-0 z-[250] flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={onClose}>
        <div
          className={`w-[440px] max-h-[78vh] rounded-2xl border flex flex-col overflow-hidden ${isDark ? 'bg-[#1a1a1f] border-zinc-700/60 text-zinc-100 shadow-[0_25px_60px_-12px_rgba(0,0,0,0.7)]' : 'bg-white border-gray-200/80 text-gray-900 shadow-[0_25px_60px_-12px_rgba(0,0,0,0.25)]'}`}
          onClick={(e) => e.stopPropagation()}
          style={{ animation: 'modalIn 0.2s ease-out' }}
        >
          {/* Header */}
          <div className={`px-5 py-4 flex items-center justify-between border-b shrink-0 ${isDark ? 'border-zinc-800/80 bg-gradient-to-r from-[#1a1a1f] to-[#1e1e24]' : 'border-gray-100 bg-gradient-to-r from-white to-gray-50/80'}`}>
            <div className="flex items-center gap-3 min-w-0">
              <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${isDark ? 'bg-[#4446CE]/15 text-[#8F91F4]' : 'bg-[#F0F1FF] text-[#4446CE]'}`}>
                <Icons.Database size={16} />
              </div>
              <div>
                <h3 className="text-sm font-bold leading-tight">添加到项目资产库</h3>
                {nodeTitle && <p className={`text-[11px] mt-0.5 truncate max-w-[260px] ${isDark ? 'text-zinc-500' : 'text-gray-400'}`}>{nodeTitle}</p>}
              </div>
            </div>
            <button className={`w-8 h-8 rounded-lg flex items-center justify-center transition-colors ${isDark ? 'hover:bg-zinc-800 text-zinc-500 hover:text-zinc-200' : 'hover:bg-gray-100 text-gray-400 hover:text-gray-700'}`} onClick={onClose}><Icons.X size={16} /></button>
          </div>

          {/* Mode Tabs */}
          <div className={`px-5 pt-4 pb-1 shrink-0`}>
            <div className={`flex p-0.5 rounded-xl ${isDark ? 'bg-zinc-900/80' : 'bg-gray-100'}`}>
              {([{ key: 'existing' as const, label: '归入已有', icon: Icons.FolderOpen }, { key: 'new' as const, label: '新建资产', icon: Icons.FilePlus }] as const).map(tab => (
                <button key={tab.key} className={`h-9 flex-1 rounded-[10px] text-xs font-semibold flex items-center justify-center gap-1.5 transition-all duration-200 ${mode === tab.key ? (isDark ? 'bg-zinc-700/80 text-white shadow-sm' : 'bg-white text-gray-900 shadow-sm') : (isDark ? 'text-zinc-500 hover:text-zinc-300' : 'text-gray-400 hover:text-gray-600')}`} onClick={() => setMode(tab.key)}>
                  <tab.icon size={13} />
                  {tab.label}
                </button>
              ))}
            </div>
          </div>

          <div className="flex-1 overflow-y-auto custom-scrollbar px-5 py-3 space-y-3">
            {mode === 'existing' ? (
              <>
                {/* Type pills */}
                <div className="flex gap-1.5 shrink-0">
                  {(['role', 'scene', 'prop'] as AssetLibraryType[]).map(key => {
                    const Icon = typeIcons[key];
                    const isActive = assetType === key;
                    return (
                      <button key={key} className={`h-8 flex-1 rounded-[10px] text-xs font-semibold flex items-center justify-center gap-1.5 transition-all duration-200 ${isActive ? typeColors[key].active : (isDark ? 'text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800/60' : 'text-gray-400 hover:text-gray-600 hover:bg-gray-50')}`} onClick={() => { setAssetType(key); setAssetSearch(''); setSelectedAssetIds(new Set()); }}>
                        <Icon size={13} />
                        {typeLabel[key]}
                      </button>
                    );
                  })}
                </div>

                {/* Search */}
                <div className={`flex items-center gap-2.5 rounded-xl border px-3.5 py-2.5 transition-colors focus-within:border-[#4446CE]/50 ${isDark ? 'border-zinc-800 bg-zinc-900/50' : 'border-gray-200 bg-gray-50/80'}`}>
                  <Icons.Search size={14} className={isDark ? 'text-zinc-600' : 'text-gray-400'} />
                  <input value={assetSearch} onChange={(e) => setAssetSearch(e.target.value)}
                    placeholder={`在项目库中搜索${typeLabel[assetType]}...`}
                    className={`min-w-0 flex-1 bg-transparent text-xs outline-none ${isDark ? 'text-zinc-100 placeholder:text-zinc-600' : 'text-gray-900 placeholder:text-gray-400'}`} />
                  {assetSearch && (
                    <button onClick={() => setAssetSearch('')} className={`${isDark ? 'text-zinc-600 hover:text-zinc-300' : 'text-gray-400 hover:text-gray-600'}`}><Icons.X size={12} /></button>
                  )}
                </div>

                {/* Asset list */}
                <div className="space-y-1.5 max-h-[260px] overflow-y-auto custom-scrollbar pr-0.5">
                  {parents.length === 0 ? (
                    <div className={`py-10 flex flex-col items-center ${isDark ? 'text-zinc-600' : 'text-gray-400'}`}>
                      <Icons.Database size={24} className="opacity-30" />
                      <p className="mt-2.5 text-xs">没有匹配的{typeLabel[assetType]}资产</p>
                    </div>
                  ) : (
                    parents.map(asset => {
                      const children = getChildren(asset.id);
                      return (
                        <div key={asset.id}>
                          <button
                            className={`w-full rounded-xl border p-3 text-left transition-all duration-200 flex items-center gap-3 group/item ${selectedAssetIds.has(asset.id) ? (isDark ? 'border-[#4446CE]/60 bg-[#4446CE]/10 ring-1 ring-[#4446CE]/20' : 'border-[#8F91F4] bg-[#F0F1FF] ring-1 ring-[#C7C8FF]') : (isDark ? 'border-zinc-800/70 bg-zinc-900/30 hover:bg-zinc-800/60 hover:border-zinc-700' : 'border-gray-100 bg-white hover:bg-gray-50 hover:border-gray-200 hover:shadow-sm')}`}
                            onClick={() => setSelectedAssetIds(prev => toggleSelected(prev, asset.id))}
                          >
                            <img src={asset.previewUrl} className="h-10 w-10 rounded-lg object-cover shrink-0 ring-1 ring-black/10" loading="lazy" />
                            <div className="min-w-0 flex-1">
                              <p className={`text-sm font-semibold truncate ${isDark ? 'text-zinc-100' : 'text-gray-900'}`}>{asset.name}</p>
                              {asset.description && <p className={`text-[11px] truncate mt-0.5 ${isDark ? 'text-zinc-500' : 'text-gray-400'}`}>{asset.description}</p>}
                            </div>
                            <div className="flex flex-col items-end gap-1 shrink-0">
                              <span className={`text-[10px] font-medium ${isDark ? 'text-zinc-600' : 'text-gray-400'}`}>{asset.version}</span>
                              {selectedAssetIds.has(asset.id) ? <Icons.Check size={14} className="text-[#8F91F4]" /> : <Icons.ChevronRight size={14} className={`transition-all duration-200 ${isDark ? 'text-zinc-700 group-hover/item:text-zinc-400 group-hover/item:translate-x-0.5' : 'text-gray-300 group-hover/item:text-gray-500 group-hover/item:translate-x-0.5'}`} />}
                            </div>
                          </button>
                          {children.map(child => (
                            <button key={child.id}
                              className={`w-full rounded-lg border p-2.5 text-left transition-all duration-200 flex items-center gap-2.5 ml-5 mt-1 group/item ${selectedAssetIds.has(child.id) ? (isDark ? 'border-[#4446CE]/50 bg-[#4446CE]/10' : 'border-[#B9BAFF] bg-[#F0F1FF]') : (isDark ? 'border-zinc-800/50 hover:bg-zinc-800/40 hover:border-zinc-700' : 'border-gray-100 hover:bg-gray-50 hover:border-gray-200')}`}
                              onClick={() => setSelectedAssetIds(prev => toggleSelected(prev, child.id))}
                            >
                              <img src={child.previewUrl} className="h-8 w-8 rounded-lg object-cover shrink-0 ring-1 ring-black/10" loading="lazy" />
                              <span className={`text-xs font-medium truncate flex-1 ${isDark ? 'text-zinc-200' : 'text-gray-800'}`}>{child.name}</span>
                              <span className={`text-[10px] shrink-0 ${isDark ? 'text-zinc-600' : 'text-gray-400'}`}>{child.version}</span>
                              {selectedAssetIds.has(child.id) ? <Icons.Check size={12} className="shrink-0 text-[#8F91F4]" /> : <Icons.ChevronRight size={12} className={`transition-all duration-200 shrink-0 ${isDark ? 'text-zinc-700 group-hover/item:text-zinc-400' : 'text-gray-300 group-hover/item:text-gray-500'}`} />}
                            </button>
                          ))}
                        </div>
                      );
                    })
                  )}
                </div>
                <button
                  disabled={selectedAssetIds.size === 0}
                  className={`w-full h-11 rounded-xl text-sm font-semibold transition-all duration-200 disabled:opacity-30 disabled:cursor-not-allowed ${isDark ? 'bg-gradient-to-r from-[#4446CE]/80 to-[#4446CE]/80 text-white hover:from-[#4446CE] hover:to-[#4446CE] shadow-lg shadow-[#4446CE]/10' : 'bg-gradient-to-r from-[#4446CE] to-[#4446CE] text-white hover:from-[#4446CE] hover:to-[#3739B0] shadow-lg shadow-[#4446CE]/20'}`}
                  onClick={() => {
                    Array.from(selectedAssetIds).forEach(assetId => onAddToExistingAsset(nodeId, assetId, assetType, false));
                    onClose();
                  }}
                >
                  {selectedAssetIds.size > 1 ? `添加 ${selectedAssetIds.size} 个资产` : '添加选中资产'}
                </button>
              </>
            ) : (
              <>
                {/* New asset type pills */}
                <div className="flex gap-1.5 shrink-0">
                  {(['role', 'scene', 'prop'] as AssetLibraryType[]).map(key => {
                    const Icon = typeIcons[key];
                    const isActive = newAssetType === key;
                    return (
                      <button key={key} className={`h-8 flex-1 rounded-[10px] text-xs font-semibold flex items-center justify-center gap-1.5 transition-all duration-200 ${isActive ? typeColors[key].active : (isDark ? 'text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800/60' : 'text-gray-400 hover:text-gray-600 hover:bg-gray-50')}`} onClick={() => setNewAssetType(key)}>
                        <Icon size={13} />
                        {typeLabel[key]}
                      </button>
                    );
                  })}
                </div>

                {/* Name input */}
                <div className={`flex items-center gap-2.5 rounded-xl border px-3.5 py-2.5 transition-colors focus-within:border-emerald-500/50 ${isDark ? 'border-zinc-800 bg-zinc-900/50' : 'border-gray-200 bg-gray-50/80'}`}>
                  <Icons.Edit3 size={14} className={isDark ? 'text-zinc-600' : 'text-gray-400'} />
                  <input value={newAssetName} onChange={(e) => setNewAssetName(e.target.value)}
                    placeholder={`输入新${typeLabel[newAssetType]}名称...`}
                    className={`min-w-0 flex-1 bg-transparent text-sm outline-none ${isDark ? 'text-zinc-100 placeholder:text-zinc-600' : 'text-gray-900 placeholder:text-gray-400'}`} />
                </div>

                {/* Confirm button */}
                <button
                  disabled={!newAssetName.trim()}
                  className={`w-full h-11 rounded-xl text-sm font-semibold transition-all duration-200 disabled:opacity-30 disabled:cursor-not-allowed ${isDark ? 'bg-gradient-to-r from-emerald-600/80 to-emerald-500/80 text-white hover:from-emerald-600 hover:to-emerald-500 shadow-lg shadow-emerald-500/10' : 'bg-gradient-to-r from-emerald-500 to-emerald-600 text-white hover:from-emerald-600 hover:to-emerald-700 shadow-lg shadow-emerald-500/20'}`}
                  onClick={() => { if (newAssetName.trim()) { onCreateNewAsset(nodeId, newAssetType, newAssetName.trim()); onClose(); } }}
                >
                  创建并添加到项目库
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    );
  }

  if (nodeType === 'video') {
    const filteredClips = useMemo(() => {
      return shotClips.filter(s => {
        if (shotEpisode !== 'all' && s.episodeNo !== shotEpisode) return false;
        if (shotSearch.trim()) {
          const kw = shotSearch.trim().toLowerCase();
          if (!`${s.shotName} ${s.description || ''} ${s.shotNo}`.toLowerCase().includes(kw)) return false;
        }
        return true;
      });
    }, [shotClips, shotEpisode, shotSearch]);

    const uniqueEpisodes = useMemo(() => {
      const set = new Set(shotClips.map(s => s.episodeNo));
      return Array.from(set).sort((a: number, b: number) => a - b);
    }, [shotClips]);

    return (
      <div className="fixed inset-0 z-[250] flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={onClose}>
        <div
          className={`w-[440px] max-h-[78vh] rounded-2xl border flex flex-col overflow-hidden ${isDark ? 'bg-[#1a1a1f] border-zinc-700/60 text-zinc-100 shadow-[0_25px_60px_-12px_rgba(0,0,0,0.7)]' : 'bg-white border-gray-200/80 text-gray-900 shadow-[0_25px_60px_-12px_rgba(0,0,0,0.25)]'}`}
          onClick={(e) => e.stopPropagation()}
          style={{ animation: 'modalIn 0.2s ease-out' }}
        >
          {/* Header */}
          <div className={`px-5 py-4 flex items-center justify-between border-b shrink-0 ${isDark ? 'border-zinc-800/80 bg-gradient-to-r from-[#1a1a1f] to-[#1e1e24]' : 'border-gray-100 bg-gradient-to-r from-white to-gray-50/80'}`}>
            <div className="flex items-center gap-3 min-w-0">
              <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${isDark ? 'bg-[#4446CE]/15 text-[#8F91F4]' : 'bg-[#F0F1FF] text-[#4446CE]'}`}>
                <Icons.Clapperboard size={16} />
              </div>
              <div>
                <h3 className="text-sm font-bold leading-tight">添加到分镜片段</h3>
                {nodeTitle && <p className={`text-[11px] mt-0.5 truncate max-w-[260px] ${isDark ? 'text-zinc-500' : 'text-gray-400'}`}>{nodeTitle}</p>}
              </div>
            </div>
            <button className={`w-8 h-8 rounded-lg flex items-center justify-center transition-colors ${isDark ? 'hover:bg-zinc-800 text-zinc-500 hover:text-zinc-200' : 'hover:bg-gray-100 text-gray-400 hover:text-gray-700'}`} onClick={onClose}><Icons.X size={16} /></button>
          </div>

          <div className="flex-1 overflow-y-auto custom-scrollbar px-5 py-4 space-y-3">
            {/* Filters */}
            <div className="flex gap-2">
              <select className={`h-9 flex-1 rounded-xl text-xs px-3 outline-none border transition-colors ${isDark ? 'bg-zinc-900/60 border-zinc-800 text-zinc-200 focus:border-zinc-600' : 'bg-gray-50 border-gray-200 text-gray-700 focus:border-gray-300'}`}
                value={String(shotEpisode)} onChange={(e) => setShotEpisode(e.target.value === 'all' ? 'all' : Number(e.target.value))}>
                <option value="all">全部集数</option>
                {uniqueEpisodes.map(ep => <option key={ep} value={String(ep)}>第{ep} 集</option>)}
              </select>
              <div className={`flex items-center gap-2 rounded-xl border px-3 flex-1 transition-colors focus-within:border-[#4446CE]/50 ${isDark ? 'border-zinc-800 bg-zinc-900/50' : 'border-gray-200 bg-gray-50/80'}`}>
                <Icons.Search size={13} className={isDark ? 'text-zinc-600' : 'text-gray-400'} />
                <input value={shotSearch} onChange={(e) => setShotSearch(e.target.value)}
                  className={`min-w-0 flex-1 bg-transparent text-xs outline-none py-2 ${isDark ? 'text-zinc-100 placeholder:text-zinc-600' : 'text-gray-900 placeholder:text-gray-400'}`} placeholder="搜索镜次..." />
              </div>
            </div>

            {/* Shot clips */}
            <div className="space-y-1.5 max-h-[320px] overflow-y-auto custom-scrollbar pr-0.5">
              {filteredClips.length === 0 ? (
                <div className={`py-10 flex flex-col items-center ${isDark ? 'text-zinc-600' : 'text-gray-400'}`}>
                  <Icons.Clapperboard size={24} className="opacity-30" />
                  <p className="mt-2.5 text-xs">没有匹配分镜</p>
                </div>
              ) : (
                filteredClips.map(clip => (
                  <button key={clip.id}
                    className={`w-full rounded-xl border p-3.5 text-left transition-all duration-200 ${selectedShotIds.has(clip.id) ? (isDark ? 'border-[#4446CE]/60 bg-[#4446CE]/10 ring-1 ring-[#4446CE]/20' : 'border-[#8F91F4] bg-[#F0F1FF] ring-1 ring-[#C7C8FF]') : (isDark ? 'border-zinc-800/70 bg-zinc-900/30 hover:bg-zinc-800/60 hover:border-zinc-700' : 'border-gray-100 bg-white hover:bg-gray-50 hover:border-gray-200 hover:shadow-sm')}`}
                    onClick={() => setSelectedShotIds(prev => toggleSelected(prev, clip.id))}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <span className={`inline-flex rounded-md px-2 py-0.5 text-[10px] font-bold tracking-wide ${isDark ? 'bg-[#4446CE]/15 text-[#B9BAFF]' : 'bg-[#E1E3FF] text-[#3739B0]'}`}>
                        第{clip.episodeNo}集 · 第{clip.sceneNo}场 · 第{String(clip.shotNo).padStart(2, "0")}镜
                      </span>
                      {selectedShotIds.has(clip.id) && <Icons.Check size={14} className="shrink-0 text-[#8F91F4]" />}
                    </div>
                    <p className={`mt-1.5 text-sm font-semibold truncate ${isDark ? 'text-zinc-100' : 'text-gray-900'}`}>{clip.shotName}</p>
                    {clip.description && <p className={`mt-1 text-[11px] truncate ${isDark ? 'text-zinc-500' : 'text-gray-400'}`}>{clip.description}</p>}
                  </button>
                ))
              )}
            </div>

            {/* Confirm */}
            {showShotConfirm ? (
              <div className={`rounded-xl border p-4 ${isDark ? 'border-[#4446CE]/30 bg-[#4446CE]/10' : 'border-[#C7C8FF] bg-[#F0F1FF]'}`}>
                <p className={`text-sm font-semibold ${isDark ? 'text-[#E1E3FF]' : 'text-[#2F318F]'}`}>
                  确认将当前视频添加到选中的分镜片段吗？
                </p>
                <p className={`mt-1 text-xs ${isDark ? 'text-[#B9BAFF]/70' : 'text-[#4446CE]/70'}`}>
                  已选择 {selectedShotIds.size} 个分镜片段
                </p>
                <div className="mt-3 flex gap-2">
                  <button
                    className={`h-9 flex-1 rounded-lg text-xs font-semibold transition-colors ${isDark ? 'bg-zinc-800 text-zinc-300 hover:bg-zinc-700' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
                    onClick={() => setShowShotConfirm(false)}
                  >
                    取消
                  </button>
                  <button
                    className={`h-9 flex-1 rounded-lg text-xs font-semibold transition-all ${isDark ? 'bg-[#4446CE] text-white hover:bg-[#4446CE]' : 'bg-[#4446CE] text-white hover:bg-[#4446CE]'}`}
                    onClick={() => {
                      Array.from(selectedShotIds).forEach(shotId => onAddToShotClip(nodeId, shotId, false));
                      onClose();
                    }}
                  >
                    确认添加
                  </button>
                </div>
              </div>
            ) : (
              <button
                disabled={selectedShotIds.size === 0}
                className={`w-full h-11 rounded-xl text-sm font-semibold transition-all duration-200 disabled:opacity-30 disabled:cursor-not-allowed ${isDark ? 'bg-gradient-to-r from-[#4446CE]/80 to-[#4446CE]/80 text-white hover:from-[#4446CE] hover:to-[#4446CE] shadow-lg shadow-[#4446CE]/10' : 'bg-gradient-to-r from-[#4446CE] to-[#4446CE] text-white hover:from-[#4446CE] hover:to-[#3739B0] shadow-lg shadow-[#4446CE]/20'}`}
                onClick={() => setShowShotConfirm(true)}
              >
                {selectedShotIds.size > 1 ? `添加到 ${selectedShotIds.size} 个分镜片段` : '添加到分镜片段'}
              </button>
            )}
          </div>
        </div>
      </div>
    );
  }

  return null;
};
