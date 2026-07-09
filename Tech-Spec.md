# 3D 实时站点大世界技术说明

本文档记录当前实现层的技术约束和接口边界。需求事实来源仍是 `REQUIREMENTS.md`，分层验收事实来源仍是 `VALIDATION_LAYERS.md`。

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

- 大场景源模型位于 `app/nav-world/public/models/world/island.glb`，体积约 86MB；当前暂不使用 Git LFS 追踪 `.glb`，也可通过 `npm run assets:world:prepare` 从本地 `resources/float-island-low-ploy.zip` 重新生成。
- 构建后模型会复制到 `app/frontend/models/world/island.glb`；该构建输出继续被 `.gitignore` 忽略，不提交普通 Git。
- GLB 使用 `scale = 6`、`position = [-14.4, -10, 3.5]`，作为世界基础地形；旧圆形地板和网格只作为 GLB 加载中或加载失败兜底。
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

- 正常首屏不 preload 占卜屋模型。
- 玩家靠近占卜屋中心时加载帐篷外壳。
- 玩家更靠近、聚焦 `divination` 模块、选中占卜屋，或使用验证参数 `?fortuneAssets=interior` 时加载室内轻量道具。
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
