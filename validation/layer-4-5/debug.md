# Layer 4.5 调试记录

本文件只记录 Layer 4.5：资源接入准备层 的问题、原因判断、解决方案和验证结果。不要记录 secret、token、私钥、密码或内部敏感地址。

记录格式：

```text
日期：
版本 / Layer：
现象：
原因判断：
解决方案：
涉及文件：
验证结果：
画面变化：
截图：
剩余风险：
```

## 2026-07-08 / Layer 4.5 资源接入准备规划

日期：2026-07-08

版本 / Layer：Layer 4.5 资源接入准备层

现象：用户已将已有大场景资源和占卜屋代码放入 `resources/`，要求对规划做最小改动，而不是立即接入实现。

原因判断：`resources/float-island-low-ploy.zip` 属于世界大场景候选资源，会影响比例、出生点、交互点和性能；`resources/fortune/` 属于占卜屋功能输入，会影响 Layer 5 的类型、API 适配、mock 和 UI 流程。两类资源不应混进 Layer 4 模块外壳，也不应直接跳过资源清点进入业务集成。

解决方案：新增 Layer 4.5 资源接入准备层；在 `TODO.md` 增加 P3.5；在 `Tech-Spec.md` 记录已有资源路径、接入边界和不接入范围；明确 `resources/fortune/node_modules/`、`resources/fortune/dist/` 和 `resources/fortune/.env` 不作为主工程源码接入输入，且不读取 `.env` 内容。

涉及文件：`VALIDATION_LAYERS.md`、`TODO.md`、`Tech-Spec.md`、`validation/layer-4-5/debug.md`、`MEMORY.md`。

验证结果：已通过文本检查确认 Layer 4.5、P3.5 和资源路径说明存在；本次只做规划，不运行构建。

画面变化：无。

截图：无用户可见画面变化，不需要截图。

剩余风险：尚未检查压缩包内部模型格式、贴图、比例和许可备注；尚未梳理 `resources/fortune/src/` 可复用代码细节。

## 2026-07-08 / Layer 4.5 大场景 GLB 动物节点清理

日期：2026-07-08

版本 / Layer：Layer 4.5 资源接入准备层

现象：用户要求先处理大场景 GLB，删除浮岛资源上的动物。

原因判断：`resources/float-island-low-ploy.zip` 内的 `source/island.glb` 节点名均为 Blender 默认名，不能通过节点名识别动物；资源中有多个 mesh 使用 `goat material`，可判定为羊 / 动物模型。动物节点作为场景根节点存在，适合先从场景中移除，再清理未引用 mesh 和材质。

解决方案：先保留原始压缩包备份 `resources/float-island-low-ploy.original.zip`；从 `source/island.glb` 移除 9 个使用 `goat material` 的动物节点；使用 `@gltf-transform/cli prune` 清理未引用的节点、mesh、primitive、material 和 accessor；将处理后的 `source/island.glb` 写回 `resources/float-island-low-ploy.zip`。

涉及文件：`resources/float-island-low-ploy.zip`、`resources/float-island-low-ploy.original.zip`。

验证结果：从更新后的 zip 重新解出 `source/island.glb` 后检查，节点数为 27，mesh 数为 25，material 数为 19；`goat material` 不存在，使用该材质的节点不存在；`gltf-transform inspect` 可正常读取 GLB。

画面变化：当前只修改本地资源包，尚未接入前端场景，没有站点画面变化。

截图：无用户可见画面变化，不需要截图。

剩余风险：本次通过材质名和场景节点结构定位动物，未做 Blender 视口人工复核；如果资源中还有未使用 `goat material` 的隐藏动物，需要后续接入或视觉检查时再处理。

## 2026-07-08 / Layer 4.5 GLB 地形替换和真实贴地

日期：2026-07-08

版本 / Layer：Layer 4.5 资源接入准备层

现象：用户要求把世界基础地板替换为浮岛 GLB，并把房子和模块区域放到空旷位置；同时要求玩家真实贴地。

原因判断：GLB 原始水平范围约 `19.65 x 17.59`，绿色可行走地形约 `16.34 x 15.62`，原尺寸放不下现有世界布局。按 `scale = 6` 放大后，可行走地形约 `98 x 94`，足够承载出生点、占卜屋、实验室和五子棋区域。玩家控制原本固定使用 `y=0`，需要改为按地形采样落地和限制岛边。

解决方案：新增 `npm run assets:world:prepare`，从 `resources/float-island-low-ploy.zip` 解出 `source/island.glb` 到 `app/nav-world/public/models/world/island.glb`；GLB 文件继续被 `.gitignore` 忽略，不进 Git。新增 `IslandTerrain` 加载浮岛 GLB，并只用名为 `Plane` 的绿色地形 mesh 作为可行走采样面。`PlayerController` 改为通过 `TerrainSampler` 查询脚下高度，保留跳跃手感，无命中或坡度过陡时阻止水平移动。出生点、占卜屋、实验室、五子棋区域、交互命中点和模块面板全部迁到浮岛空地。为避免 Drei `Text` 字体加载暂停整个 3D 场景，模块面板单独包裹局部 `Suspense`。

涉及文件：`.gitignore`、`README.md`、`TODO.md`、`Tech-Spec.md`、`VALIDATION_LAYERS.md`、`app/nav-world/package.json`、`app/nav-world/scripts/prepare-world-assets.mjs`、`app/nav-world/src/world/IslandTerrain.tsx`、`app/nav-world/src/world/terrainSampler.ts`、`app/nav-world/src/world/PlayerController.tsx`、`app/nav-world/src/world/WorldScene.tsx`、`app/nav-world/src/world/WorldExperience.tsx`、`app/nav-world/src/world/InteractionSystem.tsx`、`app/nav-world/src/world/sceneConfig.ts`、`app/nav-world/src/modules/moduleRegistry.ts`。

验证结果：`npm run assets:world:prepare` 通过，生成约 86MB 的 `island.glb`，且 `git check-ignore` 确认运行时 GLB 不进 Git；`npm run build` 通过；`npm run assets:check` 通过。使用 Vite preview 和 headless Chromium 生成桌面端、移动端截图，画面可见 GLB 浮岛绿色地形和 Layer 4.5 HUD。headless Chromium 对 87MB GLB 使用 SwiftShader 截图时收尾较慢，桌面截图通过 `timeout --signal=INT 75s` 归档成功。

画面变化：有。基础地板从圆形平面 / 网格替换为浮岛 GLB；HUD 显示 Layer 4.5；区域和模块表面重排到浮岛空地。

截图：`validation/layer-4-5/island-desktop.png`、`validation/layer-4-5/island-mobile.png`。

剩余风险：第一版只做绿色地形贴地和岛边限制，不做树木、墙体或装饰物碰撞；headless 截图不能完整验证 Pointer Lock 下的手感，仍需用户实机确认移动、跳跃和模块点击体验。

## 2026-07-08 / Layer 4.5 上层草地贴地和跳跃修复

日期：2026-07-08

版本 / Layer：Layer 4.5 资源接入准备层

现象：用户在实机预览中看到玩家站在偏青色下层平面，上方大片绿色草地悬在头顶；同时按 `Space` 跳跃没有正常起跳。

原因判断：模型内名为 `Plane` 的 mesh 实际对应偏青色下层面，不是主岛体上方草地。主岛体上方草地在 `Icosphere` mesh 内，当前单一 `Plane` 采样会把玩家和建筑锚点放到下层。跳跃方面，地形贴地和落地判断缺少起跳后的短暂离地保护，容易在地形采样切换或贴地阈值内把起跳压回地面。

解决方案：将可行走采样 mesh 改为 `Icosphere`，并在采样器里遍历命中结果，只接受法线朝上的可走面，选择最高的命中点作为地面高度。把出生点、占卜屋、实验室和五子棋锚点重排到主岛体上方草地可命中的区域。`PlayerController` 增加 `jumpGroundDetachSeconds`，起跳后短时间内不执行落地吸附，并要求下落速度后才判定落地。

涉及文件：`app/nav-world/src/world/IslandTerrain.tsx`、`app/nav-world/src/world/PlayerController.tsx`、`app/nav-world/src/world/sceneConfig.ts`、`README.md`、`TODO.md`、`Tech-Spec.md`、`VALIDATION_LAYERS.md`、`MEMORY.md`。

验证结果：`npm run build` 通过；`npm run assets:check` 通过。重新启动 Vite preview 到 `http://127.0.0.1:4174/`。重新生成桌面端和移动端截图，截图显示玩家已位于上层绿色草地，不再站在下层偏青色平面。

画面变化：有。出生点视角移动到上方草地；占卜屋、实验室和五子棋区域跟随主岛体草地重新摆放。

截图：`validation/layer-4-5/island-desktop.png`、`validation/layer-4-5/island-mobile.png`。

剩余风险：headless Chromium 截图不能直接验证 Pointer Lock 下的 `Space` 手感；跳跃仍需要用户在真实浏览器中刷新 `4174` 后实机确认。

## 2026-07-08 / Layer 4.5 大模型加载超时修复

日期：2026-07-08

版本 / Layer：Layer 4.5 资源接入准备层

现象：用户通过 `127.0.0.1:4174` 打开后进入 `3D 大世界兜底入口`，页面提示 `3D 初始化未完成，已切换到 2D 兜底入口`。

原因判断：端口和静态资源服务正常，`/models/world/island.glb` 返回 `200 OK`，模型体积约 86MB。当前 App 在 `WorldExperience` chunk 加载完成后只等待 15 秒 `onReady()`；而 Layer 4.5 的 `onReady()` 需要等待 GLB 下载、解析和地形采样准备。经 SSH 转发或慢速浏览器下载时，15 秒会误判为初始化失败。

解决方案：将 3D 世界 ready 等待窗口从 15 秒扩展到 180 秒，将动态 chunk 下载等待从 45 秒扩展到 90 秒；启动标签从 `Starting WebGL` 改为 `Loading 3D World Assets`，更准确表达当前在加载大模型资源；同时修复 `WorldErrorBoundary` 的错误状态切换逻辑。

涉及文件：`app/nav-world/src/App.tsx`。

验证结果：`npm run build` 通过；`npm run assets:check` 通过；重新启动 Vite preview 到 `http://127.0.0.1:4174/`。本机 `curl` 确认首页已引用最新构建 `index-Sun8hXQ6.js` 和 `WorldExperience-kg74XOsj.js`，`/models/world/island.glb` 返回 `200 OK`。

画面变化：启动阶段会停留更久等待 3D 资源，不再在 15 秒后误切 2D 兜底。

截图：无。修复目标是启动超时策略，现有桌面端和移动端地形截图仍适用。

剩余风险：若用户浏览器已处在旧兜底页，需要 `Ctrl+F5` 强制刷新页面重新进入新的 3D 启动流程。

## 2026-07-08 / Layer 4.5 模块表面文字重合修复

日期：2026-07-08

版本 / Layer：Layer 4.5 资源接入准备层

现象：用户反馈 GLB 场景里的常驻模块表面字体有点重合。

原因判断：Layer 4 的常驻模块面板迁到 GLB 场景后，玩家默认视角更接近五子棋面板；原面板内部状态说明、状态按钮、能力列表和底部提示在固定高度内互相挤压，五子棋这种较矮面板最明显。

解决方案：调整 `WorldModulePanels` 的 3D 文本排版：长状态说明改为短句；标题、副标题、状态、按钮、提示和能力列表使用固定分区坐标；缩小按钮文字与列表字号；能力列表上移并压缩行距，保证三条能力项都留在面板内。

涉及文件：`app/nav-world/src/modules/WorldModulePanels.tsx`。

验证结果：`npm run build` 通过；`npm run assets:check` 通过；重新启动 Vite preview 到 `http://127.0.0.1:4174/`。重新生成桌面端和移动端截图，截图中默认可见的五子棋模块文字不再压住状态按钮，能力列表没有掉出面板。

画面变化：有。常驻模块表面文字更紧凑，说明文字变短，列表和按钮间距更清楚。

截图：`validation/layer-4-5/island-desktop.png`、`validation/layer-4-5/island-mobile.png`。

剩余风险：远距离 3D 文字仍偏小；本次只处理重合，不把模块面板改成近距离大屏或放大交互模式。

## 2026-07-08 / Layer 4.5 源 GLB 改用 Git LFS

日期：2026-07-08

版本 / Layer：Layer 4.5 资源接入准备层

现象：用户希望大文件使用 Git LFS，预计 clone 次数很少，可以接受 LFS 流量成本。

原因判断：`app/nav-world/public/models/world/island.glb` 是运行所需源模型，约 86MB；普通 Git 接近 GitHub 大文件警告阈值并会污染历史。`app/frontend/models/world/island.glb` 是构建输出，不应提交。原始 `resources/` 仍是本地输入，不应进入仓库。

解决方案：安装并初始化 Git LFS；在 `.gitattributes` 中为 `app/nav-world/public/models/world/*.glb` 配置 `filter=lfs diff=lfs merge=lfs -text`；从 `.gitignore` 移除源模型忽略规则，只继续忽略 `app/frontend/models/world/*.glb`；更新 README、Tech-Spec、VALIDATION_LAYERS 和 MEMORY 的资源交付口径。

涉及文件：`.gitattributes`、`.gitignore`、`README.md`、`Tech-Spec.md`、`VALIDATION_LAYERS.md`、`MEMORY.md`、`app/nav-world/public/models/world/island.glb`。

验证结果：`git lfs version` 返回 `git-lfs/3.4.1`；`git check-attr` 确认源 GLB 使用 LFS filter；`git check-ignore` 确认构建输出 GLB 仍被忽略；源 GLB 加入 index 后，`git lfs ls-files` 能列出 `app/nav-world/public/models/world/island.glb`。

画面变化：无。只改变模型版本管理方式。

截图：无用户可见画面变化，不需要截图。

剩余风险：GitHub LFS 流量和存储配额由仓库 owner 承担；部署或新 clone 环境需要执行 `git lfs pull`，否则拿到的只是 pointer 文件。

## 2026-07-08 / Layer 4.5 首次加载提示

日期：2026-07-08

版本 / Layer：Layer 4.5 资源接入准备层

现象：用户要求在加载页提示首次加载可能时间较长。

原因判断：Layer 4.5 接入约 86MB 的 GLB 模型后，首次进入需要下载、解析模型并准备地形采样；如果只显示进度条，用户容易误以为页面卡死。

解决方案：在 `StartupScreen` 进度百分比下方增加提示文案 `首次加载需要下载 3D 模型，可能需要较长时间。`，并添加 `.startup-note` 样式控制宽度、字号、行高和居中显示。

涉及文件：`app/nav-world/src/App.tsx`、`app/nav-world/src/styles.css`。

验证结果：`npm run build` 通过；`npm run assets:check` 通过；重新启动 Vite preview 到 `http://127.0.0.1:4174/`。通过 Chromium DevTools 阻断 `island.glb` 请求，稳定捕捉真实启动页，桌面端和移动端截图均显示首次加载提示。

画面变化：有。启动页进度条下方新增首次加载说明。

截图：`validation/layer-4-5/startup-desktop.png`、`validation/layer-4-5/startup-mobile.png`。

剩余风险：无新增风险。

## 2026-07-08 / Layer 4.5 占卜屋资源目录整理

日期：2026-07-08

版本 / Layer：Layer 4.5 资源接入准备层

现象：用户提供 `resources/fortune.zip`，要求查看其中可用模型、解压到原 `resources/fortune` 路径，并把原有 `resources/fortune` 功能实现代码目录改成英文名。

原因判断：压缩包内的 `fortune/` 是占卜屋模型和贴图资源；原 `resources/fortune/` 是占卜屋功能实现代码。两类输入同名会导致 Layer 5 接入时混淆模型资源和可复用代码。

解决方案：将原 `resources/fortune/` 重命名为 `resources/feature-implementation/`；将 `resources/fortune.zip` 解压到 `resources/fortune/`；同步 README、Tech-Spec、TODO、VALIDATION_LAYERS 和 MEMORY 中的资源路径口径。

涉及文件：`resources/fortune.zip`、`resources/fortune/`、`resources/feature-implementation/`、`README.md`、`Tech-Spec.md`、`TODO.md`、`VALIDATION_LAYERS.md`、`MEMORY.md`、`validation/layer-4-5/debug.md`。

验证结果：`resources/fortune/` 当前包含 29 个 `.glb` 模型和 13 个图片资源；`resources/feature-implementation/` 保留原功能实现代码目录；未读取 `.env` 内容。

画面变化：无。仅整理本地资源输入和文档路径。

截图：无用户可见画面变化，不需要截图。

剩余风险：尚未逐个导入模型检查比例、原点、材质和贴图绑定；Layer 5 接入时仍需在浏览器里验证模型显示效果。

## 2026-07-10 / 浮岛隐藏底面裁切与传输压缩

日期：2026-07-10

版本 / Layer：Layer 4.5 资源接入准备层

现象：生产 `island.glb` 约 86.47MB，每位首次访问用户都需要下载完整模型，服务器出口和弱网启动压力较大；用户允许删除岛底看不见的模型部分，并明确不需要 Playwright 测试。

原因判断：岛体 `Icosphere` 和下层 `Plane` 合计只有约 8 千个顶点，单独裁底只能节省少量字节；文件主体是樱花树 `Cube.007`，包含约 221 万上传顶点。要明显降低传输量，需要在安全裁底之外，对全模型执行不减少轮廓三角面的去重、量化和 Meshopt 压缩。

解决方案：新增 `scripts/optimize-world-asset.mjs`。资源准备时只处理节点名为 `Icosphere` / `Plane` 的三角面：三角形三个顶点都低于模型局部 `Y=0` 时删除，任何跨越裁切面的三角形全部保留，从而在可玩地面下方留下边缘裙边。处理后执行 `dedup`、`weld`、`prune`、`sparse` 和 Meshopt high；不启用 simplify，不改变樱花树轮廓。`prepare-world-assets.mjs` 保证临时输出仍以 `.glb` 结尾，避免 NodeIO 误写成分离的 glTF / bin。

涉及文件：`app/nav-world/public/models/world/island.glb`、`app/nav-world/scripts/prepare-world-assets.mjs`、`app/nav-world/scripts/optimize-world-asset.mjs`、`app/nav-world/package.json`、`app/nav-world/package-lock.json`、`README.md`、`Tech-Spec.md`、`VALIDATION_LAYERS.md`、`MEMORY.md`。

结果：删除 655 个隐藏岛体三角面，保留 2182 个岛体三角面；文件从约 86.47MB 降至约 18.19MB，减少约 79%。优化后仍包含 `Icosphere`、`Plane` 和樱花树节点，解码后约 176.75 万个三角面。生产通过静态资源原子 release `20260710053259-2505fd4-island` 切换，源文件与线上 release 的 SHA-256 一致。

验证结果：未运行 Playwright。仅运行 GLB 规范校验和 Meshopt 解码后的结构检查：GLB 无错误 / 警告，27 个节点、12 个 mesh、14 个实际引用材质，关键节点齐全；另外执行一次 Vite 生产构建用于生成带新静态资源版本号的 release。

画面变化：预期无地表和樱花树轮廓变化；只删除玩家无法到达的深层岛底，并引入高精度量化。未做浏览器视觉回归。

截图：无，用户明确要求不运行 Playwright。

剩余风险：`EXT_meshopt_compression` 要求客户端 GLTFLoader 提供 Meshopt 解码器；项目当前 Drei `useGLTF` 默认已配置该解码器。极老或脱离当前加载链路的第三方查看器可能无法直接打开压缩模型。

## 2026-07-10 / 出生点可见资源首屏与世界流式加载

日期：2026-07-10

版本 / Layer：Layer 4.5 资源接入准备层（跨 Layer 5 / 7 / 12）

现象：启动器原来串行下载 23 个 GLB、3 首 MP3 和 22 张塔罗牌面，共约 72.35MiB，并在所有资源完成前阻止进入世界。用户要求出生点肉眼可见内容必须首次加载，但室内、未展开模块和背景音频不应阻塞。

原因判断：占卜屋虽已有室内距离门控，但全量启动清单提前下载了全部文件；实验室和五子棋组件也始终挂载。整岛 GLB 的绝大部分体积来自远处樱花树高模，使可行走地面和高模树木无法分开调度。原加载进度按文件计数，一个大文件完成前会长期显示 0/N。

解决方案：新增 `worldAssetManifest.ts`，首次只加载 8 个出生点可见 GLB；下载改为最多 4 路并发、HEAD 获取总字节、流式累计字节、最多 3 次重试和手动重试按钮。App 先等待关键文件下载，再等待地面、中央景物 / 樱花低模、占卜屋外壳和实验室外壳实际解码挂载，全部 ready 后才解除移动。Island 生成流水线拆出地面、中央装饰和樱花树低 / 中 / 高 LOD；中模在 68m 内加载，高模在 45m 内加载，旧 LOD 保留到新 LOD ready。整岛 `island.glb` 从运行时和构建产物移除。

模型与媒体优化：占卜屋 / 实验室大型 GLB 统一 Meshopt；Teleporter PNG 转 WebP，约 5.75MB 降至 3.37MB；其余可压缩纹理模型按收益转换 WebP。三首 BGM 从 320kbps 降为 128kbps，总体积约 30.04MiB 降至 12.02MiB，并全部退出首屏阻塞清单。

涉及文件：`app/nav-world/src/App.tsx`、`app/nav-world/src/assets/startupAssetPreloader.ts`、`app/nav-world/src/assets/worldAssetManifest.ts`、`app/nav-world/src/world/IslandScenery.tsx`、`app/nav-world/src/world/WorldScene.tsx`、`app/nav-world/src/world/WorldExperience.tsx`、`app/nav-world/src/world/sceneConfig.ts`、`app/nav-world/scripts/build-world-streaming-assets.mjs`、`app/nav-world/scripts/prepare-world-assets.mjs`、`app/nav-world/scripts/optimize-streaming-assets.mjs`、`app/nav-world/scripts/optimize-audio-assets.mjs`、世界 / 占卜屋 / 实验室 GLB 和三首 MP3。

结果：首次关键 GLB 总计 5,533,196 字节（5.28MiB）；按实测 4.05Mbps 理论下载约 10.9 秒，6Mbps 约 7.4 秒。生产已原子切换到 `releases/20260710065942-2505fd4-streaming`，release 中不存在旧 `models/world/island.glb`。

验证结果：`npx tsc --noEmit`、`npm run build`、五个世界 GLB 校验、实验室 GLB 校验和占卜屋资源清单检查通过；Meshopt validator 只报告不支持该扩展的 info 和既有 unused object info，无 error / warning。按用户要求未运行 Playwright。

画面变化：有。远处樱花树首次显示低模，靠近后切换中 / 高模；进入世界前会等待所有出生点可见外壳实际挂载。加载页显示真实字节进度和重试按钮。

截图：无，未运行 Playwright。出生点 360° 肉眼无 pop-in 仍由用户实机复验。

剩余风险：服务器缺少 `toktx`，Teleporter 当前是 WebP 而不是 KTX2，网络体积已下降但 GPU 压缩收益尚未获得。樱花低 / 中 LOD 是自动代理，需要用户实机确认远景轮廓；如差异明显，应调 voxel 尺寸和简化比例，不应把 18.97MB 高模重新放回首屏。
