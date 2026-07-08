# Layer 4 调试记录

本文件只记录 Layer 4：模块外壳层 的问题、原因判断、解决方案和验证结果。不要记录 secret、token、私钥、密码或内部敏感地址。

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

## 2026-07-08 / Layer 4 模块外壳实现

日期：2026-07-08

版本 / Layer：Layer 4 模块外壳层

现象：Layer 4 需要证明占卜屋、实验室、五子棋都能作为世界内模块打开和关闭，并能稳定展示 `loading`、`ready`、`error`、`offline` 状态，而不是继续使用 Layer 3 的通用占位面板。

原因判断：Layer 3 已具备靠近提示、准星命中、左键选择和暂停移动能力，但模块状态、模块注册、按需加载和局部错误隔离尚未建立；如果继续用普通 DOM 浮层，会偏离用户选择的 3D 表面方案。

解决方案：新增 Layer 4 技术说明；新增模块注册表、模块类型、共享模块表面、共享模块框架和局部模块 Error Boundary；创建占卜屋、实验室、五子棋三个模块目录；将交互目标映射到模块 id；使用 3D `Html` 表面锚定模块 UI；模块打开时暂停移动，关闭时恢复 Canvas focus；每个模块提供状态切换控件。

涉及文件：`Tech-Spec.md`、`gluepudding/app/nav-world/src/modules/`、`gluepudding/app/nav-world/src/world/WorldExperience.tsx`、`gluepudding/app/nav-world/src/world/WorldScene.tsx`、`gluepudding/app/nav-world/src/world/InteractionSystem.tsx`、`gluepudding/app/nav-world/src/styles.css`、`TODO.md`、`VALIDATION_LAYERS.md`、`MEMORY.md`。

验证结果：`npm run build` 通过；Vite preview 下使用 Chromium + SwiftShader 打开真实 3D 世界，桌面端通过 Pointer Lock 后左键打开占卜屋模块表面，移动端通过 `Select` 打开占卜屋模块表面；两端均依次切换 `Loading`、`Error`、`Offline`、`Ready` 并切到最终截图状态；额外转向验证实验室和五子棋模块也能通过准星左键打开并关闭；点击 `Close` 后模块关闭，HUD 回到 `World Active`，地址栏未发生整页跳转。

画面变化：有。HUD 更新为 Layer 4；Layer 3 通用面板替换为锚定在 3D 区域上的模块表面；模块表面展示状态、目标、触发方式、状态切换和能力占位。

截图：`validation/layer-4/modules-desktop.png`、`validation/layer-4/modules-mobile.png`。

剩余风险：Layer 4 只验证模块外壳；真实占卜、实验室能力和五子棋流程仍留到后续 Layer。自动化桌面截图使用远距离左键命中打开模块，真实用户主要按“靠近后按 E”路径操作。

## 2026-07-08 / Layer 4 移动端按钮遮挡修复

日期：2026-07-08

版本 / Layer：Layer 4 模块外壳层

现象：移动端截图初版中，模块打开后 `Interact` / `Select` 触屏按钮仍显示在底部，与交互提示条发生视觉重叠。

原因判断：Layer 3 的触屏按钮只在打开面板时禁用，没有隐藏；Layer 4 模块表面打开后，触屏按钮已无操作价值，继续显示会遮挡用户当前任务信息。

解决方案：模块打开时不渲染 `.world-touch-actions`，让模块表面和底部提示条成为唯一可见操作上下文。

涉及文件：`gluepudding/app/nav-world/src/world/WorldExperience.tsx`。

验证结果：重新运行 `npm run build` 通过；重新生成移动端截图，底部不再出现 `Interact` / `Select` 按钮遮挡；模块状态切换和关闭验证仍通过。

画面变化：有。模块打开时移动端触屏按钮隐藏。

截图：`validation/layer-4/modules-mobile.png`。

剩余风险：无已知 Layer 4 视觉遮挡风险；完整移动端触屏移动方案仍留到 Layer 13。

## 2026-07-08 / Layer 4 近距离模块表面裁切修复

日期：2026-07-08

版本 / Layer：Layer 4 模块外壳层

现象：用户实机反馈实验室模块表面有遮挡；截图显示玩家靠近实验室屏幕时，模块 UI 被透视放得过大，顶部和右侧超出浏览器视口，`STATUS`、标题上部和操作区域出现裁切。

原因判断：模块表面使用 `@react-three/drei` 的 `Html transform + distanceFactor`，该组合会按相机距离进行 CSS3D 透视缩放。玩家贴近实验室表面时，模块 DOM 被放大到超过视口，造成可读内容和按钮被裁掉。

解决方案：移除模块表面的 `transform`、`sprite` 和 `distanceFactor` 距离缩放，改为使用 3D 坐标投影定位；新增 `calculateModulePosition()` 将模块中心夹紧在桌面端和移动端安全视口内，保留世界锚点语义，同时让 UI 尺寸保持稳定。

涉及文件：`Tech-Spec.md`、`gluepudding/app/nav-world/src/modules/WorldModuleSurface.tsx`、`gluepudding/app/nav-world/src/modules/moduleRegistry.ts`、`validation/layer-4/debug.md`、`MEMORY.md`。

验证结果：`npm run build` 通过；`npm run assets:check` 通过；Vite preview + Chromium + SwiftShader 重新生成截图。桌面端打开实验室模块后，模块矩形为 `537,235 -> 917,677`，完整落在 `1440x960` 视口内；移动端打开占卜屋模块后，模块矩形为 `35,138 -> 355,652`，完整落在 `390x844` 视口内，且不与底部提示重叠。

画面变化：有。模块表面不再随距离剧烈放大，近距离打开时保持稳定可读尺寸。

截图：`validation/layer-4/modules-desktop.png`、`validation/layer-4/modules-mobile.png`。

剩余风险：模块内容后续接入真实业务后可能变高；后续 Layer 增加真实内容时仍需继续做桌面端和移动端视觉验证。

## 2026-07-08 / Layer 4 常驻 3D 模块表面重做

日期：2026-07-08

版本 / Layer：Layer 4 模块外壳层

现象：用户纠正 Layer 4 方向：模块界面不应是点击后出现的屏幕浮层，也不应让鼠标焦点离开 3D 世界；预期是界面直接常驻贴在屋子、大屏或棋盘表面，像世界内可交互模块一样存在。

原因判断：上一版虽然避免了整页跳转，但仍采用 `Html` / DOM 浮层和打开/关闭模型；该模型会引入焦点切换、Pointer Lock 退出、移动暂停和屏幕遮挡问题，偏离“同一个 3D 世界内实时操作”的核心目标。

解决方案：移除 Layer 4 运行路径中的 `WorldModuleSurface` 和 `activeModule` 打开/关闭状态；新增真实 R3F 常驻模块面板，使用 plane、mesh 和 Drei `Text` 渲染占卜屋、实验室、五子棋三个表面；每个状态芯片都是可 raycast 的 3D mesh，准星命中后左键或 `E` 在 Canvas 内切换 `ready`、`loading`、`offline`、`error`；模块操作不暂停移动，不主动退出 Pointer Lock；保留模块注册表、状态类型、目标映射和局部 Error Boundary。

涉及文件：`Tech-Spec.md`、`TODO.md`、`VALIDATION_LAYERS.md`、`MEMORY.md`、`gluepudding/app/nav-world/src/modules/WorldModulePanels.tsx`、`gluepudding/app/nav-world/src/modules/moduleRegistry.ts`、`gluepudding/app/nav-world/src/modules/types.ts`、`gluepudding/app/nav-world/src/world/WorldExperience.tsx`、`gluepudding/app/nav-world/src/world/WorldScene.tsx`、`gluepudding/app/nav-world/src/world/InteractionSystem.tsx`。

验证结果：`npm run build` 通过；`npm run assets:check` 通过；Vite preview + Chromium + SwiftShader 重新截图。桌面端截图中占卜屋、实验室和五子棋三个模块表面都常驻显示在 3D 场景物体上，地址栏未跳转；移动端截图中占卜屋模块表面常驻可见，`Interact` / `Select` 触屏按钮与底部提示无重叠。源码中已移除 Layer 4 运行路径的 `Html` 浮层、`activeModule` 打开/关闭模型和旧 DOM 模块框架。

画面变化：有。模块从屏幕浮层变为直接贴在 3D 场景物体表面的常驻面板；HUD 显示 `Surface Control` / `Module Focused`；底部提示改为准星命中状态芯片后左键或 `E` 操作。

截图：`validation/layer-4/modules-desktop.png`、`validation/layer-4/modules-mobile.png`。

剩余风险：本层仍只做模块外壳；“进入某区域才加载对应模块，其余不加载”作为后续性能优化，尚未实现。

## 2026-07-08 / Layer 4 准星半透明覆盖修复

日期：2026-07-08

版本 / Layer：Layer 4 模块外壳层

现象：用户反馈准星需要修改，当前画面像有一层透明层覆盖在准星上。

原因判断：`.world-crosshair.is-aimed` 给横竖两条伪元素同时添加了较大的半透明 `box-shadow`，当准星叠在 3D 模块表面或按钮上时，中心会形成块状光晕，看起来像额外透明层盖住准星。

解决方案：将准星改为四段式 CSS 背景线，中心留空；只保留轻量 `drop-shadow` 提升对比度，移除覆盖式半透明 `box-shadow`。瞄准状态只改变颜色和轻微缩放，不再在中心生成遮罩感。

涉及文件：`gluepudding/app/nav-world/src/styles.css`。

验证结果：`npm run build` 通过；`npm run assets:check` 通过；Vite preview + Chromium + SwiftShader 重新生成桌面端和移动端截图。截图中准星中心保持空心，没有半透明块覆盖模块表面。

画面变化：有。准星从叠加光晕的十字线改为中心留空的四段式准星。

截图：`validation/layer-4/modules-desktop.png`、`validation/layer-4/modules-mobile.png`。

剩余风险：不同背景亮度下准星对比度仍需在后续真实美术场景中继续观察。

## 2026-07-08 / Layer 4 灰黑十字准星调整

日期：2026-07-08

版本 / Layer：Layer 4 模块外壳层

现象：用户要求准星改回之前的十字形灰黑色，但不要透明层。

原因判断：上一版四段式准星解决了透明覆盖，但形态不符合用户希望的传统十字准星；准星本身不需要额外光晕，只需要不透明、清晰、中心可读。

解决方案：将 `.world-crosshair` 改回 `::before` 横线和 `::after` 竖线组成的传统十字形；颜色固定为不透明灰黑色 `#2f3037`；移除背景分段、filter、半透明阴影和瞄准态颜色变化，只保留轻微缩放反馈。

涉及文件：`gluepudding/app/nav-world/src/styles.css`。

验证结果：`npm run build` 通过；`npm run assets:check` 通过；Vite preview + Chromium + SwiftShader 重新生成桌面端和移动端截图。截图中准星为灰黑十字形，中心没有透明覆盖层。

画面变化：有。准星从中心留空的四段式改为灰黑色传统十字形。

截图：`validation/layer-4/modules-desktop.png`、`validation/layer-4/modules-mobile.png`。

剩余风险：灰黑准星在深色真实模型前可能需要后续加描边或动态反色，但本次按用户要求不加入半透明覆盖层。

## 2026-07-08 / Layer 4 准星尺寸放大

日期：2026-07-08

版本 / Layer：Layer 4 模块外壳层

现象：用户要求准星稍微大一点。

原因判断：上一版灰黑十字准星没有透明层，但在远距离 3D 面板前显得偏小，用户识别和瞄准状态感知不够明显。

解决方案：保持不透明灰黑十字形和无阴影原则，将准星盒子从 `22px` 放大到 `28px`，横竖线长度从 `16px` 放大到 `22px`，线宽保持 `2px`。

涉及文件：`gluepudding/app/nav-world/src/styles.css`。

验证结果：`npm run build` 通过；`npm run assets:check` 通过；Vite preview + Chromium + SwiftShader 重新生成桌面端和移动端截图。截图中准星更大，仍无透明覆盖层。

画面变化：有。准星尺寸略增大。

截图：`validation/layer-4/modules-desktop.png`、`validation/layer-4/modules-mobile.png`。

剩余风险：无新增风险。

## 2026-07-08 / Layer 4 用户实机确认

日期：2026-07-08

版本 / Layer：Layer 4 模块外壳层

现象：用户确认 Layer 4。

原因判断：常驻 3D 模块表面、灰黑十字准星、Canvas 内交互和模块状态切换已满足当前 Layer 4 验收口径。

解决方案：在 `VALIDATION_LAYERS.md` 记录用户实机确认，允许后续进入 Layer 4.5 资源接入准备层。

涉及文件：`VALIDATION_LAYERS.md`、`validation/layer-4/debug.md`、`MEMORY.md`。

验证结果：用户实机确认 OK。

画面变化：无。

截图：沿用 `validation/layer-4/modules-desktop.png`、`validation/layer-4/modules-mobile.png`。

剩余风险：Layer 4 只完成模块外壳，不包含大场景模型和真实占卜业务；这些进入 Layer 4.5 / Layer 5。
