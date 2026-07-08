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
