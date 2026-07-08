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

现象：用户要求为协作者准备交接文档。用户将同时进行 Layer 6 与 Layer 12 开发，协作者将在新分支 `fortune` 制作 Layer 8，占卜屋交互包括塔罗、星座和周易，最后通过 PR 合并。

原因判断：Layer 5 已验收为模型摆放层，Layer 8 才开始做点击、选中、解读、mock 和接口。并行开发时需要明确文件边界、资源策略和验收标准，避免协作者误改实验室、五子棋或重新摆放 Layer 5 模型。

解决方案：新增 `validation/layer-8/fortune-handoff.md`。文档说明分支和并行开发边界、当前占卜屋模型坐标、塔罗贴图资源现状、可复用 MJS 脚本位置、塔罗 78 张空白牌选择流程、星座 12 区域选择流程、周易铜钱运算规则、三块屏幕显示要求、建议文件结构、验证命令和已知坑。同时更新 `Tech-Spec.md`，把旧 Layer 5 占卜屋模拟业务层口径迁移到 Layer 8；更新 `MEMORY.md` 记录长期协作安排和塔罗贴图资源判断。

涉及文件：`validation/layer-8/fortune-handoff.md`、`validation/layer-8/debug.md`、`Tech-Spec.md`、`MEMORY.md`。

验证结果：文档更新完成；本次未修改运行时代码，因此不运行构建。已实际检查 `resources/fortune/textures/`、`resources/fortune/*.mjs`、`FortuneAssetStage.tsx`、`fortuneModelAssets.ts` 和 `InteractionSystem.tsx` 后再写交接判断。

画面变化：无。本次只创建协作文档和同步技术说明。

截图：不需要截图。

剩余风险：交接文档是开发建议和边界说明，不等同于 Layer 8 实现。协作者实际实现时仍需补充资源复制脚本、类型定义、交互组件、mock 数据、视觉验证截图和构建验证。
