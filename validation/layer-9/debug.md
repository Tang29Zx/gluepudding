# Layer 9 调试记录

本文件只记录 Layer 9：真实 WebRTC 层 的问题、原因判断、解决方案和验证结果。不要记录 secret、token、私钥、密码或内部敏感地址。

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
版本 / Layer：Layer 9 真实 WebRTC 层待验证项完成确认
现象：用户要求将 Layer 9 待验证标记为已完成。
原因判断：实验室大屏已按 MediaMTX WHEP 完成同源代理和前端 `MediaStream -> VideoTexture` 接入，并保留 mock、offline、unauthorized 等降级状态；真实推流上线后的最终画面仍由用户实机验证。
解决方案：在 `VALIDATION_LAYERS.md` 的 Layer 9 段落追加验收状态，记录“待验证项已完成”；在 `MEMORY.md` 记录该层状态事实。
涉及文件：`VALIDATION_LAYERS.md`、`MEMORY.md`、`validation/layer-9/debug.md`
验证结果：本次为用户验收状态归档，不修改运行时代码。
画面变化：否。
截图：无，本次只更新验收记录。
剩余风险：如果真实 `robot001` 推流源、鉴权策略或 MediaMTX 端点后续变更，需要重新验证生产环境真实视频画面。
