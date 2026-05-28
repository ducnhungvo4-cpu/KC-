import crypto from 'node:crypto';
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '..');
const distDir = path.join(rootDir, 'dist');

const loadDotEnv = () => {
  const envPath = path.join(rootDir, '.env');
  if (!fs.existsSync(envPath)) return;

  const content = fs.readFileSync(envPath, 'utf8');
  for (const line of content.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    const value = trimmed.slice(eq + 1).trim().replace(/^["']|["']$/g, '');
    if (!process.env[key]) process.env[key] = value;
  }
};

loadDotEnv();

const PORT = Number(process.env.PORT || 8787);
const LOGIN_PASSWORD = process.env.LOGIN_PASSWORD || 'kc8888';
const AUTH_SECRET = process.env.AUTH_SECRET || 'kc-canvas-dev-secret-change-me';
const TOKEN_TTL_SECONDS = Number(process.env.AUTH_TOKEN_TTL_SECONDS || 60 * 60 * 24 * 7);

const json = (res, status, data) => {
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
  });
  res.end(JSON.stringify(data));
};

const readBody = async (req) => {
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  if (chunks.length === 0) return {};
  return JSON.parse(Buffer.concat(chunks).toString('utf8'));
};

const base64url = (value) => Buffer.from(value).toString('base64url');
const sign = (payload) => crypto.createHmac('sha256', AUTH_SECRET).update(payload).digest('base64url');

const createToken = () => {
  const payload = base64url(JSON.stringify({
    sub: 'kc-user',
    exp: Math.floor(Date.now() / 1000) + TOKEN_TTL_SECONDS,
  }));
  return `${payload}.${sign(payload)}`;
};

const verifyToken = (token) => {
  try {
    if (!token || !token.includes('.')) return false;
    const [payload, signature] = token.split('.');
    const expected = sign(payload);
    const signatureBuffer = Buffer.from(signature);
    const expectedBuffer = Buffer.from(expected);
    if (signatureBuffer.length !== expectedBuffer.length) return false;
    if (!crypto.timingSafeEqual(signatureBuffer, expectedBuffer)) return false;

    const data = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
    return data.exp > Math.floor(Date.now() / 1000);
  } catch {
    return false;
  }
};

const requireAuth = (req, res) => {
  const auth = req.headers.authorization || '';
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : '';
  if (verifyToken(token)) return true;
  json(res, 401, { error: 'UNAUTHORIZED' });
  return false;
};

const joinUrl = (baseUrl, endpoint) => {
  const base = (baseUrl || '').replace(/\/$/, '');
  const pathPart = (endpoint || '').startsWith('/') ? endpoint : `/${endpoint || ''}`;
  return `${base}${pathPart}`;
};

const imageSize = (aspectRatio = '1:1', resolution = '1k') => {
  const [wRaw, hRaw] = aspectRatio.split(':').map(Number);
  const w = Number.isFinite(wRaw) && wRaw > 0 ? wRaw : 1;
  const h = Number.isFinite(hRaw) && hRaw > 0 ? hRaw : 1;
  let width = 1024;
  let height = 1024;
  if (w >= h) {
    width = 1024;
    height = Math.round(1024 * h / w);
  } else {
    height = 1024;
    width = Math.round(1024 * w / h);
  }
  if (resolution === '2k') {
    width *= 2;
    height *= 2;
  } else if (resolution === '4k') {
    width *= 4;
    height *= 4;
  }
  return `${width}x${height}`;
};

const mockImage = ({ prompt = '', aspectRatio = '1:1', resolution = '1k', index = 0 }) => {
  const [width, height] = imageSize(aspectRatio, resolution).split('x').map(Number);
  const safePrompt = String(prompt || 'KC 影视分镜概念图')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
  const hue = (safePrompt.length * 37 + index * 61) % 360;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
<defs><linearGradient id="g" x1="0" x2="1" y1="0" y2="1"><stop offset="0%" stop-color="hsl(${hue},70%,18%)"/><stop offset="100%" stop-color="hsl(${(hue + 120) % 360},65%,28%)"/></linearGradient></defs>
<rect width="100%" height="100%" fill="url(#g)"/><rect x="${width * 0.07}" y="${height * 0.08}" width="${width * 0.86}" height="${height * 0.84}" rx="24" fill="rgba(0,0,0,.24)" stroke="rgba(255,255,255,.22)"/>
<text x="${width * 0.12}" y="${height * 0.2}" fill="white" font-size="${Math.max(24, width / 26)}" font-family="Arial" font-weight="700">KC画布后端模拟生图</text>
<foreignObject x="${width * 0.12}" y="${height * 0.34}" width="${width * 0.76}" height="${height * 0.38}"><div xmlns="http://www.w3.org/1999/xhtml" style="font-family:Arial;color:white;font-size:${Math.max(18, width / 42)}px;line-height:1.35;font-weight:600;word-break:break-word;">${safePrompt}</div></foreignObject>
<text x="${width * 0.12}" y="${height * 0.84}" fill="rgba(255,255,255,.68)" font-size="${Math.max(12, width / 70)}" font-family="Arial">配置 SEEDREAM_API_KEY 后返回真实模型结果</text>
</svg>`;
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
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

const handleImageGeneration = async (req, res) => {
  const body = await readBody(req);
  const count = Math.max(1, Math.min(Number(body.count || 1), 4));

  if (!process.env.SEEDREAM_API_KEY) {
    return json(res, 200, {
      urls: Array.from({ length: count }, (_, index) => mockImage({
        prompt: body.prompt,
        aspectRatio: body.aspectRatio,
        resolution: body.resolution,
        index,
      })),
      mock: true,
    });
  }

  const payload = {
    model: process.env.SEEDREAM_MODEL_ID || 'doubao-seedream-5-0',
    prompt: body.prompt || '',
    size: imageSize(body.aspectRatio, body.resolution),
    n: count,
    response_format: 'b64_json',
  };
  if (body.inputImages?.length) {
    payload.image = body.inputImages[0];
    payload.image_url = body.inputImages[0];
    payload.reference_image = body.inputImages[0];
  }

  const result = await callModelApi({
    baseUrl: process.env.SEEDREAM_BASE_URL,
    endpoint: process.env.SEEDREAM_IMAGE_ENDPOINT || '/v1/images/generations',
    apiKey: process.env.SEEDREAM_API_KEY,
    payload,
  });
  const urls = extractUrls(result);
  if (!urls.length) throw new Error('NO_IMAGE_URL_RETURNED');
  json(res, 200, { urls });
};

const handleVideoGeneration = async (req, res) => {
  const body = await readBody(req);
  if (!process.env.SEEDANCE_API_KEY) {
    return json(res, 501, { error: 'SEEDANCE_API_NOT_CONFIGURED' });
  }

  const payload = {
    model: process.env.SEEDANCE_MODEL_ID || 'doubao-seedance-1-5-pro',
    prompt: body.prompt || '',
    aspect_ratio: body.aspectRatio || '16:9',
    resolution: body.resolution || '720p',
    duration: String(body.duration || '5s').replace('s', ''),
    images: body.inputImages || [],
    image: body.inputImages?.[0],
    first_frame: body.inputImages?.[0],
    last_frame: body.isStartEndMode ? body.inputImages?.[1] : undefined,
  };

  const result = await callModelApi({
    baseUrl: process.env.SEEDANCE_BASE_URL,
    endpoint: process.env.SEEDANCE_VIDEO_ENDPOINT || '/v1/videos',
    apiKey: process.env.SEEDANCE_API_KEY,
    payload,
    timeoutMs: 600000,
  });
  const urls = extractUrls(result);
  if (!urls.length) throw new Error('NO_VIDEO_URL_RETURNED');
  json(res, 200, { urls });
};

const handleTextGeneration = async (req, res) => {
  const body = await readBody(req);
  if (!process.env.TEXT_API_KEY || !process.env.TEXT_BASE_URL) {
    return json(res, 200, { text: body.prompt || '' });
  }

  const result = await callModelApi({
    baseUrl: process.env.TEXT_BASE_URL,
    endpoint: process.env.TEXT_ENDPOINT || '/v1/chat/completions',
    apiKey: process.env.TEXT_API_KEY,
    payload: {
      model: process.env.TEXT_MODEL_ID || 'gemini-2.0-flash-exp',
      messages: [{ role: 'user', content: body.prompt || '' }],
      stream: false,
    },
  });
  json(res, 200, { text: result.choices?.[0]?.message?.content || body.prompt || '' });
};

const contentTypes = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
};

const serveStatic = (req, res) => {
  const requestPath = decodeURIComponent(new URL(req.url, `http://${req.headers.host}`).pathname);
  const safePath = path.normalize(requestPath).replace(/^(\.\.[/\\])+/, '');
  let filePath = path.join(distDir, safePath === '/' ? 'index.html' : safePath);
  if (!filePath.startsWith(distDir)) return json(res, 403, { error: 'FORBIDDEN' });
  if (!fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
    filePath = path.join(distDir, 'index.html');
  }
  const ext = path.extname(filePath);
  res.writeHead(200, { 'Content-Type': contentTypes[ext] || 'application/octet-stream' });
  fs.createReadStream(filePath).pipe(res);
};

const server = http.createServer(async (req, res) => {
  try {
    const { pathname } = new URL(req.url, `http://${req.headers.host}`);

    if (req.method === 'POST' && pathname === '/api/auth/login') {
      const body = await readBody(req);
      if (body.password !== LOGIN_PASSWORD) return json(res, 401, { error: 'INVALID_PASSWORD' });
      return json(res, 200, { token: createToken() });
    }

    if (pathname === '/api/auth/me') {
      if (!requireAuth(req, res)) return;
      return json(res, 200, { ok: true });
    }

    if (pathname.startsWith('/api/')) {
      if (!requireAuth(req, res)) return;
      if (req.method === 'POST' && pathname === '/api/generate/image') return await handleImageGeneration(req, res);
      if (req.method === 'POST' && pathname === '/api/generate/video') return await handleVideoGeneration(req, res);
      if (req.method === 'POST' && pathname === '/api/generate/text') return await handleTextGeneration(req, res);
      return json(res, 404, { error: 'NOT_FOUND' });
    }

    serveStatic(req, res);
  } catch (error) {
    console.error(error);
    json(res, 500, { error: error.message || 'SERVER_ERROR' });
  }
});

server.listen(PORT, () => {
  console.log(`KC Canvas server listening on http://127.0.0.1:${PORT}`);
});
