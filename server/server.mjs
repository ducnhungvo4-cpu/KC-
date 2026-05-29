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
    let data = {};
    try {
      data = text ? JSON.parse(text) : {};
    } catch {
      data = { raw: text };
    }
    if (!response.ok) {
      throw new Error(data?.error?.message || data?.message || data?.code || data?.raw || `MODEL_API_${response.status}`);
    }
    return data;
  } finally {
    clearTimeout(timer);
  }
};

const getQwenEditApiKey = () => (
  process.env.DASHSCOPE_API_KEY ||
  process.env.QWEN_EDIT_API_KEY ||
  process.env.ALIYUN_DASHSCOPE_API_KEY ||
  process.env.DASHSCOPE_KEY
);

const extractText = (data) => {
  const content = data?.choices?.[0]?.message?.content;
  if (typeof content === 'string') return content;
  if (Array.isArray(content)) {
    return content.map(part => part?.text || part?.content || '').filter(Boolean).join('\n');
  }
  return '';
};

const MEDIA_ANALYSIS_SYSTEM_PROMPT = [
  '你是专业的影视广告视觉分析师和AI生成提示词工程师。',
  '当输入是图片时，完整分析画面构成，并输出可用于复刻该图片的生成提示词。',
  '当输入是视频时，按时间顺序拆解为完整分镜表，覆盖画面、镜头、运动、主体、场景、光线、色彩、声音和可复刻的视频生成提示词。',
  '输出使用中文，结构清晰，避免泛泛形容，尽量描述可观察的视觉事实。'
].join('\n');

const DEFAULT_SCRIPT_ASSET_SYSTEM_PROMPT = [
  '你是影视前期视觉资产拆解专家。你的任务是根据用户剧本，为每个主要角色输出完整、稳定、可复用的 AI 角色资产提示词。',
  '执行顺序必须固定：通读剧本 -> 提取角色基础事实 -> 先锁定性别 -> 再判断时代/朝代/世界观 -> 再判断身份阶层职业 -> 再选择五官、发型、服装、配饰 -> 执行道具过滤 -> 输出角色资产表。',
  '性别规则：男性角色不得调用女性服装、凤冠、步摇、霞帔、襦裙、宫裙、女帝高髻等女性专属规则；女性角色不得调用男性冠帽、蟒袍、衮服、权臣朝服、男性朝靴等男性专属规则；性别不明时使用中性保守描述并标注“剧本未明确”。',
  '时代规则：现代角色只能使用现代服装、发型和材质；古代角色只能使用古代服装系统；不得把现代服装混入古代角色，也不得把古装词库混入现代角色。',
  '高位古装规则：高位男性强化金冠/玉冠/翼善冠、圆领袍/蟒袍/衮服/朝服、宽阔袍摆、袍摆压地、长袍遮鞋、不露鞋面不露脚踝；高位女性强化凤冠/珠翠头面/大体量盘发、重工大袖礼袍、厚重曳地宫裙、层层堆叠裙摆、裙摆遮鞋、不露鞋面不露脚踝。',
  '道具过滤规则：剧本中的武器、手机、文件、扇子、伞、佩剑、佩刀、香囊、玉佩、令牌、腰间流苏、腰间挂件等只能进入“配饰与道具档案”，不得进入最终生图提示词。双手必须空握不持物，腰间不挂载悬挂物。',
  '固定生图构图：真人写实风格，模拟真实拍摄效果，8K 超高清，明亮柔和光线，干净白色背景。左侧正面面部特写，右侧正好 3 个全身人物单行水平排列，分别为正面、右侧面 90 度、背面；全图正好 4 个人物形象，不多不少，同一人同一服装同一发型。',
  '每个角色输出字段必须包含：基础设定、身材体态、脸部特征、发型、服装配色、内衬层、中间层、外层/外袍、下装、鞋子设定、面料质感、图案纹样、纹样位置、结构廓形、工艺重工程度、穿着状态、配饰与道具档案、最终生图提示词、负面提示词。',
  '最终输出用 Markdown。先给“角色总览表”，再逐个角色输出完整资产卡。信息不足时可以基于剧情合理推断，但必须标注“推断”，不得违背剧本。'
].join('\n');

const normalizeInputMedia = (inputMedia = []) => inputMedia
  .filter(item => item?.url && (item.type === 'image' || item.type === 'video'))
  .slice(0, 6)
  .map(item => {
    if (item.type === 'video') {
      return {
        type: 'video_url',
        video_url: { url: item.url },
        fps: Number(item.fps || 2),
        media_resolution: item.mediaResolution || 'default',
      };
    }
    return {
      type: 'image_url',
      image_url: { url: item.url },
    };
  });

const resolveMimoTextModel = (modelName) => {
  const value = String(modelName || '').toLowerCase();
  if (value.includes('2.5 pro') || value.includes('2.5-pro') || value.includes('2.5pro')) return 'mimo-v2.5-pro';
  if (value.includes('2.5')) return 'mimo-v2.5';
  return process.env.MIMO_TEXT_MODEL_ID || process.env.TEXT_MODEL_ID || 'mimo-v2.5-pro';
};

const buildMimoPayload = (body) => {
  const task = body.task || 'text';
  const baseMessages = [];
  let model = resolveMimoTextModel(body.modelName);
  let maxCompletionTokens = Number(process.env.MIMO_MAX_COMPLETION_TOKENS || 4096);

  if (task === 'media-analysis') {
    const mediaParts = normalizeInputMedia(body.inputMedia || body.media || []);
    if (!mediaParts.length) throw new Error('INPUT_MEDIA_REQUIRED');
    model = process.env.MIMO_VISION_MODEL_ID || 'mimo-v2.5';
    maxCompletionTokens = Number(process.env.MIMO_MEDIA_MAX_COMPLETION_TOKENS || 4096);
    baseMessages.push({ role: 'system', content: process.env.MIMO_MEDIA_SYSTEM_PROMPT || MEDIA_ANALYSIS_SYSTEM_PROMPT });
    baseMessages.push({
      role: 'user',
      content: [
        ...mediaParts,
        {
          type: 'text',
          text: [
            body.prompt ? `用户补充要求：${body.prompt}` : '',
            '请根据输入媒体输出分析结果。图片输出“画面构成分析 + 复刻提示词”；视频输出“完整分镜表 + 视频复刻提示词”。'
          ].filter(Boolean).join('\n'),
        },
      ],
    });
  } else if (task === 'script-assets') {
    baseMessages.push({ role: 'system', content: process.env.MIMO_SCRIPT_SYSTEM_PROMPT || DEFAULT_SCRIPT_ASSET_SYSTEM_PROMPT });
    baseMessages.push({ role: 'user', content: body.prompt || '' });
  } else {
    baseMessages.push({ role: 'user', content: body.prompt || '' });
  }

  return {
    model,
    messages: baseMessages,
    max_completion_tokens: maxCompletionTokens,
    temperature: Number(process.env.MIMO_TEMPERATURE || 0.7),
    top_p: Number(process.env.MIMO_TOP_P || 0.95),
    stream: false,
    thinking: { type: 'disabled' },
  };
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
    model: process.env.SEEDREAM_MODEL_ID || 'doubao-seedream-5-0-260128',
    prompt: body.prompt || '',
    sequential_image_generation: 'disabled',
    response_format: 'url',
    size: process.env.SEEDREAM_SIZE || seedreamSize(body.resolution),
    stream: false,
    watermark: process.env.SEEDREAM_WATERMARK !== 'false',
  };
  if (body.inputImages?.length) {
    payload.image = body.inputImages[0];
    payload.image_url = body.inputImages[0];
    payload.reference_image = body.inputImages[0];
  }

  const results = [];
  for (let index = 0; index < count; index += 1) {
    const result = await callModelApi({
      baseUrl: process.env.SEEDREAM_BASE_URL,
      endpoint: process.env.SEEDREAM_IMAGE_ENDPOINT || '/images/generations',
      apiKey: process.env.SEEDREAM_API_KEY,
      payload,
    });
    results.push(...extractUrls(result));
  }

  const urls = [...new Set(results)];
  if (!urls.length) throw new Error('NO_IMAGE_URL_RETURNED');
  json(res, 200, { urls });
};

const handleMultiAngleGeneration = async (req, res) => {
  const body = await readBody(req);
  if (!body.image) return json(res, 400, { error: 'IMAGE_REQUIRED' });
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
      watermark: process.env.QWEN_EDIT_WATERMARK === 'true',
      result_format: 'message',
    };
    if (size) parameters.size = size;

    const result = await callModelApi({
      baseUrl: process.env.QWEN_EDIT_BASE_URL || 'https://dashscope.aliyuncs.com/api/v1',
      endpoint: process.env.QWEN_EDIT_ENDPOINT || '/services/aigc/multimodal-generation/generation',
      apiKey: getQwenEditApiKey(),
      payload: {
        model: process.env.QWEN_EDIT_MODEL || 'qwen-image-edit-plus-2025-12-15',
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
  json(res, 200, { results });
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
  const apiKey = process.env.MIMO_API_KEY || process.env.TEXT_API_KEY;
  const baseUrl = process.env.MIMO_BASE_URL || process.env.TEXT_BASE_URL || 'https://api.xiaomimimo.com/v1';
  const endpoint = process.env.MIMO_TEXT_ENDPOINT || process.env.TEXT_ENDPOINT || '/chat/completions';
  if (!apiKey) {
    return json(res, 200, { text: body.prompt || '' });
  }

  const result = await callModelApi({
    baseUrl,
    endpoint,
    apiKey,
    payload: buildMimoPayload(body),
    timeoutMs: 600000,
  });
  json(res, 200, { text: extractText(result), usage: result.usage || null });
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
      if (req.method === 'POST' && pathname === '/api/generate/multi-angle') return await handleMultiAngleGeneration(req, res);
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
