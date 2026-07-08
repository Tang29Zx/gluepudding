# Layer 4.5 调试记录

本文件只记录 Layer 4.5：资源接入准备层 的问题、原因判断、解决方案和验证结果。不要记录 secret、token、私钥、密码或内部敏感地址。

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

## 2026-07-08 / Layer 4.5 资源接入准备规划

日期：2026-07-08

版本 / Layer：Layer 4.5 资源接入准备层

现象：用户已将已有大场景资源和占卜屋代码放入 `resources/`，要求对规划做最小改动，而不是立即接入实现。

原因判断：`resources/float-island-low-ploy.zip` 属于世界大场景候选资源，会影响比例、出生点、交互点和性能；`resources/fortune/` 属于占卜屋功能输入，会影响 Layer 5 的类型、API 适配、mock 和 UI 流程。两类资源不应混进 Layer 4 模块外壳，也不应直接跳过资源清点进入业务集成。

解决方案：新增 Layer 4.5 资源接入准备层；在 `TODO.md` 增加 P3.5；在 `Tech-Spec.md` 记录已有资源路径、接入边界和不接入范围；明确 `resources/fortune/node_modules/`、`resources/fortune/dist/` 和 `resources/fortune/.env` 不作为主工程源码接入输入，且不读取 `.env` 内容。

涉及文件：`VALIDATION_LAYERS.md`、`TODO.md`、`Tech-Spec.md`、`validation/layer-4-5/debug.md`、`MEMORY.md`。

验证结果：已通过文本检查确认 Layer 4.5、P3.5 和资源路径说明存在；本次只做规划，不运行构建。

画面变化：无。

截图：无用户可见画面变化，不需要截图。

剩余风险：尚未检查压缩包内部模型格式、贴图、比例和许可备注；尚未梳理 `resources/fortune/src/` 可复用代码细节。
