# KC画布 MVP

内部影视 AI 创作画布原型，基于无限画布和节点式工作流构建。

## 当前能力

- 无限画布缩放、平移、拖拽和多选
- 文本、生图、生视频节点
- 节点连线、快捷添加、右键添加
- 图片/视频本地导入、拖入、粘贴
- 图片裁剪，并生成新的生图节点
- Seedream 5.0 / Seedance 1.5 Pro 默认模型配置
- 无 API Key 时的本地模拟生图，便于业务试用交互闭环
- 项目导入导出和本地开发预览

## 本地运行

```bash
npm install
npm run dev
```

默认访问：

```text
http://127.0.0.1:5173/
```

也可以直接运行：

```bash
start-dev.cmd
```

## 后端代理与登录

线上接真实模型时不要在前端配置 API Key。复制 `.env.example` 为 `.env`，在服务端配置：

```bash
LOGIN_PASSWORD=kc8888
AUTH_SECRET=replace-with-a-long-random-string
SEEDREAM_BASE_URL=https://api.example.com
SEEDREAM_API_KEY=your-seedream-key
SEEDANCE_BASE_URL=https://api.example.com
SEEDANCE_API_KEY=your-seedance-key
```

生产运行：

```bash
npm run build
npm start
```

后端会服务 `dist` 前端页面，并提供 `/api/auth/login`、`/api/generate/image`、`/api/generate/video` 等接口。前端只保存登录 token，不保存模型 API Key。

### Cloudflare Pages 部署

Cloudflare Pages 不会运行 `server/server.mjs`，线上 API 由 `functions/api/[[path]].js` 提供。

Pages 项目配置：

```bash
Build command: npm run build
Build output directory: dist
```

在 Cloudflare Pages 的 Settings -> Variables and Secrets 中配置：

```bash
LOGIN_PASSWORD=kc8888
AUTH_SECRET=replace-with-a-long-random-string
SEEDREAM_BASE_URL=https://ark.cn-beijing.volces.com/api/v3
SEEDREAM_API_KEY=your-seedream-key
SEEDREAM_MODEL_ID=doubao-seedream-5-0-260128
SEEDREAM_IMAGE_ENDPOINT=/images/generations
SEEDREAM_SIZE=2K
SEEDREAM_WATERMARK=true
DASHSCOPE_API_KEY=your-dashscope-key
QWEN_EDIT_BASE_URL=https://dashscope.aliyuncs.com/api/v1
QWEN_EDIT_ENDPOINT=/services/aigc/multimodal-generation/generation
QWEN_EDIT_MODEL=qwen-image-edit-plus-2025-12-15
QWEN_EDIT_WATERMARK=true
```

`SEEDREAM_API_KEY`、`DASHSCOPE_API_KEY` 和 `AUTH_SECRET` 应使用 Secret 类型。

### Cloudflare Workers 部署

如果线上域名是 `*.workers.dev`，说明项目部署在 Cloudflare Workers。Workers 使用 `wrangler.toml` 和 `worker/index.js`，`/api/*` 会先进入 Worker，其他路径由 `dist` 静态资源返回。

Workers 构建配置：

```bash
Build command: npm run build
```

`wrangler.toml` 已配置：

```toml
main = "./worker/index.js"

[assets]
directory = "./dist"
binding = "ASSETS"
not_found_handling = "single-page-application"
run_worker_first = ["/api/*"]
```

在 Workers 的 Settings -> Variables and Secrets 中配置同样的 `LOGIN_PASSWORD`、`AUTH_SECRET`、`SEEDREAM_*` 变量。
多角度控制功能还需要配置 `DASHSCOPE_API_KEY`。

## 构建验证

```bash
npm run build
```
