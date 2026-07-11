# 3D 实时站点大世界技术说明

本文档记录当前实现层的技术约束和接口边界。需求事实来源仍是 `REQUIREMENTS.md`，分层验收事实来源仍是 `VALIDATION_LAYERS.md`。

## P0：占卜 AI 安全与生产部署

### 服务边界

- 占卜 AI 由 `app/fortune-ai-service/` 独立承载，生产监听 `127.0.0.1:3260`；Vite 只负责开发、构建和本地 preview。
- 普通 AI 路由接受任意有效登录账号；Admin 路由必须具有 `admin` 角色。站点不提供自助注册入口，账号继续由现有 auth 管理端创建和停用。
- Nginx 对普通路由执行登录校验、IP 限流和全局连接限制；Admin 使用独立精确路由，只保留登录、角色、请求体和 schema 安全边界。
- AI 服务必须再次向本机 auth 服务确认 Cookie，不信任客户端声明的用户、角色或 Admin 标志。

### API Contract

普通路由：

```text
POST /api/fortune/tarot/ai
POST /api/fortune/iching/ai
```

Admin 路由：

```text
POST /api/fortune/admin/tarot/ai
POST /api/fortune/admin/iching/ai
```

塔罗请求只接收 `question`、`spread`、`deck` 和 `cards[].index/isUpright/position`；周易请求只接收 `question`、`originalNumber`、`changedNumber` 和 `changingLines`。牌义和卦义必须由服务端可信数据补全，所有 schema 拒绝额外字段。

成功响应保持现有 `ApiResponse<AiInterpretResult>` 结构。错误响应使用 HTTP 状态码，并提供 `code`：`INVALID_REQUEST`、`AUTH_REQUIRED`、`FORBIDDEN`、`RATE_LIMITED`、`BUSY`、`DAILY_BUDGET_EXHAUSTED`、`AI_UNAVAILABLE`。

### 配额与费用

- 普通账号：每用户每分钟 3 次、每天 20 次、全局并发 2；Admin 不受这些配额限制。
- 普通调用每日预算为 `$0.625`，按 Asia/Shanghai 自然日持久化；调用前按最坏 token 成本预留，调用后按 DeepSeek `usage` 核销。
- Admin 费用单独审计，不占普通预算，也不触发费用熔断。
- 普通和 Admin 使用独立的 256 项、10 分钟 TTL LRU 缓存和执行中请求集合，避免费用归属混淆。
- 不记录问题正文、提示词、Cookie、密码或密钥；日志只包含 request id、匿名用户哈希、模块、状态、token 和费用摘要。

### 生产发布

- Nginx 静态 root 指向 `/var/www/sites/gluepudding/current/frontend`，`current` 原子指向 `releases/<时间戳-提交号>`。
- AI 服务由 `gluepudding-fortune-ai.service` 管理；运行数据位于 `/var/lib/gluepudding-fortune-ai/`，secret 位于独立 EnvironmentFile。
- `vite preview` 仅用于本地和 CI，生产切换成功后删除 PM2 中的 `gluepudding` preview 进程。

## 可见资源优先与场景流式加载

- “首次加载完成”的定义是：玩家位于出生点 `[0, 1.15, 40]`，在不移动的情况下正常 360° 转头和上下观察，所有肉眼可见内容均已完成下载、GLTF / 纹理解码和首次挂载；进入世界后不得出现可见建筑、地形或材质突然补上。
- 首次关键资源包括：可行走地面与碰撞、中央装饰、樱花树远景 LOD、占卜屋帐篷与魔法阵、地面传送台、天空实验室远景外壳 / 玻璃地板 / 传送台，以及代码生成的游戏入口、模块面板和版权备案屏。
- 首次不阻塞资源包括：占卜屋室内、塔罗牌面、天空实验室近景细节与 WebRTC、未展开的五子棋、未进入的游戏内容和所有背景音乐。
- Island 输入按加载生命周期拆为 `ground.glb`、`central-decor.glb`、`sakura-tree-low.glb`、`sakura-tree-mid.glb` 和 `sakura-tree-high.glb`。`ground.glb` 保留 `Icosphere` / `Plane` 节点名和地形采样契约；树木低 / 中 LOD 必须首次可见，高 LOD 靠近后在低模仍显示时后台加载。
- 首次资源并行下载但限制并发，显示文件内字节进度；关键资源最多重试 3 次，失败后进入明确错误 / 重试状态，不建立无限重试。非关键资源失败不得阻塞可移动世界。
- 大型几何统一使用 `EXT_meshopt_compression`。Teleporter 的内嵌 PNG 当前转换为内嵌 WebP，将模型从约 5.75MB 降到约 3.37MB；KTX2 仍需补充本地 `toktx` 编码器和 Basis transcoder 后再切换，不得依赖外部 CDN 解码器。
- 首次阻塞资源目标为约 6～8 MiB；在约 4 Mbps 链路下目标为十几秒进入可移动状态。最终以出生点实机 360° 无可见 pop-in 为硬验收，不以文件数单独判断。

## 出生点构图、场景层次与 2D 兜底页视觉收口

### 视觉系统

- 世界保留现有低多边形资产，统一为“低多边形浮岛 × 暮紫占卜屋 × 青绿实验室”。
- 户外主色为低饱和鼠尾草绿，路径为暖灰石色，地标照明为旧金；不引入新大图、Bloom、SSAO 或新 npm 依赖。
- 场景装饰使用程序化低面数几何体，根据现有 `TerrainSampler` 贴地摆放，不参与玩家碰撞。
- 2D 兜底页使用深墨紫、羊皮纸白和旧金的同一品牌色系；使用真实世界截图，不使用伪造的 CSS / SVG 场景。

### 构图与导航

- 出生相机以占卜屋为主焦点，实验室地面传送台和五子棋路径作为左右次级焦点；首帧地面不得占据超过约一半视口。
- 主路从出生点引向中央节点，再分别引向占卜屋、实验室和五子棋区；石块、草簇和灯笼只布置在主要行进线周边。
- 资源版权与备案屏移出出生视线中心，保留可访问性但不抢占首帧地标层级。

### 兜底页内容边界

- 删除“未来接入”、“后续层”和 Layer 编号等开发阶段文案。
- 首屏只保留当前降级状态、世界简介、真实截图和重试 3D 入口。
- 占卜屋、实验室和五子棋使用纵向编号列表提供真实独立降级链接，不再使用通用三列功能卡。

### 验收

- 1440 × 900 首帧能同时辨认占卜屋、实验室方向和五子棋路径，且占卜屋是明确主焦点。
- 路径、石块、草簇和灯笼无明显悬空、穿地或阻挡主通道。
- `?forceFallback=1` 显示新兜底页，截图可加载，三个降级入口可聚焦且文案不再含开发阶段表述。

## Layer 4：模块外壳层

目标：让占卜屋、实验室、五子棋都能作为常驻 3D 模块表面贴在世界物体上，不发生整页跳转，也不让鼠标焦点离开 Canvas。

### 范围

- 本层只实现模块外壳、模块状态、错误隔离和验证入口。
- 本层不实现真实占卜、WebRTC、RDK、门禁控制或五子棋规则。
- 模块 UI 以真实 R3F 3D 表面呈现，常驻锚定在对应建筑或物体表面。
- 状态切换控件是可 raycast 的 3D mesh，准星命中后左键或 `E` 激活。
- 加载中、错误、离线状态通过内置调试切换复现，不使用随机失败。

### 类型和状态

```ts
type WorldModuleId = "divination" | "laboratory" | "gomoku";
type WorldModuleStatus = "loading" | "ready" | "error" | "offline";
```

交互目标和模块映射：

```text
divination-house -> divination
laboratory       -> laboratory
gomoku-board     -> gomoku
```

### 运行边界

- 模块状态保留在 `WorldExperience` 附近的局部 React state 中。
- 不引入中心化状态库；等后续出现跨模块共享状态需求后再评估。
- 单个模块渲染异常必须被局部 Error Boundary 捕获，并显示该模块的错误状态。
- 模块面板常驻显示，不再使用打开 / 关闭式 DOM 浮层。
- 模块状态切换时玩家移动和视角继续运行，Pointer Lock 不主动退出。
- 后续“进入某个区域才加载对应模块，其余不加载”作为性能优化，不属于本层最小验证。

### 验收

- 三个模块常驻显示在占卜屋入口、实验室大屏和五子棋棋盘附近。
- 三个模块的状态芯片都能通过准星左键或 `E` 在 Canvas 内切换。
- 三个模块都能切换 `loading`、`ready`、`error`、`offline`。
- 地址栏不发生整页跳转。
- 连续切换三个模块状态后，玩家仍停留在同一个世界中，移动和视角不被模块操作打断。
- 桌面端和移动端截图必须归档到 `validation/layer-4/` 并写入 `VALIDATION_LAYERS.md`。

## Layer 4.5：GLB 地形替换和资源接入准备层

目标：把 `resources/` 中的大场景 GLB 作为世界基础地形接入，同时继续把占卜屋代码留作 Layer 5 输入。

### 已有输入

- 世界大场景候选资源：`resources/float-island-low-ploy.zip`。
- 占卜屋模型资源压缩包：`resources/fortune.zip`。
- 占卜屋模型资源解压目录：`resources/fortune/`。
- 占卜屋现有功能实现代码：`resources/feature-implementation/`。

### 接入边界

- 大场景运行时不再使用整岛 `island.glb`。`npm run assets:world:prepare` 从本地约 86.47MB 输入生成 `ground.glb`、`central-decor.glb` 和樱花树低 / 中 / 高 LOD；运行时源文件位于 `app/nav-world/public/models/world/`，当前暂不使用 Git LFS。
- 构建后五个世界分片复制到 `app/frontend/models/world/`；构建输出继续被 `.gitignore` 忽略，不提交普通 Git。
- 五个 GLB 统一使用 `scale = 6`、`position = [-14.4, -10, 3.5]`。`ground.glb` 是基础地形；旧圆形地板和网格只作为加载中或加载失败兜底。
- 玩家贴地对 GLB 主岛体 `Icosphere` 做射线采样，并选择最高的朝上可走命中；树木、房屋墙体和装饰物第一版不参与碰撞。
- 无地形命中或坡度过陡时阻止水平移动，避免玩家走出浮岛。
- 出生点、占卜屋、实验室和五子棋区域已重排到浮岛空地，模块表面和交互命中点跟随新锚点。
- 占卜屋代码作为 Layer 5 输入，优先复用 `resources/feature-implementation/src/types/fortuneTypes.ts`、`resources/feature-implementation/src/adapters/fortuneApi.ts`、mock 流程和 UI 状态设计。
- `resources/feature-implementation/node_modules/`、`resources/feature-implementation/dist/` 和 `resources/feature-implementation/.env` 不进入主工程源码；不要读取或记录 `.env` 内容。
- Python/FastAPI 部分只作为接口行为参考，是否接真实后端留到后续接口层决定。

### 下一步

- 再梳理占卜屋 demo 的可复用前端代码，并拆成 Layer 5 的最小 mock 接入任务。

## Layer 5A：占卜屋模型外壳与室内按需加载

目标：先把占卜屋模型接进世界，不实现占卜业务逻辑。

### 资源边界

- 轻量模型从 `resources/fortune/` 通过 `npm run assets:fortune:prepare` 复制到 `app/nav-world/public/models/fortune/`。
- `resources/fortune/textures/`、`tex_*.png`、完整塔罗牌面图和大牌面样例 GLB 不进入运行时资源目录。
- `app/nav-world/public/models/fortune/**/*.glb` 当前暂不使用 Git LFS 追踪；构建输出 `app/frontend/models/fortune/**/*.glb` 继续忽略。

### 加载策略

- 帐篷和魔法阵属于出生点可见外壳，随首次关键资源加载；室内模型不进入首屏阻塞清单。
- 首次关键场景完成后立即启动后台串行队列：先下载并解析占卜屋室内，再下载并解析樱花中模，最后下载并解析樱花高模；不再等待玩家靠近。该队列不阻止玩家移动。
- 右上角只在模型尚未就绪时显示字节/解析进度。进入门口迷雾后，必须同时满足室内资源下载完成以及 Three.js 解码挂载完成，才允许雾气散开；下载失败保持遮挡并自动重试。
- 延迟模型不得直接依赖 Three.js LoadingManager 的文件计数作为 HUD；樱花树中/高 LOD、占卜屋室内和五子棋使用具名下载任务，按响应字节显示大小、百分比和速度。任务从 fetch 开始持续到 Suspense 子树提交，避免文件切换或下载完成、解析未完成时提示消失。
- 樱花中模和高模虽然提前下载，但显示仍使用距离 LOD：68m 内切到中模、45m 内切到高模，远处继续渲染低模，避免提前下载导致远距离也常驻高模、增加 GPU 压力。
- 验证参数 `?fortuneAssets=shell` 和 `?fortuneAssets=interior` 只用于截图和网络验证，不作为真实业务入口。

### 当前摆位

- 帐篷中心放回占卜屋锚点，门朝出生点方向。
- 帐篷比例放大，内部使用平整圆形基底和放大的魔法阵。
- 塔罗桌、桌布、烛台、水晶和少量占位塔罗牌放在桌面高度；不加载 22/78 张牌面贴图。
- 星座穹顶放在帐篷上方，周易桌、卦板和铜钱放在室内右侧。

## Layer 5.5：视觉渲染基线层

目标：在 Layer 6 世界内五子棋模拟层和 Layer 7 实验室模拟层继续前，先统一当前大世界的实时渲染基线，让后续模块共享同一套光照、屏幕材质和低成本高画质感。

### 范围

- 本层只实现 235 计划中的光照基线、材质 / 屏幕质感和低成本“光追感”。
- 不新增 npm 依赖，不引入 Bloom / SSAO 后处理，不迁移 WebGPU，不接真实 path tracing。
- 不调整 Layer 5 已验收的占卜屋模型坐标。
- 不实现占卜屋、实验室、五子棋的业务交互。

### 渲染基线

- `Canvas` 创建时设置 `SRGBColorSpace`、`ACESFilmicToneMapping` 和固定曝光。
- WebGL shadow map 类型使用 `PCFSoftShadowMap`。
- 主世界光照采用低环境光、柔和天光和暖色 directional light。
- 主光使用 `2048 x 2048` 阴影图，并配置 shadow camera 范围、bias 和 normal bias，优先覆盖出生点、占卜屋、实验室和五子棋区域。

### 屏幕和局部氛围

- 占卜屋三块内容屏使用深色 PBR 屏幕材质和轻微 emissive，仍作为空白结果承载面。
- 实验室和五子棋常驻模块面板底板使用深色屏幕质感材质；按钮、文字和命中控件保持原 Canvas 内交互口径。
- 占卜屋内部增加暖色点光、紫色辅助点光和星座侧弱冷光；这些灯光不投射额外阴影，避免增加移动端成本。
- Layer 5 摆位期临时坐标辅助不再渲染，避免污染视觉验收画面。

## Layer 5.6：暮光写实光影增强

### 视觉目标

- 在现有“低多边形浮岛 × 暮紫占卜屋 × 青绿实验室”系统上引入暮光写实光影，不追求照片级拟真，不破坏低多边形轮廓。
- 暖色太阳作为唯一投射阴影的主光，冷色天空和弱定向光补足背光面，灯笼、占卜屋和实验室保留局部发光层级。

### 实现边界

- 使用 drei `Sky` 生成程序化大气天空，不下载 HDRI，不使用外部 CDN。
- 使用 `Environment` + `Lightformer` 生成一次性 `64px` 环境反射，`frames=1`，不持续捕获世界。
- 继续使用 ACES tone mapping 和 `PCFSoftShadowMap`；不新增 Bloom、SSAO、PCSS、实时 ContactShadows、WebGPU 或 path tracing。
- 天空和环境反射只在户外世界渲染；玩家进入占卜屋后继续使用已验收的室内光和深紫雾。
- 程序化灯笼只增加低强度、无阴影点光，不增加额外 shadow map。

### 验收

- 1440 × 900 出生点首帧天空有明确的大气色彩，占卜屋、植被、山体和实验室的亮暗面可分辨，没有大面积过曝、死黑或阴影条纹。
- 实验室金属 / 玻璃和占卜屋 PBR 材质能获得轻量环境反射，canvas 内容屏仍清晰可读。
- 生产构建通过，Chromium 桌面端无 console error / page error；390 × 844 只做回归截图，不在本层调整移动端 HUD。

## Layer 7.1：实验室真实流首帧稳定性

### 问题边界

- MediaMTX 已能接收 `robot001` 的 SRT H.264 推流，WHEP 信令、ICE 和视频 track 均可建立；本层不改推流协议、鉴权角色或 Nginx 路由。
- 旧实现使用完全脱离 DOM 的临时 `video`，并在收到 track 时就标记在线；部分浏览器会建立 PeerConnection，却没有稳定触发可供 Three.js 使用的首个解码帧。
- 用户在 Windows Edge 实机确认：首帧门槛通过且状态显示“实时视频流”后，WebGL `VideoTexture` 仍为空白；因此不能继续把原生媒体帧上传 WebGL 作为生产显示主路径。

### 实现边界

- 使用 drei `Html transform` 把原生 `video` 作为浏览器合成层贴合实验室视频区域，继承父级 3D 位置、旋转、透视和屏幕后隐藏判断；不再经过 WebGL `VideoTexture` 上传。
- 媒体元素保持 `autoplay + muted + playsInline`，不显示原生 controls、不接收鼠标事件；视频区域尺寸固定为 16:9，并保留原 3D 边框、离线状态与在线角标。
- 收到真实 `MediaStream` 后调用 `play()`，以 `requestVideoFrameCallback`、`loadeddata`、`canplay` 和 `playing` 共同确认首个可用视频帧，再显示原生视频层。
- 断流、重连或组件卸载时取消视频帧回调、暂停媒体元素、清除 `srcObject` 并移除 DOM 节点；MediaStream 和 WHEP session 仍由现有适配层负责关闭。
- 保留真实流离线后的指数退避重连，不降级为公开未鉴权直连，也不把流地址或凭据写入用户可见日志。
- WHEP session `DELETE` 作为幂等 best-effort 清理；已由 peer close 或上游回收的 session 不再向控制台抛出未处理的 400 响应。

### 验收

- 在线 `robot001` 在 Chromium 中得到非零 `videoWidth/videoHeight`、`readyState >= 2` 且 `currentTime` 持续增长。
- 实验室大屏只有在视频帧可用后显示“实时视频流”，原生视频画面能连续刷新；推流短暂断开后无需刷新整页即可恢复。
- TypeScript、生产构建和资源检查通过，生产 WHEP 仍只允许具备 `armbot` 权限的同源会话访问。

## Layer 8：占卜屋交互与占卜接口层

目标：在 Layer 5 模型摆放已验收后，让用户能在同一个 3D 世界内完成占卜屋塔罗、星座和周易交互，并为真实占卜接口接入保留边界。

### 范围

- Layer 5 已缩小为模型摆放验收，不再承载占卜交互。
- 本层做占卜屋 mock-first 前端体验，并在接口可用时通过适配层接入真实占卜服务。
- 占卜屋仍然是 3D 世界内模块，不使用整页跳转。
- 本次 PR 先验收塔罗 `three_card` 三张大阿卡纳流程；`single` 模式和 78 张完整牌组作为后续增强，不作为本次合并阻塞项。
- 星座使用 12 个可交互区域让用户选择自己的星座，并在星座屏显示解读。
- 周易先询问用户想算什么，再通过 6 次掷铜钱记录正反面、换算爻值、解卦并在周易屏显示；抽签玩法作为周易区额外能力保留。
- 周易展示六爻时必须使用 `result.lines.slice().reverse()`，因为接口结果从下往上返回。
- 详细交接要求见 `validation/layer-8/fortune-handoff.md`。

### 接口边界

- `types.ts` 定义星座、塔罗、周易的前端数据契约。
- `fortuneApi.ts` 提供 `getZodiacFortune()`、`getTarotReading()`、`getIchingReading()`。
- 默认使用模拟数据；只有 `VITE_USE_MOCK=false` 且 `VITE_FORTUNE_API_BASE_URL` 存在时才尝试真实接口。
- 真实接口失败时返回安全错误摘要，不能暴露内部地址、token 或堆栈。

### 交互边界

- 占卜屋专属控件复用 Layer 4 的 Canvas 内 raycast 口径：注册可命中的 mesh，准星命中后左键或 `E` 激活。
- 操作占卜屋控件不主动退出 Pointer Lock，不暂停玩家移动。
- 移动端复用底部 `Interact` / `Select` 按钮触发当前命中的占卜控件。
- `three_card` 模式最多选 3 张牌；`single` 模式留到后续增强。

### 验收

- `npm run build` 通过。
- `npm run assets:fortune:check` 通过。
- 本次 PR 的桌面端和移动端画面由用户手测，Codex 合并侧记录未截图原因。
- 模拟数据路径下星座、三张塔罗、周易六爻和抽签都能出结果，外部接口不可用不阻塞演示。
