const TOKEN_TTL_SECONDS = 60 * 60 * 24 * 7;

const json = (data, status = 200) => new Response(JSON.stringify(data), {
  status,
  headers: {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
  },
});

const base64UrlEncodeBytes = (bytes) => {
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
};

const base64UrlEncodeText = (text) => {
  return base64UrlEncodeBytes(new TextEncoder().encode(text));
};

const base64UrlDecodeText = (value) => {
  const padded = value.replace(/-/g, '+').replace(/_/g, '/').padEnd(Math.ceil(value.length / 4) * 4, '=');
  const binary = atob(padded);
  const bytes = Uint8Array.from(binary, char => char.charCodeAt(0));
  return new TextDecoder().decode(bytes);
};

const hmacKey = (secret) => crypto.subtle.importKey(
  'raw',
  new TextEncoder().encode(secret),
  { name: 'HMAC', hash: 'SHA-256' },
  false,
  ['sign'],
);

const sign = async (payload, secret) => {
  const key = await hmacKey(secret);
  const signature = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(payload));
  return base64UrlEncodeBytes(new Uint8Array(signature));
};

const secureEqual = (left, right) => {
  if (left.length !== right.length) return false;
  let result = 0;
  for (let index = 0; index < left.length; index += 1) {
    result |= left.charCodeAt(index) ^ right.charCodeAt(index);
  }
  return result === 0;
};

const createToken = async (env) => {
  const secret = env.AUTH_SECRET || 'kc-canvas-dev-secret-change-me';
  const payload = base64UrlEncodeText(JSON.stringify({
    sub: 'kc-user',
    exp: Math.floor(Date.now() / 1000) + Number(env.AUTH_TOKEN_TTL_SECONDS || TOKEN_TTL_SECONDS),
  }));
  return `${payload}.${await sign(payload, secret)}`;
};

const verifyToken = async (token, env) => {
  try {
    if (!token || !token.includes('.')) return false;
    const [payload, signature] = token.split('.');
    const expected = await sign(payload, env.AUTH_SECRET || 'kc-canvas-dev-secret-change-me');
    if (!secureEqual(signature, expected)) return false;
    const data = JSON.parse(base64UrlDecodeText(payload));
    return data.exp > Math.floor(Date.now() / 1000);
  } catch {
    return false;
  }
};

const requireAuth = async (request, env) => {
  const auth = request.headers.get('Authorization') || '';
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : '';
  return verifyToken(token, env);
};

const joinUrl = (baseUrl, endpoint) => {
  const base = (baseUrl || '').replace(/\/$/, '');
  const pathPart = (endpoint || '').startsWith('/') ? endpoint : `/${endpoint || ''}`;
  return `${base}${pathPart}`;
};

const seedreamSize = (resolution = '2k') => {
  const normalized = String(resolution || '').toLowerCase();
  if (normalized.includes('4')) return '4K';
  if (normalized.includes('1')) return '1K';
  return '2K';
};

const extractUrls = (data) => {
  const urls = [];
  const visit = (value) => {
    if (!value) return;
    if (typeof value === 'string') {
      if (/^(https?:|data:image|data:video|blob:)/.test(value)) urls.push(value);
      return;
    }
    if (Array.isArray(value)) {
      value.forEach(visit);
      return;
    }
    if (typeof value === 'object') {
      if (value.b64_json) urls.push(`data:image/png;base64,${value.b64_json}`);
      if (value.url) visit(value.url);
      if (value.image_url) visit(value.image_url);
      if (value.video_url) visit(value.video_url);
      if (value.output_url) visit(value.output_url);
      if (value.data) visit(value.data);
      if (value.result) visit(value.result);
      if (value.output) visit(value.output);
      if (value.content) visit(value.content);
    }
  };
  visit(data);
  return [...new Set(urls)];
};

const callModelApi = async ({ baseUrl, endpoint, apiKey, payload, timeoutMs = 300000 }) => {
  if (!baseUrl || !apiKey) throw new Error('MODEL_API_NOT_CONFIGURED');
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(joinUrl(baseUrl, endpoint), {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });
    const text = await response.text();
    const data = text ? JSON.parse(text) : {};
    if (!response.ok) {
      throw new Error(data?.error?.message || data?.message || `MODEL_API_${response.status}`);
    }
    return data;
  } finally {
    clearTimeout(timer);
  }
};

const handleLogin = async (request, env) => {
  if (request.method !== 'POST') return json({ error: 'METHOD_NOT_ALLOWED' }, 405);
  const body = await request.json().catch(() => ({}));
  if (body.password !== (env.LOGIN_PASSWORD || 'kc8888')) {
    return json({ error: 'INVALID_PASSWORD' }, 401);
  }
  return json({ token: await createToken(env) });
};

const handleMe = async (request, env) => {
  if (!(await requireAuth(request, env))) return json({ error: 'UNAUTHORIZED' }, 401);
  return json({ ok: true });
};

const handleImageGeneration = async (request, env) => {
  if (request.method !== 'POST') return json({ error: 'METHOD_NOT_ALLOWED' }, 405);
  if (!(await requireAuth(request, env))) return json({ error: 'UNAUTHORIZED' }, 401);

  const body = await request.json().catch(() => ({}));
  const count = Math.max(1, Math.min(Number(body.count || 1), 4));
  const payload = {
    model: env.SEEDREAM_MODEL_ID || 'doubao-seedream-5-0-260128',
    prompt: body.prompt || '',
    sequential_image_generation: 'disabled',
    response_format: 'url',
    size: env.SEEDREAM_SIZE || seedreamSize(body.resolution),
    stream: false,
    watermark: env.SEEDREAM_WATERMARK !== 'false',
  };
  if (body.inputImages?.length) {
    payload.image = body.inputImages[0];
    payload.image_url = body.inputImages[0];
    payload.reference_image = body.inputImages[0];
  }

  const results = [];
  for (let index = 0; index < count; index += 1) {
    const result = await callModelApi({
      baseUrl: env.SEEDREAM_BASE_URL,
      endpoint: env.SEEDREAM_IMAGE_ENDPOINT || '/images/generations',
      apiKey: env.SEEDREAM_API_KEY,
      payload,
    });
    results.push(...extractUrls(result));
  }

  const urls = [...new Set(results)];
  if (!urls.length) throw new Error('NO_IMAGE_URL_RETURNED');
  return json({ urls });
};

const handleTextGeneration = async (request, env) => {
  if (request.method !== 'POST') return json({ error: 'METHOD_NOT_ALLOWED' }, 405);
  if (!(await requireAuth(request, env))) return json({ error: 'UNAUTHORIZED' }, 401);
  const body = await request.json().catch(() => ({}));
  return json({ text: body.prompt || '' });
};

const handleVideoGeneration = async (request, env) => {
  if (request.method !== 'POST') return json({ error: 'METHOD_NOT_ALLOWED' }, 405);
  if (!(await requireAuth(request, env))) return json({ error: 'UNAUTHORIZED' }, 401);
  return json({ error: 'SEEDANCE_API_NOT_CONFIGURED' }, 501);
};

const handleHealth = async (request, env) => {
  if (!(await requireAuth(request, env))) return json({ error: 'UNAUTHORIZED' }, 401);
  return json({
    ok: true,
    seedream: {
      hasBaseUrl: Boolean(env.SEEDREAM_BASE_URL),
      hasApiKey: Boolean(env.SEEDREAM_API_KEY),
      modelId: env.SEEDREAM_MODEL_ID || '',
      endpoint: env.SEEDREAM_IMAGE_ENDPOINT || '/images/generations',
      size: env.SEEDREAM_SIZE || '2K',
      watermark: env.SEEDREAM_WATERMARK !== 'false',
    },
  });
};

export async function onRequest(context) {
  const { request, env } = context;
  const { pathname } = new URL(request.url);

  try {
    if (pathname === '/api/auth/login') return await handleLogin(request, env);
    if (pathname === '/api/auth/me') return await handleMe(request, env);
    if (pathname === '/api/generate/image') return await handleImageGeneration(request, env);
    if (pathname === '/api/generate/text') return await handleTextGeneration(request, env);
    if (pathname === '/api/generate/video') return await handleVideoGeneration(request, env);
    if (pathname === '/api/health') return await handleHealth(request, env);
    return json({ error: 'NOT_FOUND' }, 404);
  } catch (error) {
    console.error(error);
    return json({ error: error.message || 'SERVER_ERROR' }, 500);
  }
}
