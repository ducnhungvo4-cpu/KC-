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

const angleLabels = {
  front: '正面',
  left_45: '左前45°',
  right_45: '右前45°',
  left_side: '左侧面',
  right_side: '右侧面',
  back: '背面',
  top: '俯视',
  low: '仰视',
  custom: '自定义视角',
  fisheye: '鱼眼视角',
  tilt: '倾斜视角',
  front_top: '正面俯拍',
  front_low: '正面仰拍',
  panorama_top: '全景俯拍',
  back_view: '背面视角',
};

const angleInstructions = {
  front: '正面视角',
  left_45: '左前45度视角',
  right_45: '右前45度视角',
  left_side: '左侧面视角',
  right_side: '右侧面视角',
  back: '背面视角',
  top: '俯视视角',
  low: '低机位仰视视角',
  custom: '自定义相机视角',
  fisheye: '鱼眼广角视角',
  tilt: '倾斜构图视角',
  front_top: '正面俯拍视角',
  front_low: '正面仰拍视角',
  panorama_top: '全景俯拍视角',
  back_view: '背面视角',
};

const backgroundInstructions = {
  keep: '尽量保留原图背景和光线关系。',
  clean: '使用干净背景并保持完整画面空间关系，画面清晰自然。',
  solid: '使用简洁纯色背景，避免复杂环境元素。',
};

const aspectToQwenSize = (aspectRatio) => {
  const sizes = {
    '1:1': '1024*1024',
    '3:4': '960*1280',
    '4:3': '1280*960',
    '9:16': '864*1536',
    '16:9': '1536*864',
  };
  return sizes[aspectRatio] || '';
};

const zoomInstructions = {
  wide: '全景景别，视野更宽，保留更多环境信息。',
  medium: '中景景别，保持自然视野范围。',
  close: '近景景别，适度靠近画面中心但不要裁掉关键空间关系。',
};

const buildMultiAnglePrompt = ({ angle, prompt = '', consistency = 'high', background = 'clean', yaw = 0, pitch = 0, zoom = 'medium', targetMode = 'scene' }) => {
  const targetText = targetMode === 'subject'
    ? '围绕图1中的主要主体进行视角变化。'
    : '对图1的整张图片、完整场景和相机视角进行变化，不要把人物、物品或局部主体单独抠出，不要改变为孤立主体图。';
  const consistencyText = consistency === 'high'
    ? '严格保持原图的空间布局、人物/物体相对位置、场景结构、材质、颜色和关键细节一致。'
    : '保持原图的主要场景结构、元素关系、颜色和材质一致。';
  const yawText = yaw > 0 ? `相机向右水平环绕约${yaw}度。` : yaw < 0 ? `相机向左水平环绕约${Math.abs(yaw)}度。` : '水平视角保持正向。';
  const pitchText = pitch > 0 ? `相机向下俯拍约${pitch}度。` : pitch < 0 ? `相机向上仰拍约${Math.abs(pitch)}度。` : '垂直俯仰保持水平。';
  return [
    `基于图1生成${angleInstructions[angle] || angle}。`,
    targetText,
    yawText,
    pitchText,
    zoomInstructions[zoom] || zoomInstructions.medium,
    consistencyText,
    backgroundInstructions[background] || backgroundInstructions.clean,
    '输出必须是单张完整画面，不要生成拼贴图或多宫格，不要只返回局部主体。',
    prompt ? `补充要求：${prompt}` : '',
  ].filter(Boolean).join('');
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
      if (value.image) visit(value.image);
      if (value.url) visit(value.url);
      if (value.image_url) visit(value.image_url);
      if (value.video_url) visit(value.video_url);
      if (value.output_url) visit(value.output_url);
      if (value.data) visit(value.data);
      if (value.result) visit(value.result);
      if (value.output) visit(value.output);
      if (value.content) visit(value.content);
      for (const nested of Object.values(value)) visit(nested);
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

const handleMultiAngleGeneration = async (request, env) => {
  if (request.method !== 'POST') return json({ error: 'METHOD_NOT_ALLOWED' }, 405);
  if (!(await requireAuth(request, env))) return json({ error: 'UNAUTHORIZED' }, 401);

  const body = await request.json().catch(() => ({}));
  if (!body.image) return json({ error: 'IMAGE_REQUIRED' }, 400);
  const angles = Array.isArray(body.angles) && body.angles.length ? body.angles.slice(0, 8) : ['left_45', 'right_45', 'back'];
  const countPerAngle = Math.max(1, Math.min(Number(body.countPerAngle || 1), 2));
  const size = aspectToQwenSize(body.aspectRatio);

  const results = [];
  for (const angle of angles) {
    const prompt = buildMultiAnglePrompt({
      angle,
      prompt: body.prompt,
      consistency: body.consistency,
      background: body.background,
      yaw: Number(body.yaw || 0),
      pitch: Number(body.pitch || 0),
      zoom: body.zoom,
      targetMode: body.targetMode || 'scene',
    });
    const parameters = {
      n: countPerAngle,
      negative_prompt: body.negativePrompt || '低清晰度，变形，主体结构错误，多余肢体，文字错误，拼贴，多宫格',
      watermark: env.QWEN_EDIT_WATERMARK === 'true',
      result_format: 'message',
    };
    if (size) parameters.size = size;

    const result = await callModelApi({
      baseUrl: env.QWEN_EDIT_BASE_URL || 'https://dashscope.aliyuncs.com/api/v1',
      endpoint: env.QWEN_EDIT_ENDPOINT || '/services/aigc/multimodal-generation/generation',
      apiKey: env.DASHSCOPE_API_KEY,
      payload: {
        model: env.QWEN_EDIT_MODEL || 'qwen-image-edit-plus-2025-12-15',
        input: {
          messages: [{
            role: 'user',
            content: [
              { image: body.image },
              { text: prompt },
            ],
          }],
        },
        parameters,
      },
      timeoutMs: 600000,
    });

    for (const url of extractUrls(result)) {
      results.push({
        angle,
        label: angleLabels[angle] || angle,
        url,
        prompt,
      });
    }
  }

  if (!results.length) throw new Error('NO_MULTI_ANGLE_URL_RETURNED');
  return json({ results });
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
    qwenEdit: {
      hasApiKey: Boolean(env.DASHSCOPE_API_KEY),
      modelId: env.QWEN_EDIT_MODEL || 'qwen-image-edit-plus-2025-12-15',
      endpoint: `${env.QWEN_EDIT_BASE_URL || 'https://dashscope.aliyuncs.com/api/v1'}${env.QWEN_EDIT_ENDPOINT || '/services/aigc/multimodal-generation/generation'}`,
      watermark: env.QWEN_EDIT_WATERMARK === 'true',
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
    if (pathname === '/api/generate/multi-angle') return await handleMultiAngleGeneration(request, env);
    if (pathname === '/api/generate/text') return await handleTextGeneration(request, env);
    if (pathname === '/api/generate/video') return await handleVideoGeneration(request, env);
    if (pathname === '/api/health') return await handleHealth(request, env);
    return json({ error: 'NOT_FOUND' }, 404);
  } catch (error) {
    console.error(error);
    return json({ error: error.message || 'SERVER_ERROR' }, 500);
  }
}
