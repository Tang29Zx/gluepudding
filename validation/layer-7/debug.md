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
