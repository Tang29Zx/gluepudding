# Layer 3 调试记录

本文件只记录 Layer 3：世界内交互层 的问题、原因判断、解决方案和验证结果。不要记录 secret、token、私钥、密码或内部敏感地址。

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

## 2026-07-07 / Layer 3 世界内交互实现

现象：Layer 3 需要证明大世界不是静态展示，玩家靠近或瞄准占卜屋、实验室、五子棋区域后，应能看到提示、触发世界内面板、选中对象，并在面板打开时暂停移动。

原因判断：原 `InteractionSystem` 只是空组件，`CameraRig` 内部独占玩家控制状态，交互系统无法读取玩家位置，也无法在面板打开时暂停移动。

解决方案：将玩家控制状态提升到 Canvas 内运行容器，传给 `CameraRig` 和 `InteractionSystem`；为 `divination-house`、`laboratory`、`gomoku-board` 建立统一交互配置；增加距离检测、相机中心射线检测、对象高亮、`E` 区域交互、右键对象交互、世界内提示、选中状态、占位面板和移动端 `Interact` / `Select` 按钮。面板打开时禁用移动并退出 Pointer Lock，关闭后通过点击画布恢复视角控制。

涉及文件：`gluepudding/app/nav-world/src/world/InteractionSystem.tsx`、`gluepudding/app/nav-world/src/world/WorldExperience.tsx`、`gluepudding/app/nav-world/src/world/WorldScene.tsx`、`gluepudding/app/nav-world/src/world/CameraRig.tsx`、`gluepudding/app/nav-world/src/world/PlayerController.tsx`、`gluepudding/app/nav-world/src/styles.css`、`TODO.md`、`VALIDATION_LAYERS.md`、`MEMORY.md`。

验证结果：`npm run build` 通过；预览构建产物后刷新 3 次均显示 Layer 3 运行态；占卜屋、实验室、五子棋均能靠近后按 `E` 打开面板并用 `ESC` 关闭；占卜屋右键可触发对象选中面板；`?forceFallback` 仍显示 2D 兜底入口；桌面端和移动端截图已归档。

画面变化：有。新增目标高亮、底部交互提示、当前选中状态、世界内占位面板、移动端交互按钮，HUD 状态从 Layer 2 更新为 Layer 3。

截图：`validation/layer-3/interaction-desktop.png`、`validation/layer-3/interaction-mobile.png`。

剩余风险：Layer 3 仅验证交互外壳，占位面板不承载真实模块；完整模块加载、错误、离线状态留到 Layer 4。移动端只有 `Interact` / `Select` 替代按钮，完整触屏移动方案留到 Layer 13。

## 2026-07-07 / Layer 3 键盘验证兼容

现象：自动化验证早期使用固定按键时，偶发靠近提示已出现但 `E` 未打开面板，斜向移动路径也会因按键时机或固定时长误差错过区域。

原因判断：实现只依赖 `event.code === "KeyE"` 不够稳健；自动化脚本如果在玩家控制 effect 挂载前按下移动键，或用固定移动时长穿过交互半径边缘，会造成验证误判。

解决方案：区域交互键同时兼容 `event.code` 和 `event.key`；验证脚本等待交互提示层稳定后再移动，并用“移动直到目标提示出现就停止”的方式验证区域。

涉及文件：`gluepudding/app/nav-world/src/world/InteractionSystem.tsx`。

验证结果：重新运行 `npm run build` 通过；占卜屋、实验室、五子棋目标验证通过；移动端截图和强制 fallback 验证通过。

画面变化：无，属于输入兼容性和验证方式调整。

截图：无新增截图；沿用本次 Layer 3 归档截图。

剩余风险：无已知功能风险；真实用户手感仍以实机确认为准。

## 2026-07-07 / Layer 3 面板焦点和物理异步修复

现象：用户反馈两个问题：点击“关闭面板”后鼠标焦点不会自动回到 3D 世界；跳起来打开面板后玩家停在空中，不会继续下落。

原因判断：关闭按钮只关闭 React 面板状态，没有利用按钮点击这个用户手势重新聚焦 canvas 并申请 Pointer Lock；同时 `isMovementEnabled` 为 false 时 `PlayerController` 的 `useFrame` 直接返回，导致输入暂停的同时重力和垂直速度也被暂停。

解决方案：第一版尝试在关闭按钮点击时聚焦 canvas 并在非触屏指针环境下重新申请 Pointer Lock；`CameraRig` 只在组件卸载时退出 Pointer Lock，避免状态切换清理函数抵消关闭按钮的重新申请。`PlayerController` 将“暂停输入”和“停止物理”拆开：面板打开时清空输入和跳跃缓冲，但继续执行重力、垂直速度和空中惯性，落地后再归零水平速度。后续发现真实 canvas 选择器仍需修正，见下一条记录。

涉及文件：`gluepudding/app/nav-world/src/world/WorldExperience.tsx`、`gluepudding/app/nav-world/src/world/CameraRig.tsx`、`gluepudding/app/nav-world/src/world/PlayerController.tsx`、`gluepudding/app/nav-world/src/styles.css`。

验证结果：`npm run build` 通过；预览构建产物后，在占卜屋附近打开面板，等待后确认面板提示为“移动输入已暂停，世界仍会继续运行”；桌面端和移动端截图已重新归档。后续复查发现 `canvas.world-canvas` 不是 R3F 真实 canvas，Pointer Lock 验证结论以下一条记录为准。

画面变化：有。面板打开时底部提示文案更新为“移动输入已暂停，世界仍会继续运行。关闭面板后回到同一个世界位置。”

截图：`validation/layer-3/interaction-desktop.png`、`validation/layer-3/interaction-mobile.png`。

剩余风险：真实 canvas 选择器和 Pointer Lock 复核见下一条记录。

## 2026-07-07 / Layer 3 真实 canvas 焦点和空中速度修复

现象：用户再次反馈点击“关闭面板”后鼠标仍没有回到世界；跳起来按 `E` 打开面板时仍像被空中截停，不符合物理规律。

原因判断：`@react-three/fiber` 的 `Canvas` `className` 实际挂在外层 `.world-canvas` div 上，真实 `<canvas>` 没有 `world-canvas` class，之前 `canvas.world-canvas` 选择器没有选中真实 canvas，关闭按钮没有可靠地聚焦和锁定真实 canvas。空中截停的进一步原因是打开面板会退出 Pointer Lock，`pointerlockchange` 和禁用移动 effect 调用了会清空水平速度的 `clearMovement()`，把输入暂停错误地扩大成了速度清零。

解决方案：关闭面板时先用 `flushSync` 同步关闭面板，再在同一次按钮点击手势中聚焦 `.world-canvas canvas` 并申请 Pointer Lock；`onCreated` 为真实 `gl.domElement` 设置 `tabIndex = 0`。`PlayerController` 暴露 `clearMovementInput()`，`CameraRig` 在 Pointer Lock 退出和面板暂停时只清输入，不清空水平速度；`useFrame` 继续执行重力、垂直速度和空中惯性，落地后才在无输入状态下归零水平速度。

涉及文件：`gluepudding/app/nav-world/src/world/WorldExperience.tsx`、`gluepudding/app/nav-world/src/world/CameraRig.tsx`、`gluepudding/app/nav-world/src/world/PlayerController.tsx`、`gluepudding/app/nav-world/src/styles.css`。

验证结果：`npm run build` 通过；预览构建产物后，打开面板并点击“关闭面板”，浏览器验证 `document.activeElement` 和 `document.pointerLockElement` 均为真实 `.world-canvas canvas`；`?forceFallback` 仍可打开。物理修复通过代码路径验证：打开面板、退出 Pointer Lock 和面板暂停都只清输入，`useFrame` 不返回，空中速度不会被清零。

画面变化：无，属于焦点、Pointer Lock 和运动物理行为修复。

截图：无新增截图；界面静态画面未变化。

剩余风险：Pointer Lock 仍依赖浏览器允许用户手势触发；点击关闭按钮路径已验证，`ESC` 关闭仍不强制申请 Pointer Lock。

## 2026-07-07 / Layer 3 准星和左键对象选择

现象：用户指出右键对象交互不知道点哪里有效，并询问左键是否更好。右键作为主交互不直观，且移动端没有右键。

原因判断：当前世界是第一人称 Pointer Lock 视角，用户实际操作的是屏幕中心方向，而不是自由鼠标坐标；因此对象级交互应以“中心准星命中什么”为依据，再用左键或移动端按钮确认。右键更适合调试或高级上下文操作，不应作为主路径。

解决方案：新增中心准星，命中可交互对象时准星高亮；对象提示改为“准星对准对象，左键选择”；真实 canvas 左键点击在 Pointer Lock 已激活且准星命中目标时打开对象面板；右键只阻止浏览器菜单，不再触发对象面板；移动端继续使用 `Select` 按钮作为替代。同步更新 `REQUIREMENTS.md`、`TODO.md`、`VALIDATION_LAYERS.md` 和 `MEMORY.md`，将主交互模型改为准星命中 + 左键/点击。

涉及文件：`gluepudding/app/nav-world/src/world/InteractionSystem.tsx`、`gluepudding/app/nav-world/src/world/WorldExperience.tsx`、`gluepudding/app/nav-world/src/styles.css`、`REQUIREMENTS.md`、`TODO.md`、`VALIDATION_LAYERS.md`、`MEMORY.md`。

验证结果：`npm run build` 通过；预览构建产物后，启动层消失时屏幕中心命中真实 canvas；点击画布进入 Pointer Lock 后靠近占卜屋，准星命中入口并高亮；右键不会打开对象面板；左键打开对象面板且触发方式显示 `左键 / Select`；`?forceFallback` 仍可打开。

画面变化：有。新增中心准星；提示文案从右键改为准星对准后左键选择；移动端截图显示准星命中态。

截图：`validation/layer-3/interaction-desktop.png`、`validation/layer-3/interaction-mobile.png`。

剩余风险：左键对象选择要求先进入 Pointer Lock；第一次点击画布用于锁定鼠标，后续左键才触发对象选择。移动端完整触屏移动方案仍留到 Layer 13。

## 2026-07-07 / Layer 3 真实 canvas 尺寸修复

现象：自动化验证发现启动层消失前点击会落到启动遮罩；启动层消失后还需要确认真实 canvas 可覆盖整个世界，否则中心点击可能无法稳定命中 canvas。

原因判断：R3F 的 `.world-canvas` class 挂在外层 div 上，真实 `<canvas>` 初始 DOM 尺寸可能表现为默认 300×150。虽然渲染画面可见，但点击命中和 Pointer Lock 事件需要真实 canvas DOM 盒子覆盖全屏。

解决方案：为 `.world-canvas > div` 和 `.world-canvas canvas` 增加 `width: 100% !important`、`height: 100% !important`；验证脚本等待 `.startup-screen` 移除后再点击，确保用户实际点击的是 3D world canvas。

涉及文件：`gluepudding/app/nav-world/src/styles.css`。

验证结果：预览构建产物后，真实 `.world-canvas canvas` 尺寸为 1440×960，启动层消失后屏幕中心 `elementFromPoint` 命中 `CANVAS`。

画面变化：无，属于真实 canvas 命中区域修复。

截图：无新增截图；沿用本次 Layer 3 截图。

剩余风险：无已知功能风险。

## 2026-07-07 / Layer 3 用户实机验收

现象：用户确认 Layer 3 可以验收。

原因判断：Layer 3 工程目标已覆盖：区域靠近提示、`E` 区域交互、准星命中、左键对象选择、面板暂停输入、关闭后回到世界、空中物理继续、fallback 回归和桌面/移动端截图归档。

解决方案：在 `VALIDATION_LAYERS.md` 的 Layer 3 下补充用户实机确认记录。

涉及文件：`VALIDATION_LAYERS.md`、`MEMORY.md`、`validation/layer-3/debug.md`。

验证结果：验收记录已写入；未改应用运行代码。

画面变化：无。

截图：沿用 `validation/layer-3/interaction-desktop.png`、`validation/layer-3/interaction-mobile.png`。

剩余风险：入口/门类最终 UX 方向仍是靠近后按 `E`，左键对象选择主要保留给后续区域内部具体物件。
