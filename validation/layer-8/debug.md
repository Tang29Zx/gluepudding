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
