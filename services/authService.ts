const TOKEN_KEY = 'KC_CANVAS_AUTH_TOKEN';

export const authService = {
  getToken() {
    return localStorage.getItem(TOKEN_KEY) || '';
  },

  setToken(token: string) {
    localStorage.setItem(TOKEN_KEY, token);
  },

  clearToken() {
    localStorage.removeItem(TOKEN_KEY);
  },

  async login(password: string) {
    const response = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password }),
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(data.error || '登录失败');
    }
    this.setToken(data.token);
    return data.token as string;
  },

  async verify() {
    const token = this.getToken();
    if (!token) return false;

    const response = await fetch('/api/auth/me', {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!response.ok) {
      this.clearToken();
      return false;
    }
    return true;
  },
};

export const apiFetch = async (url: string, options: RequestInit = {}) => {
  const token = authService.getToken();
  const headers = new Headers(options.headers || {});
  if (!headers.has('Content-Type') && options.body) {
    headers.set('Content-Type', 'application/json');
  }
  if (token) {
    headers.set('Authorization', `Bearer ${token}`);
  }

  const response = await fetch(url, { ...options, headers });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    if (response.status === 401) {
      authService.clearToken();
      window.dispatchEvent(new Event('kc-auth-expired'));
    }
    throw new Error(data.error || `请求失败: ${response.status}`);
  }
  return data;
};
