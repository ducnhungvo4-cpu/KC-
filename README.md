# KC画布 MVP 产品文档

## 产品定位

KC画布是面向内部影视与视觉创意业务的 AI 创作画布原型。产品以无限画布为核心，把文本、图片、视频、裁剪、多角度编辑、模型生成等能力组织成可拖拽、可连线、可复用的节点工作流。

当前阶段目标不是完整生产系统，而是先交付一版可在线试用的 MVP，让业务方验证：

- 节点式创作流程是否符合日常工作习惯
- 图片、视频、文本节点是否能串联成可理解的创作链路
- AI 生图、图片编辑、多角度控制等能力是否能提高分镜和视觉方案产出效率
- 后续是否需要扩展为更完整的项目管理、资产管理和多人协作工具

## MVP 范围

### 已纳入

- 无限画布基础操作
- 图片、视频、文本节点
- 节点拖拽、选择、连线、快捷添加
- 本地图片/视频导入
- 图片裁剪与新节点生成
- Seedream 5.0 Lite 生图接入
- Qwen Image Edit 多角度图片编辑接入
- 简单密码登录
- 后端代理模型 API Key
- Cloudflare Workers 线上部署
- 项目导入导出

### 暂不纳入

- 多账号与权限体系
- 企业级素材库
- 复杂计费与额度系统
- 多人实时协作
- 完整任务队列和异步生成中心
- 模型训练、LoRA 管理和 GPU 自部署管理后台

## 目标用户

- 产品经理：快速验证 AI 创作流程和节点交互是否可用
- 影视/短视频业务人员：把分镜、参考图、生成图、视频结果串成流程
- 视觉设计/创意人员：围绕一张图继续裁剪、变体生成、多角度探索
- 内部技术人员：验证前后端代理、模型接入和部署可行性

## 核心流程

1. 用户输入密码进入画布。
2. 在画布中新增生图、文本或视频节点。
3. 通过上传、粘贴、拖拽或生成结果把图片/视频放入画布。
4. 对任意图片节点进行裁剪、多角度控制或继续生图。
5. 生成结果自动成为新的标准节点，并与来源节点建立连线。
6. 用户可以继续拖拽、连线、编辑参数、导出项目。

## 功能清单

### 1. 登录与 API Key 安全

- 线上访问需要输入访问密码，当前默认密码为 `kc8888`。
- 前端不保存模型 API Key，只保存登录 token。
- 模型 API Key 统一配置在后端环境变量或 Cloudflare Workers Secret 中。
- 未登录或 token 失效时，前端会回到登录页。
- 当前登录为 MVP 级简单密码方案，后续可升级为账号、角色和额度控制。

### 2. 无限画布

- 支持画布缩放、平移和节点自由拖拽。
- 支持框选、多选和节点删除。
- 支持右键菜单和快捷添加节点。
- 支持从节点连接口拖出连线。
- 连接端口为大尺寸圆形 `+` 按钮，鼠标悬停才显示，避免干扰画布视觉。
- 节点位置、大小、连线关系会进入项目导入导出数据。

### 3. 节点系统

- 生图节点：用于文本生图、图片输入后再生图、承载上传/裁剪/编辑生成的图片。
- 生视频节点：用于文本或图片驱动的视频生成。
- 首尾帧视频节点：用于首帧、尾帧控制的视频生成。
- 文本节点：用于输入文本内容、选择模型，并在生成过程中展示 loading。
- 所有来源进入画布的图片/视频都应作为标准节点处理，包括本地上传、粘贴、裁剪结果、模型生成结果和多角度结果。

### 4. 图片导入与二次编辑

- 支持本地上传图片。
- 支持剪贴板粘贴图片。
- 支持拖拽媒体文件进入画布。
- 上传或粘贴后的图片会自动计算合适画幅，并成为可继续编辑的标准图片节点。
- 图片节点可继续裁剪、多角度控制、连接到其他节点或作为后续生成输入。

### 5. 图片裁剪

- 图片节点的 `功能` 下拉菜单中提供 `图片裁剪`。
- 裁剪范围只能使用节点支持的画幅比例，避免裁剪后节点尺寸被任意撑大。
- 裁剪确认后自动生成一个新的标准图片节点。
- 新裁剪节点会继承来源节点的模型、提示词和基础配置。
- 来源节点与裁剪结果节点会自动建立连线，保留处理链路。

### 6. 多角度控制图片

- 图片节点的 `功能` 下拉菜单中提供 `多角度控制`。
- 多角度编辑器支持自由调整相机参数：
  - 水平环绕：`-180°` 到 `180°`
  - 垂直俯仰：`-90°` 到 `90°`
  - 景别缩放：全景 / 中景 / 近景
- 提供常用预设：
  - 自定义
  - 鱼眼视角
  - 倾斜视角
  - 正面俯拍
  - 正面仰拍
  - 全景俯拍
  - 背面视角
- 支持补充提示词，用于追加光线、质感、风格、构图等要求。
- 支持输出画幅选择：沿原图、`1:1`、`3:4`、`4:3`、`9:16`、`16:9`。
- 后端会把角度、俯仰、景别、背景策略等字段转换为 Qwen Image Edit 提示词。
- 默认编辑目标是整张图片和完整场景，而不是只处理人物、商品或局部主体。
- 多角度结果会自动生成新的标准图片节点，并与来源图片节点连线。

### 7. 生图能力

- 当前生图模型接入 Seedream 5.0 Lite。
- 模型接口通过后端代理调用，前端只提交提示词、画幅、分辨率和输入图片。
- 当前 Ark 接口配置：
  - `SEEDREAM_BASE_URL=https://ark.cn-beijing.volces.com/api/v3`
  - `SEEDREAM_MODEL_ID=doubao-seedream-5-0-260128`
  - `SEEDREAM_IMAGE_ENDPOINT=/images/generations`
  - `SEEDREAM_SIZE=2K`
- 无本地 API Key 时，本地开发会使用模拟生图结果，保证业务试用交互闭环。

### 8. Qwen Image Edit 能力

- 当前用于多角度控制图片。
- 接入模型：`qwen-image-edit-plus-2025-12-15`。
- 调用方式：DashScope 多模态生成接口。
- 前端传入图片、水平角度、垂直角度、景别、画幅、背景策略和补充提示词。
- 后端统一组装提示词，避免前端暴露具体模型 API 细节。
- 当前提示词策略强调完整场景视角变化，避免模型只把局部主体单独抠出。

### 9. 视频生成能力

- 当前默认模型配置为 Seedance 1.5 Pro。
- 已保留文本生视频、图片生视频、首尾帧生视频的节点结构。
- 后端接口已预留 `/api/generate/video`。
- 真实视频 API Key 和具体生产链路可在后续版本继续完善。

### 10. 文本节点

- 文本节点支持单击选择和拖拽，双击进入编辑态。
- 支持输入文本内容。
- 支持模型选择。
- 生成过程中显示 loading 状态。
- 文本结果可作为后续工作流中的描述、提示词或创作备注。

### 11. 项目导入导出

- 支持导出当前画布项目。
- 导出内容包含节点、连线、画布位置、缩放状态和项目名称。
- 支持导入项目继续编辑。
- 当前主要服务于 MVP 试用和本地项目迁移。

### 12. 本地存储与下载

- 支持本地浏览器环境下的项目和资源操作。
- 下载逻辑保留浏览器默认下载作为基础能力。
- 后续可继续扩展为指定下载目录、缓存清理和桌面端打包能力。

## 当前技术架构

### 前端

- React
- TypeScript
- Vite
- 节点画布和参数面板均在前端实现

### 后端代理

- 本地运行：`server/server.mjs`
- Cloudflare Workers：`worker/index.js`
- Cloudflare API 路由：`functions/api/[[path]].js`

后端负责：

- 登录校验
- token 校验
- 模型 API Key 保护
- Seedream 生图请求转发
- Qwen Image Edit 多角度请求转发
- 错误信息统一返回

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

生产运行：

```bash
npm run build
npm start
```

后端会服务 `dist` 前端页面，并提供 `/api/auth/login`、`/api/generate/image`、`/api/generate/multi-angle`、`/api/generate/video` 等接口。

## Cloudflare Workers 部署

当前线上域名为 `*.workers.dev`，项目按 Cloudflare Workers + Static Assets 部署。

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

需要在 Workers 的 Settings -> Variables and Secrets 中配置：

```bash
LOGIN_PASSWORD=kc8888
AUTH_SECRET=replace-with-a-long-random-string
SEEDREAM_API_KEY=your-seedream-key
DASHSCOPE_API_KEY=your-dashscope-key
```

`SEEDREAM_API_KEY`、`DASHSCOPE_API_KEY` 和 `AUTH_SECRET` 应使用 Secret 类型。`wrangler.toml` 中已写入非敏感的模型默认地址、模型 ID、接口路径和水印配置。

## Cloudflare Pages 说明

如果改用 Cloudflare Pages，静态页面可以直接使用 `dist`，但 `server/server.mjs` 不会运行。Pages API 需要依赖 `functions/api/[[path]].js`。当前项目优先按 Workers 部署。

## 构建验证

```bash
npm run build
```

## 后续迭代方向

- 增加更明确的模型调用状态和失败原因提示。
- 增加生成任务队列，避免长耗时模型请求阻塞 Worker。
- 增加资源库和节点历史版本。
- 增加视频模型真实 API 配置和结果轮询。
- 增加账号、角色、额度和调用日志。
- 增加多角度编辑的局部主体模式和完整场景模式切换。
