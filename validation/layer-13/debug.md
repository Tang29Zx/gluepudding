# Layer 13 调试记录

本文件只记录 Layer 13：性能和移动端层 的问题、原因判断、解决方案和验证结果。不要记录 secret、token、私钥、密码或内部敏感地址。

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

日期：2026-07-11
版本 / Layer：Layer 13 / 出生点构图与 2D 兜底页视觉收口
现象：桌面端首帧大面积为高饱和绿色地面，三个核心方向缺少地面导向；版权备案屏位于主视线；2D 兜底页与 3D 世界风格脱节且保留开发阶段文案。
原因判断：出生相机俯角过大，地形顶点色饱和度高，出生点到各地标没有可见连线；兜底页仍沿用 Layer 0 的通用粉色卡片结构。
解决方案：将初始相机调整为 `pitch=-0.01` / `yaw=0.05`；新增 `WorldComposition` 程序化贴地石径、岩石、草簇、灯笼和五子棋标记；降低可走地形顶点色饱和度，收紧雾、曝光和主光，启用 PCF 软阴影；关闭会产生大块远投影的中央装饰阴影；版权备案屏移到非首帧位置；兜底页改用当前真实世界截图、深墨紫 / 旧金视觉系统和纵向区域入口。
涉及文件：`app/nav-world/src/world/WorldComposition.tsx`、`sceneConfig.ts`、`PlayerController.tsx`、`WorldScene.tsx`、`WorldExperience.tsx`、`IslandTerrain.tsx`、`IslandScenery.tsx`、`modules/laboratory/LaboratoryDebugAccessScreen.tsx`、`components/FallbackPage.tsx`、`styles.css`、`app/nav-world/public/images/world-overview.webp`。
验证结果：`npm run build` 通过；Chromium 本地生产 preview 在 1440×900 和 390×844 尺寸下无 console error / page error；`?forceFallback=1` 的图片、布局和入口可渲染。生产已切换到 `releases/20260711045314-91a5231`，Nginx 配置检查通过，`/internal/health` 返回 `ok`，线上首页已引用新资源 hash，`/images/world-overview.webp` 返回 200。发布脚本的单次即时健康检查曾在服务监听前误触发回滚，已改为最长 20 秒短轮询。
画面变化：有。出生点主焦点、地形色彩、导向路径、场景装饰、阴影、雾、2D 兜底页均变化。
截图：`validation/layer-13/world-composition-desktop.png`、`validation/layer-13/world-composition-mobile.png`、`validation/layer-13/fallback-v2-desktop.png`、`validation/layer-13/fallback-v2-mobile.png`。
剩余风险：按用户要求，本次不做移动端 HUD / 触屏移动专项改造；新装饰不参与碰撞，路径是视觉导向而非物理边界；真实外部降级服务的登录和业务状态未在本次本地预览中操作验证。
