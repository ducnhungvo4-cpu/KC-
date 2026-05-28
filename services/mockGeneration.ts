const ratioToSize = (aspectRatio = '1:1', resolution = '1k') => {
    const [wRaw, hRaw] = aspectRatio.split(':').map(Number);
    const wRatio = Number.isFinite(wRaw) && wRaw > 0 ? wRaw : 1;
    const hRatio = Number.isFinite(hRaw) && hRaw > 0 ? hRaw : 1;
    const base = resolution === '4k' ? 1536 : resolution === '2k' ? 1280 : 1024;

    if (wRatio >= hRatio) {
        return { width: base, height: Math.round(base * hRatio / wRatio) };
    }

    return { width: Math.round(base * wRatio / hRatio), height: base };
};

const escapeXml = (value: string) => value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

export const generateMockImage = (
    prompt: string,
    aspectRatio = '1:1',
    resolution = '1k',
    index = 0,
    inputImageCount = 0
) => {
    const { width, height } = ratioToSize(aspectRatio, resolution);
    const safePrompt = escapeXml(prompt.trim() || 'KC 影视分镜概念图');
    const seed = Array.from(safePrompt).reduce((sum, char) => sum + char.charCodeAt(0), 0) + index * 37;
    const hueA = seed % 360;
    const hueB = (hueA + 92) % 360;
    const hueC = (hueA + 178) % 360;
    const refText = inputImageCount > 0 ? `参考图 ${inputImageCount} 张` : '文本生图';

    const svg = `
<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
  <defs>
    <linearGradient id="bg" x1="0" x2="1" y1="0" y2="1">
      <stop offset="0%" stop-color="hsl(${hueA}, 72%, 18%)"/>
      <stop offset="54%" stop-color="hsl(${hueB}, 62%, 28%)"/>
      <stop offset="100%" stop-color="hsl(${hueC}, 70%, 16%)"/>
    </linearGradient>
    <radialGradient id="key" cx="72%" cy="24%" r="58%">
      <stop offset="0%" stop-color="rgba(255,255,255,0.42)"/>
      <stop offset="100%" stop-color="rgba(255,255,255,0)"/>
    </radialGradient>
    <filter id="grain">
      <feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="3" stitchTiles="stitch"/>
      <feColorMatrix type="saturate" values="0"/>
      <feComponentTransfer><feFuncA type="table" tableValues="0 0.16"/></feComponentTransfer>
    </filter>
  </defs>
  <rect width="100%" height="100%" fill="url(#bg)"/>
  <rect width="100%" height="100%" fill="url(#key)"/>
  <rect width="100%" height="100%" filter="url(#grain)" opacity="0.28"/>
  <g fill="none" stroke="rgba(255,255,255,0.18)" stroke-width="${Math.max(2, width / 420)}">
    <path d="M ${width * 0.1} ${height * 0.72} C ${width * 0.32} ${height * 0.52}, ${width * 0.5} ${height * 0.92}, ${width * 0.9} ${height * 0.55}"/>
    <path d="M ${width * 0.18} ${height * 0.25} L ${width * 0.82} ${height * 0.25} L ${width * 0.68} ${height * 0.78} L ${width * 0.3} ${height * 0.78} Z"/>
  </g>
  <rect x="${width * 0.06}" y="${height * 0.07}" width="${width * 0.88}" height="${height * 0.86}" rx="18" fill="rgba(0,0,0,0.18)" stroke="rgba(255,255,255,0.18)"/>
  <text x="${width * 0.1}" y="${height * 0.18}" fill="rgba(255,255,255,0.9)" font-family="Arial, sans-serif" font-size="${Math.max(22, width / 24)}" font-weight="700">KC画布模拟生图</text>
  <text x="${width * 0.1}" y="${height * 0.26}" fill="rgba(255,255,255,0.72)" font-family="Arial, sans-serif" font-size="${Math.max(14, width / 44)}">${escapeXml(`Seedream 5.0 / ${aspectRatio} / ${resolution} / ${refText}`)}</text>
  <foreignObject x="${width * 0.1}" y="${height * 0.36}" width="${width * 0.8}" height="${height * 0.34}">
    <div xmlns="http://www.w3.org/1999/xhtml" style="font-family: Arial, sans-serif; font-size:${Math.max(18, width / 36)}px; line-height:1.35; color:white; font-weight:600; word-break:break-word;">${safePrompt}</div>
  </foreignObject>
  <text x="${width * 0.1}" y="${height * 0.84}" fill="rgba(255,255,255,0.62)" font-family="Arial, sans-serif" font-size="${Math.max(12, width / 58)}">API Key 接入后将替换为真实模型结果</text>
</svg>`.trim();

    return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
};
