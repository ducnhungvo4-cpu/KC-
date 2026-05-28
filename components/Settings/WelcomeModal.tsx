import React from 'react';
import { Icons } from '../Icons';

interface WelcomeModalProps {
    isOpen: boolean;
    onClose: () => void;
    isDark: boolean;
}

const WELCOME_SHOWN_KEY = 'KC_CANVAS_WELCOME_SHOWN_V1';

export const hasShownWelcome = (): boolean => {
    return localStorage.getItem(WELCOME_SHOWN_KEY) === 'true';
};

export const markWelcomeShown = (): void => {
    localStorage.setItem(WELCOME_SHOWN_KEY, 'true');
};

export const WelcomeModal: React.FC<WelcomeModalProps> = ({ isOpen, onClose, isDark }) => {
    if (!isOpen) return null;

    const handleClose = () => {
        markWelcomeShown();
        onClose();
    };

    const bgCard = isDark ? 'bg-[#18181B]' : 'bg-white';
    const borderColor = isDark ? 'border-[#27272a]' : 'border-gray-200';
    const textMain = isDark ? 'text-white' : 'text-gray-900';
    const textSub = isDark ? 'text-gray-400' : 'text-gray-500';

    return (
        <div 
            className="fixed inset-0 z-[300] flex items-center justify-center p-4 bg-black/70 backdrop-blur-md animate-in fade-in duration-300"
            onClick={handleClose}
        >
            <div 
                className={`w-full max-w-lg rounded-2xl overflow-hidden shadow-2xl border ${bgCard} ${borderColor} animate-in zoom-in-95 duration-300`}
                onClick={e => e.stopPropagation()}
            >
                {/* Header */}
                <div className={`px-6 py-5 border-b ${borderColor} text-center`}>
                    <div className={`w-16 h-16 mx-auto mb-3 rounded-2xl flex items-center justify-center ${isDark ? 'bg-gradient-to-br from-emerald-500/20 to-cyan-500/20' : 'bg-gradient-to-br from-emerald-100 to-cyan-100'}`}>
                        <Icons.Sparkles size={32} className={isDark ? 'text-emerald-400' : 'text-emerald-600'} />
                    </div>
                    <h2 className={`text-xl font-bold ${textMain}`}>欢迎使用 KC画布 MVP</h2>
                    <p className={`text-sm mt-1 ${textSub}`}>内部影视 AI 创作原型</p>
                </div>

                {/* Content */}
                <div className="p-6 space-y-4">
                    
                    <div className={`p-4 rounded-xl border ${isDark ? 'bg-blue-500/10 border-blue-500/30' : 'bg-blue-50 border-blue-200'}`}>
                        <div className="flex items-start gap-3">
                            <Icons.Info size={20} className={isDark ? 'text-blue-400 shrink-0 mt-0.5' : 'text-blue-600 shrink-0 mt-0.5'} />
                            <div>
                                <h4 className={`text-sm font-bold ${isDark ? 'text-blue-400' : 'text-blue-700'}`}>
                                    本轮试用范围
                                </h4>
                                <p className={`text-xs mt-1 leading-relaxed ${isDark ? 'text-blue-300/80' : 'text-blue-600'}`}>
                                    先验证画布、节点拖拽连线、参数面板和生图闭环。登录、积分、后端存储和视频合成已按 MVP 原型阶段延后。
                                </p>
                            </div>
                        </div>
                    </div>

                    <div className={`p-4 rounded-xl border ${isDark ? 'bg-emerald-500/10 border-emerald-500/30' : 'bg-emerald-50 border-emerald-200'}`}>
                        <div className="flex items-start gap-3">
                            <Icons.Check size={20} className={isDark ? 'text-emerald-400 shrink-0 mt-0.5' : 'text-emerald-600 shrink-0 mt-0.5'} />
                            <div>
                                <h4 className={`text-sm font-bold ${isDark ? 'text-emerald-400' : 'text-emerald-700'}`}>
                                    默认模型
                                </h4>
                                <p className={`text-xs mt-1 leading-relaxed ${isDark ? 'text-emerald-300/80' : 'text-emerald-600'}`}>
                                    图片节点默认 Seedream 5.0，视频节点默认 Seedance 1.5 Pro。当前没有 API Key 时会生成本地模拟图，方便业务先试用交互效果。
                                </p>
                                <div className={`mt-2 flex flex-wrap gap-2`}>
                                    <span className={`inline-flex items-center px-2 py-1 rounded-md text-[10px] font-medium ${isDark ? 'bg-white/10 text-white' : 'bg-gray-100 text-gray-700'}`}>
                                        Seedream 5.0 生图
                                    </span>
                                    <span className={`inline-flex items-center px-2 py-1 rounded-md text-[10px] font-medium ${isDark ? 'bg-white/10 text-white' : 'bg-gray-100 text-gray-700'}`}>
                                        Seedance 1.5 Pro 视频
                                    </span>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* 接口兼容性提示 */}
                    <div className={`p-3 rounded-lg ${isDark ? 'bg-white/5' : 'bg-gray-50'}`}>
                        <div className="flex items-start gap-2">
                            <Icons.Info size={14} className={`${textSub} shrink-0 mt-0.5`} />
                            <p className={`text-[11px] leading-relaxed ${textSub}`}>
                                <strong>试用提示：</strong>
                                左侧添加生图节点，选中节点后在下方参数面板输入提示词并点击生成；拖动节点右侧端口可连到其他节点。
                            </p>
                        </div>
                    </div>
                </div>

                {/* Footer */}
                <div className={`px-6 py-4 border-t ${borderColor} flex justify-center`}>
                    <button
                        onClick={handleClose}
                        className="px-8 py-2.5 rounded-xl text-sm font-semibold bg-gradient-to-r from-emerald-600 to-cyan-600 hover:from-emerald-500 hover:to-cyan-500 text-white shadow-lg shadow-emerald-500/25 transition-all active:scale-[0.98]"
                    >
                        开始试用
                    </button>
                </div>
            </div>
        </div>
    );
};
