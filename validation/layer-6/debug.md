# Layer 6 调试记录

本文件只记录 Layer 6：实验室模拟层 的问题、原因判断、解决方案和验证结果。不要记录 secret、token、私钥、密码或内部敏感地址。

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
版本 / Layer：Layer 6 资源复用评估
现象：用户要求评估 `resources/gomoku-ai-academy-submission/` 中的代码是否能在 Layer 6 复用。
原因判断：该包是五子棋 AI 课程展示产品，核心能力是五子棋对弈、训练、复盘、PWA / 桌面包装和 AI Worker；不包含 WebRTC 大屏、RDK 展示台、门禁控制台或设备状态模拟。
解决方案：Layer 6 不复用此包；实验室模拟层继续按独立的 WebRTC 占位画面、RDK 静态 / 模拟模型和门禁状态机实现。
涉及文件：`resources/gomoku-ai-academy-submission/README.md`、`resources/gomoku-ai-academy-submission/iphone/index.html`、`resources/gomoku-ai-academy-submission/iphone/ai_worker.js`
验证结果：已阅读目录结构和 README；`python3 -m py_compile` 对核心 Python 文件通过；`node --check` 对 `iphone/ai_worker.js` 和 `iphone/sw.js` 通过；未运行未知服务或脚本。
画面变化：否。
截图：无，代码评估不涉及用户可见画面。
剩余风险：Layer 6 后续仍需单独设计实验室模拟数据、屏幕动画、门禁确认流程和 RDK 模型占位。
