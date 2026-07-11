# Layer 7 调试记录

本文件只记录 Layer 7：实验室模拟层 的问题、原因判断、解决方案和验证结果。不要记录 secret、token、私钥、密码或内部敏感地址。

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

## 2026-07-09 / PR #3 game 合入后审计

日期：2026-07-09

版本 / Layer：Layer 7 世界内游戏入口，PR #3 `game -> main`

现象：`game` PR 已被自动合并到 `main`，尚未经过本地审计。检查发现 `app/nav-world/public/game/shadow-game.html` 通过 `unpkg.com` 加载 Three.js 和 addons，游戏入口依赖外部 CDN，且远端脚本会在同源 iframe 中执行。

原因判断：`shadow-game.html` 是放在 `public/` 下的独立静态游戏页，没有经过主 Vite 应用打包，因此原实现用 importmap 从 CDN 取 `three`、`OrbitControls` 和 `GLTFLoader`。这会让离线 / 国内网络环境下游戏不可用，也扩大了外部脚本信任范围。

解决方案：从项目锁定依赖 `node_modules/three` 复制 `three.module.js`、`OrbitControls.js`、`GLTFLoader.js` 及其必要 utils 到 `app/nav-world/public/vendor/three/`，并保留 Three.js MIT license；将游戏页 importmap 改为加载本项目静态 vendor 路径。

涉及文件：`app/nav-world/public/game/shadow-game.html`、`app/nav-world/public/vendor/three/`、`validation/layer-7/debug.md`、`MEMORY.md`。

验证结果：`npm run build` 和 `npm run assets:check` 通过；`game` 合入后的主线未发现类型检查或构建阻断问题。

画面变化：否。游戏入口加载来源改变，但 UI 和玩法不变。

截图：本轮未新增截图；这是合入后安全和可用性审计修复，使用构建和静态检查替代。

剩余风险：未做自动化游戏 iframe 玩法通关测试；`shadow-game.html` 仍是独立静态页，后续如继续扩展，建议逐步迁入 Vite 模块或补专门 e2e。
日期：2026-07-09
版本 / Layer：Layer 7 资源复用评估（由原 Layer 6 记录更正）
现象：用户要求评估 `resources/gomoku-ai-academy-submission/` 中的代码是否能在实验室模拟层复用；此前因 Layer 6 / Layer 7 编号写反，记录到了 `validation/layer-6/debug.md`。
原因判断：该包是五子棋 AI 课程展示产品，核心能力是五子棋对弈、训练、复盘、PWA / 桌面包装和 AI Worker；不包含 WebRTC 大屏、RDK 展示台、门禁控制台或设备状态模拟。
解决方案：Layer 7 实验室模拟层不复用此包；实验室模拟层继续按独立的 WebRTC 占位画面、RDK 静态 / 模拟模型和门禁状态机实现。
涉及文件：`resources/gomoku-ai-academy-submission/README.md`、`resources/gomoku-ai-academy-submission/iphone/index.html`、`resources/gomoku-ai-academy-submission/iphone/ai_worker.js`
验证结果：已阅读目录结构和 README；`python3 -m py_compile` 对核心 Python 文件通过；`node --check` 对 `iphone/ai_worker.js` 和 `iphone/sw.js` 通过；未运行未知服务或脚本。
画面变化：否。
截图：无，代码评估不涉及用户可见画面。
剩余风险：Layer 7 后续仍需单独设计实验室模拟数据、屏幕动画、门禁确认流程和 RDK 模型占位。

日期：2026-07-09
版本 / Layer：Layer 7 用户验收确认（由原 Layer 6 记录更正）
现象：用户此前明确表示实验室模拟层确认验收；当时因 Layer 6 / Layer 7 编号写反，记录为 “Layer 6 用户验收确认”。
原因判断：Layer 6 / Layer 7 编号更正后，实验室模拟层归属 Layer 7；原验收事实不变，只需要修正归档编号。
解决方案：在 `VALIDATION_LAYERS.md` 的 Layer 7 段落补充用户实机确认记录，并在长期记忆中把实验室模拟层验收归属改为 Layer 7。
涉及文件：`VALIDATION_LAYERS.md`、`validation/layer-7/debug.md`、`MEMORY.md`
验证结果：文档记录已更新；本次只修正用户验收状态归属，不涉及代码或构建产物变更。
画面变化：否。
截图：无，本次为验收记录编号纠正，不改变用户可见画面。
剩余风险：Layer 7 验收不代表真实 WebRTC、RDK、IoT 服务已接入；真实能力仍按后续 Layer 分别推进。

日期：2026-07-09
版本 / Layer：Layer 7 / Layer 6 编号纠正
现象：用户指出此前 Layer 6 和 Layer 7 写反，导致实验室模拟层和世界内五子棋模拟层在事实来源和 debug 归档里互换。
原因判断：`VALIDATION_LAYERS.md`、`validation/layer-6/debug.md`、`validation/layer-7/debug.md`、`MEMORY.md`、`Tech-Spec.md` 和 Layer 8 协作材料中存在跟随旧编号的描述。
解决方案：将 Layer 7 更正为实验室模拟层；将世界内五子棋模拟层归为 Layer 6；保留实验室资源评估和验收事实，只改编号归属。
涉及文件：`VALIDATION_LAYERS.md`、`validation/layer-6/debug.md`、`validation/layer-7/debug.md`、`MEMORY.md`、`Tech-Spec.md`、`validation/layer-8/debug.md`、`validation/layer-8/fortune-handoff.md`
验证结果：本次为文档编号纠正；已通过 `rg` 检查 Layer 6 / Layer 7 引用，未发现仍把 Layer 6 写成实验室或把 Layer 7 写成五子棋的旧口径。
画面变化：否。
截图：无，本次不改变用户可见画面。
剩余风险：本次没有重新运行实验室模拟层，也没有新增截图；验收事实沿用用户实机确认。

日期：2026-07-09
版本 / Layer：Layer 7 空中实验室玻璃地板资产
现象：用户提供 `resources/laboratory/sci-_fi__future_building_2_simple_dome.glb` 作为实验室顶盖，并计划制作可俯瞰整个世界的空中实验室；当前需要先生成实验室玻璃地板 GLB。
原因判断：顶盖资源包围盒约为直径 `4.13m`、高度 `2.04m`，第一版地板应略大于顶盖底部并保留可重复生成脚本，避免只提交不可追溯二进制模型。
解决方案：新增 `app/nav-world/scripts/generate-laboratory-models.mjs`，生成 `app/nav-world/public/models/laboratory/glass_floor.glb`。模型半径约 `2.24m`，包含透明蓝色玻璃盘面、深色金属支撑框架和青色发光导引线；新增 `assets:laboratory:generate`、`assets:laboratory:check`、`assets:laboratory:validate` 命令，并忽略构建输出 `app/frontend/models/laboratory/*.glb`。
涉及文件：`app/nav-world/scripts/generate-laboratory-models.mjs`、`app/nav-world/public/models/laboratory/glass_floor.glb`、`app/nav-world/package.json`、`.gitignore`、`MEMORY.md`、`validation/layer-7/debug.md`
验证结果：`npm run assets:laboratory:generate` 通过；`npm run assets:laboratory:check` 通过；`npm run assets:laboratory:validate` 通过且无 errors / warnings / infos / hints；`npx gltf-transform inspect public/models/laboratory/glass_floor.glb` 显示包围盒约 `[-2.24, -0.09, -2.24]` 到 `[2.24, 0.035, 2.24]`、3 个 mesh、3 个 material，玻璃材质为 `BLEND`；`npm run build` 通过。
画面变化：否，本次只生成资产和脚本，未接入世界场景渲染。
截图：无；模型尚未接入可见场景，且本次不改变用户可见画面。
剩余风险：尚未和顶盖模型在世界中合体预览，透明玻璃在实际光照、排序和俯瞰视角下的视觉效果仍需后续接入场景后由用户实机确认。

日期：2026-07-09
版本 / Layer：Layer 7 空中实验室摆放与传送台放大
现象：用户要求把实验室放在岛上方、视野良好，并在空中实验室正中心和正下方岛面各放一个 `resources/laboratory/sci-fi_teleporter.glb` 传送台；随后指出传送台太小，需要能容纳真人，并说明已有白粉色人形作为比例参考。
原因判断：原实验室仍是岛面盒子占位，不符合空中实验室设想；传送台初始显示比例 `0.42` 视觉上偏小，和已有 `playerSpawn.height = 1.72` 的人形参考不匹配。
解决方案：新增 `LaboratoryAerialStage`，用 `dome.glb`、`glass_floor.glb` 和 `teleporter.glb` 替换旧实验室盒子占位；实验室锚点移到 `[12, 22, 25]`，地面传送台保留在正下方 `[12, 1.74, 25]`；实验室交互近距离提示绑定到地面传送台，准星目标指向空中实验室；传送台显示比例从 `0.42` 调到 `0.65`，不新增人形参考，继续使用现有白粉色人形参考。
涉及文件：`app/nav-world/src/modules/laboratory/LaboratoryAerialStage.tsx`、`app/nav-world/src/world/sceneConfig.ts`、`app/nav-world/src/world/WorldScene.tsx`、`app/nav-world/src/world/InteractionSystem.tsx`、`app/nav-world/scripts/generate-laboratory-models.mjs`、`app/nav-world/package.json`、`.gitignore`、`MEMORY.md`、`validation/layer-7/debug.md`
验证结果：`npm run assets:laboratory:generate` 通过；`npm run assets:laboratory:check` 通过；`npm run assets:laboratory:validate` 通过，外部 GLB 仅有上游资源的 unused TEXCOORD info，无 errors / warnings；`npm run build` 通过，仍有既有大 chunk 警告。
画面变化：是，实验室从岛面盒子变为空中实验室，地面和空中各有一个更大传送台。
截图：未归档最终截图；用户明确本次由实机验证比例，且此前自动化截图角度未能稳定拍到空中实验室，过期截图已删除。
剩余风险：空中高度、传送台大小和顶盖 / 地板视觉关系仍以用户实机验证为准；当前只完成摆放和比例修正，没有实现真实传送、碰撞或进入空中平台。

日期：2026-07-09
版本 / Layer：Layer 7 空中实验室二次放大
现象：用户继续反馈需要“传送台放大到原来的两倍，顶盖和地板放大到原来的四倍”。
原因判断：上一版传送台 `0.65`、顶盖 / 地板 `1` 仍不能满足实机比例预期；现有白粉色人形已经提供真人尺度参照，不需要新增额外人形。
解决方案：将 `teleporterScale` 从 `0.65` 调到 `1.3`；新增 `laboratoryShellScale = 4`，同时作用于 `dome.glb` 和 `glass_floor.glb`；按放大后的模型底部重新计算顶盖和传送台落地高度；将实验室交互准星半径从 `3.2` 调到 `11`，地面传送台靠近半径从 `5.6` 调到 `9.5`。
涉及文件：`app/nav-world/src/modules/laboratory/LaboratoryAerialStage.tsx`、`app/nav-world/src/world/InteractionSystem.tsx`、`MEMORY.md`、`validation/layer-7/debug.md`
验证结果：`npm run assets:laboratory:check` 通过；`npm run build` 通过，仍有既有大 chunk 警告。
画面变化：是，两个传送台、空中顶盖和玻璃地板明显放大。
截图：未截图；用户明确由实机验证比例。
剩余风险：最终比例、空中平台高度和远近视野仍以用户实机确认作为验收依据；当前仍未实现传送或空中平台碰撞。

日期：2026-07-09
版本 / Layer：Layer 7 空中实验室高度和半径三次调整
现象：用户要求实验室高度再高一倍，半径为当前的 `1.5` 倍，传送台变为当前的 `1.5` 倍。
原因判断：当前空中实验室仍需要更高、更大的俯瞰感；地板 / 顶盖和传送台继续按显示比例调参即可，不需要改 GLB 源资产。
解决方案：将实验室锚点从 `[12, 22, 25]` 调到 `[12, 44, 25]`；将 `laboratoryShellScale` 从 `4` 调到 `6`；将 `teleporterScale` 从 `1.3` 调到 `1.95`；同步把地面传送台靠近半径调到 `14`、空中实验室准星半径调到 `16.5`。
涉及文件：`app/nav-world/src/modules/laboratory/LaboratoryAerialStage.tsx`、`app/nav-world/src/world/sceneConfig.ts`、`app/nav-world/src/world/InteractionSystem.tsx`、`MEMORY.md`、`validation/layer-7/debug.md`
验证结果：`npm run assets:laboratory:check` 通过；`npm run build` 通过，仍有既有大 chunk 警告。
画面变化：是，空中实验室高度翻倍，地板 / 顶盖半径和两个传送台继续放大。
截图：未截图；用户明确由实机验证比例。
剩余风险：最终空中高度、远景可见性、平台和传送台比例仍以用户实机验证为准；当前仍未实现传送或空中平台碰撞。

日期：2026-07-09
版本 / Layer：Layer 7 传送台大门朝向
现象：用户要求传送台的大门正对出生点。
原因判断：传送台模型默认朝向不一定与世界出生点方向一致；地面和空中传送台都应以出生点作为视觉入口方向，避免入口背对玩家初始路径。
解决方案：在 `LaboratoryAerialStage` 中根据传送台世界坐标和 `playerSpawn.position` 计算 yaw，并按模型本地 `+X` 作为大门默认正面旋转两个传送台。
涉及文件：`app/nav-world/src/modules/laboratory/LaboratoryAerialStage.tsx`、`MEMORY.md`、`validation/layer-7/debug.md`
验证结果：`npm run build` 通过，仍有既有大 chunk 警告。
画面变化：是，两个传送台仅改变朝向，不改变大小和位置。
截图：未截图；继续由用户实机验证朝向。
剩余风险：如果该 GLB 实际大门默认方向不是本地 `+X`，实机看起来可能会差 `180°` 或 `90°`，届时只需要调整基础朝向偏移量。

日期：2026-07-09
版本 / Layer：Layer 7 传送台和实验室边框碰撞体积
现象：用户要求给传送台和实验室边框加碰撞体积。
原因判断：实验室资源是外部 GLB，直接逐三角碰撞成本高且不稳定；当前玩家移动系统本来只依赖地形高度采样，缺少对世界内大型模型边框和传送台框架的水平阻挡。
解决方案：新增 `worldColliders.ts`，用数学环形碰撞体描述地面传送台、空中传送台和空中实验室边框；两个传送台中心保留可进入空间，环形框架阻挡玩家穿过；实验室边框阻挡玩家穿过平台外圈；在 `PlayerController` 候选移动位置落地前调用 `isWorldMovementBlocked()`。
涉及文件：`app/nav-world/src/world/worldColliders.ts`、`app/nav-world/src/world/PlayerController.tsx`、`MEMORY.md`、`validation/layer-7/debug.md`
验证结果：`npm run assets:laboratory:check` 通过；`npm run build` 通过，仍有既有大 chunk 警告。
画面变化：否，新增的是不可见碰撞体积；用户可感知变化是移动时会被传送台环形框架和空中实验室边框挡住。
截图：无；不可见碰撞体积截图无法直接体现，继续由用户实机验证移动阻挡。
剩余风险：当前只实现玩家水平移动阻挡；没有实现真实传送、没有实现空中平台可踩地面采样，也没有把传送台中心区域作为传送触发器。

日期：2026-07-09
版本 / Layer：Layer 7 传送台入口碰撞修复
现象：用户反馈走不上地面传送台，截图显示玩家正对传送台台阶和入口但被阻挡。
原因判断：上一版传送台碰撞体是完整环形体，虽然中心区域可进入，但正对出生点的入口 / 台阶方向也被环形框架挡住，玩家无法从正门走进中心。
解决方案：为传送台环形碰撞体增加 `openingCenterAngle` 和 `openingHalfAngle`；开口方向按传送台中心指向 `playerSpawn.position` 计算，当前开口半角为 `Math.PI / 3`，正门方向留出约 120 度通道；空中实验室边框仍保持完整环形碰撞。
涉及文件：`app/nav-world/src/world/worldColliders.ts`、`MEMORY.md`、`validation/layer-7/debug.md`
验证结果：`npm run build` 通过，仍有既有大 chunk 警告。
画面变化：否；用户可感知变化是可从正对出生点的台阶 / 入口方向走进传送台中心。
截图：未截图；由用户实机验证是否能走上去。
剩余风险：如果入口仍偏窄，可继续增大 `teleporterDoorOpeningHalfAngle`；如果仍无法上台阶，则下一步需要给传送台中心和台阶增加可踩地面采样，而不只是水平碰撞放行。

日期：2026-07-09
版本 / Layer：Layer 7 地面传送台台阶可踩表面
现象：用户反馈已经能从入口走进传送台，但走上去会穿模；截图显示玩家位于传送台前门 / 内部平台附近，脚下高度仍像贴着岛面，没有按传送台台阶逐级抬升。
原因判断：上一版只解决了水平碰撞开口，玩家移动候选点仍从岛屿地形采样高度；传送台 GLB 没有被加入玩家可踩地面采样，所以视觉上进入模型后会穿进台阶和平台。
解决方案：在 `worldColliders.ts` 中新增 `sampleLaboratorySurface()`，按地面传送台朝向把世界坐标转换到传送台本地坐标，并使用从 `teleporter.glb` 前门方向只读采样得到的阶梯高度剖面，返回分级可踩面；在 `WorldExperience.tsx` 的世界地形采样链中先叠加实验室传送台表面，再叠加五子棋可踩表面。
涉及文件：`app/nav-world/src/world/worldColliders.ts`、`app/nav-world/src/world/WorldExperience.tsx`、`MEMORY.md`、`validation/layer-7/debug.md`
验证结果：`npm run assets:laboratory:check` 通过；`npm run build` 通过；`localhost:4177` 端口仍由本地 Vite preview 监听，刷新页面后可读取新的构建产物。
画面变化：没有改变 GLB 外观；用户可感知变化是走正门台阶时玩家高度会按分级表面抬升，不再贴岛面穿进传送台。
截图：未截图；本次属于模型摆位 / 移动手感微调，按用户此前要求由用户实机验证，Codex 侧用资源检查和构建验证兜底。
剩余风险：当前是按 GLB 只读采样结果做的轻量阶梯剖面，不是运行时逐三角 mesh 碰撞；如果某个边缘位置仍与视觉模型不贴合，下一步应把传送台 mesh 注册为真实 raycast 可踩面。空中实验室地板暂未全局加入地形采样，避免玩家在岛面经过实验室正下方时被错误抬到空中。

日期：2026-07-09
版本 / Layer：Layer 7 传送台空气墙范围缩小
现象：用户反馈传送台附近走着走着会撞到空气墙，要求空气墙范围缩小到刚好包围传送台。
原因判断：上一版传送台碰撞体是圆形环，外半径按前后长度取值，导致左右侧也使用同样半径；传送台 GLB 实际前后长、左右窄，圆形宽环会在侧面生成比可见模型大很多的不可见碰撞范围。同时环宽过厚，使台面内部可行走区域被不必要地阻挡。
解决方案：将地面和空中传送台碰撞体从宽圆环改为薄椭圆外圈；外圈 X / Z 分别按 `teleporter.glb` 包围盒前后半径和左右半径计算，内圈只向内收窄 `0.28` 个模型单位，保留入口开口和大部分台面可走空间；空中实验室平台边框继续使用圆环碰撞。
涉及文件：`app/nav-world/src/world/worldColliders.ts`、`MEMORY.md`、`validation/layer-7/debug.md`
验证结果：`npm run assets:laboratory:check` 通过；`npm run build` 通过，仍有既有大 chunk 警告。
画面变化：没有改变 GLB 外观；用户可感知变化是传送台侧面和台面内部的不可见阻挡明显收窄，碰撞更贴近可见外框。
截图：未截图；本次为碰撞范围和移动手感微调，按用户此前要求由用户实机验证，Codex 侧用资源检查和构建验证兜底。
剩余风险：当前仍是轻量数学碰撞体，不是逐三角 mesh 碰撞；如果边框局部还不够贴合，下一步应为传送台外框注册更细的多段碰撞或真实 mesh raycast。

日期：2026-07-09
版本 / Layer：Layer 7 实验室传送台 Space / Ctrl 传送
现象：用户要求站在下面的传送台上按 `Space` 传送到上面，按 `Ctrl` 从上面传送回下面；同时需要传送后稳定站在目标传送台上。
原因判断：原玩家控制器中 `Space` 只进入跳跃缓冲，`Ctrl` 没有实验室语义；地形采样只用 `x/z`，此前为了避免岛面正下方被吸到空中，没有把空中实验室地板加入全局采样，因此必须在传送时同时引入参考高度区分上下两层。
解决方案：扩展 `TerrainSampler.sampleGround(x, z, referenceY?)`；玩家采样时传入当前 / 候选脚底高度；`sampleLaboratorySurface()` 根据 `referenceY` 返回地面传送台、空中传送台或空中实验室玻璃地板表面；新增 `getLaboratoryTeleportTarget()`，在地面中心平台按 `Space` 返回空中中心平台目标点，在空中中心平台按 `Ctrl` 返回地面中心平台目标点；传送成功后清空水平速度、垂直速度、跳跃缓冲和移动输入，保留视角；更新实验室近距离提示文案。
涉及文件：`app/nav-world/src/world/worldColliders.ts`、`app/nav-world/src/world/terrainSampler.ts`、`app/nav-world/src/world/WorldExperience.tsx`、`app/nav-world/src/world/PlayerController.tsx`、`app/nav-world/src/world/InteractionSystem.tsx`、`MEMORY.md`、`validation/layer-7/debug.md`
验证结果：`npm run assets:laboratory:check` 通过；`npm run build` 通过，仍有既有大 chunk 警告。
画面变化：没有新增或改变 GLB 外观；用户可感知变化是地面 / 空中传送台增加 `Space` / `Ctrl` 传送，且空中平台可稳定站立。
截图：未截图；本次属于交互逻辑和移动手感调整，按用户此前要求由用户实机验证，Codex 侧用资源检查和构建验证兜底。
剩余风险：当前传送没有动画、音效或冷却时间；传送判定只覆盖传送台中心平台，不覆盖整个外圈台面。空中地板仍使用轻量数学采样，不是逐三角 mesh 地形。

日期：2026-07-09
版本 / Layer：Layer 7 空中实验室头部穿出玻璃修复
现象：用户反馈当前头模 / 第一人称相机能从空中实验室玻璃边界探出去，希望“稍微收缩一点”，让头能被玻璃挡住。
原因判断：上一版空中实验室可踩半径和边框碰撞内沿基本贴近地板内圈；玩家脚下会被边缘挡住，但第一人称头部 / 相机仍能贴近斜玻璃外侧，视觉上像头穿出玻璃。
解决方案：在 `worldColliders.ts` 的空中实验室内圈半径计算中增加 `laboratoryHeadClearanceInset = 1.05`，同步收缩空中地板可踩范围和边框碰撞内沿。GLB 模型大小不变，只让玩家更早被边界挡住。
涉及文件：`app/nav-world/src/world/worldColliders.ts`、`MEMORY.md`、`VALIDATION_LAYERS.md`、`validation/layer-7/debug.md`
验证结果：`npm run assets:laboratory:check` 通过；`npm run build` 通过，仍有既有大 chunk 警告。
画面变化：没有改变 GLB 外观；用户可感知变化是空中实验室边缘更早阻挡玩家，头模 / 相机不应再从玻璃外穿出。
截图：未截图；本次属于模型碰撞和移动手感微调，按用户此前要求由用户实机验证，Codex 侧用资源检查和构建验证兜底。
剩余风险：当前仍是轻量数学碰撞，不是逐三角玻璃 mesh 碰撞；如果极端角度仍能探出头，下一步应继续增加内缩量，或按玻璃分段注册更贴近模型的碰撞体。

日期：2026-07-09
版本 / Layer：Layer 7 天空实验室大屏替换
现象：用户要求去掉旧大屏幕和小蓝球，改成一个正对实验室传送台的大屏幕；屏幕最上面一栏居中写“天空实验室”，下面准备接入视频流，标题写“链接外部世界”。
原因判断：旧大屏来自 `WorldModulePanels` 的实验室模块面板，位置和内容仍是 Layer 4 模块外壳验证口径；小蓝球来自 `InteractionSystem` 的实验室可见瞄准标记。进入空中实验室后，这两者会干扰新的实验室空间陈设。
解决方案：在 `LaboratoryAerialStage` 中新增 `SkyLaboratoryScreen`，放在空中实验室边缘并让屏幕正面朝向中心传送台；屏幕顶部栏显示“天空实验室”，视频流预留区域标题显示“链接外部世界”。隐藏实验室旧模块面板，去掉实验室可见小蓝球标记，并同步更新实验室 HUD / 交互文案。
涉及文件：`app/nav-world/src/modules/laboratory/LaboratoryAerialStage.tsx`、`app/nav-world/src/modules/WorldModulePanels.tsx`、`app/nav-world/src/modules/moduleRegistry.ts`、`app/nav-world/src/world/InteractionSystem.tsx`、`app/nav-world/src/world/WorldExperience.tsx`、`TODO.md`、`MEMORY.md`、`validation/layer-7/debug.md`
验证结果：`npm run assets:laboratory:check` 通过；`npm run build` 通过，仍有既有大 chunk 警告。
画面变化：是；空中实验室不再显示旧模块面板和小蓝球，改为一块正对中心传送台的静态视频流预留大屏。
截图：未截图；本次属于实验室模型摆放 / 文案微调，按用户此前要求由用户实机验证，Codex 侧用资源检查和构建验证兜底。
剩余风险：当前大屏是静态占位，不包含真实 WebRTC 视频纹理、放大查看、连接状态或权限状态；这些仍属于后续 WebRTC 接入层。

日期：2026-07-09
版本 / Layer：Layer 7 天空实验室浅色屏幕与坐标参考
现象：用户要求屏幕改成浅色调，并在实验室里面打坐标。
原因判断：上一版屏幕为深色科技屏，和用户期望的浅色调不一致；实验室内部后续还会继续摆放屏幕、视频流、RDK 展示或控制台，需要局部坐标参考来快速沟通位置。
解决方案：将 `SkyLaboratoryScreen` 的主面板、标题栏、视频流槽位和边框改为浅蓝白色系；新增 `LaboratoryCoordinateGuide`，以空中实验室中心传送台为局部原点，在地板上显示 X / Z 轴、`2m` 间隔刻度、正负方向和“中心 X0 Z0”标签。
涉及文件：`app/nav-world/src/modules/laboratory/LaboratoryAerialStage.tsx`、`MEMORY.md`、`validation/layer-7/debug.md`
验证结果：`npm run assets:laboratory:check` 通过；`npm run build` 通过，仍有既有大 chunk 警告。
画面变化：是；天空实验室屏幕从深色改为浅色，实验室地板上出现局部坐标参考。
截图：未截图；本次属于实验室模型摆放 / 视觉微调，按用户此前要求由用户实机验证，Codex 侧用资源检查和构建验证兜底。
剩余风险：坐标参考是临时调试视觉层，不影响碰撞或传送；如果后续正式展示不需要坐标，应在验收后移除或改成可开关。

日期：2026-07-09
版本 / Layer：Layer 7 天空实验室大屏位置调整
现象：用户要求把屏幕挪到实验室局部坐标 `x = -6, z = 6` 的位置，并正对传送台。
原因判断：上一版屏幕位于 `Z=-8.45` 一侧；新增坐标参考后，用户指定了更明确的内部摆位坐标。屏幕在 `X=-6, Z=6` 时不能继续使用默认朝向，否则正面不会对准中心传送台。
解决方案：将 `skyLaboratoryScreenPosition` 改为 `[-6, 3.45, 6]`；新增 `skyLaboratoryScreenRotation`，绕 Y 轴旋转 `3π/4`，让屏幕正面朝向中心传送台。
涉及文件：`app/nav-world/src/modules/laboratory/LaboratoryAerialStage.tsx`、`MEMORY.md`、`validation/layer-7/debug.md`
验证结果：`npm run assets:laboratory:check` 通过；`npm run build` 通过，仍有既有大 chunk 警告。
画面变化：是；天空实验室大屏移动到局部 `X=-6, Z=6`，并朝向中心传送台。
截图：未截图；本次属于实验室模型摆放微调，按用户此前要求由用户实机验证，Codex 侧用资源检查和构建验证兜底。
剩余风险：屏幕是否被顶盖支柱、边框或玩家视角遮挡仍需用户实机确认；如遮挡，可继续按坐标微调。

日期：2026-07-09
版本 / Layer：Layer 7 天空实验室大屏自动朝向
现象：用户询问屏幕和传送台是否正对；基于截图判断当前大致朝向正确，但严格正对关系应由代码自动计算，而不是手写 `3π/4`。
原因判断：屏幕位置后续会继续按局部 X / Z 坐标微调；如果朝向角度继续手写，每次移动都容易出现轻微偏差或忘记同步旋转。
解决方案：新增 `getYawForLocalPositiveZToFace()`，按屏幕当前位置和中心传送台目标点计算 yaw；`skyLaboratoryScreenRotation` 改为由该函数生成，屏幕本地 `+Z` 正面始终指向中心传送台。
涉及文件：`app/nav-world/src/modules/laboratory/LaboratoryAerialStage.tsx`、`MEMORY.md`、`validation/layer-7/debug.md`
验证结果：`npm run assets:laboratory:check` 通过；`npm run build` 通过，仍有既有大 chunk 警告。
画面变化：理论上当前坐标下朝向数值仍等价于 `3π/4`，画面只应有极小或无可见变化；后续调整屏幕坐标时会自动保持正对传送台。
截图：未截图；本次属于朝向计算逻辑修正，按用户此前要求由用户实机验证，Codex 侧用资源检查和构建验证兜底。
剩余风险：如果用户站位不在传送台中心，透视上仍可能看起来不是完全正面；最终判断应以屏幕中心法线指向传送台中心为准。

日期：2026-07-09
版本 / Layer：Layer 7 天空实验室 WebRTC 视频纹理接入
现象：用户要求参考 `/home/tang/sites/iot` 的 WebRTC 拉流能力，把流接近实验室屏幕里；`iot` 当前 Armbot 控制台只把 `/webrtc/robot001/` 放进 iframe，没有可直接复用的 `RTCPeerConnection` / `MediaStream` 客户端。
原因判断：iframe 页面不能直接作为 Three.js `VideoTexture`；实验室大屏需要独立适配层拿到 `MediaStream`，再绑定隐藏 `video` 元素并生成视频纹理。真实信令协议尚未在 `iot` 仓库中出现，因此必须保留 mock / offline 降级，避免没有推流服务时破坏大世界。
解决方案：新增 `webrtcClient.ts`，默认使用 mock canvas 动态测试流，并支持通过 `VITE_LAB_WEBRTC_MODE=whep`、`VITE_LAB_WEBRTC_SIGNALING_URL`、`VITE_LAB_WEBRTC_STREAM_ID` 启用 WHEP / offer-answer 真实流；新增 `LaboratoryWebRtcScreen`，将 `MediaStream` 绑定到隐藏 `video`，再创建 `VideoTexture` 贴到天空实验室大屏中间槽位；连接中、在线、离线、无权限和错误状态均在屏幕内显示。
涉及文件：`app/nav-world/src/adapters/webrtcClient.ts`、`app/nav-world/src/modules/laboratory/LaboratoryWebRtcScreen.tsx`、`app/nav-world/src/modules/laboratory/LaboratoryAerialStage.tsx`、`app/nav-world/src/world/WorldExperience.tsx`、`app/nav-world/src/world/InteractionSystem.tsx`、`app/nav-world/src/modules/moduleRegistry.ts`、`TODO.md`、`MEMORY.md`、`validation/layer-7/debug.md`
验证结果：`npm run assets:laboratory:check` 通过；`npm run build` 通过，仍有既有大 chunk 警告；`git diff --check` 通过；本地 Vite preview 仍监听 `0.0.0.0:4177`。
画面变化：是；天空实验室大屏不再只是静态浅色槽位，默认显示动态 mock 视频纹理；真实流配置后会走同一块屏幕材质。
截图：未截图；本次属于实验室屏幕动态内容接入，按用户此前要求由用户实机验证，Codex 侧用资源检查、类型检查和构建验证兜底。
剩余风险：真实 WHEP 服务当前未在本机监听，也未在 `iot` 仓库中发现明确服务端实现；真实流上线前需要提供信令 URL、流标识、权限错误码和 ICE 配置。当前未实现大屏放大查看，仍按后续任务推进。

日期：2026-07-09
版本 / Layer：Layer 7 天空实验室视频槽位 16:9 比例调整
现象：用户询问当前屏幕比例是否放得下 720p 视频，并要求把模拟视频流区域拉高，让视频比例正确。
原因判断：上一版视频槽位宽高为 `7.22m x 2.88m`，比例约 `2.51:1`，会把 720p / 16:9 画面横向拉伸。
解决方案：保持视频槽位宽度 `7.22m` 不变，按 `16:9` 计算高度为 `4.06125m`；将大屏整体高度从 `4.6m` 增到 `6m`，并把“链接外部世界”标题和分隔线抬到视频槽位上方，避免文字压到视频画面里。
涉及文件：`app/nav-world/src/modules/laboratory/LaboratoryAerialStage.tsx`、`MEMORY.md`、`validation/layer-7/debug.md`
验证结果：视频槽位计算结果为 `7.22m x 4.06125m`，比例 `1.777777777777778`；`npm run assets:laboratory:check` 通过；`npm run build` 通过，仍有既有大 chunk 警告。
画面变化：是；天空实验室大屏和中间模拟视频流区域变高，720p / 16:9 画面不再被横向拉伸。
截图：未截图；本次属于实验室屏幕比例微调，按用户此前要求由用户实机验证，Codex 侧用尺寸计算、资源检查和构建验证兜底。
剩余风险：大屏变高后是否被顶盖支柱或用户常用视角遮挡仍需实机目检；如遮挡，可继续调整屏幕局部坐标或垂直位置。

日期：2026-07-09
版本 / Layer：Layer 7 真实 MediaMTX WHEP 接入
现象：用户要求找到 `/webrtc/robot001/` 背后的真实 WebRTC 拉流协议，并让实验室大屏直接连接该接口拿 `MediaStream`。
原因判断：`/home/tang/sites/iot` 本地仓库只有 iframe 入口；在 `sh_vps` 的 `/var/www/sites/iot` 和 Nginx 配置中确认真实路径为 `iot.gluepudding.com/webrtc/robot001/`，其 Nginx `location ^~ /webrtc/` 鉴权后重写到 `127.0.0.1:8889`。`8889` 监听进程为 `mediamtx`，`/robot001/` 页面内置 `reader.js` 使用 `new URL("whep", window.location.href)`，实际拉流端点为 `/robot001/whep`。MediaMTX 的 WHEP reader 会先 `OPTIONS` 获取 `Link` ICE server，再 `POST` SDP，保存 `Location` session，后续 ICE candidate 使用 `PATCH application/trickle-ice-sdpfrag`，关闭时 `DELETE`。
解决方案：在 `gluepudding` 生产 Nginx 增加 `/lab-webrtc/` 同源代理，使用 `armbot` 权限鉴权后反代到 `127.0.0.1:8889`，未登录 / 无权限直接返回 `401/403`，避免前端把登录页 HTML 当作 SDP answer。将 `webrtcClient.ts` 的 WHEP 实现从一次性 `POST` 扩展为 MediaMTX 完整流程：`OPTIONS` 读取 ICE servers、`POST` offer 接收 `201 + Location + SDP answer`、保存 session URL、候选通过 `PATCH` 发送、断开时 `DELETE` session；`404` 或 “no stream is available” 映射为“视频流离线”。
涉及文件：`app/nav-world/src/adapters/webrtcClient.ts`、`TODO.md`、`MEMORY.md`、`validation/layer-7/debug.md`；远端配置：`/etc/nginx/sites-available/gluepudding`
验证结果：`npm run assets:laboratory:check` 通过；首次 `npm run build` 因当前 TypeScript lib 不支持 `RTCIceServer.credentialType` 失败，已移除该非必要字段，重新运行 `npm run build` 通过，仍有既有大 chunk 警告；`git diff --check` 通过；远端 `sudo nginx -t` 通过并已 reload；远端 `curl -X OPTIONS http://127.0.0.1:8889/robot001/whep` 返回 `204`、`Accept-Post: application/sdp` 和 `PATCH/DELETE` 能力；公网未登录访问 `https://gluepudding.com/lab-webrtc/robot001/whep` 返回 `401`。
画面变化：没有改变屏幕模型外观；用户可感知变化是配置真实 WHEP 后实验室大屏可走真实 `MediaStream`，无权限显示无权限，`robot001` 未推流时显示离线。
截图：未截图；本次主要是信令和 Nginx 接入，真实推流源当前离线，且用户此前要求这类实验室实机画面由用户验证；Codex 侧用构建、资源检查和远端 HTTP / Nginx 验证兜底。
剩余风险：当前没有在线 `robot001` 推流源，无法在 Codex 侧看到真实视频画面；生产构建需要设置 `VITE_LAB_WEBRTC_MODE=whep`、`VITE_LAB_WEBRTC_SIGNALING_URL=/lab-webrtc/{streamId}/whep`、`VITE_LAB_WEBRTC_STREAM_ID=robot001`，否则仍会使用本地默认 mock 流。

## 2026-07-11 / 真实流首帧与视频纹理稳定性修复

现象：用户反馈实验室大屏无法显示真实推流。MediaMTX 日志确认浏览器 WHEP PeerConnection 已建立并开始读取 `robot001` 的 H.264 track，但旧实现收到 track 后立即标记“实时视频流”，完全脱离 DOM 的临时 `video` 没有稳定产出可供 Three.js 使用的首帧。

原因判断：`robot001` 推流源、MediaMTX、WHEP 信令和 ICE 均正常；真实源为 1280×720、H.264 High Profile Level 3.1。断点位于浏览器媒体轨道到视频纹理之间：旧实现只监听 detached video 的 metadata / canplay 事件，没有把“首个已解码视频帧”作为在线条件，也没有单独的解码超时重连。

解决方案：将专用 `video` 挂载到 `document.body` 的视口外位置，保持 `autoplay + muted + playsInline`；同时监听 `loadedmetadata`、`loadeddata`、`canplay`、`playing`、`resize` 和 `requestVideoFrameCallback`。只有 `readyState >= HAVE_CURRENT_DATA` 且分辨率非零后才创建 `VideoTexture` 并显示“实时视频流”。首帧等待超过流超时则显示“实时视频解码超时”并进入既有指数退避重连。断流、重连和卸载时取消视频帧回调与轮询、清理 `srcObject`、移除 DOM 节点并释放纹理。

验证结果：在线 `robot001` 的 WHEP 流程返回 `OPTIONS 204`、`POST 201`、ICE candidate `PATCH 204`；Chromium 中 video 为 1280×720、`readyState=4`、`paused=false`，连续两次采样的 `currentTime` 从 `1.717` 增长到 `2.696`。直接媒体帧和 2D canvas 像素验证为有效非黑画面。`npm run build` 与 `npm run assets:check` 通过，只有既有大 chunk 警告。

剩余风险：headless SwiftShader 对 WebRTC `VideoTexture` 的 WebGL 截图会得到黑纹理，无法替代真实 GPU 浏览器的最终肉眼确认；因此本次自动验证以 WHEP 状态、解码尺寸、readyState、播放时间增长和原始帧像素为准。真实视频内容涉及外部现场画面，未归档到仓库截图。

部署结果：2026-07-11 发布为 `releases/20260711064416-e0237e5` 并原子切换 `current`。前端 TypeScript / Vite 构建、fortune AI 11 项测试、生产依赖审计、systemd 健康、Nginx 配置与 reload 均通过；生产首页引用 `WorldExperience-CBhqJkaN.js`，首页、新版主世界资源和公共占卜健康接口均返回 `200`，未登录 WHEP 仍返回 `401`。

## 2026-07-11 / Edge 实机空纹理改为原生视频合成层

现象：用户在 Windows Edge 实机截图确认，大屏左下角已显示“实时视频流”，说明 WHEP、track 和首帧门槛均已通过，但视频区域仍保持浅蓝空白。控制台同时出现旧 session `DELETE 400`。

原因判断：Edge 能用原生 video 解码并播放这路 H.264，但将 WebRTC video 上传为 WebGL `VideoTexture` 后没有有效画面；继续调 WebGL texture 参数无法保证不同 GPU / 驱动组合。`DELETE 400` 则来自清理时同时发 DELETE 和立即 `peerConnection.close()` 的竞态：MediaMTX 先因 peer close 回收 session，随后 DELETE 找不到 session。

解决方案：实验室视频区域改用 drei `Html transform` 承载浏览器原生 video，按 720×405 CSS 基准和世界宽度动态计算 `distanceFactor`，从而继承屏幕父级位置、旋转、透视和背后隐藏判断。原生 video 不显示 controls、不接收鼠标，首帧前透明；首帧可用后显示，同时保留 3D 边框、离线提示和 HTML 在线角标。WHEP 清理改为先 DELETE，成功、失败或 1.2 秒兜底后再关闭 peer；已经失败 / 断开的 peer 直接关闭，不再制造删除竞态。

验证结果：隔离 R3F 验证页使用在线 `robot001` 得到真实画面；video 为 1280×720、`paused=false`、opacity 为 1，投影后的屏幕区域为约 678×381 像素并保持 16:9。WHEP 返回 `OPTIONS 204`、`POST 201`、`PATCH 204`，组件主动卸载时 `DELETE 200`；浏览器没有 console error。真实视频内容涉及外部现场，验证截图在检查后删除，未归档到仓库。

剩余风险：原生 DOM 合成层不参与 WebGL 深度缓冲；当前使用 drei transform 的屏幕后隐藏与低 z-index，适用于实验室室内正面观看，但未来如果在视频屏幕前新增可穿过的 3D 遮挡物，需要额外启用指定 mesh 的 HTML occlusion。

部署结果：原生视频合成修复已发布到 `releases/20260711071254-e0237e5` 并切换 `current`。前端 TypeScript / Vite 构建、fortune AI 11 项测试、两轮生产依赖审计、systemd 健康、Nginx 配置与 reload 均通过；生产首页引用 `WorldExperience-w23zXzKB.js`，首页、新版资源、fortune health 为 `200`，未登录 WHEP 为 `401`，`robot001` 仍为在线 1280×720 H.264。断线恢复期间曾有两条发布进程并发，未切换旧 staging；最终终止旧流程，只保留本 release。发布脚本新增非阻塞 `flock`，后续并发发布会在构建前直接退出。

发布插曲：第一次发布尝试中，npm 11 的 `npm ci` 已输出完成，但本地 `typescript/bin/tsc` 与 `.bin/tsc` 尚未落盘，紧接着的 `npx tsc` 因而提示安装无关的 `tsc@2.0.3`。已拒绝安装并中止，`current` 未切换。发布脚本现会等待项目本地 `tsc` / `vite` 可执行文件出现，并直接调用本地 binary，避免 `npx` 错误回退到在线同名包。

部署结果：原生视频合成版最终发布为 `releases/20260711071254-e0237e5` 并切换 `current`。生产首页引用 `WorldExperience-w23zXzKB.js`，首页、新主世界资源和 fortune health 均返回 `200`，未登录 WHEP 返回 `401`；`robot001` 复检仍为在线 1280×720 H.264。发布期间一个重复启动的旧脚本实例在构建阶段自行失败并清理 staging，最终仅保留一个 release 完成原子切换，没有出现半发布。

日期：2026-07-09
版本 / Layer：Layer 7 实验室传送权限与世界内登录屏
现象：用户要求地面传送台按 `Space` 上行前必须登录并具备 `admin`、`armbot` 或 `door` 任一角色；未通过时不传送，并在传送台门口显示世界内原生用户名 / 密码登录屏。用户进一步确认 `admin` 也可以上去，输入框采用固定准星模式，鼠标仍可转视角。
原因判断：原 `PlayerController` 中 `Space` 在地面传送台中心会直接传送，没有 auth 门槛；`gluepudding` 站点此前只为 `/lab-webrtc/` 配置了 `armbot` 鉴权代理，没有给 3D 世界自身提供同源 `/api/auth/session` 和 `/api/sessions`。普通 DOM input 会打断世界内交互口径，因此登录屏需要用 R3F mesh / text 实现，并在键盘捕获时阻止移动键继续作用于玩家控制器。
解决方案：新增 `laboratoryAuth.ts` 适配现有 auth 会话接口，读取 `/api/auth/session` 的 `user.roles` 并按 `admin | armbot | door` 任一角色判定可上行；`Space` 在地面传送台激活区内先检查权限，未通过时打开登录屏而不是跳跃或传送。新增 `LaboratoryLoginScreen`，放在地面传送台门口并朝向传送台中央；准星命中用户名框、密码框或登录按钮后左键操作，键盘捕获期间 `W/A/S/D/Space` 不移动，鼠标仍可转视角，`Esc` 或点击框外退出输入。生产 Nginx 新增 `/api/auth/session` 和 `/api/sessions` 同源代理到 auth 服务；首次远端写入时 Nginx 变量被 shell 展开导致 `nginx -t` 失败，配置未 reload，随后从备份重建并用本地临时文件方式写回，通过 `nginx -t` 后 reload。
涉及文件：`app/nav-world/src/adapters/laboratoryAuth.ts`、`app/nav-world/src/modules/laboratory/LaboratoryLoginScreen.tsx`、`app/nav-world/src/modules/laboratory/LaboratoryAerialStage.tsx`、`app/nav-world/src/world/PlayerController.tsx`、`app/nav-world/src/world/WorldExperience.tsx`、`app/nav-world/src/world/WorldScene.tsx`、`app/nav-world/src/world/InteractionSystem.tsx`、`TODO.md`、`MEMORY.md`、`validation/layer-7/debug.md`；远端配置：`/etc/nginx/sites-available/gluepudding`
验证结果：`npm run assets:laboratory:check` 通过；`npm run build` 通过，仍有既有大 chunk 警告；`git diff --check` 通过；本地 `http://127.0.0.1:4177/` 返回 `200 OK`；远端 `nginx -t` 通过并已 reload；公网未登录访问 `https://gluepudding.com/api/auth/session` 返回 `401 unauthorized` JSON；使用无效测试账号 `POST https://gluepudding.com/api/sessions` 返回 `401 invalid_credentials` JSON。
画面变化：是；地面传送台门口新增按需显示的浅色登录屏，`Space` 上行新增权限门槛。
截图：未截图；本次需要真实 pointer lock、键盘输入和登录态组合验证，按用户此前实验室实机验证口径由用户实机确认，Codex 侧以构建、资源检查和 HTTP / Nginx 验证兜底。
剩余风险：本地开发环境如果没有同源 auth 代理，登录屏会显示登录服务不可达；真实 `admin`、`armbot`、`door` 账号登录后的上行效果需要用户在已登录浏览器中实机验证。该前端门槛只是世界交互门槛，不替代 WebRTC、门禁等真实服务端鉴权。

日期：2026-07-09
版本 / Layer：Layer 7 出生点本地调试登录屏
现象：用户要求保留一个小后门测试入口，用于临时切换登录 / 未登录状态；随后补充要求该小屏放在出生点不用回头就能看到的位置。
原因判断：真实 auth 登录需要账号和角色，Codex 侧无法用真实凭据验证 `admin` / `armbot` / `door` 上行；同时用户需要快速切换传送门权限状态做本地手感验证。该能力不能改真实 auth 会话或服务端权限，否则会引入真实后门风险。
解决方案：新增 `LaboratoryDebugAccessScreen`，放在出生点前方右侧世界坐标约 `[3.6, 2.55, 34.2]`，屏幕朝向出生点，初始视角不用回头可见。小屏只在本地 `localhost` / `127.0.0.1` / `::1` 或显式 `VITE_LAB_AUTH_DEBUG=true` 时显示；左键切换前端实验室通行覆盖状态为“测试已登录 / 测试未登录”。覆盖状态仅影响 `PlayerController` 的实验室上行判断，不创建真实 auth session、不写 cookie、不改服务器状态；正式上线前应移除或替换为“说明 / 关于”。
涉及文件：`app/nav-world/src/modules/laboratory/LaboratoryDebugAccessScreen.tsx`、`app/nav-world/src/adapters/laboratoryAuth.ts`、`app/nav-world/src/world/WorldExperience.tsx`、`app/nav-world/src/world/WorldScene.tsx`、`TODO.md`、`MEMORY.md`、`VALIDATION_LAYERS.md`、`validation/layer-7/debug.md`
验证结果：`npm run build` 通过，仍有既有大 chunk 警告；构建生成新的前端 hash 资源并 prune 旧未引用资源；`npm run assets:laboratory:check` 通过；`git diff --check` 通过；本地 `http://127.0.0.1:4177/` 返回 `200 OK`。
画面变化：是；出生点前方右侧新增一块浅色小屏，本地可直接看到并点击切换实验室测试登录状态。
截图：未截图；本次属于实验室调试屏摆放和交互微调，按用户此前口径由用户实机验证，Codex 侧以构建和资源检查兜底。
剩余风险：小屏使用前端覆盖状态，不能代表真实 auth / cookie / 服务器权限；如果通过非 localhost 的局域网 IP 预览，默认不会显示，需用 `VITE_LAB_AUTH_DEBUG=true` 构建。

日期：2026-07-09
版本 / Layer：Layer 7 实验室登录屏输入框排版修正
现象：用户截图反馈地面传送台登录屏里输入框文字和横线重叠；同时要求 `admin` 和 `armbot` 之间改用 `/` 分隔。
原因判断：`LaboratoryLoginScreen` 的输入文字和下划线几乎位于同一局部 Y 坐标，长用户名或占位文案会被横线穿过；权限文案在登录屏、HUD 和 auth 错误摘要里使用了不同分隔风格。
解决方案：将输入框文字和字段标签上移，把下划线压到输入框底部，并拉开用户名 / 密码两行的垂直间距；用户可见权限文案统一为 `admin/armbot/door`。
涉及文件：`app/nav-world/src/modules/laboratory/LaboratoryLoginScreen.tsx`、`app/nav-world/src/adapters/laboratoryAuth.ts`、`app/nav-world/src/world/WorldExperience.tsx`、`app/nav-world/src/world/InteractionSystem.tsx`、`validation/layer-7/debug.md`
验证结果：已检查源码中用户可见权限文案只剩 `admin/armbot/door` 写法；`npm run assets:laboratory:check` 通过；`npm run build` 通过，仍有既有大 chunk 警告；`git diff --check` 通过。
画面变化：是；登录屏输入框文字不再和底部横线重叠，权限提示分隔符变为 `/`。
截图：未截图；本次属于世界内登录屏微调，按用户此前实验室实机验证口径由用户实机确认，Codex 侧以资源检查和构建验证兜底。
剩余风险：3D 文本透视下的精确视觉间距仍以用户当前浏览器实机画面为准；如仍贴线，可继续上移文字或下压横线。

日期：2026-07-09
版本 / Layer：Layer 7 实验室登录屏错误密码后输入锁死修复
现象：用户稳定复现多次输入错误密码后，登录屏从视野中消失，HUD 仍显示“正在输入实验室登录信息”，`W/A/S/D` 全部无法移动，鼠标点击外侧和 `Esc` 都无法恢复。
原因判断：登录提交是异步流程，旧的失败回包会无条件执行 `setActiveField("password")` 和 `onInputActiveChange(true)`；在多次错误密码、屏幕隐藏或输入状态被取消后，父级键盘捕获可能被旧请求重新打开。子组件键盘监听此前只依赖 `activeField`，没有同时检查屏幕是否可见；父级也没有对“屏幕不可见但输入捕获仍为 true”的异常组合做兜底清理。
解决方案：为登录提交增加最新请求 id、屏幕可见性 guard 和 `isSubmitting` 防重复提交；登录屏隐藏时失效所有 pending submit 并清理提交态；子组件键盘监听改为只在屏幕可见且字段激活时挂载；父级增加异常状态自愈，登录屏不可见时自动释放 `isLaboratoryLoginInputActive`，并用捕获阶段 `Esc` 与点击框外兜底恢复移动。
涉及文件：`app/nav-world/src/modules/laboratory/LaboratoryLoginScreen.tsx`、`app/nav-world/src/world/WorldExperience.tsx`、`MEMORY.md`、`validation/layer-7/debug.md`
验证结果：`npm run assets:laboratory:check` 通过；`npm run build` 通过，仍有既有大 chunk 警告；`git diff --check` 通过。该问题需要真实浏览器 pointer lock / 键盘输入 / auth 失败回包组合，最终手感仍由用户实机复验。
画面变化：有轻微变化；提交中按钮显示“登录中”，其余模型外观不变。
截图：未截图；本次是交互状态机修复，按用户此前实验室实机验证口径由用户复验，Codex 侧以构建和静态检查兜底。
剩余风险：本地没有真实错误密码连续请求的自动化浏览器回放；若 auth 服务返回特殊限流状态，屏幕应保持可恢复，但错误文案仍可能需要按实际状态码细化。

日期：2026-07-09
版本 / Layer：Layer 7 出生点本地调试登录屏靠树调整
现象：用户截图反馈切换登录态的小屏还在出生点前方偏中间位置，要求把它挪到靠近树一点。
原因判断：上一版坐标 `[3.6, 2.55, 34.2]` 虽然不用回头可见，但更靠近传送台正前方和白粉色人形左侧，不够贴近右侧树。
解决方案：将 `LaboratoryDebugAccessScreen` 的世界坐标调整为 `[6.25, 2.55, 34.8]`，让小屏更靠近出生点右侧树；屏幕朝向继续通过当前位置和出生点自动计算，保持正面可见。
涉及文件：`app/nav-world/src/modules/laboratory/LaboratoryDebugAccessScreen.tsx`、`MEMORY.md`、`VALIDATION_LAYERS.md`、`validation/layer-7/debug.md`
验证结果：`npm run assets:laboratory:check` 通过；`npm run build` 通过，仍有既有大 chunk 警告；`git diff --check` 通过。
画面变化：是；本地调试登录态小屏从传送台前方偏中间位置移动到更靠近树的一侧。
截图：未截图；本次属于摆位微调，按用户此前实验室实机验证口径由用户实机确认，Codex 侧以构建和资源检查兜底。
剩余风险：具体“靠近树”的视觉距离以用户当前视角实机为准；如果仍偏中间，可继续增大 X 或微调 Z。

日期：2026-07-09
版本 / Layer：Layer 7 出生点本地调试登录屏移到帐篷和传送台中间
现象：用户截图反馈小屏放到树边后仍不合适，要求放在占卜帐篷和地面传送台中间、准心指向的位置，并面对出生点。
原因判断：占卜帐篷地标为 `[-12, 2.14, 25]`，地面传送台地标为 `[12, 1.74, 25]`，横向中点为 `x=0,z=25`；截图准心位于两者之间的草地上，略靠出生点一侧。
解决方案：将 `LaboratoryDebugAccessScreen` 的世界坐标调整为 `[0, 2.55, 26.2]`，让小屏位于帐篷和传送台之间；屏幕朝向继续通过当前位置和出生点自动计算，保持正面面对出生点。
涉及文件：`app/nav-world/src/modules/laboratory/LaboratoryDebugAccessScreen.tsx`、`MEMORY.md`、`VALIDATION_LAYERS.md`、`validation/layer-7/debug.md`
验证结果：`npm run assets:laboratory:check` 通过；`npm run build` 通过，仍有既有大 chunk 警告；`git diff --check` 通过。
画面变化：是；本地调试登录态小屏移动到占卜帐篷和地面传送台中间。
截图：未截图；本次属于摆位微调，按用户此前实验室实机验证口径由用户实机确认，Codex 侧以构建和资源检查兜底。
剩余风险：准心截图只能估算世界坐标；如果仍需更贴准，可以继续按用户实机画面微调 X / Z。

日期：2026-07-09
版本 / Layer：Layer 7 出生点本地调试登录屏靠近传送门
现象：用户截图反馈小屏在帐篷和传送台中间后仍偏帐篷侧，要求再靠近传送门一点。
原因判断：上一版坐标 `[0, 2.55, 26.2]` 是帐篷 `x=-12` 和地面传送台 `x=12` 的横向中点；视觉上离传送台还有较大距离。
解决方案：将 `LaboratoryDebugAccessScreen` 的世界坐标调整为 `[5.2, 2.55, 26.2]`，沿 X 轴向地面传送台方向移动，同时保留面向出生点的自动朝向。
涉及文件：`app/nav-world/src/modules/laboratory/LaboratoryDebugAccessScreen.tsx`、`MEMORY.md`、`validation/layer-7/debug.md`
验证结果：`npm run assets:laboratory:check` 通过；`npm run build` 通过，仍有既有大 chunk 警告；`git diff --check` 通过。
画面变化：是；本地调试登录态小屏更靠近地面传送门。
截图：未截图；本次属于摆位微调，按用户此前实验室实机验证口径由用户实机确认，Codex 侧以构建和资源检查兜底。
剩余风险：具体距离仍以用户实机视角为准；如仍偏远，可继续增大 X。

日期：2026-07-09
版本 / Layer：Layer 7 出生点本地调试登录屏中点回调
现象：用户反馈上一版 `[5.2, 2.55, 26.2]` 移过头了，要求取中点。
原因判断：上一版是从 `[0, 2.55, 26.2]` 向传送门方向移动到 `[5.2, 2.55, 26.2]`；用户说“取中点”应取这两个位置的中点。
解决方案：将 `LaboratoryDebugAccessScreen` 的世界坐标调整为 `[2.6, 2.55, 26.2]`，保留面向出生点的自动朝向。
涉及文件：`app/nav-world/src/modules/laboratory/LaboratoryDebugAccessScreen.tsx`、`MEMORY.md`、`validation/layer-7/debug.md`
验证结果：`npm run assets:laboratory:check` 通过；`npm run build` 通过，仍有既有大 chunk 警告；`git diff --check` 通过。
画面变化：是；本地调试登录态小屏从靠传送门侧回调到两版位置中点。
截图：未截图；本次属于摆位微调，按用户此前实验室实机验证口径由用户实机确认，Codex 侧以构建和资源检查兜底。
剩余风险：具体位置仍以用户实机视角为准。

日期：2026-07-09
版本 / Layer：Layer 7 隐藏柱状参考人物
现象：用户要求隐藏出生点附近白粉色柱状参考人物。
原因判断：该对象是 `WorldScene` 里的 `SpawnScaleMarker`，用于早期比例参考；当前实验室和传送台比例已基本定型，继续显示会干扰传送门、树和调试板视线。
解决方案：移除 `ReferenceLandmarks` 中的 `SpawnScaleMarker` 渲染，不再把白粉色柱状人物加入世界场景。
涉及文件：`app/nav-world/src/world/WorldScene.tsx`、`MEMORY.md`、`VALIDATION_LAYERS.md`、`validation/layer-7/debug.md`
验证结果：已确认 `SpawnScaleMarker` / `ReferenceLandmarks` 不再出现在 `WorldScene`；`npm run assets:laboratory:check` 通过；`npm run build` 通过，仍有既有大 chunk 警告；`git diff --check` 通过。
画面变化：是；出生点附近不再显示白粉色柱状比例参考人物。
截图：未截图；本次属于场景可见对象隐藏，按用户此前实验室实机验证口径由用户实机确认，Codex 侧以构建和资源检查兜底。
剩余风险：如果后续还需要可视比例参考，应改成开发开关或临时 debug 模式，不应常驻正式场景。

日期：2026-07-09
版本 / Layer：Layer 7 PR #2 laboratory 合并到当前 main
现象：PR #2 基于旧 main 开发，当前 main 已额外合入 `game` 和 `fortuine-fix`，本地合并时 `MEMORY.md`、`app/frontend/index.html`、`WorldExperience.tsx`、`WorldScene.tsx`、Layer 7 / Layer 8 debug 记录出现冲突。
原因判断：实验室分支新增了空中实验室、登录态、WebRTC 大屏和调试屏；主线同时新增 game 入口、本地 vendor、mp3 音频和占卜屋修复。冲突集中在世界运行态 props、场景渲染入口、构建 hash 和验证记录。
解决方案：保留实验室新增的权限 / 传送 / WebRTC 状态，同时保留主线的 `isLoading` 背景音乐切换、`GamePortal`、game vendor 和 PR #4 音频修复；不恢复旧 `ReferenceLandmarks`，避免把旧实验室占位和白粉色参考人物带回。重新构建生成最终 `app/frontend` hash，并移除 PR 分支自带的旧未引用构建 hash。
涉及文件：`app/nav-world/src/world/WorldExperience.tsx`、`app/nav-world/src/world/WorldScene.tsx`、`app/frontend/index.html`、`app/frontend/assets/`、`MEMORY.md`、`validation/layer-7/debug.md`、`validation/layer-8/debug.md`。
验证结果：`npm run assets:laboratory:check` 通过；`npm run assets:laboratory:validate` 通过，GLB validator 仅输出既有 UNUSED_OBJECT info，无 error；`npm run build` 通过，仍有既有大 chunk 警告；`npm run assets:check` 通过。
画面变化：是；实验室 PR 本身包含空中实验室、传送台、登录屏、调试屏和视频大屏等可见变化。
截图：本次合并未新增截图；沿用实验室分支已有实机验证口径，Codex 侧以资源校验和构建验证兜底。
剩余风险：未在本轮自动化浏览器中完整走登录、传送、WebRTC 离线态和 game iframe 入口；真实 auth / WHEP / 设备权限仍依赖部署环境验证。

日期：2026-07-09
版本 / Layer：Layer 7 本地预览 auth 检查和 smoke 测试修复
现象：PR #2 合并后运行 `npx playwright test tests/e2e/world-smoke.spec.ts`，3D 用例实际能加载和交互，但测试失败；失败收集器记录本地 preview 下 `/api/auth/session` 404，以及页面卸载时 BGM mp3 请求 `net::ERR_ABORTED`。
原因判断：本地 Vite preview 没有 auth 后端代理，实验室权限检查不应默认请求同源 `/api/auth/session`；音频请求在 Playwright 测试结束、页面卸载或音轨切换时被浏览器取消，不代表资源缺失或运行错误。
解决方案：`laboratoryAuth` 在 `localhost` / `127.0.0.1` / `::1` 默认使用本地 guest fallback，不请求 auth 服务；如需本地真实 auth 联调，可设置 `VITE_LAB_AUTH_LOCAL_FETCH=true`。Playwright failure 收集器忽略 `/audio/*.mp3` 的 `net::ERR_ABORTED`。
涉及文件：`app/nav-world/src/adapters/laboratoryAuth.ts`、`app/nav-world/tests/e2e/world-smoke.spec.ts`、`validation/layer-7/debug.md`、`MEMORY.md`。
验证结果：`npm run build` 通过；`npm run assets:check` 通过；`npx playwright test tests/e2e/world-smoke.spec.ts` 桌面 / 移动共 8 条通过。
画面变化：否。本地无 auth 后端时，实验室权限文案会更明确提示使用测试屏。
截图：无，本次为本地预览和自动化测试稳定性修复。
剩余风险：真实生产 auth 仍依赖部署代理；本地联调真实 auth 时必须显式开启 `VITE_LAB_AUTH_LOCAL_FETCH=true`。

## 2026-07-10 / 恢复生产版权声明和备案小屏

日期：2026-07-10

版本 / Layer：Layer 7 实验室模拟层 / 全站法务信息

现象：用户反馈生产环境中的版权声明和备案信息消失；Fallback 页仍有备案链接，3D 世界内原有“版权与备案”小屏源码也仍存在，但线上不可见。

原因判断：`WorldExperience.shouldShowLaboratoryDebugScreen()` 仍沿用旧调试屏规则，只在 localhost、127.0.0.1、::1 或 `VITE_LAB_AUTH_DEBUG=true` 时显示。该屏后来已改为正式模型授权与备案信息，但生产可见性条件没有同步更新；静态部署未启用调试开关后因此被隐藏。

解决方案：保留原小屏坐标、朝向、版权文案和备案号，只把显示条件改为始终返回 true，并注释说明这是生产必需内容，不得再按 debug 环境隐藏。

涉及文件：`app/nav-world/src/world/WorldExperience.tsx`、`MEMORY.md`、`validation/layer-7/debug.md`。

部署结果：执行一次不含 Playwright 的 Vite 生产构建，并原子切换到 `releases/20260710060047-2505fd4-legal`。

验证结果：按用户此前要求未运行 Playwright；生产构建完成，生成的新 `WorldExperience` chunk 包含版权与备案小屏逻辑。

画面变化：是。出生点附近重新常驻显示“版权与备案”小屏。

截图：无，未运行 Playwright。

剩余风险：3D Text 中的 URL 目前是授权说明文字，不是可点击 DOM 链接；2D Fallback 页继续提供可点击的 ICP 和公安备案链接。

## 2026-07-10 / 实验室首屏外壳与 WebRTC 延迟连接

现象：地面传送台和天空实验室在出生点转头 / 抬头可见，必须首屏完整出现；但真实 WebRTC 属于天空实验室内部能力，不应在出生点占用连接和重试资源。

解决方案：Teleporter、Dome 和 Glass Floor 纳入 8 个首屏关键 GLB，并在三者实际挂载后才上报实验室可见资源 ready。Teleporter 使用 WebP + Meshopt，Dome / Floor 使用 Meshopt。`LaboratoryWebRtcScreen` 新增 `isActive`，只有玩家水平距离天空实验室不超过 26m 且高度差不超过 14m 时才建立 WHEP / mock 连接；其他位置显示“进入天空实验室后连接”。

涉及文件：`app/nav-world/src/modules/laboratory/LaboratoryAerialStage.tsx`、`app/nav-world/src/modules/laboratory/LaboratoryWebRtcScreen.tsx`、`app/nav-world/src/world/WorldScene.tsx`、实验室三个 GLB。

验证结果：TypeScript、生产构建和实验室 GLB validator 通过；未运行 Playwright。

画面变化：出生点仍可看到地面传送台和天空实验室外壳；视频连接状态在未进入天空实验室时显示延迟连接提示。

剩余风险：需要用户实机确认 WebP 贴图质量和天空实验室远景完整性；KTX2 尚未实施。
