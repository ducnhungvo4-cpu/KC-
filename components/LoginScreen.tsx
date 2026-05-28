import React, { useState } from 'react';
import { Icons } from './Icons';
import { authService } from '../services/authService';

interface LoginScreenProps {
  onLogin: () => void;
}

export const LoginScreen: React.FC<LoginScreenProps> = ({ onLogin }) => {
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError('');
    setIsLoading(true);
    try {
      await authService.login(password);
      onLogin();
    } catch (err) {
      setError((err as Error).message || '登录失败');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#0b0c0e] text-white px-4">
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-sm rounded-2xl border border-zinc-800 bg-[#18181b] p-6 shadow-2xl"
      >
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 rounded-xl bg-blue-500/15 text-blue-400 flex items-center justify-center">
            <Icons.Sparkles size={20} />
          </div>
          <div>
            <h1 className="text-lg font-bold">KC画布</h1>
            <p className="text-xs text-zinc-400">请输入访问密码</p>
          </div>
        </div>

        <input
          type="password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          className="w-full h-11 rounded-xl border border-zinc-700 bg-zinc-900 px-4 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
          placeholder="访问密码"
          autoFocus
        />

        {error && <div className="mt-3 text-xs text-red-400">{error}</div>}

        <button
          type="submit"
          disabled={isLoading || !password}
          className="mt-5 w-full h-11 rounded-xl bg-blue-600 hover:bg-blue-500 disabled:bg-zinc-700 disabled:text-zinc-400 font-semibold text-sm flex items-center justify-center gap-2"
        >
          {isLoading && <Icons.Loader2 size={16} className="animate-spin" />}
          进入画布
        </button>
      </form>
    </div>
  );
};
