import React, { useState, useMemo } from 'react';
import { Icons } from './Icons';
import { AssetLibraryItem, AssetLibraryType, AssetLibraryScope, AddToAssetType } from '../types';

interface AssetSelectionModalProps {
  isOpen: boolean;
  nodeId: string;
  nodeType: 'image' | 'video';
  nodeTitle?: string;
  assetLibrary: AssetLibraryItem[];
  shotClips?: { id: string; episodeNo: number; shotNo: number; shotName: string; sceneNo: number; description?: string }[];
  isDark: boolean;
  onClose: () => void;
  onAddToExistingAsset: (nodeId: string, assetId: string, targetType: AddToAssetType) => void;
  onCreateNewAsset: (nodeId: string, assetType: AssetLibraryType, name: string) => void;
  onAddToShotClip: (nodeId: string, shotClipId: string) => void;
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
  const [assetScope, setAssetScope] = useState<AssetLibraryScope | 'all'>('all');
  const [newAssetType, setNewAssetType] = useState<AssetLibraryType>('role');
  const [newAssetName, setNewAssetName] = useState('');
  const [shotEpisode, setShotEpisode] = useState<number | 'all'>('all');
  const [shotSearch, setShotSearch] = useState('');
  const [selectedShotId, setSelectedShotId] = useState<string>('');

  if (!isOpen) return null;

  if (nodeType === 'image') {
    const filteredAssets = useMemo(() => {
      const kw = assetSearch.trim().toLowerCase();
      return assetLibrary.filter(a => {
        const scope = a.scope || 'project';
        const matchScope = assetScope === 'all' || scope === assetScope;
        const matchType = a.type === assetType;
        const matchKw = !kw || `${a.name} ${a.description || ''}`.toLowerCase().includes(kw);
        return matchScope && matchType && matchKw;
      });
    }, [assetLibrary, assetType, assetSearch, assetScope]);

    const parents = filteredAssets.filter(a => !a.parentId);
    const getChildren = (pid: string) => filteredAssets.filter(a => a.parentId === pid);
    const typeLabel: Record<AssetLibraryType, string> = { role: '角色', scene: '场景', prop: '道具' };

    return (
      <div className="fixed inset-0 z-[250] flex items-center justify-center bg-black/70 backdrop-blur-md animate-in fade-in duration-200" onClick={onClose}>
        <div 
          className={`w-[420px] max-h-[75vh] rounded-2xl border shadow-2xl flex flex-col overflow-hidden ${isDark ? 'bg-[#18181b] border-zinc-700 text-zinc-100' : 'bg-white border-gray-200 text-gray-900'}`}
          onClick={(e) => e.stopPropagation()}
        >
          <div className={`h-14 px-5 flex items-center justify-between border-b shrink-0 ${isDark ? 'border-zinc-800' : 'border-gray-100'}`}>
            <div className="flex items-center gap-2 min-w-0">
              <Icons.Database size={18} />
              <span className="font-semibold truncate">添加到资产素材库</span>
            </div>
            <button className={`w-9 h-9 rounded-full flex items-center justify-center ${isDark ? 'hover:bg-zinc-800 text-zinc-400 hover:text-white' : 'hover:bg-gray-100 text-gray-500 hover:text-gray-900'}`} onClick={onClose}><Icons.X size={20} /></button>
          </div>

          <div className={`px-4 pt-3 flex gap-1 shrink-0`}>
            <button className={`h-8 flex-1 rounded-lg text-xs font-semibold transition-all ${mode === 'existing' ? (isDark ? 'bg-blue-500/20 text-blue-300' : 'bg-blue-50 text-blue-600') : (isDark ? 'text-zinc-500 hover:bg-zinc-800' : 'text-gray-500 hover:bg-gray-100')}`} onClick={() => setMode('existing')}>归入已有资产</button>
            <button className={`h-8 flex-1 rounded-lg text-xs font-semibold transition-all ${mode === 'new' ? (isDark ? 'bg-green-500/20 text-green-300' : 'bg-green-50 text-green-600') : (isDark ? 'text-zinc-500 hover:bg-zinc-800' : 'text-gray-500 hover:bg-gray-100')}`} onClick={() => setMode('new')}>新建资产</button>
          </div>

          <div className="flex-1 overflow-y-auto custom-scrollbar p-4 space-y-3">
            {mode === 'existing' ? (
              <>
                <div className="flex gap-1 shrink-0">
                  {([{ key: 'role' as AssetLibraryType, label: '角色' }, { key: 'scene' as AssetLibraryType, label: '场景' }, { key: 'prop' as AssetLibraryType, label: '道具' }]).map(tab => (
                    <button key={tab.key} className={`h-8 flex-1 rounded-lg text-xs font-semibold transition-all ${assetType === tab.key ? (isDark ? 'bg-blue-500/20 text-blue-300' : 'bg-blue-50 text-blue-600') : (isDark ? 'text-zinc-500 hover:bg-zinc-800' : 'text-gray-500 hover:bg-gray-100')}`} onClick={() => { setAssetType(tab.key); setAssetSearch(''); }}>{tab.label}</button>
                  ))}
                </div>

                <div className={`flex items-center gap-2 rounded-xl border px-3 py-2 ${isDark ? 'border-zinc-800 bg-zinc-950/40' : 'border-gray-200 bg-gray-50'}`}>
                  <Icons.Search size={15} className={isDark ? 'text-gray-600' : 'text-gray-400'} />
                  <input value={assetSearch} onChange={(e) => setAssetSearch(e.target.value)}
                    placeholder={`搜索${typeLabel[assetType]}...`}
                    className={`min-w-0 flex-1 bg-transparent text-xs outline-none ${isDark ? 'text-zinc-100 placeholder:text-zinc-600' : 'text-gray-900 placeholder:text-gray-400'}`} />
                </div>

                <div className={`grid grid-cols-3 gap-1 rounded-xl p-1 ${isDark ? 'bg-zinc-950/45' : 'bg-gray-100'}`}>
                  {[{ key: 'project' as const, label: '项目库' }, { key: 'public' as const, label: '公共库' }, { key: 'all' as const, label: '全部' }].map(tab => (
                    <button key={tab.key} className={`h-8 rounded-lg text-xs font-semibold transition-all ${assetScope === tab.key ? (isDark ? 'bg-blue-500/20 text-blue-300' : 'bg-white text-blue-600 shadow-sm') : (isDark ? 'text-zinc-500 hover:bg-zinc-800' : 'text-gray-500 hover:bg-white/70')}`} onClick={() => setAssetScope(tab.key)}>{tab.label}</button>
                  ))}
                </div>

                <div className="space-y-1 max-h-[240px] overflow-y-auto custom-scrollbar pr-1">
                  {parents.length === 0 ? (
                    <div className={`py-6 text-center text-xs ${isDark ? 'text-gray-600' : 'text-gray-400'}`}>没有匹配资产</div>
                  ) : (
                    parents.map(asset => {
                      const children = getChildren(asset.id);
                      return (
                        <div key={asset.id}>
                          <button 
                            className={`w-full rounded-lg border p-2.5 text-left transition-all flex items-center gap-3 ${isDark ? 'border-zinc-800 hover:bg-zinc-800/50' : 'border-gray-100 hover:bg-gray-50'}`}
                            onClick={() => onAddToExistingAsset(nodeId, asset.id, assetType)}
                          >
                            <img src={asset.previewUrl} className="h-9 w-9 rounded-lg object-cover shrink-0" loading="lazy" />
                            <div className="min-w-0 flex-1">
                              <p className={`text-sm font-semibold truncate ${isDark ? 'text-white' : 'text-gray-900'}`}>{asset.name}</p>
                              {asset.description && <p className={`text-[11px] truncate ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>{asset.description}</p>}
                            </div>
                            <span className={`text-[10px] shrink-0 ${isDark ? 'text-gray-600' : 'text-gray-400'}`}>{asset.version}</span>
                          </button>
                          {children.map(child => (
                            <button key={child.id}
                              className={`w-full rounded-lg border p-2 text-left transition-all flex items-center gap-2 ml-4 mt-1 ${isDark ? 'border-zinc-800/60 hover:bg-zinc-800/40' : 'border-gray-100 hover:bg-gray-50'}`}
                              onClick={() => onAddToExistingAsset(nodeId, child.id, assetType)}
                            >
                              <img src={child.previewUrl} className="h-7 w-7 rounded-lg object-cover shrink-0" loading="lazy" />
                              <span className={`text-xs font-medium truncate ${isDark ? 'text-white' : 'text-gray-900'}`}>{child.name}</span>
                              <span className={`text-[10px] shrink-0 ${isDark ? 'text-gray-600' : 'text-gray-400'}`}>{child.version}</span>
                            </button>
                          ))}
                        </div>
                      );
                    })
                  )}
                </div>
              </>
            ) : (
              <>
                <div className="flex gap-1 shrink-0">
                  {([{ key: 'role' as AssetLibraryType, label: '角色' }, { key: 'scene' as AssetLibraryType, label: '场景' }, { key: 'prop' as AssetLibraryType, label: '道具' }]).map(tab => (
                    <button key={tab.key} className={`h-8 flex-1 rounded-lg text-xs font-semibold transition-all ${newAssetType === tab.key ? (isDark ? 'bg-green-500/20 text-green-300' : 'bg-green-50 text-green-600') : (isDark ? 'text-zinc-500 hover:bg-zinc-800' : 'text-gray-500 hover:bg-gray-100')}`} onClick={() => setNewAssetType(tab.key)}>{tab.label}</button>
                  ))}
                </div>
                <div className={`flex items-center gap-2 rounded-xl border px-3 py-2 ${isDark ? 'border-zinc-800 bg-zinc-950/40' : 'border-gray-200 bg-gray-50'}`}>
                  <Icons.Edit3 size={15} className={isDark ? 'text-gray-600' : 'text-gray-400'} />
                  <input value={newAssetName} onChange={(e) => setNewAssetName(e.target.value)}
                    placeholder={`输入新${newAssetType === 'role' ? '角色' : newAssetType === 'scene' ? '场景' : '道具'}名称...`}
                    className={`min-w-0 flex-1 bg-transparent text-sm outline-none ${isDark ? 'text-zinc-100 placeholder:text-zinc-600' : 'text-gray-900 placeholder:text-gray-400'}`} />
                </div>
                <button 
                  disabled={!newAssetName.trim()}
                  className={`w-full h-10 rounded-xl text-sm font-semibold transition-all disabled:opacity-40 disabled:cursor-not-allowed ${isDark ? 'bg-green-500/20 text-green-300 hover:bg-green-500/30' : 'bg-green-100 text-green-700 hover:bg-green-200'}`}
                  onClick={() => { if (newAssetName.trim()) { onCreateNewAsset(nodeId, newAssetType, newAssetName.trim()); onClose(); } }}
                >
                  创建并添加
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
      <div className="fixed inset-0 z-[250] flex items-center justify-center bg-black/70 backdrop-blur-md animate-in fade-in duration-200" onClick={onClose}>
        <div 
          className={`w-[420px] max-h-[75vh] rounded-2xl border shadow-2xl flex flex-col overflow-hidden ${isDark ? 'bg-[#18181b] border-zinc-700 text-zinc-100' : 'bg-white border-gray-200 text-gray-900'}`}
          onClick={(e) => e.stopPropagation()}
        >
          <div className={`h-14 px-5 flex items-center justify-between border-b shrink-0 ${isDark ? 'border-zinc-800' : 'border-gray-100'}`}>
            <div className="flex items-center gap-2 min-w-0">
              <Icons.Clapperboard size={18} />
              <span className="font-semibold truncate">添加到分镜片段</span>
            </div>
            <button className={`w-9 h-9 rounded-full flex items-center justify-center ${isDark ? 'hover:bg-zinc-800 text-zinc-400 hover:text-white' : 'hover:bg-gray-100 text-gray-500 hover:text-gray-900'}`} onClick={onClose}><Icons.X size={20} /></button>
          </div>

          <div className="flex-1 overflow-y-auto custom-scrollbar p-4 space-y-3">
            <div className="flex gap-2">
              <select className={`h-8 flex-1 rounded-lg text-xs px-2 outline-none ${isDark ? 'bg-zinc-800 border-zinc-700 text-zinc-200' : 'bg-gray-100 border-gray-200 text-gray-700'}`}
                value={String(shotEpisode)} onChange={(e) => setShotEpisode(e.target.value === 'all' ? 'all' : Number(e.target.value))}>
                <option value="all">全部集数</option>
                {uniqueEpisodes.map(ep => <option key={ep} value={String(ep)}>第{ep} 集</option>)}
              </select>
              <div className={`flex items-center gap-2 rounded-xl border px-3 flex-1 ${isDark ? 'border-zinc-800 bg-zinc-950/40' : 'border-gray-200 bg-gray-50'}`}>
                <Icons.Search size={14} className={isDark ? 'text-gray-600' : 'text-gray-400'} />
                <input value={shotSearch} onChange={(e) => setShotSearch(e.target.value)}
                  className={`min-w-0 flex-1 bg-transparent text-xs outline-none ${isDark ? 'text-zinc-100 placeholder:text-zinc-600' : 'text-gray-900 placeholder:text-gray-400'}`} placeholder="搜索镜次" />
              </div>
            </div>

            <div className="space-y-1 max-h-[320px] overflow-y-auto custom-scrollbar pr-1">
              {filteredClips.length === 0 ? (
                <div className={`py-6 text-center text-xs ${isDark ? 'text-gray-600' : 'text-gray-400'}`}>没有匹配分镜</div>
              ) : (
                filteredClips.map(clip => (
                  <button key={clip.id}
                    className={`w-full rounded-lg border p-3 text-left transition-all ${selectedShotId === clip.id ? (isDark ? 'border-blue-500 bg-blue-500/10' : 'border-blue-500 bg-blue-50') : (isDark ? 'border-zinc-800 hover:bg-zinc-800/50' : 'border-gray-100 hover:bg-gray-50')}`}
                    onClick={() => setSelectedShotId(clip.id)}
                  >
                    <div className="flex items-center justify-between">
                      <div className="min-w-0 flex-1">
                        <span className={`rounded-md px-1.5 py-0.5 text-[10px] font-bold ${isDark ? 'bg-purple-500/20 text-purple-300' : 'bg-purple-100 text-purple-700'}`}>
                          第{clip.episodeNo}集·第{clip.sceneNo}场·第{String(clip.shotNo).padStart(2, "0")}镜
                        </span>
                        <p className={`mt-1 text-sm font-semibold truncate ${isDark ? 'text-white' : 'text-gray-900'}`}>{clip.shotName}</p>
                        {clip.description && <p className={`mt-0.5 text-[11px] truncate ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>{clip.description}</p>}
                      </div>
                    </div>
                  </button>
                ))
              )}
            </div>

            <button 
              disabled={!selectedShotId}
              className={`w-full h-10 rounded-xl text-sm font-semibold transition-all disabled:opacity-40 disabled:cursor-not-allowed ${isDark ? 'bg-blue-500/20 text-blue-300 hover:bg-blue-500/30' : 'bg-blue-100 text-blue-700 hover:bg-blue-200'}`}
              onClick={() => { if (selectedShotId) { onAddToShotClip(nodeId, selectedShotId); onClose(); } }}
            >
              添加到分镜片段
            </button>
          </div>
        </div>
      </div>
    );
  }

  return null;
};
