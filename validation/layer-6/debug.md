# Layer 6 调试记录

本文件只记录 Layer 6：世界内五子棋模拟层 的问题、原因判断、解决方案和验证结果。不要记录 secret、token、私钥、密码或内部敏感地址。

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
版本 / Layer：Layer 6 / Layer 7 编号纠正
现象：用户指出此前 Layer 6 和 Layer 7 写反；本文件原先记录的是实验室模拟层内容。
原因判断：分层事实来源曾把 Layer 6 写成实验室模拟层、Layer 7 写成世界内五子棋模拟层，与当前纠正后的编号相反。
解决方案：将 Layer 6 更正为世界内五子棋模拟层；实验室模拟层相关资源评估和验收记录移到 `validation/layer-7/debug.md`；同步更新 `VALIDATION_LAYERS.md`、`MEMORY.md`、`Tech-Spec.md` 和 Layer 8 协作引用。
涉及文件：`VALIDATION_LAYERS.md`、`validation/layer-6/debug.md`、`validation/layer-7/debug.md`、`MEMORY.md`、`Tech-Spec.md`、`validation/layer-8/debug.md`、`validation/layer-8/fortune-handoff.md`
验证结果：本次为文档编号纠正；已通过 `rg` 检查 Layer 6 / Layer 7 引用，未发现仍把 Layer 6 写成实验室或把 Layer 7 写成五子棋的旧口径。
画面变化：否。
截图：无，本次不改变用户可见画面。
剩余风险：本次只修正文档和验证归档编号，不新增运行时五子棋能力或补拍截图。
