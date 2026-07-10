# Layer 12 调试记录

本文件只记录 Layer 12：真实五子棋集成层 的问题、原因判断、解决方案和验证结果。不要记录 secret、token、私钥、密码或内部敏感地址。

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

日期：2026-07-09
版本 / Layer：Layer 12 资源准备
现象：用户要求解压 `resources/gomoku-ai-academy-submission.zip`，压缩包条目使用 Windows 反斜杠路径。
原因判断：直接按普通 Linux 解压流程处理有概率生成带反斜杠的扁平文件名，不利于后续五子棋资源审查和集成。
解决方案：先运行压缩包完整性检查、路径安全检查和目标目录冲突检查；再将反斜杠归一化为目录分隔符，解压到独立目录 `resources/gomoku-ai-academy-submission/`。
涉及文件：`resources/gomoku-ai-academy-submission.zip`、`resources/gomoku-ai-academy-submission/`
验证结果：`unzip -t` 通过；解压得到 62 个文件和 7 个目录；未发现带反斜杠的文件名；`git check-ignore` 确认压缩包和解压目录均被 `resources/` 规则忽略。
画面变化：否。
截图：无，资源解压不涉及用户可见画面。
剩余风险：本次只完成解压和目录结构验证，尚未评估其中代码安全、许可证、运行方式和可复用边界。

日期：2026-07-09
版本 / Layer：Layer 12 资源复用评估
现象：用户要求评估 `resources/gomoku-ai-academy-submission/` 中的五子棋代码是否能用于 Layer 12。
原因判断：该包包含可用五子棋能力，但交付形态是完整课程产品，不是主工程可直接消费的模块。PWA / Worker 采用 25x25 棋盘，Python `board.py` 采用 45x45 棋盘；整包嵌入会带来键盘 / Pointer Lock 冲突、Service Worker 缓存作用域、UI 风格不一致、状态不可控和许可证不明风险。
解决方案：Layer 12 推荐走逻辑抽离路线：优先抽 `iphone/ai_worker.js` 的 Worker 协议、棋盘状态机、胜负判断、AI 难度配置、AI 解释数据和 `COURSE_PUZZLES`；在主工程内新建 TypeScript 类型和 `gomokuAdapter`，由 React / R3F 渲染原生世界内棋盘。短期如必须演示，可同源托管 `iphone/` 静态 PWA 并嵌入世界内面板，但只作为过渡方案。
涉及文件：`resources/gomoku-ai-academy-submission/iphone/ai_worker.js`、`resources/gomoku-ai-academy-submission/iphone/index.html`、`resources/gomoku-ai-academy-submission/board.py`、`resources/gomoku-ai-academy-submission/ai.py`、`app/nav-world/src/modules/moduleRegistry.ts`、`app/nav-world/src/modules/WorldModulePanels.tsx`
验证结果：核心 Python 语法检查通过；`iphone/ai_worker.js` 和 `iphone/sw.js` 语法检查通过；构造 Python 棋局验证胜负判断和 `get_best_move` 可运行；确认 `resources/` 仍不进 Git。
画面变化：否。
截图：无，代码评估不涉及用户可见画面。
剩余风险：未跑 PWA 视觉 / 交互截图；未做许可证确认；未证明 AI Worker 移植到 Vite Worker 后的构建兼容性；未评估 25x25 棋盘在 3D 世界中的性能和移动端交互手感。

日期：2026-07-09
版本 / Layer：Layer 12 原生五子棋模型资产
现象：用户要求先为世界内五子棋创建棋盘和黑白棋 GLB 模型，后续按 `G` 在世界地板上展开棋盘并左键落子。
原因判断：当前还没有可复用的原生 3D 棋盘 / 棋子资产；如果直接进入交互实现，会把建模、加载、射线命中和规则逻辑混在一起。先做小体积、可重复生成的 GLB，能降低后续 R3F 接入风险。
解决方案：新增脚本化 GLB 生成器，生成 25x25 棋盘、黑棋和白棋三份模型；棋盘使用实际几何线条、星位和边框，棋子使用低矮凸面形状。安装 `@gltf-transform/cli` 作为开发依赖，用于 GLB spec 校验；未安装 Blender，因为本次低面数模型用脚本生成更容易复现和调整。
涉及文件：`app/nav-world/scripts/generate-gomoku-models.mjs`、`app/nav-world/public/models/gomoku/gomoku_board.glb`、`app/nav-world/public/models/gomoku/black_stone.glb`、`app/nav-world/public/models/gomoku/white_stone.glb`、`app/nav-world/package.json`、`app/nav-world/package-lock.json`、`.gitignore`
验证结果：`npm run assets:gomoku:generate` 通过；`npm run assets:gomoku:check` 通过；`npm run assets:gomoku:validate` 对三份 GLB 均为 0 error / 0 warning；Three `GLTFLoader` 可解析三份模型，棋盘 bbox 约 `4.880 x 0.116 x 4.880`，棋子 bbox 约 `0.160 x 0.054 x 0.160`；`npm run assets:check` 通过；`npm run build` 通过。
画面变化：否，尚未接入主世界运行态；仅生成模型资产和预览截图。
截图：`validation/layer-12/gomoku-models-desktop.png`、`validation/layer-12/gomoku-models-mobile.png`
剩余风险：模型尚未接入 `G` 键展开、世界地形贴合、交叉点射线命中、落子状态、AI Worker 和移动端触控流程；视觉样式为脚本生成的基础棋盘，后续可按实机观感继续微调材质和比例。

日期：2026-07-09
版本 / Layer：Layer 12 世界内五子棋交互外壳
现象：原计划让 `G` 同时承担展开、移动和“准星对着棋盘 / 控制屏时收回”。自动化验证中第二次按 `G` 未收回，而是移动棋盘，说明收回判定依赖准星命中帧状态不稳定。
原因判断：棋盘和控制屏的准星命中状态来自渲染帧射线检测；键盘事件触发时可能拿到上一帧状态，且自动化和实机视角差异会让几何兜底判定不一致。把同一个 `G` 键同时设计为移动和收回，会让用户意图依赖瞄准状态，容易误操作。
解决方案：改为稳定热键约定：`G` 只负责展开或移动棋盘，`H` 负责收回棋盘；控制屏上的“收回棋盘”按钮继续真实收回，其余按钮只显示占位反馈。同步更新 HUD 文案、控制屏文案和 e2e 用例。
涉及文件：`app/nav-world/src/modules/gomoku/GomokuWorldBoard.tsx`、`app/nav-world/src/world/WorldExperience.tsx`、`app/nav-world/tests/e2e/world-smoke.spec.ts`、`TODO.md`、`MEMORY.md`、`VALIDATION_LAYERS.md`
验证结果：`npm run assets:gomoku:check` 通过；`npm run assets:gomoku:validate` 通过；`npx tsc --noEmit` 通过；`npm run build` 通过，仍有既有 `WorldExperience` chunk 超 500KB 警告；`npx playwright test tests/e2e/world-smoke.spec.ts -g "places and retracts"` 桌面 / 移动 2 项通过；`npx playwright test tests/e2e/world-smoke.spec.ts` 桌面 / 移动 6 项全部通过。
画面变化：是，HUD 和控制屏热键文案改为 `G` 展开 / 移动、`H` 收回，并可在世界内展开棋盘和水平控制屏。
截图：`validation/layer-12/gomoku-hotkeys-desktop.png`、`validation/layer-12/gomoku-hotkeys-mobile.png`
剩余风险：本轮仍不接真实落子、AI、悔棋、重开和胜负判断；控制屏按钮除“收回棋盘”外仍是占位反馈。移动端截图使用自动化键盘触发 `G` 展开，真实触屏入口后续接入时还需要单独验收。

日期：2026-07-09
版本 / Layer：Layer 12 棋盘尺寸和控制屏观感调整
现象：用户要求棋盘边长缩小为原来的 `2/3`，控制台改为浅色调。
原因判断：只缩放 GLB 模型会造成视觉尺寸、可踩 overlay、放置 footprint 和准星命中盒不一致；控制屏变浅后还需要同步调整按钮材质、文字颜色和控件位置，避免在缩短后的屏幕深度里重叠。
解决方案：将棋盘生成参数从约 `4.88m x 4.88m` 调整为约 `3.253m x 3.253m`，格距从 `0.18m` 调整为 `0.12m`；同步更新运行时 `boardHalfSize`、控制屏深度和放置 footprint。控制屏主体、面板和按钮改为浅色调，文字改为深色。中断 Playwright 前发现默认自动化视角会提示“这里放不下棋盘”，因此额外增加放置容错：准星目标附近放不下时，再尝试玩家脚下附近，并恢复 `placementSearchRadius` 为 `3.6`。
涉及文件：`app/nav-world/scripts/generate-gomoku-models.mjs`、`app/nav-world/public/models/gomoku/gomoku_board.glb`、`app/nav-world/src/modules/gomoku/gomokuWorldTypes.ts`、`app/nav-world/src/modules/gomoku/GomokuWorldBoard.tsx`、`MEMORY.md`
验证结果：`npm run assets:gomoku:generate` 通过；`npm run assets:gomoku:check` 通过；`npm run assets:gomoku:validate` 通过；Three `GLTFLoader` 解析确认棋盘 bbox 为约 `3.253 x 0.116 x 3.253`，棋子仍为约 `0.160 x 0.054 x 0.160`；`npx tsc --noEmit` 通过；`npm run build` 通过，仍有既有 `WorldExperience` chunk 超 500KB 警告。Playwright 热键测试按用户要求停止，未作为本轮验收结果。
画面变化：是，棋盘边长缩小为原来的 `2/3`，水平控制屏改为浅色调。
截图：本轮未新增截图；用户明确表示“我来测试就好”，画面由用户实机验证。
剩余风险：未做自动化截图归档；浅色控制屏在不同光照角度下的可读性和棋盘新尺寸手感需以用户实机观感为准。真实落子、AI、悔棋、重开和胜负判断仍未接入。

日期：2026-07-09
版本 / Layer：Layer 12 控制屏高度和宽度微调
现象：用户要求控制屏做到和棋盘一个高度，并且窄一点。
原因判断：此前控制屏 surface 比棋盘面高约 `0.018m`，玩家走上棋盘和控制屏时会有轻微高度差；控制屏宽度 `2.35m` 在棋盘缩小到 `3.253m` 后显得偏宽。
解决方案：将 `gomokuScreenSurfaceHeight` 改为与 `gomokuBoardSurfaceHeight` 相同；将控制屏宽度从 `2.35m` 收窄到 `1.72m`，并同步缩小按钮、底部提示条和文字 `maxWidth`，避免内容越界。
涉及文件：`app/nav-world/src/modules/gomoku/gomokuWorldTypes.ts`、`app/nav-world/src/modules/gomoku/GomokuWorldBoard.tsx`
验证结果：`npx tsc --noEmit` 通过；`npm run assets:check` 通过；`npm run build` 通过，仍有既有 `WorldExperience` chunk 超 500KB 警告；预览服务已重启到 `http://localhost:4174/` 和 `http://10.99.239.94:4174/`。
画面变化：是，控制屏与棋盘同高，横向更窄。
截图：本轮未新增截图；用户正在实机测试。
剩余风险：未做自动化截图归档；控制屏窄化后的文字观感、玩家踩踏手感和按钮命中体验以用户实机反馈为准。

日期：2026-07-09
版本 / Layer：Layer 12 五子棋实机视角范围调整
现象：用户在测试世界内五子棋时，希望视角上下限再提高和拉低一点。
原因判断：棋盘是贴地水平面，玩家站在棋盘和控制屏附近操作时，需要更大低头角度；同时世界内观察高处也需要更大抬头角度。原 Layer 2 俯仰限制约 `±64°`，偏保守。
解决方案：在全局玩家控制配置中将 `maxPitch/minPitch` 从 `±Math.PI / 2.8` 放宽到 `±Math.PI / 2.25`，约 `±80°`；保留垂直方向余量，避免相机翻转。
涉及文件：`app/nav-world/src/world/sceneConfig.ts`、`validation/layer-2/debug.md`
验证结果：`npx tsc --noEmit` 通过；`npm run assets:check` 通过；`npm run build` 通过，仍有既有 `WorldExperience` chunk 超 500KB 警告；预览服务已重启到 `http://localhost:4174/` 和 `http://10.99.239.94:4174/`。
画面变化：是，玩家可抬头 / 低头的视角范围变大。
截图：本轮未新增截图；用户正在实机测试。
剩余风险：极限视角下的方向感和棋盘操作舒适度仍以用户实机反馈为准。

日期：2026-07-09
版本 / Layer：Layer 12 移除旧五子棋占位
现象：用户实机截图中仍能看到原先 Layer 4 的 Gomoku 常驻模块面板、五子棋交互小球和黄色占位地板，与新的 `G/H` 展开式世界内棋盘重复。
原因判断：Layer 12 新增原生棋盘后，旧的五子棋模块外壳仍由 `WorldModulePanels`、`InteractionSystem` 和 `WorldScene` 中的 `GomokuArea` 渲染，形成两套五子棋入口和视觉占位。
解决方案：从模块面板渲染列表中排除 `gomoku`；禁用并过滤旧 `gomoku-board` 交互目标渲染，去掉小球和靠近环；删除 `WorldScene` 里的旧 `GomokuArea` 占位地板；更新默认 HUD 文案为“占卜屋和实验室模块面板”。
涉及文件：`app/nav-world/src/modules/moduleRegistry.ts`、`app/nav-world/src/world/InteractionSystem.tsx`、`app/nav-world/src/world/WorldScene.tsx`、`app/nav-world/src/world/WorldExperience.tsx`
验证结果：`npx tsc --noEmit` 通过；`npm run assets:check` 通过；`npm run build` 通过，仍有既有 `WorldExperience` chunk 超 500KB 警告；预览服务已重启到 `http://localhost:4174/` 和 `http://10.99.239.94:4174/`。
画面变化：是，旧 Gomoku 面板、小球、靠近环和黄色占位地板不再渲染。
截图：本轮未新增截图；用户正在实机测试。
剩余风险：旧 `gomoku` 模块定义暂保留在注册表中以减少类型边界改动，但不会渲染到当前世界；后续若彻底删除 Layer 4 旧五子棋模块契约，需要同步收敛 `WorldModuleId` 和相关注册表类型。

日期：2026-07-09
版本 / Layer：Layer 12 Gomoku 可踩面高度过渡
现象：用户反馈人在上下有高度的东西时会突然往上 / 往下，尤其在棋盘和水平控制屏这类可踩 overlay 上影响舒适度。
原因判断：Gomoku overlay 原先只在棋盘矩形和控制屏矩形内返回固定平台高度；进入、离开边缘或经过棋盘与控制屏之间的可见缝隙时，脚下高度可能在平台高度和真实地形高度之间突然切换。相机此前又直接跟随玩家高度，因此体感为突然上 / 下。
解决方案：将棋盘、控制屏和中间可见缝隙按一个组合可踩 footprint 参与地形采样；在组合 footprint 外围增加约 `0.46m` 的高度过渡带，基于真实地形高度平滑抬升到平台高度；同时在 Layer 2 的 `CameraRig` 中增加相机高度平滑跟随，降低剩余小高度差带来的不适。
涉及文件：`app/nav-world/src/modules/gomoku/gomokuWorldTypes.ts`、`app/nav-world/src/world/WorldExperience.tsx`、`app/nav-world/src/world/CameraRig.tsx`、`app/nav-world/src/world/sceneConfig.ts`、`validation/layer-2/debug.md`、`MEMORY.md`
验证结果：`npx tsc --noEmit` 通过；`npm run assets:check` 通过；`npm run build` 通过，仍有既有 `WorldExperience` chunk 超 500KB 警告。
画面变化：是，玩家走上 / 走下棋盘控制屏区域时的高度过渡行为改变；棋盘和控制屏之间的缝隙不再让玩家高度掉回地形。
截图：本轮未新增截图；用户前面已明确这类实机视觉 / 手感调整由用户测试，Codex 使用类型检查、资源检查和构建作为替代验证。
剩余风险：未做自动化路径行走截图或帧级高度曲线验证；边缘过渡距离和相机阻尼仍需用户实机确认手感。

日期：2026-07-09
版本 / Layer：Layer 12 真实五子棋逻辑接入
现象：用户要求按计划接入真实世界内五子棋逻辑：玩家执黑先手，AI 执白，只做人机对弈，不接训练、复盘、玩家对战、PWA 嵌入或后端存档。
原因判断：已有 Layer 12 `G/H` 交互外壳、GLB 棋盘和可踩控制屏，适合在主工程内接原生状态机；参考包 `iphone/ai_worker.js` 是 25x25 Worker AI，和当前棋盘尺寸一致。Python 逻辑为 45x45，不适合直接混用；整包 PWA 嵌入会重新引入 UI、Pointer Lock 和 Service Worker 边界问题。
解决方案：新增 25x25 五子棋核心类型、胜负检测、坐标转换、悔棋和 fallback AI；将 `iphone/ai_worker.js` 的候选点、威胁判断、难度参数、negamax / alpha-beta、`stats` 和 `explain` 移植为 Vite TypeScript Worker；新增 React hook 管理玩家回合、AI 思考、终局和错误状态；在世界棋盘上把射线命中转换为最近交叉点，渲染黑白 GLB 棋子和五连线高亮；控制屏按钮改为真实悔棋、重开、AI 强度循环和收回棋盘。
涉及文件：`app/nav-world/src/modules/gomoku/gomokuGame.ts`、`app/nav-world/src/modules/gomoku/gomokuAiWorker.ts`、`app/nav-world/src/modules/gomoku/useGomokuGame.ts`、`app/nav-world/src/modules/gomoku/GomokuWorldBoard.tsx`、`app/nav-world/src/world/WorldExperience.tsx`、`app/nav-world/tests/e2e/world-smoke.spec.ts`、`VALIDATION_LAYERS.md`、`TODO.md`、`MEMORY.md`
验证结果：`npm run assets:gomoku:check` 通过；`npm run assets:gomoku:validate` 通过；`npx tsc --noEmit` 通过；`npm run assets:check` 通过；`npm run build` 通过，仍有既有 `WorldExperience` chunk 超 500KB 警告；`npx playwright test tests/e2e/world-smoke.spec.ts` 桌面 / 移动共 8 项通过，覆盖展开、玩家落子、AI 响应、悔棋、重开和收回。
画面变化：是，棋盘可真实落黑白子，控制屏显示真实状态、难度、AI 搜索统计和讲解摘要，胜利时会高亮五连线。
截图：`validation/layer-12/gomoku-real-game-desktop.png`、`validation/layer-12/gomoku-real-game-mobile.png`
剩余风险：暂不接玩家对战、训练、复盘、PWA 外壳、后端 API、账号存档或 Worker 外部配置；AI 来源参考包未发现明确 LICENSE / attribution 文件，上线前仍需确认许可证和素材来源；移动端真实触屏落子手感仍需后续实机验收。

日期：2026-07-09
版本 / Layer：Layer 12 五子棋模型缩小
现象：用户实机测试截图中，世界内五子棋棋盘占据过多视野，棋子也明显大于格距，落子后互相挤压并遮挡棋盘线。
原因判断：上一版棋盘边长约 `3.253m`，玩家站上棋盘低头时视野容易被棋盘铺满；棋子直径约 `0.16m`，大于 `0.12m` 格距，真实落子后会几何重叠。
解决方案：将棋盘平面尺寸按约 `80%` 缩小，格距从 `0.12m` 调整为 `0.096m`，棋盘边长约 `2.603m`；同步更新运行时点击坐标、可踩 footprint 和控制屏深度。将棋子直径从约 `0.16m` 缩小到 `0.075m`，高度降到约 `0.036m`，并降低棋子放置高度，减少视觉遮挡。
涉及文件：`app/nav-world/scripts/generate-gomoku-models.mjs`、`app/nav-world/public/models/gomoku/gomoku_board.glb`、`app/nav-world/public/models/gomoku/black_stone.glb`、`app/nav-world/public/models/gomoku/white_stone.glb`、`app/nav-world/src/modules/gomoku/gomokuGame.ts`、`app/nav-world/src/modules/gomoku/gomokuWorldTypes.ts`、`app/nav-world/src/modules/gomoku/GomokuWorldBoard.tsx`、`VALIDATION_LAYERS.md`、`MEMORY.md`
验证结果：`npm run assets:gomoku:generate` 通过；`npm run assets:gomoku:check` 通过；`npm run assets:gomoku:validate` 通过，三份 GLB 均为 0 error / 0 warning；GLB extras 确认为格距 `0.096m`、棋子直径 `0.075m`、棋子高度 `0.036m`；`npx tsc --noEmit` 通过；`npm run assets:check` 通过；`npm run build` 通过，仍有既有 `WorldExperience` chunk 超 500KB 警告。
画面变化：是，棋盘、控制屏深度和棋子都更小，棋子不再大于格距。
截图：`validation/layer-12/gomoku-resized-desktop.png`、`validation/layer-12/gomoku-resized-mobile.png`
剩余风险：截图由自动化默认视角生成，最终遮挡感、第一人称低头操作距离和棋子可读性仍以用户实机测试为准；如果还偏大，下一轮可以只继续缩棋盘 footprint，或只缩棋子直径。

日期：2026-07-09
版本 / Layer：Layer 12 控制屏文字修复
现象：用户实机截图中，棋盘缩小后控制屏文字再次出现问题：标题、状态和按钮文字沿用旧屏幕尺寸，近距离看会显得过大、贴边或错位。
原因判断：控制屏深度已随棋盘从约 `3.253m` 缩到约 `2.603m`，但文字字号、按钮文案长度和底部讲解条仍接近旧布局；长文案如“AI 强度：宗师”在透视下容易占满按钮。
解决方案：控制屏改成紧凑短标签布局：标题保留“五子棋”，状态 / 强度 / 统计压缩为小字号三行，按钮显示“悔棋 / 重开 / 宗师 / 收回”等短词；删除底部空白讲解条，避免小屏幕上产生新的文字遮挡。为自动化近景截图，在已有 `window.__gomokuQa` 测试钩子上增加 `focusControlScreen()`，仅用于验证相机定位。
涉及文件：`app/nav-world/src/modules/gomoku/GomokuWorldBoard.tsx`、`VALIDATION_LAYERS.md`、`validation/layer-12/debug.md`、`MEMORY.md`
验证结果：`npx tsc --noEmit` 通过；`npm run assets:check` 通过；`npm run build` 通过，仍有既有 `WorldExperience` chunk 超 500KB 警告；`npx playwright test tests/e2e/world-smoke.spec.ts -g "places and retracts|plays a native world gomoku turn against AI"` 桌面 / 移动 4 项通过。
画面变化：是，控制屏文本变短、字号降低，按钮文字不再撑满按钮，底部空白讲解条移除。
截图：`validation/layer-12/gomoku-control-text-focused-desktop.png`、`validation/layer-12/gomoku-control-text-mobile.png`
剩余风险：自动化近景截图用于验证文字不再溢出；最终在用户实机第一人称角度下的可读距离仍以实测为准。

日期：2026-07-09
版本 / Layer：Layer 12 棋子贴地和最终验收
现象：用户实机反馈棋子看起来像悬浮在棋盘上，离远后视角会产生偏差；随后用户确认 Layer 12 验收通过。
原因判断：棋子此前使用 `gomokuBoardSurfaceHeight` 摆放，该高度对应棋盘边框 / 可踩平台顶面；真实棋盘格线面更低，导致棋子相对落子线悬空约数厘米，远景下会被透视放大为落点偏移。
解决方案：新增独立的棋盘落子面高度 `gomokuBoardPlaySurfaceHeight`，棋子和胜利标记使用落子面高度；保留 `gomokuBoardSurfaceHeight` 给玩家可踩面、控制屏同高和碰撞 / overlay 使用。
涉及文件：`app/nav-world/src/modules/gomoku/gomokuWorldTypes.ts`、`app/nav-world/src/modules/gomoku/GomokuWorldBoard.tsx`、`VALIDATION_LAYERS.md`、`validation/layer-12/debug.md`、`MEMORY.md`
验证结果：`npx tsc --noEmit` 通过；`npm run assets:check` 通过；`npm run build` 通过，仍有既有 `WorldExperience` chunk 超 500KB 警告；用户实机确认 Layer 12 验收通过。
画面变化：是，棋子贴近棋盘格线面，降低悬浮感和远景视差。
截图：`validation/layer-12/gomoku-stone-grounded-far-desktop.png`、`validation/layer-12/gomoku-stone-grounded-mobile.png`
剩余风险：Layer 12 已按用户实机确认验收；玩家对战、训练、复盘、PWA 嵌入、后端 API 和持久化仍不属于本层范围。

## 2026-07-10 / 五子棋模型按 G 加载

现象：五子棋棋盘在未按 `G` 前不存在于世界中，但旧组件在页面启动时已经执行三个 `useGLTF`，使棋盘和黑白棋子进入全量首屏下载清单。

解决方案：新增不依赖 GLB 的 `GomokuBoardActivation`，在棋盘未展开时只监听 `G` 并计算摆放位置；产生 placement 后才挂载原 `GomokuWorldBoard`，由其下载棋盘和黑白棋子。加载期间保留“棋盘正在展开”HUD，模型完成后出现真实棋盘。

涉及文件：`app/nav-world/src/modules/gomoku/GomokuWorldBoard.tsx`、`app/nav-world/src/world/WorldScene.tsx`、`app/nav-world/src/assets/worldAssetManifest.ts`。

验证结果：TypeScript 和生产构建通过；未运行 Playwright。

画面变化：未按 `G` 时无棋盘；首次按 `G` 后可能出现短暂加载提示，再显示棋盘。已展开后的移动、收回和棋局状态仍由原组件处理。

剩余风险：首次按 `G` 的加载过渡需要用户实机确认；三个模型合计很小，预计只产生短暂停顿。
