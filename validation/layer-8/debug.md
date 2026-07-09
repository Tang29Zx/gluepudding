# Layer 8 调试记录

本文件只记录 Layer 8：真实占卜接口层 的问题、原因判断、解决方案和验证结果。不要记录 secret、token、私钥、密码或内部敏感地址。

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

## 2026-07-08 / Layer 8 Fortune 协作者交接文档

日期：2026-07-08

版本 / Layer：Layer 8 占卜屋交互与真实占卜接口层

现象：用户要求为协作者准备交接文档。用户将同时进行实验室和五子棋相关层开发，协作者将在新分支 `fortune` 制作 Layer 8，占卜屋交互包括塔罗、星座和周易，最后通过 PR 合并。

原因判断：Layer 5 已验收为模型摆放层，Layer 8 才开始做点击、选中、解读、mock 和接口。并行开发时需要明确文件边界、资源策略和验收标准，避免协作者误改实验室、五子棋或重新摆放 Layer 5 模型。

解决方案：新增 `validation/layer-8/fortune-handoff.md`。文档说明分支和并行开发边界、当前占卜屋模型坐标、塔罗贴图资源现状、可复用 MJS 脚本位置、塔罗 78 张空白牌选择流程、星座 12 区域选择流程、周易铜钱运算规则、三块屏幕显示要求、建议文件结构、验证命令和已知坑。同时更新 `Tech-Spec.md`，把旧 Layer 5 占卜屋模拟业务层口径迁移到 Layer 8；更新 `MEMORY.md` 记录长期协作安排和塔罗贴图资源判断。

涉及文件：`validation/layer-8/fortune-handoff.md`、`validation/layer-8/debug.md`、`Tech-Spec.md`、`MEMORY.md`。

验证结果：文档更新完成；本次未修改运行时代码，因此不运行构建。已实际检查 `resources/fortune/textures/`、`resources/fortune/*.mjs`、`FortuneAssetStage.tsx`、`fortuneModelAssets.ts` 和 `InteractionSystem.tsx` 后再写交接判断。

画面变化：无。本次只创建协作文档和同步技术说明。

截图：不需要截图。

剩余风险：交接文档是开发建议和边界说明，不等同于 Layer 8 实现。协作者实际实现时仍需补充资源复制脚本、类型定义、交互组件、mock 数据、视觉验证截图和构建验证。

## 2026-07-09 / PR #1 fortune 合并冲突解决

日期：2026-07-09

版本 / Layer：Layer 8 占卜屋交互与真实占卜接口层，PR #1 `fortune -> main`

现象：`fortune` 分支已开 PR 合入 `main`，GitHub 显示不可直接合并。本地合并 `origin/main` 时，`app/frontend/index.html` 和 `app/nav-world/src/modules/divination/FortuneAssetStage.tsx` 出现内容冲突；同时 PR 中存在多批旧 Vite hash 构建产物。

原因判断：`fortune` 基于 Layer 5 后的旧提交开发，占卜屋交互与 `main` 后续 Layer 5.5 视觉基线、实验室层和五子棋层并行修改。`FortuneAssetStage.tsx` 同时被视觉基线和占卜交互改动；`app/frontend/index.html` 同时引用不同构建 hash。

解决方案：以 `main` 的视觉基线和世界能力为底，保留占卜屋深色内容屏、局部氛围灯和 Layer 12 五子棋改动；合入 `fortune` 的 `ZodiacWheel`、`TarotTable`、`IchingDesk` 和 `IchingHexagram`。移除坐标调试辅助，不渲染 `FortuneCoordinateGuide`。保留周易抽签玩法；本次塔罗只验收 `three_card` 三张牌流程，`single` 模式和 78 张完整牌组作为后续增强。修复周易六爻展示顺序为 `result.lines.slice().reverse()`。删除 `fortune` 旧构建遗留且最终不引用的 hash JS，重新构建生成当前入口资源。

涉及文件：`app/nav-world/src/modules/divination/FortuneAssetStage.tsx`、`app/nav-world/src/modules/divination/IchingHexagram.tsx`、`app/frontend/index.html`、`TODO.md`、`Tech-Spec.md`、`VALIDATION_LAYERS.md`、`MEMORY.md`。

验证结果：`npm install` 通过；`npm run assets:fortune:check` 通过；`npm run assets:gomoku:check` 通过；`npm run assets:gomoku:validate` 通过；`npm run build` 通过，仍有既有 `WorldExperience` chunk 超 500KB 警告；`npm run assets:check` 通过。

画面变化：是，占卜屋新增星座、三张塔罗、周易六爻和抽签交互；本次不由 Codex 自动截图。

截图：用户明确本次画面由用户手测；Codex 未生成桌面端 / 移动端截图。

剩余风险：未做自动化视觉截图；塔罗 `single` 模式和 78 张完整牌组未作为本次验收范围；周易提问阶段仍使用受控 DOM 输入层，实机交互体验以用户手测确认。

## 2026-07-09 / Layer 8 内容屏重叠修复

日期：2026-07-09

版本 / Layer：Layer 8 占卜屋交互与真实占卜接口层

现象：用户实机截图显示周易新内容屏和 `main` 里 Layer 5.5 保留的旧空白内容屏重叠，导致画面像两块屏幕叠在一起。

原因判断：合并冲突时同时保留了 `main` 的 `BlankContentScreens` 和 `fortune` 的 `ZodiacWheel` / `TarotTable` / `IchingHexagram` 自带内容屏。三者使用相同或接近的屏幕坐标，真实内容屏会覆盖在旧屏幕上。

解决方案：从 `FortuneAssetStage` 移除 `BlankContentScreens`、旧屏幕坐标定义和不再使用的 `DoubleSide` import；保留 Layer 8 真实星座、塔罗、周易内容屏和占卜屋氛围灯。

涉及文件：`app/nav-world/src/modules/divination/FortuneAssetStage.tsx`、`validation/layer-8/debug.md`。

验证结果：`npm run assets:fortune:check` 通过；`npm run build` 通过，仍有既有 `WorldExperience` chunk 超 500KB 警告；`npm run assets:check` 通过。画面由用户实机手测。

画面变化：是，旧空白内容屏不再渲染，避免和真实内容屏重叠。

截图：用户实机验证，本轮 Codex 不生成截图。

剩余风险：如果真实内容屏自身位置仍需微调，以用户实机反馈继续调整。

## 2026-07-09 / PR #4 Fortune fix 合并验证

日期：2026-07-09

版本 / Layer：Layer 8 占卜屋交互与真实占卜接口层，PR #4 `fortuine-fix -> main`

现象：`fortune fix` 分支把背景音乐从 wav 切换为 mp3，并调整塔罗、周易模型交互和 mock 结果生成。本地合并到包含 `game` 修复的 `main` 时没有代码冲突；检查音频引用时发现脚步声和摇签声路径也被改为 mp3，但仓库没有对应小音效文件。

原因判断：PR 只提交了三首 BGM 的 mp3 文件，没有提交 `footstep.mp3` 和 `shake_cylinder.mp3`。旧版本引用的 wav 小音效同样不存在，因此如果不处理，会在运行时继续产生缺失音效请求。

解决方案：保留 BGM mp3 切换；新增 `playOptionalAudio`，对缺失小音效做会话级不可用缓存。脚步声和摇签声后续补齐文件后可自动播放；未补齐时不阻断世界运行，也不会持续重复请求同一个缺失文件。清理构建目录中的旧 wav 音频产物，只保留 mp3 输出。

涉及文件：`app/nav-world/public/audio/`、`app/nav-world/src/audio/playOptionalAudio.ts`、`app/nav-world/src/world/WorldExperience.tsx`、`app/nav-world/src/modules/divination/IchingDesk.tsx`、`app/frontend/audio/`、`validation/layer-8/debug.md`。

验证结果：`npm run build` 和 `npm run assets:check` 通过；仍有既有 `WorldExperience` chunk 超 500KB 警告。

画面变化：是，占卜屋部分模型和交互反馈有调整；本轮未新增截图。

截图：未新增截图；本次以合并验证、类型检查和构建检查为主，视觉细节留给用户实机确认。

剩余风险：未补真实 `footstep.mp3` 和 `shake_cylinder.mp3` 小音效；未做占卜屋完整浏览器流程截图。

## 2026-07-09 / 塔罗点击串到周易抽签修复

日期：2026-07-09

版本 / Layer：Layer 8 占卜屋交互与真实占卜接口层

现象：用户实机反馈点击完塔罗牌后，会同时触发周易抽签弹窗；截图中塔罗结果屏背后出现“抽签结果”DOM 弹窗。

原因判断：星座、塔罗、周易六爻和周易抽签组件都在同一个 Canvas DOM 节点上注册原生 `click` 监听。塔罗组件处理点击后只调用 `stopPropagation()`，这不能阻止同一个 DOM 节点上的其他原生监听器继续执行；如果同一帧周易抽签组件的准星射线也命中签筒，就会同一次点击内继续触发抽签。

解决方案：新增 `consumeCanvasClick()`，统一调用 `preventDefault()`、`stopPropagation()` 和 `stopImmediatePropagation()`。所有占卜屋 Canvas 点击处理在确认自己消费点击后都改用该 helper，避免同一次点击被同节点后续占卜组件监听器继续处理。

涉及文件：`app/nav-world/src/modules/divination/canvasEvents.ts`、`app/nav-world/src/modules/divination/ZodiacWheel.tsx`、`app/nav-world/src/modules/divination/TarotTable.tsx`、`app/nav-world/src/modules/divination/IchingDesk.tsx`、`app/nav-world/src/modules/divination/IchingHexagram.tsx`。

验证结果：`npm run build` 通过；`npm run assets:check` 通过；仍有既有 `WorldExperience` chunk 超 500KB 警告。

画面变化：否。只修正同一次 Canvas 点击的事件消费行为。

截图：无，本次为交互串台修复；复验以用户当前实机操作为准。

剩余风险：未新增专门的塔罗选牌自动化回放；如果后续新增占卜屋组件，也应复用 `consumeCanvasClick()`。
## 2026-07-09 / Layer 6 和 Layer 7 编号引用更正

日期：2026-07-09

版本 / Layer：Layer 8 占卜屋交互与真实占卜接口层

现象：用户指出 Layer 6 和 Layer 7 此前写反；Layer 8 交接文档和历史调试记录里也引用了旧编号口径。

原因判断：Layer 8 是并行协作层，交接文档曾用旧编号描述实验室和五子棋相关开发边界。编号更正后，继续保留旧描述会误导协作者。

解决方案：更新 `validation/layer-8/fortune-handoff.md` 中的并行开发边界：Layer 6 为世界内五子棋模拟层，Layer 7 为实验室模拟层，Layer 12 为真实五子棋集成层；同时把本 debug 中泛化为“实验室层和五子棋层”，避免继续传播旧编号。

涉及文件：`validation/layer-8/fortune-handoff.md`、`validation/layer-8/debug.md`。

验证结果：文档更新完成；本次不修改运行时代码。

画面变化：否。

截图：无，本次只修正协作文档编号。

剩余风险：Layer 8 历史实现和 PR 合并结果不受影响；只修正协作说明中的层级口径。

## 2026-07-09 / Layer 8 用户验收确认

日期：2026-07-09

版本 / Layer：Layer 8 占卜屋交互与真实占卜接口层

现象：用户要求确认 Layer 8 验收。

原因判断：Layer 8 已完成星座、三张塔罗、周易六爻和周易抽签等本次验收范围；`single` 塔罗模式和 78 张完整牌组此前已明确不作为本次阻塞项。

解决方案：在 `VALIDATION_LAYERS.md` 的 Layer 8 段落追加验收状态，并在 `MEMORY.md` 记录该层验收事实。

涉及文件：`VALIDATION_LAYERS.md`、`MEMORY.md`、`validation/layer-8/debug.md`。

验证结果：本次为用户验收状态归档，不修改运行时代码。

画面变化：否。

截图：无，本次只更新验收记录。

剩余风险：后续增强仍包括 `single` 塔罗模式、完整 78 张牌组和更完整的真实接口错误态细化。

## 2026-07-09 / 占卜屋三块内容屏放大

日期：2026-07-09

版本 / Layer：Layer 8 占卜屋交互与真实占卜接口层

现象：用户反馈占卜屋屏幕内文字偏小/模糊，并要求三个屏幕大一倍。

原因判断：星座、塔罗和周易六爻三块内容屏均为 `3.6 x 2.25` 的 3D 平面，文字由 canvas 贴图渲染；用户希望通过增大世界内屏幕尺寸提升可读性。

解决方案：将三块内容屏几何尺寸统一从 `3.6 x 2.25` 放大到 `7.2 x 4.5`；同时把屏幕中心高度从 `2.0` 抬到 `3.125`，保持底边大致停留在原高度，避免放大后下沿穿入地面。

涉及文件：`app/nav-world/src/modules/divination/ZodiacWheel.tsx`、`app/nav-world/src/modules/divination/TarotTable.tsx`、`app/nav-world/src/modules/divination/IchingHexagram.tsx`、`validation/layer-8/debug.md`。

验证结果：按用户要求未跑自动化测试或构建；视觉效果由用户在本地实机确认。

画面变化：是。占卜屋星座、塔罗、周易三块内容屏在世界内宽高各放大 2 倍。

截图：无，本次不新增截图。

剩余风险：屏幕放大后可能需要用户实机确认是否与帐篷、墙面或视角边界产生遮挡；如过大，可后续微调位置或缩放比例。

## 2026-07-09 / 占卜屋内容屏透明罩修复

日期：2026-07-09

版本 / Layer：Layer 8 占卜屋交互与真实占卜接口层

现象：用户实机反馈占卜屋屏幕放大后，桌面附近出现像透明层一样的大面片，从侧面看会切过桌布和地毯，导致桌布局部像被遮没。

原因判断：三块内容屏原本带有一个 `SCREEN_W + 0.1` / `SCREEN_H + 0.1` 的半透明 box，用于形成屏幕外框或玻璃质感；屏幕宽高放大 2 倍后，这些 box 也变成大透明片，即使后移到屏幕后方，从侧面和背面仍会穿过视线并遮挡桌布视觉。

解决方案：保留三块内容屏的 canvas 贴图不透明材质，彻底删除整块半透明 box 背板；后续如需屏幕边框，应使用窄边框线或局部高光，不再使用整面透明板。

涉及文件：`app/nav-world/src/modules/divination/ZodiacWheel.tsx`、`app/nav-world/src/modules/divination/TarotTable.tsx`、`app/nav-world/src/modules/divination/IchingHexagram.tsx`、`validation/layer-8/debug.md`。

验证结果：按用户要求未跑自动化测试或构建；已用源码检查确认三块内容屏不再使用 `opacity={0.95}`，也不再渲染 `SCREEN_W + 0.1` 的半透明 box 背板。

画面变化：是。占卜屋内容屏应只剩实色内容平面，桌布和地毯不再被屏幕透明背板遮挡。

截图：无，本次由用户在本地实机确认。

剩余风险：若仍希望有玻璃高光，需要改成边框线或局部窄条，而不是覆盖整块屏幕的透明 box。

## 2026-07-09 / 塔罗隐形命中球深度遮挡修复

日期：2026-07-09

版本 / Layer：Layer 8 占卜屋交互与真实占卜接口层

现象：用户实机反馈塔罗桌面上水晶球和蜡烛附近有两个像透明层一样的东西，会把桌布和后方地毯局部遮没。

原因判断：塔罗交互使用两个隐形球体作为准星射线命中区：水晶球命中球和蜡烛翻页命中球。它们此前使用 `opacity={0}` + `transparent` 隐藏视觉，但材质仍会参与深度写入，导致透明球体遮挡后方桌布/地毯。

解决方案：将两个命中球材质改为 `visible={false}`、`depthWrite={false}`、`depthTest={false}`，保留 mesh 供 Raycaster 命中，不再参与渲染或深度缓冲。

涉及文件：`app/nav-world/src/modules/divination/TarotTable.tsx`、`validation/layer-8/debug.md`、`MEMORY.md`。

验证结果：按用户要求未跑自动化测试或构建；源码检查确认塔罗水晶球和蜡烛命中球已不再使用 `opacity={0}` 透明材质，并改为不可见、不写深度。

画面变化：是。塔罗桌面水晶球和蜡烛附近不应再出现透明球体遮挡桌布。

截图：无，本次由用户在本地实机确认。

剩余风险：如果后续添加新的隐形命中 mesh，也必须禁用渲染/深度写入，而不是只把 opacity 设为 0。

## 2026-07-09 / 占卜输入输出迁移到世界大屏

日期：2026-07-09

版本 / Layer：Layer 8 占卜屋交互与真实占卜接口层

现象：用户要求占卜的输入输出全部做在大屏幕上，交互形态参考传送台登录接口，不再使用浏览器 DOM 弹窗。

原因判断：塔罗问题输入和周易六爻问题输入此前使用固定 DOM overlay；周易抽签结果也使用 DOM overlay。它们会脱离 3D 世界语境，并且与 Pointer Lock / 准星交互体验不一致。

解决方案：新增 `screenInput.ts` 作为世界内屏幕输入辅助；塔罗和周易六爻在各自 canvas 内容屏上绘制问题输入页、输入框、确认/取消按钮，并用屏幕上的隐形命中平面处理准星点击，键盘输入由组件捕获。新增 `ichingLots.ts` 抽离签文数据；`IchingDesk` 停止创建 DOM 结果弹窗，摇签结束后把结果传给 `FortuneAssetStage`，再由 `IchingHexagram` 绘制到周易大屏。

涉及文件：`app/nav-world/src/modules/divination/screenInput.ts`、`app/nav-world/src/modules/divination/ichingLots.ts`、`app/nav-world/src/modules/divination/TarotTable.tsx`、`app/nav-world/src/modules/divination/IchingHexagram.tsx`、`app/nav-world/src/modules/divination/IchingDesk.tsx`、`app/nav-world/src/modules/divination/FortuneAssetStage.tsx`、`validation/layer-8/debug.md`、`MEMORY.md`。

验证结果：按用户要求未跑自动化测试或构建；`git diff --check` 通过；源码搜索确认占卜模块不再残留 `tarot-question-overlay`、`iching-question-overlay`、`iching-result-overlay`、`exitPointerLock` 或 `requestPointerLock`，只保留 canvas 贴图创建所需的 `document.createElement("canvas")`。

画面变化：是。塔罗问题输入、周易起卦问题输入、周易抽签结果都应显示在世界内大屏上。

截图：无，本次由用户在本地实机确认。

剩余风险：本节记录的是输入迁移到大屏的第一版；中文 IME 风险已在下一节通过隐藏原生 textarea 输入桥继续处理。

## 2026-07-09 / 占卜大屏中文输入与框外失焦

日期：2026-07-09

版本 / Layer：Layer 8 占卜屋交互与真实占卜接口层

现象：用户反馈占卜大屏输入框内无法输入中文，并要求复用传送台登录屏的交互逻辑：准星点到输入框外也应能取消输入。

原因判断：上一版世界内输入通过捕获 `keydown` 手动追加字符，只能拿到单个按键，拿不到中文输入法的 composition/input 提交结果；同时 question 阶段点击空白区域会重新激活输入，而不是像实验室登录屏一样关闭当前输入。

解决方案：新增 `useScreenTextInput()`，在输入激活时创建一个不可见、可聚焦的原生 textarea，由浏览器原生处理中文 IME、粘贴、退格和组合输入，再把受控值同步绘制到塔罗 / 周易 canvas 大屏。塔罗和周易 question 阶段点击逻辑改为：点输入框激活输入，点确认 / 取消执行对应动作，点到控件外且当前正在输入时只关闭输入激活态。

涉及文件：`app/nav-world/src/modules/divination/useScreenTextInput.ts`、`app/nav-world/src/modules/divination/screenInput.ts`、`app/nav-world/src/modules/divination/TarotTable.tsx`、`app/nav-world/src/modules/divination/IchingHexagram.tsx`、`validation/layer-8/debug.md`、`MEMORY.md`。

验证结果：按用户要求未跑自动化测试或构建；`git diff --check` 通过；源码搜索确认占卜输入不再使用旧的手写 `appendQuestionText` / `isPrintableQuestionKey` 键盘拼字逻辑，新增的 DOM 元素仅为不可见 textarea 输入桥，不是可见 overlay。

画面变化：轻微。输入框仍绘制在世界大屏上；输入激活时中文提交后应实时显示在大屏输入框内。

截图：无，本次由用户在本地实机确认中文输入法和框外点击体验。

剩余风险：不同浏览器对 pointer lock 下聚焦隐藏 textarea 的 IME 候选窗位置可能略有差异；当前 click handler 已允许 question 阶段在 pointer lock 丢失时仍能点击确认、取消或失焦。

## 2026-07-09 / 塔罗水晶球输入页消失修复

日期：2026-07-09

版本 / Layer：Layer 8 占卜屋交互与真实占卜接口层

现象：用户反馈点击水晶球进入塔罗输入页后，桌面上的水晶球视觉模型消失，只剩底座附近物件。

原因判断：塔罗水晶球模型和它的隐形 raycast 点击球被同一个 `phase === "idle" || phase === "reveal"` 条件包住；进入 `question` 阶段后 React 同时卸载了视觉模型和点击命中体。

解决方案：将水晶球视觉模型改为常驻渲染，只把隐形 raycast 点击球保留为 idle / reveal 阶段启用。这样输入页和选牌流程不会拿掉桌面道具，同时不会让水晶球在不该交互的阶段抢点击。

涉及文件：`app/nav-world/src/modules/divination/TarotTable.tsx`、`validation/layer-8/debug.md`、`MEMORY.md`。

验证结果：按用户要求未跑自动化测试或构建；本次只做源码修复和 `git diff --check`。

画面变化：是。点击水晶球进入输入页后，水晶球模型应继续留在桌面上。

截图：无，本次由用户在本地实机确认。

剩余风险：如果后续将其他桌面道具做成可交互对象，应同样区分“视觉模型常驻”和“命中体按阶段启用”。

## 2026-07-09 / 占卜输入按钮左右对称

日期：2026-07-09

版本 / Layer：Layer 8 占卜屋交互与真实占卜接口层

现象：用户反馈塔罗输入页“开始选牌”和“取消”按钮靠得太近，希望左右两边对称；周易输入页同样需要一致调整。

原因判断：塔罗和周易输入页的按钮绘制坐标都集中在屏幕中部偏右，且确认按钮和取消按钮宽度不同；对应的隐形点击平面也沿用旧位置。

解决方案：塔罗与周易输入页按钮改为同宽，并将确认 / 取消按钮中心放到屏幕中线左右等距位置；同步更新 `questionControlLayout` 中的隐形命中平面，使视觉按钮和准星点击区域保持一致。

涉及文件：`app/nav-world/src/modules/divination/TarotTable.tsx`、`app/nav-world/src/modules/divination/IchingHexagram.tsx`、`validation/layer-8/debug.md`、`MEMORY.md`。

验证结果：按用户要求未跑自动化测试或构建；本次只做源码修复和 `git diff --check`。

画面变化：是。塔罗和周易大屏输入页的“开始 / 取消”按钮应左右分开、同宽、相对屏幕中线对称。

截图：无，本次由用户在本地实机确认。

剩余风险：如果后续继续调整屏幕尺寸或按钮尺寸，需要重新检查 canvas 绘制坐标和 3D 命中平面是否仍对齐。

## 2026-07-09 / 塔罗结果前场景闪空修复

日期：2026-07-09

版本 / Layer：Layer 8 占卜屋交互与真实占卜接口层

现象：用户反馈塔罗选完三张牌后，在结果出现前桌子和屏幕会先短暂消失 / 闪一下。

原因判断：进入 `reveal` 阶段时会为选中的牌挂载 `CardFaceTexture`，该组件内部调用 `useTexture(cardFaceUrl(index))`。首次加载牌面图片会触发 Suspense，而占卜屋室内内容外层的 `<Suspense fallback={null}>` 会在加载期间把整组室内内容置空，因此桌子和屏幕出现短暂闪空。

解决方案：移除结果渲染路径里的 `CardFaceTexture` / `useTexture`；改为在 `select` / `reveal` 阶段用 `TextureLoader` 后台预加载已选牌的牌面贴图，并写入 `cardFaceTextures`。`ArcCard` 渲染时只读 state 中已有贴图，未加载完成时继续显示牌背，不再触发外层 Suspense。

涉及文件：`app/nav-world/src/modules/divination/TarotTable.tsx`、`validation/layer-8/debug.md`、`MEMORY.md`。

验证结果：按用户要求未跑自动化测试或构建；本次只做源码修复和 `git diff --check`。

画面变化：是。选完三张牌后应保持桌子和屏幕稳定，不再因为牌面图片首次加载而整组占卜屋闪空。

截图：无，本次由用户在本地实机确认。

剩余风险：如果后续新增其他异步贴图 / GLB 加载组件，也应避免放在结果切换的即时渲染路径里，或使用局部 fallback，避免影响整个室内 Suspense 边界。

## 2026-07-09 / 塔罗水晶球亮闪效果

日期：2026-07-09

版本 / Layer：Layer 8 占卜屋交互与真实占卜接口层

现象：用户反馈塔罗桌上的水晶球太丑，当前看起来像实心黄球，缺少水晶球的透明和亮闪效果。

原因判断：原 GLB 球体材质不够透明，hover 时材质 emissive 直接偏向金色，近距离看会变成一颗实心黄球；场景里也缺少独立的光晕、内发光和星点层次。

解决方案：在 `TarotTable` 中将水晶球 GLB 的 mesh 材质替换为半透明紫蓝 `MeshPhysicalMaterial`；新增 `SparklingCrystalEffect` 视觉层，包含外部 additive 光晕、内部玻璃核心、两条细光环、点光源和多个呼吸闪烁的小星芒。hover 时提升点光源和球体 emissive，让准星对准水晶球时更亮。

涉及文件：`app/nav-world/src/modules/divination/TarotTable.tsx`、`validation/layer-8/debug.md`、`MEMORY.md`。

验证结果：按用户要求未跑自动化测试或构建；本次只做源码修复和 `git diff --check`。

画面变化：是。水晶球应从实心黄球变为透明紫蓝、带光晕光环和闪烁星点的发光水晶球。

截图：无，本次由用户在本地实机确认。

剩余风险：不同显卡 / 浏览器对透明材质排序和 additive blending 的观感会略有差异；如果实机过亮或过花，可继续微调光晕 opacity、点光源 intensity 和星芒数量。

## 2026-07-09 / 塔罗水晶球高度修正

日期：2026-07-09

版本 / Layer：Layer 8 占卜屋交互与真实占卜接口层

现象：用户反馈加亮闪效果后，塔罗水晶球下半截沉进桌子里，没有坐在水晶球支架上。

原因判断：水晶球仍使用旧球心 `[0, 1.42, 3.72]`。旧 GLB 小球视觉半径较小；新增的透明玻璃核心、外光晕和光环视觉半径更大，沿用旧球心会导致下半部分压进桌布。

解决方案：将塔罗水晶球球心常量 `CRYSTAL_POS` 的 y 坐标从 `1.42` 抬到 `1.8`。水晶球 GLB、发光特效和隐形 raycast 命中体共用该球心；支架底座模型仍由 `tarot-crystal-base` 保持原位置。

涉及文件：`app/nav-world/src/modules/divination/TarotTable.tsx`、`validation/layer-8/debug.md`、`MEMORY.md`。

验证结果：按用户要求未跑自动化测试或构建；本次只做源码修复和 `git diff --check`。

画面变化：是。水晶球应抬到支架上方，不再下沉进桌面。

截图：无，本次由用户在本地实机确认。

剩余风险：如果实机看起来仍偏低或偏高，可继续小幅微调 `CRYSTAL_POS[1]`，但要保持视觉球、光效和 raycast 命中体共用同一球心。

## 2026-07-09 / 周易铜钱落桌修正

日期：2026-07-09

版本 / Layer：Layer 8 占卜屋交互与真实占卜接口层

现象：用户反馈周易桌上的铜钱悬空，没有贴在桌面上。

原因判断：周易桌 GLB 包围盒显示顶面约为 `y=1.099`，桌面图案放在 `y=1.105`；铜钱 GLB 本身半厚度约 `0.005~0.006`。但交互铜钱触发位置使用 `y=1.28`，投掷动画落点使用 `y=1.2`，都明显高于桌面。

解决方案：新增 `ICHING_TABLE_COIN_Y = 1.112` 作为周易铜钱中心高度；静态触发铜钱 `TRIGGER_POS` 和投掷动画 `COIN_BASE_Y` 共用该高度。同步把 `fortuneModelAssets` 中备用的 `iching-coin` 坐标改为同一高度，避免后续参考旧悬空坐标。

涉及文件：`app/nav-world/src/modules/divination/IchingHexagram.tsx`、`app/nav-world/src/modules/divination/fortuneModelAssets.ts`、`validation/layer-8/debug.md`、`MEMORY.md`。

验证结果：按用户要求未跑自动化测试或构建；本次只做源码修复和 `git diff --check`。

画面变化：是。周易铜钱应贴近桌面，只保留极小离桌距离避免模型闪烁。

截图：无，本次由用户在本地实机确认。

剩余风险：如果实机仍觉得略浮或压进桌面，可在 `1.105~1.115` 间小幅微调，但要保持触发铜钱和投掷落点共用同一高度。

## 2026-07-09 / 周易掷钱动画重做

日期：2026-07-09

版本 / Layer：Layer 8 占卜屋交互与真实占卜接口层

现象：用户反馈原先周易掷钱动画观感很差，像简单原地抬起落下，不像真实掷钱。

原因判断：旧实现只为每轮三枚铜钱维护 `x/y/z/rx/ry/rz`，并在 `useFrame` 中修改这些普通对象字段；但渲染层通过 React props 读取这些字段，帧循环本身不会触发 React 重渲染，因此画面容易出现跳变或几乎没有连续动画。同时铜钱结果是在动画结束时才随机，无法让视觉最终朝向和卦象结果一致。

解决方案：重做 `IchingHexagram` 内部铜钱动画状态。开始起卦时预生成六轮三枚铜钱，每枚铜钱记录正反面结果、起点、落点、抛物线高度、翻滚速度、最终朝向和落地光效强度。帧循环根据这些参数计算抛物线飞行、落桌阻尼弹跳和轻微摇摆，并通过 Object3D ref 直接写回铜钱模型的 position / rotation / scale。后续根据用户反馈继续优化性能和观感：每次只飞一枚铜钱，前面落定的铜钱保持平贴桌面，未轮到的铜钱隐藏；移除投掷阶段动态 pointLight，只保留小型金色 ring，ring 材质 `depthWrite=false`，避免透明层遮挡桌面。

涉及文件：`app/nav-world/src/modules/divination/IchingHexagram.tsx`、`validation/layer-8/debug.md`、`MEMORY.md`。

验证结果：按用户要求未跑自动化测试或构建；本次只做源码修复和 `git diff --check`。

画面变化：是。周易起卦时应看到铜钱一枚一枚飞起、快速翻滚、平贴落桌；每轮三枚都落定后再进入下一轮，六轮后进入结果页。

截图：无，本次由用户在本地实机确认。

剩余风险：不同浏览器 / 帧率下抛物线和落地光效观感会有轻微差异；如果实机觉得太快、太亮或落点不理想，可继续微调 `COIN_TOSS_DURATION`、`peakHeight`、落点随机范围和 `impactStrength`。

## 2026-07-09 / 周易铜钱最终姿态轴向修正

日期：2026-07-09

版本 / Layer：Layer 8 占卜屋交互与真实占卜接口层

现象：用户反馈改成单枚投掷后，铜钱最后仍会斜插在桌面里面。

原因判断：铜钱 GLB 是沿 Y 轴厚度的扁圆柱，平贴桌面时只能绕 Y 轴做桌面内旋转。此前最终姿态把 `finalRz` 随机化，绕 Z 轴会把铜钱从水平桌面翘起来，导致看起来斜插进桌面。

解决方案：将最终姿态改为 `finalRy = Math.random() * Math.PI * 2`、`finalRz = 0`；落桌弹跳阶段也不再给 `rz` 增加摆动。正反面仍由 `finalRx = 0 / Math.PI` 表达，保证最终平贴。

涉及文件：`app/nav-world/src/modules/divination/IchingHexagram.tsx`、`validation/layer-8/debug.md`、`MEMORY.md`。

验证结果：按用户要求未跑自动化测试或构建；本次只做源码修复和 `git diff --check`。

画面变化：是。铜钱最终应平贴在桌面上，不再出现斜插角度。

截图：无，本次由用户在本地实机确认。

剩余风险：如果仍有轻微视觉穿插，下一步应只微调 `COIN_BASE_Y` 或模型半厚度偏移，不要再通过 X/Z 轴旋转修正。

## 2026-07-09 / 周易结果页桌下纸片修复

日期：2026-07-09

版本 / Layer：Layer 8 占卜屋交互与真实占卜接口层

现象：用户反馈点击太极图 / 周易结果页交互后，桌子下面出现一张像纸一样的矩形。

原因判断：该矩形不是业务内容，而是周易结果页用于“点击桌面切换 AI 解读”的 `tableMeshRef` raycast 热区。它使用了低透明度可见材质 `opacity=0.06/0.25`，在桌面下方透出，视觉上像一张纸。

解决方案：将该热区材质改为 `visible={false}`，并保留 `depthWrite={false}`、`depthTest={false}`。这样 mesh 仍可作为 raycast 命中面使用，但不会绘制到画面里，也不会遮挡桌面或地毯。

涉及文件：`app/nav-world/src/modules/divination/IchingHexagram.tsx`、`validation/layer-8/debug.md`、`MEMORY.md`。

验证结果：按用户要求未跑自动化测试或构建；本次只做源码修复和 `git diff --check`。

画面变化：是。周易桌下不应再出现纸片状矩形；结果页桌面点击翻页交互应继续可用。

截图：无，本次由用户在本地实机确认。

剩余风险：Three Raycaster 通常仍会命中材质不可见但 object 可见的 mesh；如果实机发现桌面翻页不可点，应改为让 material opacity 为 0 但同时 `colorWrite=false`，而不是恢复低透明度可见平面。

## 2026-07-09 / 占卜屋大屏文字清晰度优化

日期：2026-07-09

版本 / Layer：Layer 8 占卜屋交互与真实占卜接口层

现象：用户反馈只有占卜屋里的大屏文字发糊，外面模块文字是清楚的。

原因判断：占卜屋星座、塔罗、周易三块内容屏都是 canvas 贴图，物理屏幕已放大到 `7.2m x 4.5m`，但贴图分辨率分别只有 `768x480`、`1280x800`、`1024x640`。近距离斜视时会被放大采样，文字边缘变软；同时屏幕内容会经过场景 tone mapping，浅底深字对比度也会被压低。

解决方案：三块占卜内容屏统一提升到 `2048x1280` canvas，保持 16:10 比例和原物理尺寸不变；CanvasTexture 改用显式 `LinearFilter` 和 `SRGBColorSpace`；屏幕 `meshBasicMaterial` 设置 `toneMapped={false}`，让 UI 贴图按屏幕颜色显示，减少灰雾感。

涉及文件：`app/nav-world/src/modules/divination/ZodiacWheel.tsx`、`app/nav-world/src/modules/divination/TarotTable.tsx`、`app/nav-world/src/modules/divination/IchingHexagram.tsx`、`validation/layer-8/debug.md`、`MEMORY.md`。

验证结果：按用户要求未跑自动化测试或构建；本次只做源码修复和 `git diff --check`。

画面变化：是。占卜屋内三块大屏的文字边缘应更清晰、对比度更稳定。

截图：无，本次由用户在本地实机确认。

剩余风险：每块大屏 canvas 约 `2048x1280`，显存占用高于旧版；如果低端设备卡顿，应优先降到 `1536x960`，不要回到旧的 768/1024 级别。

## 2026-07-09 / 占卜屋进屋卡顿降采样

日期：2026-07-09

版本 / Layer：Layer 8 占卜屋交互与真实占卜接口层

现象：用户反馈进入占卜屋有点卡，选择优先执行“大屏从 2048x1280 降到 1536x960”的轻量优化方案。

原因判断：占卜屋进入时会同时挂载星座、塔罗、周易三块 canvas 大屏。`2048x1280` 三张 UI 贴图的 GPU 初始化成本较高，且占卜屋还会同步加载桌子、水晶球、签筒、铜钱等模型和交互逻辑。

解决方案：三块占卜内容屏统一降到 `1536x960`，保持 16:10 比例、`LinearFilter`、`SRGBColorSpace` 和 `toneMapped={false}` 不变。该分辨率仍明显高于旧的 `768x480` / `1024x640`，但比 `2048x1280` 少约 44% 像素量。

涉及文件：`app/nav-world/src/modules/divination/ZodiacWheel.tsx`、`app/nav-world/src/modules/divination/TarotTable.tsx`、`app/nav-world/src/modules/divination/IchingHexagram.tsx`、`validation/layer-8/debug.md`、`MEMORY.md`。

验证结果：按用户要求未跑自动化测试或构建；本次只做源码修复和 `git diff --check`。

画面变化：轻微。大屏文字应仍比旧版清楚，但进占卜屋时贴图初始化压力应低于 `2048x1280` 版本。

截图：无，本次由用户在本地实机确认。

剩余风险：如果实机仍卡，下一步应按塔罗 / 周易 / 星座区域做交互组件懒加载，避免进入占卜屋时一次挂载三套业务组件。

## 2026-07-09 / 占卜屋大屏配色柔化

日期：2026-07-09

版本 / Layer：Layer 8 占卜屋交互与真实占卜接口层

现象：用户希望占卜屋内三块大屏颜色淡一点，更符合神秘气氛。

原因判断：三块屏幕此前以亮白 / 高饱和紫为主，在偏暗的占卜屋里更像普通办公 UI，且和桌布、蜡烛、紫色墙面氛围不够统一。

解决方案：星座、塔罗、周易三块 canvas 内容屏统一改为偏暗暮紫底、深葡萄标题条、旧金分割线、柔和面板和低饱和按钮 / 状态色；保持屏幕贴图不透明、`1536x960` 分辨率、`LinearFilter`、`SRGBColorSpace` 和 `toneMapped={false}` 不变。

涉及文件：`app/nav-world/src/modules/divination/ZodiacWheel.tsx`、`app/nav-world/src/modules/divination/TarotTable.tsx`、`app/nav-world/src/modules/divination/IchingHexagram.tsx`、`validation/layer-8/debug.md`、`MEMORY.md`。

验证结果：按用户要求未跑自动化测试或构建；本次只做源码修复和 `git diff --check`。

画面变化：是。占卜屋大屏应更柔和、更偏暗、更贴近神秘氛围，减少纯白大屏的突兀感。

截图：无，本次由用户在本地实机确认。

剩余风险：如果实机觉得对比度偏低，应优先微调文字色和标题条深度，不要恢复大面积纯白底或透明背板。
