# Layer 1 调试记录

本文件只记录 Layer 1：3D 世界存活层 的问题、原因判断、解决方案和验证结果。不要记录 secret、token、私钥、密码或内部敏感地址。

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

## 2026-07-07 / Layer 1 初始验证

现象：需要确认 3D 场景能稳定出现，并且不是远距离微缩沙盘。

原因判断：用户目标是第一人称实时大世界，基础尺度和取景会影响后续移动、交互和区域接入。

解决方案：采用第一人称基准，放大场地和区域占位体，保持 WebGL 初始化失败时回落到 Layer 0。

涉及文件：`VALIDATION_LAYERS.md`、`gluepudding/app/nav-world/src/world/WorldScene.tsx`、`gluepudding/app/nav-world/src/world/sceneConfig.ts`。

验证结果：用户已在 `VALIDATION_LAYERS.md` 中确认 Layer 1 OK。

画面变化：已有第一人称场地截图记录。

截图：`validation/layer-1/firstperson-desktop.png`、`validation/layer-1/firstperson-mobile.png`。

剩余风险：当前工作区未检测到历史截图文件本体；后续如重新验证，需要按新规则重新归档电脑端和手机端截图。
