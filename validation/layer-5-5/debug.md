# Layer 5.5 调试记录

本文件只记录 Layer 5.5：视觉渲染基线层 的问题、原因判断、解决方案和验证结果。不要记录 secret、token、私钥、密码或内部敏感地址。

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

## 2026-07-08 / Layer 5.5 235 视觉渲染基线

日期：2026-07-08

版本 / Layer：Layer 5.5 视觉渲染基线层

现象：用户要求实施 235 视觉渲染计划，只做光照基线、材质 / 屏幕质感和低成本“光追感”，不新增后处理依赖，不做真实 path tracing，也不调整 Layer 5 已验收的占卜屋模型坐标。

原因判断：当前世界光照主要依赖较高环境光、半球光和单向光，画面容易被整体打平；占卜屋三块内容屏和实验室 / 五子棋模块面板大量使用不受光的白色 `meshBasicMaterial`，视觉上像临时白板；Layer 5 摆位期的室内坐标辅助仍会在室内加载后显示，会污染视觉验收画面。

解决方案：在 Canvas 创建阶段设置 sRGB 输出、ACES tone mapping、固定曝光和软阴影类型；将主世界光照改为低环境光、柔和天光和暖色主光，主光阴影图升级到 `2048` 并配置 shadow camera 范围、bias 和 normal bias。将占卜屋三块内容屏改为深色 PBR 屏幕材质并加入轻微 emissive；为占卜屋内部增加暖色点光、紫色辅助点光和星座侧弱冷光；将实验室和五子棋模块面板底板改为深色屏幕质感材质并保持文字、按钮可读；移除占卜屋室内临时坐标辅助渲染。

涉及文件：`app/nav-world/src/world/WorldExperience.tsx`、`app/nav-world/src/world/WorldScene.tsx`、`app/nav-world/src/modules/divination/FortuneAssetStage.tsx`、`app/nav-world/src/modules/WorldModulePanels.tsx`、`VALIDATION_LAYERS.md`、`TODO.md`、`Tech-Spec.md`、`validation/layer-5-5/debug.md`、`MEMORY.md`。

验证结果：`npm run assets:fortune:check` 通过；`npm run build` 通过，仍有既有 `WorldExperience` chunk 超过 500KB 的 Vite 警告但不阻断；`npm run assets:check` 通过。启动 Vite preview 到 `http://127.0.0.1:4174/`，使用 Playwright Chromium 等待 `.startup-screen` 移除和 `.world-canvas canvas` 可见后生成桌面端、移动端截图；截图脚本未发现 4xx、请求失败、console error 或 pageerror。截图目检确认没有黑屏、过曝、明显文字重叠，HUD、准星、触屏按钮和底部提示没有互相遮挡。额外运行 `npm run test:e2e`，桌面端和移动端 3D canvas 加载、强制 2D fallback 共 4 条 smoke 测试全部通过。

画面变化：有。整体光照、阴影、占卜屋内容屏、实验室 / 五子棋模块面板底板和占卜屋室内氛围灯发生变化；占卜屋室内坐标辅助不再显示。

截图：`validation/layer-5-5/visual-desktop.png`、`validation/layer-5-5/visual-mobile.png`。

剩余风险：本层没有引入 Bloom / SSAO / 环境贴图，也没有做真实 path tracing；高画质模式和低性能模式仍留到 Layer 13 或后续美术专项。headless 截图不能完整验证 Pointer Lock 移动时的阴影闪烁感，仍建议后续实机移动观察。

## 2026-07-11 / Layer 5.6 暮光写实光影增强

日期：2026-07-11

版本 / Layer：Layer 5.6 暮光写实光影增强

现象：户外背景仍是纯色，环境光和单向光的色彩关系偏平；草地、建筑和装饰缺少统一的天空反射，程序化灯笼只有几何体而没有局部光照。第一轮低角度太阳测试还让可走地形出现大面积平行阴影条纹。

原因判断：原光照缺少可见天空与反射环境，暖冷关系主要靠直接光，材质之间难以形成自然的环境统一感。低角度太阳下，可走地形同时投射并接收自身阴影，低面数三角面和阴影精度共同放大了 self-shadow acne。另一次背光夕阳试验虽然轮廓更强，但占卜屋和实验室暗部可读性明显下降。

解决方案：新增程序化 `Sky`，并用 `Environment + Lightformer` 生成只更新一帧、`64px` 分辨率的低成本环境反射；户外光照使用暖色主光、冷色半球光和冷色侧向补光，保留一组 `2048` shadow map。调整曝光、雾、shadow bias 和 normal bias；可走地形改为只接收阴影、不投射阴影，建筑与近景装饰仍投影。灯笼加入短距离、无阴影的暖色点光。放弃过暗的背光夕阳，采用建筑正面仍可读的均衡晚午暖阳。

涉及文件：`app/nav-world/src/world/WorldAtmosphere.tsx`、`app/nav-world/src/world/WorldScene.tsx`、`app/nav-world/src/world/WorldExperience.tsx`、`app/nav-world/src/world/WorldComposition.tsx`、`app/nav-world/src/world/IslandTerrain.tsx`、`Tech-Spec.md`、`TODO.md`、`VALIDATION_LAYERS.md`、`validation/layer-5-5/debug.md`、`MEMORY.md`。

验证结果：`npx tsc --noEmit` 通过；`npm run build` 通过，只有既有的 `WorldExperience` chunk 超过 500KB 警告。Vite preview 在 `127.0.0.1:4175` 加载后生成桌面端与手机尺寸截图；目检未见阴影条纹、过曝、死黑或新增 HUD 遮挡问题。手机尺寸只做回归，不属于本轮专项改造。

画面变化：有。天空、材质反射、主次光色、雾中远景层次、地面投影关系和灯笼附近的暖光均发生变化；未引入 Bloom、SSAO、PCSS、ContactShadows 或实时光线追踪。

截图：`validation/layer-5-5/lighting-dusk-desktop.png`、`validation/layer-5-5/lighting-dusk-mobile.png`。

剩余风险：headless 静态截图不能完整验证 Pointer Lock 行走时的阴影闪烁；新增天空与环境组件使最终世界 chunk 约增加 `21KB gzip`。环境反射固定为一帧和低分辨率以控制运行成本。

部署结果：2026-07-11 通过 `scripts/deploy-production.sh` 发布为 `releases/20260711060605-91a5231` 并原子切换 `current`。前端 TypeScript 与 Vite 构建通过，fortune AI 11 项测试全部通过，生产依赖审计为 0 个漏洞；systemd 服务、内部健康端点、Nginx 配置、生产首页、新版主世界 JS 和公共占卜健康端点复检通过。构建仍只有既有的主世界 chunk 超过 500KB 警告。
