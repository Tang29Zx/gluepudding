# Layer 0 调试记录

本文件只记录 Layer 0：静态兜底层 的问题、原因判断、解决方案和验证结果。不要记录 secret、token、私钥、密码或内部敏感地址。

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

## 2026-07-07 / Layer 0 初始验证

现象：需要确认 WebGL 不可用时仍有 2D 兜底入口。

原因判断：3D 大世界依赖浏览器 WebGL，必须保证低性能或初始化失败时站点不空白。

解决方案：保留 React fallback 页面，并在 3D 初始化失败或 `forceFallback` 参数下展示静态兜底内容。

涉及文件：`VALIDATION_LAYERS.md`、`gluepudding/app/nav-world/src/components/FallbackPage.tsx`。

验证结果：用户已在 `VALIDATION_LAYERS.md` 中确认 Layer 0 OK。

画面变化：已有兜底页面截图记录。

截图：`validation/layer-0/fallback-desktop.png`、`validation/layer-0/fallback-mobile.png`。

剩余风险：当前工作区未检测到历史截图文件本体；后续如重新验证，需要按新规则重新归档电脑端和手机端截图。
