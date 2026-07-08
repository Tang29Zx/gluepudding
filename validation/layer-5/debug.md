# Layer 5 调试记录

本文件只记录 Layer 5：占卜屋模拟层 的问题、原因判断、解决方案和验证结果。不要记录 secret、token、私钥、密码或内部敏感地址。

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

## 2026-07-08 / Layer 5A 占卜屋模型外壳与室内按需加载

日期：2026-07-08

版本 / Layer：Layer 5A 占卜屋模型接入切片

现象：用户要求先接入占卜屋模型，业务逻辑交给其他同学；同时指出完整塔罗牌不要一次性放进浏览器，下载量太大。初版接入后，用户进一步反馈帐篷偏小、地面不平、桌子穿模、模型位置不合适、星座穹顶未放在天上、帐篷门未朝出生点、烛台没有放在桌上。

原因判断：完整 `resources/fortune/textures/` 约 80.8MB，不适合作为首屏或占卜屋模型包全量下载；初版模型舞台锚点放在模块面板下方，导致面板和帐篷内部重合；部分 GLB 使用自身原点和高度，直接按粗略坐标摆放会出现桌面穿模和道具落地。

解决方案：新增 `assets:fortune:prepare` / `assets:fortune:check`，只复制 allowlist 的 18 个轻量 GLB 到 `app/nav-world/public/models/fortune/`，不复制贴图目录和完整牌面图；新增 `FortuneAssetStage` 和 `fortuneModelAssets`，世界首屏不 preload，占卜屋外壳靠近/聚焦后加载，室内道具更靠近或通过验证参数加载；将帐篷锚点放回占卜屋中心，放大帐篷，旋转门朝出生点，增加平整圆形基底和放大魔法阵，按模型高度重新摆放桌子、桌布、烛台、水晶、星座穹顶、周易桌和铜钱。

涉及文件：`.gitattributes`、`.gitignore`、`TODO.md`、`Tech-Spec.md`、`VALIDATION_LAYERS.md`、`MEMORY.md`、`app/nav-world/package.json`、`app/nav-world/scripts/prepare-fortune-assets.mjs`、`app/nav-world/src/modules/divination/FortuneAssetStage.tsx`、`app/nav-world/src/modules/divination/fortuneModelAssets.ts`、`app/nav-world/src/world/WorldExperience.tsx`、`app/nav-world/src/world/WorldScene.tsx`。

验证结果：`npm run assets:fortune:check` 通过；`npm run assets:check` 通过；`npm run build` 通过。Playwright 网络验证确认正常首屏无 `models/fortune/` 或 `textures/` 请求；`?fortuneAssets=shell` 只请求 `models/fortune/tarot_tent.glb`；`?fortuneAssets=interior` 请求 18 个轻量 GLB，没有请求完整贴图目录。用户已开始实机检查模型摆位，本条不标记 Layer 5 通过。

画面变化：有。占卜屋附近出现帐篷外壳和室内道具；帐篷、地台、魔法阵、桌子、烛台、星座穹顶和周易道具位置发生调整。

截图：`validation/layer-5/fortune-shell-desktop.png`、`validation/layer-5/fortune-shell-mobile.png`、`validation/layer-5/fortune-interior-desktop.png`、`validation/layer-5/fortune-interior-mobile.png`。

剩余风险：headless 截图默认视角不能完全替代用户实机从占卜屋入口走入后的观察；模型比例、门向和室内物件位置仍以用户实机反馈继续微调。占卜业务逻辑、塔罗选牌、星座/周易模拟结果和完整牌面按需加载策略尚未实现。

## 2026-07-08 / Layer 5A 移除旧占卜屋占位模型

日期：2026-07-08

版本 / Layer：Layer 5A 占卜屋模型接入切片

现象：用户反馈需要一步步调整模型，第一步要求“原来占位的占卜屋不要了”。

原因判断：`WorldScene.tsx` 里仍保留 Layer 1-4 的几何占位占卜屋 `DivinationHouse()`，它会和真实帐篷/占卜屋模型形成重复表达，并干扰后续判断真实模型的比例、门向和摆位。

解决方案：删除 `DivinationHouse()` 组件和 `ReferenceLandmarks` 中对它的渲染；后续占卜屋位置只由 `FortuneAssetStage` 的帐篷/真实模型承担。

涉及文件：`app/nav-world/src/world/WorldScene.tsx`、`validation/layer-5/debug.md`。

验证结果：`npm run build` 通过；`rg` 确认 `WorldScene.tsx` / `WorldExperience.tsx` 中无 `DivinationHouse` 残留引用。

画面变化：有。旧几何占位占卜屋不再显示。

截图：本步等待用户实机检查旧占位是否已移除；后续继续调整模型摆位时统一更新 Layer 5A 截图。

剩余风险：真实帐篷模型仍按现有按需加载策略出现；如果不靠近或不使用 `?fortuneAssets=shell|interior`，占卜屋区域将不再有旧占位物作为远距离提示。

## 2026-07-08 / Layer 5A 帐篷比例翻倍

日期：2026-07-08

版本 / Layer：Layer 5A 占卜屋模型接入切片

现象：用户要求“帐篷扩大一倍”。

原因判断：当前帐篷外壳比例仍偏小，不足以作为占卜屋主体空间。

解决方案：将 `tarot-tent` 模型 scale 从 `1.42` 调整为 `2.84`，只改变帐篷外壳，不同步改动室内道具、魔法阵或桌面摆位。

涉及文件：`app/nav-world/src/modules/divination/fortuneModelAssets.ts`、`validation/layer-5/debug.md`。

验证结果：`npm run build` 通过。

画面变化：有。帐篷外壳变为当前尺寸的 2 倍。

截图：等待用户实机检查后，后续统一更新 Layer 5A 截图。

剩余风险：帐篷扩大后，室内道具和地台可能需要继续按新尺度重新布局。

## 2026-07-08 / Layer 5A 移除白灰板和圆柱支架

日期：2026-07-08

版本 / Layer：Layer 5A 占卜屋模型接入切片

现象：用户指出画面中的白白/灰灰板子不要了，旁边圆柱形支架也不要了。

原因判断：这些对象来自星座相关展示资源和周易签筒资源，当前只是模型占位，不符合用户想要的占卜屋空间表达，并且遮挡帐篷内部。

解决方案：从 `fortuneModelAssets.interiorAssets` 渲染清单移除 `zodiac-altar`、`zodiac-wheel`、`zodiac-result-stand` 和 `iching-lot-cylinder`。资源文件暂时保留在准备脚本 allowlist 中，后续确认彻底不用后再清理运行时资源。

涉及文件：`app/nav-world/src/modules/divination/fortuneModelAssets.ts`、`validation/layer-5/debug.md`。

验证结果：`npm run build` 通过；`rg` 确认上述对象不再在占卜屋模型渲染清单中出现。

画面变化：有。白/灰展示板和圆柱支架不再渲染。

截图：等待用户实机检查后，后续统一更新 Layer 5A 截图。

剩余风险：准备脚本仍会复制这些 GLB，虽然不再被浏览器请求；后续确认不用后应从 allowlist 和 public 目录一并清理。

## 2026-07-08 / Layer 5A 放大平整魔法阵地面

日期：2026-07-08

版本 / Layer：Layer 5A 占卜屋模型接入切片

现象：用户指出地上的魔法阵要覆盖整个占卜屋，并且要是平的，出现的绿地部分直接削掉。

原因判断：原平整基底半径只有 `4.95`，魔法阵 scale 只有 `1.35`，无法覆盖放大后的帐篷占地；浮岛绿地从帐篷内部露出，破坏占卜屋室内地面表达。

解决方案：将 `StageFloor` 改为半径 `12.2` 的平整圆柱基底，覆盖帐篷内部可见绿地；将 `tarot-magic-circle` 的 scale 从 `1.35` 放大到 `3.72`，并抬到基底上方，作为整个占卜屋的平面魔法阵地面。

涉及文件：`app/nav-world/src/modules/divination/FortuneAssetStage.tsx`、`app/nav-world/src/modules/divination/fortuneModelAssets.ts`、`validation/layer-5/debug.md`。

验证结果：`npm run build` 通过。

画面变化：有。占卜屋内部基底和魔法阵覆盖范围扩大，绿地应被平整地面遮盖。

截图：等待用户实机检查后，后续统一更新 Layer 5A 截图。

剩余风险：基底为覆盖式平面，并未真实修改 GLB 浮岛地形；如果玩家从极低角度看边缘，仍可能看到地形与基底交界。

## 2026-07-08 / Layer 5A 魔法阵可踩与帐篷常驻

日期：2026-07-08

版本 / Layer：Layer 5A 占卜屋模型接入切片

现象：用户指出地板上仍露出绿地，希望玩家踩在魔法阵模型上；同时要求帐篷不管玩家在哪都渲染，室内物件走进魔法阵范围再渲染，帐篷高度缩小一半，并移除桌上的棕色柱状物、恢复原来的空心圆筒。

原因判断：上一版只用 `StageFloor` 做了视觉覆盖，没有接入玩家地面采样，实际脚下仍由浮岛地形决定；魔法阵仍属于室内懒加载资源，无法作为常驻地面范围提示；桌上棕色柱状物来自蜡烛台模型占位，而周易空心圆筒之前被一起从渲染清单移除。

解决方案：将占卜屋圆形基底半径扩到 `15`，并在玩家地面采样中对该范围返回平整高度，使角色可踩在占卜屋魔法阵平面上；将帐篷外壳改为常驻渲染，魔法阵挪到外壳层常驻显示，室内资源仍按 `15` 半径、聚焦或强制验证参数加载；帐篷 scale 改为 `[2.84, 1.42, 2.84]`，保持占地面积同时高度减半；从室内渲染清单移除 `tarot_candle_stand.glb` 的左右蜡烛台占位，并恢复 `iching_lot_cylinder.glb` 空心圆筒。

涉及文件：`app/nav-world/src/world/WorldExperience.tsx`、`app/nav-world/src/modules/divination/FortuneAssetStage.tsx`、`app/nav-world/src/modules/divination/fortuneModelAssets.ts`、`validation/layer-5/debug.md`。

验证结果：`npm run build` 通过；`npm run assets:fortune:check` 通过。

画面变化：有。占卜屋范围内应不再以浮岛绿地作为脚下平面，帐篷和魔法阵常驻，室内道具进魔法阵范围后加载。

截图：等待用户实机检查后，后续统一更新 Layer 5A 截图。

剩余风险：基底仍是覆盖式圆形平面，未真实裁剪原浮岛 GLB 网格；如果魔法阵 GLB 自身边界不是完整圆形，极端角度仍可能看到下层地形边缘，需要继续按实机截图微调半径和高度。

## 2026-07-08 / Layer 5A 收缩魔法阵并抬高室内地面

日期：2026-07-08

版本 / Layer：Layer 5A 占卜屋模型接入切片

现象：用户指出魔法阵没有收缩到帐篷内，并且帐篷里地面上仍能看到绿色浮岛地形。

原因判断：上一版为了覆盖区域将 `floorRadius` 和 `interiorLoadRadius` 设为 `15`，`tarot_magic_circle.glb` scale 设为 `5`，导致魔法阵直径约 `30.3`，明显超过缩放后帐篷约 `21.7 x 18.6` 的占地；同时地面平面高度仍偏低，部分原浮岛绿地从帐篷内部露出。

解决方案：将占卜屋可踩平面和室内加载半径收缩到 `8.8`，把魔法阵 scale 从 `5` 收缩到 `2.8`，使其直径约 `17`，落在帐篷占地内部；将 `floorSurfaceOffset` 从 `0.22` 提高到 `0.48`，并同步把魔法阵高度调到 `y=0.52`，让平整基底压过原地形露绿区域。

涉及文件：`app/nav-world/src/modules/divination/fortuneModelAssets.ts`、`validation/layer-5/debug.md`。

验证结果：`npm run build` 通过。

画面变化：有。魔法阵和可踩基底应收回帐篷内，帐篷内部绿地露出应减少或消失。

截图：等待用户实机检查后，后续统一更新 Layer 5A 截图。

剩余风险：原浮岛 GLB 未被真正裁剪；如果局部地形高度仍高于 `0.48` 偏移，可能需要继续抬高室内基底或改用局部遮罩地板。

## 2026-07-08 / Layer 5A 降低桌布并移除塔罗卡

日期：2026-07-08

版本 / Layer：Layer 5A 占卜屋模型接入切片

现象：用户要求桌布放矮一点，并去掉塔罗卡牌。

原因判断：上一版桌布仍偏高；`FortuneAssetStage` 里通过 `TarotCards` 组件实例化了多张 `tarot_card.glb` 占位卡，当前不需要显示。

解决方案：将 `tarot-table-cloth` 的高度从 `y=1.31` 下调到 `y=1.24`；删除 `TarotCards`、`tarotCardPositions` 和运行时 `tarotCardAsset` 引用，使占卜屋不再渲染或请求 `tarot_card.glb`。

涉及文件：`app/nav-world/src/modules/divination/fortuneModelAssets.ts`、`app/nav-world/src/modules/divination/FortuneAssetStage.tsx`、`validation/layer-5/debug.md`。

验证结果：`npm run build` 通过；`rg` 确认源码中不再存在 `tarotCardAsset`、`TarotCards`、`tarotCardPositions` 或 `tarot_card` 运行时引用。

画面变化：有。桌布位置降低，桌面上的塔罗卡占位不再出现。

截图：等待用户实机检查后，后续统一更新 Layer 5A 截图。

剩余风险：`tarot_card.glb` 文件仍保留在 public allowlist 中，当前不会被浏览器请求；后续确认完全不用后可从资源准备脚本中清理。

## 2026-07-08 / Layer 5A 帐篷高度增加一半

日期：2026-07-08

版本 / Layer：Layer 5A 占卜屋模型接入切片

现象：用户要求“把帐篷增高现有帐篷高度的一半”。

原因判断：上一版帐篷高度为当前模型高度 scale `1.42`，用户希望在保留现有占地尺寸的基础上增加垂直空间。

解决方案：只将 `tarot-tent` 的 Y 轴 scale 从 `1.42` 调整为 `2.13`，即现有高度的 `1.5` 倍；X/Z 轴仍保持 `2.84`。

涉及文件：`app/nav-world/src/modules/divination/fortuneModelAssets.ts`、`validation/layer-5/debug.md`。

验证结果：`npm run build` 通过；`npm run assets:fortune:check` 通过。截图验证按用户要求改为用户实机验证。

画面变化：有。帐篷外壳高度增加，宽度和深度不变。

截图：本次不由 Codex 生成截图；用户说明截图验证由用户实机完成。

剩余风险：帐篷增高后，星座穹顶和室内物件相对视觉比例可能还需要用户实机继续微调。

## 2026-07-08 / Layer 5A 桌布贴近桌面

日期：2026-07-08

版本 / Layer：Layer 5A 占卜屋模型接入切片

现象：用户截图显示桌布整体悬在桌子表面上方，要求“把桌布贴在桌子表面上”。

原因判断：`tarot-table-cloth` 的 Y 轴位置 `1.24` 仍高于当前桌面可见高度，造成桌布浮空。

解决方案：只调整 `tarot-table-cloth` 的位置，将高度从 `y=1.24` 下调到 `y=1.02`，不改变桌子、帐篷、魔法阵或其他室内道具。

涉及文件：`app/nav-world/src/modules/divination/fortuneModelAssets.ts`、`validation/layer-5/debug.md`。

验证结果：`npm run build` 通过；`npm run assets:fortune:check` 通过。截图按用户要求由用户实机验证。

画面变化：有。桌布应更贴近桌面，不再明显悬空。

截图：本次不由 Codex 生成截图；用户实机验证。

剩余风险：未做模型包围盒精确测量，若实机看到桌布压进桌面或仍有间隙，需要继续按小步长微调 Y 轴位置。

## 2026-07-08 / Layer 5A 桌布小幅上调

日期：2026-07-08

版本 / Layer：Layer 5A 占卜屋模型接入切片

现象：用户在实机验证后要求桌布“往上面调一丢丢”。

原因判断：上一版将 `tarot-table-cloth` 从 `y=1.24` 下调到 `y=1.02` 后，桌布贴近桌面但可能略低或局部压入桌体。

解决方案：只将 `tarot-table-cloth` 的高度从 `y=1.02` 小幅上调到 `y=1.06`，保持桌子、帐篷、魔法阵和其他道具不变。

涉及文件：`app/nav-world/src/modules/divination/fortuneModelAssets.ts`、`validation/layer-5/debug.md`。

验证结果：`npm run build` 通过；`npm run assets:fortune:check` 通过。截图按用户要求由用户实机验证。

画面变化：有。桌布相对桌面小幅上移。

截图：本次不由 Codex 生成截图；用户实机验证。

剩余风险：该调整仍是目视微调；若桌布仍压进桌面或重新出现悬空，需要继续按小步长调整。

## 2026-07-08 / Layer 5A 塔罗桌移到帐篷最里面

日期：2026-07-08

版本 / Layer：Layer 5A 占卜屋模型接入切片

现象：用户要求“桌子靠在帐篷对着门的方向的最里面”。

原因判断：当前塔罗桌组仍在帐篷中心附近，进入帐篷后桌子过于靠前，不符合“门正对面最里面”的室内布局。

解决方案：根据当前帐篷门向，沿本地后墙方向移动塔罗桌组：将 `tarot-table` 和 `tarot-table-cloth` 的 Z 轴从 `0.25` 调到 `4.15`，并将桌面水晶底座和水晶球同步平移到 `z=3.72`。周易桌、魔法阵和帐篷不变。

涉及文件：`app/nav-world/src/modules/divination/fortuneModelAssets.ts`、`validation/layer-5/debug.md`。

验证结果：`npm run build` 通过；`npm run assets:fortune:check` 通过。截图按用户要求由用户实机验证。

画面变化：有。塔罗桌组应移动到帐篷后部，靠近门正对面的内侧区域。

截图：本次不由 Codex 生成截图；用户实机验证。

剩余风险：该调整基于当前模型门向和实机截图判断；如果桌子过于贴近帐篷墙或仍不够靠里，需要继续按 Z 轴小步微调。

## 2026-07-08 / Layer 5A 周易铜钱中心方孔切除

日期：2026-07-08

版本 / Layer：Layer 5A 占卜屋模型接入切片

现象：用户在 GLB 预览服务中查看 `fortune/iching_coin_2(1).glb`，要求把模型中间的方孔挖掉。

原因判断：原始铜钱 GLB 中心方孔区域仍有填充面，视觉上像白色实心块，不符合古钱币中空方孔形态。

解决方案：新增本地资源处理脚本 `resources/cut-coin-square-hole.mjs`，备份原始模型到 `resources/fortune/iching_coin_2(1).before-square-hole.glb`；脚本保留原材质和贴图，通过 X/Z 平面方孔边界切分三角面并剔除孔内面。随后运行 `npm run assets:fortune:prepare`，将修改后的资源同步到 `app/nav-world/public/models/fortune/iching_coin.glb`。

涉及文件：`resources/fortune/iching_coin_2(1).glb`、`resources/fortune/iching_coin_2(1).before-square-hole.glb`、`resources/cut-coin-square-hole.mjs`、`app/nav-world/public/models/fortune/iching_coin.glb`、`validation/layer-5/debug.md`。

验证结果：`npm run assets:fortune:prepare` 通过；`npm run assets:fortune:check` 通过；`npm run build` 通过。截图按用户要求由用户实机验证。

画面变化：有。周易铜钱模型中心方孔区域应由实心面变为中空孔。

截图：本次不由 Codex 生成截图；用户实机验证。

剩余风险：当前切孔只删除中心孔内面，没有额外生成方孔内壁侧面；从极低侧视角可能看到开口边界没有独立内壁厚度。如果用户需要更真实的孔壁，需要后续用建模工具或脚本补内壁几何。

## 2026-07-08 / Layer 5A 周易铜钱方孔内壁补面

日期：2026-07-08

版本 / Layer：Layer 5A 占卜屋模型接入切片

现象：用户要求“把里面缺失的面填回去”，即方孔挖开后孔内壁缺少侧面。

原因判断：上一版切孔只剔除了中心方孔内的填充面，没有为方孔四边生成内壁厚度面，低角度查看时会看到孔边缺面。

解决方案：更新 `resources/cut-coin-square-hole.mjs`，将备份逻辑改为已存在则不覆盖；从 `resources/fortune/iching_coin_2(1).before-square-hole.glb` 恢复源模型后重新生成中空方孔，并为方孔四边补 8 个内壁三角面。随后运行 `npm run assets:fortune:prepare` 同步到 `app/nav-world/public/models/fortune/iching_coin.glb`。

涉及文件：`resources/cut-coin-square-hole.mjs`、`resources/fortune/iching_coin_2(1).glb`、`app/nav-world/public/models/fortune/iching_coin.glb`、`validation/layer-5/debug.md`。

验证结果：`npm run assets:fortune:prepare` 通过；`npm run assets:fortune:check` 通过；`npm run build` 通过。截图按用户要求由用户实机验证。

画面变化：有。周易铜钱中心方孔保持中空，同时方孔四周应出现内壁面。

截图：本次不由 Codex 生成截图；用户实机验证。

剩余风险：内壁面使用同一材质和简单 UV，视觉上可补齐缺面，但不等同于建模软件中手工展开的精细孔壁贴图。

## 2026-07-08 / Layer 5A 周易铜钱方孔内壁改为纯白材质

日期：2026-07-08

版本 / Layer：Layer 5A 占卜屋模型接入切片

现象：用户要求“补白色就好，不要补图案”，即方孔内壁不要沿用铜钱表面纹理。

原因判断：上一版内壁面与原铜钱表面写入同一个 GLB primitive，继承了同一张图案材质，导致孔壁也出现纹理图案。

解决方案：重构 `resources/cut-coin-square-hole.mjs`，将铜钱原表面和方孔内壁拆成两个 primitive：原表面继续使用原材质 `cm`，孔壁使用新增纯白材质 `plain_white_hole_wall`，并保持 `doubleSided` 以避免侧壁背面剔除。随后从原始备份重新生成 GLB，并运行 `npm run assets:fortune:prepare` 同步到主工程资源。

涉及文件：`resources/cut-coin-square-hole.mjs`、`resources/fortune/iching_coin_2(1).glb`、`app/nav-world/public/models/fortune/iching_coin.glb`、`validation/layer-5/debug.md`。

验证结果：脚本检查确认 GLB 有 2 个 primitive，材质分别为 `cm` 和 `plain_white_hole_wall`；`npm run assets:fortune:check` 通过；`npm run build` 通过。截图按用户要求由用户实机验证。

画面变化：有。周易铜钱中心方孔内壁应为白色，不再显示铜钱表面图案。

截图：本次不由 Codex 生成截图；用户实机验证。

剩余风险：白色孔壁为简单 PBR 材质，没有单独贴图；如果后续需要更接近原模型边缘的阴影和磨损效果，需要建模侧补精细材质。

## 2026-07-08 / Layer 5A 移除大世界内周易卦板

日期：2026-07-08

版本 / Layer：Layer 5A 占卜屋模型接入切片

现象：用户在 GLB 预览服务中查看 `fortune/iching_hexagram_board.glb`，要求“把这个从大世界里面去掉”。

原因判断：周易卦板在占卜屋当前室内布局中占用面积较大，且不是此阶段必须展示的模型，会干扰后续桌面和周易道具摆位。

解决方案：从 `fortuneModelAssets.interiorAssets` 渲染清单中移除 `iching-board`，不再在大世界占卜屋内加载 `iching_hexagram_board.glb`。资源文件本身暂时保留，仍可在 GLB 预览服务中查看。

涉及文件：`app/nav-world/src/modules/divination/fortuneModelAssets.ts`、`validation/layer-5/debug.md`。

验证结果：`npm run assets:fortune:check` 通过；`npm run build` 通过；`rg` 确认 `fortuneModelAssets.ts` 中没有 `iching-board` 或 `iching_hexagram_board` 运行时引用。截图按用户要求由用户实机验证。

画面变化：有。大世界占卜屋内不再显示周易卦板。

截图：本次不由 Codex 生成截图；用户实机验证。

剩余风险：`iching_hexagram_board.glb` 仍在资源准备 allowlist 中，因此 public 目录仍会保留该文件，但运行时不会请求；后续确认彻底不用后可从 allowlist 和 public 资源中清理。

## 2026-07-08 / Layer 5A 参考图生成线稿魔法阵 GLB

日期：2026-07-08

版本 / Layer：Layer 5A 占卜屋模型接入切片

现象：用户提供黑白魔法阵参考图，要求“把这个做成魔法阵的 GLB 模型”。

原因判断：直接贴 JPG 会在大世界中缩放模糊，也不便于后续材质和几何层级调整；更适合做成扁平几何线稿 GLB。

解决方案：新增 `resources/create-magic-circle-glb.mjs`，用 Three.js 程序化生成扁平魔法阵 GLB：白色圆形底、黑色外圈符文、六边形、上下三角形成六芒星、中心同心圆、星形符号和四周小圆徽章。原 `resources/fortune/tarot_magic_circle.glb` 备份为 `resources/fortune/tarot_magic_circle.original.glb`；生成后运行 `npm run assets:fortune:prepare` 同步到 `app/nav-world/public/models/fortune/tarot_magic_circle.glb`。

涉及文件：`resources/create-magic-circle-glb.mjs`、`resources/fortune/tarot_magic_circle.glb`、`resources/fortune/tarot_magic_circle.original.glb`、`app/nav-world/public/models/fortune/tarot_magic_circle.glb`、`validation/layer-5/debug.md`。

验证结果：`npm run assets:fortune:prepare` 通过；`npm run assets:fortune:check` 通过；`npm run build` 通过。GLB 结构检查显示新模型包含 272 个节点、267 个 mesh。截图按用户要求由用户实机验证。

画面变化：有。占卜屋地面魔法阵应替换为接近参考图的黑白几何线稿风格。

截图：本次不由 Codex 生成截图；用户实机验证。

剩余风险：该 GLB 是基于参考图的程序化近似重绘，不是逐像素矢量描摹；符文使用抽象短线模拟，不是原图文字的精确字体。

## 2026-07-08 / Layer 5A 从参考图抠线生成魔法阵 GLB

日期：2026-07-08

版本 / Layer：Layer 5A 占卜屋模型接入切片

现象：用户反馈上一版程序化近似魔法阵“做得不好”，要求“把图片里面的每根线抠出来做成魔法阵”，并确认可使用 `resources/` 中的参考图。

原因判断：上一版是基于参考图重新绘制的几何近似，无法保留原图中大量细线、符号、符文和不规则装饰细节。

解决方案：新增 `resources/create-magic-circle-from-image.py`，读取 `resources/6063008e755fe5fe3771fc950b3d16b60eff880b12494-LjRG1z_fw658webp.webp`，用 OpenCV 阈值提取黑色线条 mask，将横向连续黑色像素合并为扁平几何面；生成的 GLB 包含 `ivory_circle_base` 白色圆形底和 `extracted_black_lines` 黑色抠线面。上一版程序化近似 GLB 备份为 `resources/fortune/tarot_magic_circle.programmatic-approx.glb`，并运行 `npm run assets:fortune:prepare` 同步到主工程资源。

涉及文件：`resources/create-magic-circle-from-image.py`、`resources/6063008e755fe5fe3771fc950b3d16b60eff880b12494-LjRG1z_fw658webp.webp`、`resources/fortune/tarot_magic_circle.glb`、`resources/fortune/tarot_magic_circle.programmatic-approx.glb`、`app/nav-world/public/models/fortune/tarot_magic_circle.glb`、`validation/layer-5/debug.md`。

验证结果：脚本输出提取 `120002` 个黑色 mask 像素、`20140` 段横向线条面、`40280` 个线条三角面；GLB 结构检查显示 1 个 mesh、2 个 primitive，材质为 `ivory_circle_base` 和 `extracted_black_lines`；`npm run assets:fortune:check` 通过；`npm run build` 通过。截图按用户要求由用户实机验证。

画面变化：有。魔法阵应从程序化近似图形替换为基于参考图黑线抠出的高保真线稿。

截图：本次不由 Codex 生成截图；用户实机验证。

剩余风险：当前是像素级横向 run mesh，保真度接近原图，但边缘会保留像素阶梯；如果后续要求真正矢量级平滑曲线，需要引入 potrace / 手工矢量化或建模侧处理。

## 2026-07-08 / Layer 5A 放大魔法阵覆盖室内

日期：2026-07-08

版本 / Layer：Layer 5A 占卜屋模型接入切片

现象：用户实机截图显示新魔法阵只覆盖帐篷内部中间区域，要求“放大到整个屋子里面”。

原因判断：参考图抠线版 GLB 的实际视觉直径比旧模型更小，沿用 `scale: 2.8` 后覆盖范围不足。

解决方案：只调整 `tarot-magic-circle` 的 scale，从 `2.8` 放大到 `4.4`；不改变帐篷、桌子、周易道具、平整基底半径或玩家地面采样。

涉及文件：`app/nav-world/src/modules/divination/fortuneModelAssets.ts`、`validation/layer-5/debug.md`。

验证结果：`npm run assets:fortune:check` 通过；`npm run build` 通过。截图按用户要求由用户实机验证。

画面变化：有。魔法阵应放大，覆盖更多帐篷室内地面。

截图：本次不由 Codex 生成截图；用户实机验证。

剩余风险：如果放大后边缘越过帐篷内墙或仍未覆盖到位，需要继续按小步长调整 scale。

## 2026-07-08 / Layer 5A 魔法阵透明底并继续放大

日期：2026-07-08

版本 / Layer：Layer 5A 占卜屋模型接入切片

现象：用户实机截图显示魔法阵仍未到帐篷边缘，且白色圆形底色不符合期望，要求“没到帐篷的边缘，魔法阵底色改为透明的”。

原因判断：上一版 GLB 包含 `ivory_circle_base` 白色圆形底盘，会遮住原有室内地面；同时 `scale: 4.4` 覆盖范围仍不足。

解决方案：修改 `resources/create-magic-circle-from-image.py`，去掉白色底盘 primitive，只输出 `extracted_black_lines` 黑色抠线面，使地面底色透明透出；将 `tarot-magic-circle` scale 从 `4.4` 放大到 `6.4`，使魔法阵更接近帐篷室内边缘。随后运行 `npm run assets:fortune:prepare` 同步资源。

涉及文件：`resources/create-magic-circle-from-image.py`、`resources/fortune/tarot_magic_circle.glb`、`app/nav-world/public/models/fortune/tarot_magic_circle.glb`、`app/nav-world/src/modules/divination/fortuneModelAssets.ts`、`validation/layer-5/debug.md`。

验证结果：脚本输出仍提取 `120002` 个黑色 mask 像素、`20140` 段横向线条面、`40280` 个线条三角面；GLB 结构检查确认只剩 1 个 primitive，材质为 `extracted_black_lines`；`npm run assets:fortune:check` 通过；`npm run build` 通过。截图按用户要求由用户实机验证。

画面变化：有。魔法阵白色底盘消失，只保留黑色线条；魔法阵整体进一步放大。

截图：本次不由 Codex 生成截图；用户实机验证。

剩余风险：透明底意味着线条下面的地面颜色会直接影响可读性；如果室内地面颜色太暗或太接近黑色，需要后续调整线条颜色、加轻微描边或调整地面材质。

## 2026-07-08 / Layer 5A 透明底魔法阵线条增强可见性

日期：2026-07-08

版本 / Layer：Layer 5A 占卜屋模型接入切片

现象：用户实机反馈去掉白色底盘后魔法阵“啥都没了”，进入帐篷内也几乎看不到线条。

原因判断：透明底后只剩黑色贴地线条，当前室内地面、帐篷遮挡和视角距离会让黑线可读性很低，看起来像模型消失。

解决方案：保持透明底不恢复白盘；将 `resources/create-magic-circle-from-image.py` 生成的线条材质从黑色改为浅亮象牙色 `extracted_ivory_lines`，加入轻微 `emissiveFactor`，并将线条高度从 `LINE_Y=0.012` 提到 `LINE_Y=0.018`，降低被地面吃掉或视觉融合的概率。随后运行 `npm run assets:fortune:prepare` 同步资源。

涉及文件：`resources/create-magic-circle-from-image.py`、`resources/fortune/tarot_magic_circle.glb`、`app/nav-world/public/models/fortune/tarot_magic_circle.glb`、`validation/layer-5/debug.md`。

验证结果：GLB 结构检查确认只剩 1 个 primitive，材质为 `extracted_ivory_lines`，包含 `80560` 个线条顶点；`npm run assets:fortune:check` 通过；`npm run build` 通过。截图按用户要求由用户实机验证。

画面变化：有。魔法阵仍为透明底，但线条应从黑色变为浅亮色并更容易看见。

截图：本次不由 Codex 生成截图；用户实机验证。

剩余风险：如果浅亮线条仍在远距离或特定角度不可见，下一步应考虑加粗线条或生成双层描边，而不是恢复白色底盘。

## 2026-07-08 / Layer 5A 回退到透明底修改前魔法阵

日期：2026-07-08

版本 / Layer：Layer 5A 占卜屋模型接入切片

现象：用户要求“回退到修改透明度之前”。

原因判断：透明底版本和后续浅亮线条版本都没有达到预期，用户希望回到去掉白色底盘之前的稳定视觉状态。

解决方案：恢复 `resources/create-magic-circle-from-image.py` 输出白色圆形底盘 `ivory_circle_base` 和黑色抠线 `extracted_black_lines` 两个 primitive；将 `tarot-magic-circle` scale 从 `6.4` 回退到透明底修改前的 `4.4`。随后重新生成 GLB 并运行 `npm run assets:fortune:prepare` 同步资源。

涉及文件：`resources/create-magic-circle-from-image.py`、`resources/fortune/tarot_magic_circle.glb`、`app/nav-world/public/models/fortune/tarot_magic_circle.glb`、`app/nav-world/src/modules/divination/fortuneModelAssets.ts`、`validation/layer-5/debug.md`。

验证结果：GLB 结构检查确认恢复为 2 个 primitive，材质为 `ivory_circle_base` 和 `extracted_black_lines`；`npm run assets:fortune:check` 通过；`npm run build` 通过。截图按用户要求由用户实机验证。

画面变化：有。魔法阵回到白色底盘加黑色抠线版本，透明底和浅亮线条撤销。

截图：本次不由 Codex 生成截图；用户实机验证。

剩余风险：回退后魔法阵再次带白色底盘，可能仍未覆盖完整帐篷内沿；如需继续调整，应单独改 scale 或地面摆放，不再混入透明底修改。

## 2026-07-08 / Layer 5A 魔法阵 GLB 透明底保留黑线

日期：2026-07-08

版本 / Layer：Layer 5A 占卜屋模型接入切片

现象：用户基于实机截图要求“把魔法阵的 GLB 改成透明的，线留着，底色为透明”。当前 GLB 回退后仍包含 `ivory_circle_base` 白色圆形底盘，会遮住下方室内地面。

原因判断：`resources/create-magic-circle-from-image.py` 生成的魔法阵 GLB 有两个 primitive：白色底盘和黑色抠线。要让底色真正透明，最可靠方式是移除底盘 primitive，而不是把底盘材质设为半透明；这样浏览器只渲染线条，底色由下方场景地面决定。

解决方案：修改 `resources/create-magic-circle-from-image.py`，删除白色圆盘几何生成和 `ivory_circle_base` 材质，只输出 `extracted_black_lines` 一个 primitive；保留黑色线条，并将线条局部高度从 `0.012` 小幅提高到 `0.018`，降低贴地线条被地面遮挡或闪烁的概率。重新生成 `resources/fortune/tarot_magic_circle.glb`，并运行 `npm run assets:fortune:prepare` 同步到 `app/nav-world/public/models/fortune/tarot_magic_circle.glb`。

涉及文件：`resources/create-magic-circle-from-image.py`、`resources/fortune/tarot_magic_circle.glb`、`app/nav-world/public/models/fortune/tarot_magic_circle.glb`、`validation/layer-5/debug.md`。

验证结果：`python3 resources/create-magic-circle-from-image.py` 通过，提取 `120002` 个黑色 mask 像素、`20140` 段横向线条面、`40280` 个线条三角面；GLB 结构检查确认源资源和运行时资源都只剩 1 个 primitive，材质为 `extracted_black_lines`；`npm run assets:fortune:check` 通过；`npm run build` 通过。

画面变化：有。魔法阵 GLB 不再渲染白色底盘，只保留黑色线条；底色变为透明并透出下方室内地面。

截图：本次不由 Codex 生成截图；按当前小步模型摆位口径，由用户实机验证。

剩余风险：透明底会让线条可读性依赖下方地面颜色和视角；如果黑线在实际场景中不够明显，后续应优先微调地面材质、线条粗细或线条高度，而不是恢复底盘。

## 2026-07-08 / Layer 5A 塔罗桌恢复烛台装饰

日期：2026-07-08

版本 / Layer：Layer 5A 占卜屋模型接入切片

现象：用户基于实机截图要求“把烛台什么的装饰加回有桌布的桌子上”。当前塔罗桌只保留桌布和水晶球，左右烛台此前为避免桌面棕色柱状物干扰而从渲染清单移除。

原因判断：`tarot_candle_stand.glb` 仍在资源准备 allowlist 和运行时资源目录中，可直接复用；此前问题主要是摆位不符合桌面布局，而不是资源本身不可用。桌布顶面在当前摆位下约为局部 `y=1.27`，烛台模型底部从自身 `y=0` 开始，适合以 `y=1.28` 放置在桌布上。

解决方案：在 `fortuneModelAssets.interiorAssets` 中恢复两个 `tarot_candle_stand.glb` 实例，分别命名为 `tarot-candle-left` 和 `tarot-candle-right`，放在塔罗桌左右两侧、桌布表面上方；不调整帐篷、魔法阵、塔罗桌、桌布、水晶球或周易道具的现有坐标。

涉及文件：`app/nav-world/src/modules/divination/fortuneModelAssets.ts`、`validation/layer-5/debug.md`。

验证结果：`npm run assets:fortune:check` 通过；`npm run build` 通过。构建过程中 `assets:prune` 清理了上一轮未被当前 `index.html` 引用的旧 frontend hash 资源，属于既有构建清理行为。

画面变化：有。有桌布的塔罗桌左右两侧恢复烛台装饰。

截图：本次不由 Codex 生成截图；按当前小步模型摆位口径，由用户实机验证。

剩余风险：烛台位置按模型包围盒和当前截图估算；如果实机看到烛台过高、压入桌布或遮挡水晶球，需要继续按小步长调整 `x / y / z`。

## 2026-07-08 / Layer 5A 周易桌移动到门左侧并朝向中央

日期：2026-07-08

版本 / Layer：Layer 5A 占卜屋模型接入切片

现象：用户基于实机截图要求“把这个桌子放在门的左侧正对中央”。当前周易棕色桌位于帐篷内部偏中后位置，朝向没有明确对准魔法阵中央。

原因判断：周易桌和桌面道具此前分别使用独立绝对坐标，移动桌子时如果不统一处理，签筒、铜钱、竹简和爻线容易散位；同时“正对中央”需要桌子和桌面物件共享同一个朝向。

解决方案：在 `fortuneModelAssets.ts` 中新增周易桌锚点 `ichingTablePosition = [4.05, 0.05, -2.75]` 和统一朝向 `ichingTableYaw = -0.98`；通过 `positionOnIchingTable()` 保持桌面物件相对桌面的布局，并通过 `rotationOnIchingTable()` 让桌子、签筒、铜钱、竹简和爻线一起朝向魔法阵中央。塔罗桌、帐篷和魔法阵不变。

涉及文件：`app/nav-world/src/modules/divination/fortuneModelAssets.ts`、`validation/layer-5/debug.md`。

验证结果：`npm run assets:fortune:check` 通过；`npm run build` 通过。构建过程中 `assets:prune` 清理了上一轮未被当前 `index.html` 引用的旧 frontend hash 资源，属于既有构建清理行为。

画面变化：有。周易棕色桌及其桌面道具应移动到帐篷门左侧，并整体朝向魔法阵中央。

截图：本次不由 Codex 生成截图；按当前小步模型摆位口径，由用户实机验证。

剩余风险：门左侧方向基于当前帐篷本地坐标和用户截图判断；如果实机视角中左右方向与预期相反，需要将周易桌锚点从 `x=4.05` 镜像到负 X 侧，桌面相对布局仍可复用。

## 2026-07-08 / Layer 5A 周易桌贴近门的正左侧

日期：2026-07-08

版本 / Layer：Layer 5A 占卜屋模型接入切片

现象：用户实机截图显示周易棕色桌已经在门左侧方向，但位置仍偏斜，进一步要求“门的正左侧”。

原因判断：上一版锚点 `[4.05, 0.05, -2.75]` 位于门左侧与魔法阵之间，视觉上更像左前方斜位，不是贴近门口的正左侧；需要沿门口方向继续外移，并保持朝向魔法阵中央。

解决方案：只调整周易桌组锚点和朝向：将 `ichingTablePosition` 从 `[4.05, 0.05, -2.75]` 调整为 `[5.15, 0.05, -4.95]`，将 `ichingTableYaw` 从 `-0.98` 调整为 `-0.81`；签筒、铜钱、竹简和爻线继续通过相对桌面坐标跟随，不单独散调。塔罗桌、帐篷和魔法阵不变。

涉及文件：`app/nav-world/src/modules/divination/fortuneModelAssets.ts`、`validation/layer-5/debug.md`。

验证结果：`npm run assets:fortune:check` 通过；`npm run build` 通过。构建过程中 `assets:prune` 清理了上一轮未被当前 `index.html` 引用的旧 frontend hash 资源，属于既有构建清理行为。

画面变化：有。周易棕色桌及其桌面道具应更贴近帐篷门口正左侧，同时继续朝向魔法阵中央。

截图：本次不由 Codex 生成截图；按当前小步模型摆位口径，由用户实机验证。

剩余风险：如果实机中桌子过于靠门外、贴墙或仍不够“正左侧”，下一步只需继续小步调整 `ichingTablePosition` 的 X/Z，不需要改桌面物件相对布局。

## 2026-07-08 / Layer 5A 周易桌门左侧方向镜像修正

日期：2026-07-08

版本 / Layer：Layer 5A 占卜屋模型接入切片

现象：用户实机截图确认上一版“门的正左侧”方向判断反了，要求“位置反了，往反方向挪”。

原因判断：上一版把门左侧映射到本地正 X 方向，实际用户视角下应在相反侧；桌面道具已通过相对桌面坐标组织，适合直接镜像桌组锚点，不需要分别调整每个道具。

解决方案：将 `ichingTablePosition` 从 `[5.15, 0.05, -4.95]` 镜像为 `[-5.15, 0.05, -4.95]`，并将 `ichingTableYaw` 从 `-0.81` 镜像为 `0.81`，让周易桌和桌面道具移动到反方向后仍朝向魔法阵中央。塔罗桌、帐篷和魔法阵不变。

涉及文件：`app/nav-world/src/modules/divination/fortuneModelAssets.ts`、`validation/layer-5/debug.md`。

验证结果：`npm run assets:fortune:check` 通过；`npm run build` 通过。构建过程中 `assets:prune` 清理了上一轮未被当前 `index.html` 引用的旧 frontend hash 资源，属于既有构建清理行为。

画面变化：有。周易棕色桌及其桌面道具应从上一版位置镜像到门口另一侧，并继续朝向魔法阵中央。

截图：本次不由 Codex 生成截图；按当前小步模型摆位口径，由用户实机验证。

剩余风险：如果镜像后距离门口或墙面仍需微调，继续只改 `ichingTablePosition` 的 X/Z；相对桌面道具布局无需重做。

## 2026-07-08 / Layer 5A 周易桌门左侧小步外移

日期：2026-07-08

版本 / Layer：Layer 5A 占卜屋模型接入切片

现象：用户实机验证后反馈位置还是不对，要求“再挪一点点”。

原因判断：上一版镜像方向已经修正，但桌子在门左侧的位置仍需要沿当前方向继续小步调整；桌面道具已绑定到周易桌锚点，适合只移动整组锚点。

解决方案：只将 `ichingTablePosition` 的 X 从 `-5.15` 调整为 `-5.65`，让周易桌组沿当前门左侧方向再外移一点；保持 Z、高度、朝向 `ichingTableYaw = 0.81` 和桌面道具相对布局不变。塔罗桌、帐篷和魔法阵不变。

涉及文件：`app/nav-world/src/modules/divination/fortuneModelAssets.ts`、`validation/layer-5/debug.md`。

验证结果：`npm run assets:fortune:check` 通过；`npm run build` 通过。构建过程中 `assets:prune` 清理了上一轮未被当前 `index.html` 引用的旧 frontend hash 资源，属于既有构建清理行为。

画面变化：有。周易棕色桌及其桌面道具应沿门左侧方向小幅外移。

截图：本次不由 Codex 生成截图；按当前小步模型摆位口径，由用户实机验证。

剩余风险：该调整仍是实机目视微调；如果还需要靠近门、远离门或沿墙移动，继续只改 `ichingTablePosition` 的 X/Z。

## 2026-07-08 / Layer 5A 周易桌两单位外移后回退

日期：2026-07-08

版本 / Layer：Layer 5A 占卜屋模型接入切片

现象：用户先要求“再挪两点”，随后中断并要求“回退”。

原因判断：两单位外移把 `ichingTablePosition` 的 X 从 `-5.65` 临时调整到 `-7.65`；用户随后要求回退，说明上一版 `-5.65` 更接近期望或至少应作为继续微调基准。

解决方案：将 `ichingTablePosition` 从 `[-7.65, 0.05, -4.95]` 回退为 `[-5.65, 0.05, -4.95]`；保持 `ichingTableYaw = 0.81`、桌面道具相对布局、塔罗桌、帐篷和魔法阵不变。

涉及文件：`app/nav-world/src/modules/divination/fortuneModelAssets.ts`、`validation/layer-5/debug.md`。

验证结果：`npm run assets:fortune:check` 通过；`npm run build` 通过。构建过程中 `assets:prune` 清理了两单位外移构建产生、但回退后不再被当前 `index.html` 引用的旧 frontend hash 资源，属于既有构建清理行为。

画面变化：有。周易棕色桌及其桌面道具回到上一版 `x=-5.65` 的位置。

截图：本次不由 Codex 生成截图；按当前小步模型摆位口径，由用户实机验证。

剩余风险：当前只回退最后一次两单位外移；如果用户希望回退更多步，需要继续指定回退到哪一版位置。

## 2026-07-08 / Layer 5A 帐篷室内临时坐标辅助

日期：2026-07-08

版本 / Layer：Layer 5A 占卜屋模型接入切片

现象：用户要求“在屋子里面临时放坐标辅助我判断”，用于继续判断周易桌、塔罗桌和其他室内物件的摆位方向与偏移量。

原因判断：当前模型摆位都使用帐篷局部坐标，但用户只能从实机截图判断方向，容易出现“门左侧”与本地 X/Z 方向混淆；需要在室内直接显示局部 X/Z 轴和刻度，降低来回试错成本。

解决方案：在 `FortuneAssetStage.tsx` 中新增 `FortuneCoordinateGuide`，仅在 `shouldLoadInterior` 为 true 时显示。坐标辅助包含红色 X 轴、蓝色 Z 轴、中心点、每 2 个单位的刻度标签和 X+/X-/Z+/Z- 方向标签；标签使用 `Billboard` 和 `Text`，会面向相机，位置抬高到魔法阵上方，避免与地面线条重合。该辅助层只用于临时摆位判断，不改变任何模型坐标。

涉及文件：`app/nav-world/src/modules/divination/FortuneAssetStage.tsx`、`validation/layer-5/debug.md`。

验证结果：`npm run assets:fortune:check` 通过；`npm run build` 通过。构建过程中 `assets:prune` 清理了上一轮未被当前 `index.html` 引用的旧 frontend hash 资源，属于既有构建清理行为。

画面变化：有。占卜屋室内加载后会显示临时局部坐标轴、刻度和方向标签。

截图：本次不由 Codex 生成截图；按当前小步模型摆位口径，由用户实机验证。

剩余风险：坐标辅助是临时调试视觉层，会遮挡部分室内画面；摆位确认后应移除或改为调试开关。

## 2026-07-08 / Layer 5A 周易桌放到 X6 Z0 并面向中央

日期：2026-07-08

版本 / Layer：Layer 5A 占卜屋模型接入切片

现象：用户借助临时坐标辅助后，明确要求“把桌子放在 x6 z0 的地方面对中央”。

原因判断：上一轮基于“门左侧”的描述仍存在方向误差；现在用户已用坐标辅助给出明确局部坐标，最短可靠路径是直接按帐篷局部坐标摆放周易桌组，并用坐标计算朝向中心。

解决方案：将周易桌组锚点 `ichingTablePosition` 改为 `[6, 0.05, 0]`，对应地面局部 `X=6, Z=0`；将 `ichingTableYaw` 改为 `-Math.PI / 2`，使桌子从该点朝向局部中心 `[0, 0]`。签筒、铜钱、竹简和爻线继续通过 `positionOnIchingTable()` 跟随桌子，不单独散调。塔罗桌、帐篷、魔法阵和临时坐标辅助不变。

涉及文件：`app/nav-world/src/modules/divination/fortuneModelAssets.ts`、`validation/layer-5/debug.md`。

验证结果：`npm run assets:fortune:check` 通过；`npm run build` 通过。构建过程中 `assets:prune` 清理了上一轮未被当前 `index.html` 引用的旧 frontend hash 资源，属于既有构建清理行为。

画面变化：有。周易棕色桌及其桌面道具应移动到临时坐标辅助显示的 `X=6, Z=0` 附近，并面向中心点。

截图：本次不由 Codex 生成截图；按当前小步模型摆位口径，由用户实机验证。

剩余风险：桌子模型自身的正面方向如果与预估不同，可能需要在 `ichingTableYaw` 上加减 `Math.PI` 或小角度微调；位置坐标本身已按用户指定设置。

## 2026-07-08 / Layer 5A 周易桌道具重排到签筒中心布局

日期：2026-07-08

版本 / Layer：Layer 5A 占卜屋模型接入切片

现象：用户基于实机截图要求“把筒放在桌子中间，两根竹条放进筒中，铜钱放在筒的旁边”。当前签筒在桌面偏侧，竹条平放在桌面，铜钱距离筒较远。

原因判断：周易桌面道具通过 `positionOnIchingTable()` 绑定到桌面局部坐标，适合只调整相对桌面的 offset。`iching_lot_cylinder.glb` 底部适合放在 `y=1.14`；`iching_bamboo_slips.glb` 模型长轴沿 Z，`iching_line_yang.glb` 模型长轴沿 X，需要分别旋转成立式后才能看起来插入签筒。

解决方案：将签筒 offset 改为桌面中心 `(0, 0)`；将竹简和爻线移动到签筒中心附近并旋转成立式插入筒内；将铜钱移动到签筒旁边。周易桌位置、朝向、塔罗桌、帐篷、魔法阵和临时坐标辅助不变。

涉及文件：`app/nav-world/src/modules/divination/fortuneModelAssets.ts`、`validation/layer-5/debug.md`。

验证结果：`npm run assets:fortune:check` 通过；`npm run build` 通过。构建过程中 `assets:prune` 清理了上一轮未被当前 `index.html` 引用的旧 frontend hash 资源，属于既有构建清理行为。

画面变化：有。周易桌上的签筒应在桌面中心，两根竹条应位于签筒内，铜钱应在签筒旁边。

截图：本次不由 Codex 生成截图；按当前小步模型摆位口径，由用户实机验证。

剩余风险：竹条插入角度是按模型包围盒和截图估算；如果实机中竹条高度、倾斜角或是否真正落入筒口仍不理想，需要继续小步调整竹条的 `y`、旋转角和微小 X/Z offset。

## 2026-07-08 / Layer 5A 修正周易白条子插入方向

日期：2026-07-08

版本 / Layer：Layer 5A 占卜屋模型接入切片

现象：用户实机截图显示筒内黑/棕色竹条基本竖直，但白条子仍横向伸出筒外，反馈“你白条子方向还是没做好”。

原因判断：`iching_line_yang.glb` 的长轴沿模型局部 X 轴，上一版给了接近竖直但带倾斜的旋转和偏移，实际渲染后仍表现为横向穿出；需要把白条子收回筒口中心并使用明确的 `Math.PI / 2` 竖直旋转。

解决方案：只调整 `iching-yang-line`：位置从 `positionOnIchingTable(-0.04, 1.64, -0.02)` 改为 `positionOnIchingTable(-0.04, 1.68, -0.04)`，旋转从 `[0, ichingTableYaw - 0.1, Math.PI / 2 - 0.12]` 改为 `[0, ichingTableYaw, Math.PI / 2]`。签筒、黑/棕色竹条、铜钱、桌子位置和朝向不变。

涉及文件：`app/nav-world/src/modules/divination/fortuneModelAssets.ts`、`validation/layer-5/debug.md`。

验证结果：`npm run assets:fortune:check` 通过；`npm run build` 通过。构建过程中 `assets:prune` 清理了上一轮未被当前 `index.html` 引用的旧 frontend hash 资源，属于既有构建清理行为。

画面变化：有。白条子应从横向伸出改为竖直插入签筒内。

截图：本次不由 Codex 生成截图；按当前小步模型摆位口径，由用户实机验证。

剩余风险：如果 GLB 模型自身视觉重心不在原点，白条子可能仍需微调 X/Z offset 或 Y 高度。

## 2026-07-08 / Layer 5A 周易白条子改用竖版 GLB

日期：2026-07-08

版本 / Layer：Layer 5A 占卜屋模型接入切片

现象：用户反馈调整白条子运行时旋转后实机“没反应”，要求“直接把建模换个方向”。

原因判断：原始 `iching_line_yang.glb` 本体长轴沿 X 轴，继续依赖运行时 rotation 容易受模型轴向、缓存和目视角度影响；同时同名 GLB 也可能被浏览器缓存。更可靠的方式是生成一个新文件名的竖版 GLB，让模型本体长轴沿 Y 轴。

解决方案：新增 `app/nav-world/scripts/create-vertical-iching-line.mjs`，从 `resources/fortune/iching_line_yang.glb` 读取原模型，旋转几何并生成 `resources/fortune/iching_line_yang_vertical.glb`。更新 `prepare-fortune-assets.mjs` allowlist，把竖版资源复制到 `app/nav-world/public/models/fortune/iching_line_yang_vertical.glb`。运行时 `iching-yang-line` 改用竖版文件，并将 rotation 简化为 `rotationOnIchingTable()`。

涉及文件：`app/nav-world/scripts/create-vertical-iching-line.mjs`、`app/nav-world/scripts/prepare-fortune-assets.mjs`、`resources/fortune/iching_line_yang_vertical.glb`、`app/nav-world/public/models/fortune/iching_line_yang_vertical.glb`、`app/nav-world/src/modules/divination/fortuneModelAssets.ts`、`validation/layer-5/debug.md`。

验证结果：`node scripts/create-vertical-iching-line.mjs` 通过，输出模型尺寸从原始 `[0.9, 0.02, 0.06]` 变为竖版 `[0.02, 0.9, 0.06]`；`npm run assets:fortune:prepare` 通过并准备 19 个 fortune assets；`npm run assets:fortune:check` 通过；`npm run build` 通过。构建过程中 `assets:prune` 清理了上一轮未被当前 `index.html` 引用的旧 frontend hash 资源，属于既有构建清理行为。

画面变化：有。周易白条子不再使用横向原模型，应以竖版模型插入签筒。

截图：本次不由 Codex 生成截图；按当前小步模型摆位口径，由用户实机验证。

剩余风险：竖版模型本体方向已固定，但如果筒口内的落点仍偏，需要继续微调 `iching-yang-line` 的局部 offset 或 Y 高度。

## 2026-07-08 / Layer 5A 回退周易白条子竖版 GLB

日期：2026-07-08

版本 / Layer：Layer 5A 占卜屋模型接入切片

现象：用户要求“回退上一步操作”，即撤销上一版把白条子改成竖版 GLB 的尝试。

原因判断：上一版新增了竖版生成脚本、竖版 GLB 资源、资源 allowlist 条目，并把运行时白条子 URL 改为 `iching_line_yang_vertical.glb`。回退需要同时撤销源码引用、资源准备清单和生成资源文件，避免浏览器继续请求竖版模型。

解决方案：删除 `app/nav-world/scripts/create-vertical-iching-line.mjs`；从 `prepare-fortune-assets.mjs` 移除 `iching_line_yang_vertical.glb`；将 `iching-yang-line` 的 URL 改回 `iching_line_yang.glb`，rotation 恢复为上一版运行时竖直旋转 `[0, ichingTableYaw, Math.PI / 2]`；删除 `resources/fortune/iching_line_yang_vertical.glb`，并重新运行 `npm run assets:fortune:prepare` 清理 public 目录中的竖版资源。

涉及文件：`app/nav-world/scripts/create-vertical-iching-line.mjs`、`app/nav-world/scripts/prepare-fortune-assets.mjs`、`app/nav-world/src/modules/divination/fortuneModelAssets.ts`、`resources/fortune/iching_line_yang_vertical.glb`、`app/nav-world/public/models/fortune/iching_line_yang_vertical.glb`、`validation/layer-5/debug.md`。

验证结果：`npm run assets:fortune:prepare` 通过并恢复为 18 个 fortune assets；`npm run assets:fortune:check` 通过；`npm run build` 通过；确认 `resources/fortune/iching_line_yang_vertical.glb` 和 `app/nav-world/public/models/fortune/iching_line_yang_vertical.glb` 均不存在。构建过程中 `assets:prune` 清理了上一轮未被当前 `index.html` 引用的旧 frontend hash 资源，属于既有构建清理行为。

画面变化：有。周易白条子回到使用原始 `iching_line_yang.glb` 的运行时旋转方案。

截图：本次不由 Codex 生成截图；按当前小步模型摆位口径，由用户实机验证。

剩余风险：回退后白条子方向问题本身仍未解决；后续如果继续调整，应基于原始 GLB 的运行时位置/旋转，或另行选择更明确的建模方案。

## 2026-07-08 / Layer 5A 周易竹签竖直插入签筒

日期：2026-07-08

版本 / Layer：Layer 5A 占卜屋模型接入切片

现象：用户实机截图显示周易桌上有一根浅色竹签横向穿过签筒后方，要求“把这根横着的竹签竖着插进竹筒里面”。

原因判断：`iching_bamboo_slips.glb` 的模型长轴在本地 Z 轴，上一版运行时旋转 `[-Math.PI / 2, ichingTableYaw + 0.12, 0.08]` 会把本地 Z 轴转到帐篷局部 X 方向，因此视觉上横向穿过桌面和签筒。

解决方案：只调整 `iching-bamboo-slips` 的运行时旋转为 `[-Math.PI / 2, 0, 0]`，让模型本地 Z 轴对齐帐篷局部 Y 轴并竖直向上；位置仍保持在签筒中心附近，不改周易桌、签筒、铜钱、白条子、塔罗桌、帐篷或魔法阵。

涉及文件：`app/nav-world/src/modules/divination/fortuneModelAssets.ts`、`validation/layer-5/debug.md`。

验证结果：`npm run assets:fortune:check` 通过；`npm run build` 通过。构建过程中 Vite 仍提示 `WorldExperience` chunk 超过 500 kB，这是既有 3D 资源相关提示，不阻断构建。

画面变化：有。周易桌上原本横向伸出的浅色竹签应改为竖直插入签筒内。

截图：本次不由 Codex 生成截图；按当前小步模型摆位口径，由用户实机验证。

剩余风险：该调整基于模型包围盒确认轴向；如果实机中竹签竖直后仍偏离筒口中心，下一步只需微调 `iching-bamboo-slips` 的 `positionOnIchingTable()` X/Z offset 或 Y 高度。

## 2026-07-08 / Layer 5A 周易太极图放到桌面中心

日期：2026-07-08

版本 / Layer：Layer 5A 占卜屋模型接入切片

现象：用户在资源 GLB 预览中选中 `fortune/iching_floor_pattern.glb`，要求“把这张太极图的模型放在桌子的正中央”。

原因判断：该资源尚未在 `prepare-fortune-assets.mjs` allowlist 中，运行时不会复制到 `public/models/fortune/`，也没有在周易桌模型清单中渲染。模型原始直径约 `5.08`，大于当前周易桌桌面深度，直接原尺寸放置会明显超出桌边。

解决方案：将 `iching_floor_pattern.glb` 加入 fortune 轻量资源 allowlist，输出为 `iching_floor_pattern.glb`；在 `fortuneModelAssets.interiorAssets` 中新增 `iching-floor-pattern`，放在周易桌局部中心 `positionOnIchingTable(0, 1.105, 0)`，使用 `rotationOnIchingTable()` 跟随桌子朝向，并缩放到 `0.27`，作为贴近桌面的中心太极图案。签筒、铜钱、竹签、白条子和桌子位置不变。

涉及文件：`app/nav-world/scripts/prepare-fortune-assets.mjs`、`app/nav-world/src/modules/divination/fortuneModelAssets.ts`、`app/nav-world/public/models/fortune/iching_floor_pattern.glb`、`validation/layer-5/debug.md`。

验证结果：`npm run assets:fortune:prepare` 通过，当前准备 19 个 fortune assets；`npm run assets:fortune:check` 通过；`npm run build` 通过。构建过程中 Vite 仍提示 `WorldExperience` chunk 超过 500 kB，这是既有 3D 资源相关提示，不阻断构建；`assets:prune` 清理了上一轮未被当前 `index.html` 引用的旧 frontend hash 资源。

画面变化：有。周易桌桌面中心应出现缩小后的太极图模型，位于签筒下方的桌面中心区域。

截图：本次不由 Codex 生成截图；按当前小步模型摆位口径，由用户实机验证。

剩余风险：缩放值按模型尺寸和桌面尺寸估算；如果实机中太极图偏大、偏小、压进桌面或被签筒遮挡太多，下一步只需微调 `iching-floor-pattern` 的 `scale`、Y 高度或 X/Z offset。

## 2026-07-08 / Layer 5A 室内模型变成 fallback 方块原因审查

日期：2026-07-08

版本 / Layer：Layer 5A 占卜屋模型接入切片

现象：用户实机截图显示占卜屋室内出现黄褐色方块、紫色圆柱和浅紫色半球，周易桌等真实室内模型未正常显示，要求审查“模型变成不明方块”的原因。

原因判断：截图中的黄褐色方块、紫色圆柱和浅紫色半球与 `FortuneAssetStage.tsx` 里的 `InteriorFallback()` 几何占位体一致，说明不是太极图模型自身变成方块，而是 `FortuneAssetBoundary` 捕获到室内模型组加载或渲染错误后，把整组室内模型替换成 fallback。静态检查确认 `app/nav-world/public/models/fortune/iching_floor_pattern.glb` 当前存在且 Vite dev 资源响应为 200；该 GLB 内含嵌入式 PNG 贴图，结构上有 1 个 mesh、1 个 material、1 张内嵌 PNG。高概率原因是新增 `iching_floor_pattern.glb` 接入时，浏览器或 R3F `useGLTF` 曾经在资源复制完成前请求到失败状态，Error Boundary 进入 `hasError` 后不会自动恢复；也可能是该带贴图 GLB 在主站 GLTFLoader 中触发运行时加载错误，需看浏览器控制台的 `Fortune interior failed to render.` 具体错误确认。

解决方案：本次只做原因审查，不改运行时代码。当前最短排查路径是刷新页面或重启 dev server 后重新进入 `?fortuneAssets=interior`，观察是否恢复真实模型；如果仍出现 fallback，打开浏览器控制台查找 `Fortune interior failed to render.`，重点看是否指向 `iching_floor_pattern.glb`、贴图解码或网络 404。后续修复方向可以是临时移除 `iching-floor-pattern` 验证，或把室内资源从“整组一个 Error Boundary”改成“单模型隔离”，避免一个 GLB 失败拖垮全部室内模型。

涉及文件：`app/nav-world/src/modules/divination/FortuneAssetStage.tsx`、`app/nav-world/src/modules/divination/fortuneModelAssets.ts`、`app/nav-world/public/models/fortune/iching_floor_pattern.glb`、`validation/layer-5/debug.md`。

验证结果：静态资源检查通过，`npm run assets:fortune:check` 通过；`curl -I http://localhost:5174/models/fortune/iching_floor_pattern.glb` 返回 200；GLB 结构检查确认 `iching_floor_pattern.glb` 有 1 个 mesh、1 个 material、1 张内嵌 PNG，模型尺寸约 `5.08 x 0.002 x 5.08`。本环境 Playwright 自带 Chromium 未安装，未做浏览器控制台复现；用户实机浏览器控制台仍是确认具体异常的事实来源。

画面变化：无。本次只审查原因并记录，不调整模型坐标、资源或组件行为。

截图：本次不由 Codex 生成截图；用户已提供实机截图作为现象依据。

剩余风险：没有拿到用户浏览器控制台里的 `Fortune interior failed to render.` 原始错误堆栈，因此只能确认“画面来自 fallback”，不能 100% 确认 fallback 的直接触发点是资源瞬时 404、GLB 贴图解码，还是其他室内模型加载异常。

## 2026-07-08 / Layer 5A 复制小号星座台并放到 X-6 Z0

日期：2026-07-08

版本 / Layer：Layer 5A 占卜屋模型接入切片

现象：用户在资源 GLB 预览中选中 `fortune/zodiac_altar_base.glb`，要求“这个模型文件，复制一份新的，小的，与原先无关的，放在 x=-6 z=0 的位置”。

原因判断：原始 `zodiac_altar_base.glb` 仍作为资源文件保留，但当前大世界渲染不应直接复用原 URL，否则后续调整小号模型时会和原始资源含义混在一起。该模型原始尺寸约 `3.24 x 0.51 x 3.24`，直接放入帐篷内会偏大。

解决方案：复制 `resources/fortune/zodiac_altar_base.glb` 为独立源文件 `resources/fortune/zodiac_altar_base_small.glb`；将新文件加入 `prepare-fortune-assets.mjs` allowlist，并输出为 `app/nav-world/public/models/fortune/zodiac_altar_base_small.glb`。在 `fortuneModelAssets.interiorAssets` 中新增 `zodiac-altar-small`，使用新 URL `zodiac_altar_base_small.glb`，放到帐篷局部坐标 `[-6, 0.52, 0]`，scale 设为 `0.36`，使直径约 `1.17`。原 `zodiac_altar_base.glb` 不改变，其他模型位置不变。

涉及文件：`resources/fortune/zodiac_altar_base_small.glb`、`app/nav-world/scripts/prepare-fortune-assets.mjs`、`app/nav-world/public/models/fortune/zodiac_altar_base_small.glb`、`app/nav-world/src/modules/divination/fortuneModelAssets.ts`、`validation/layer-5/debug.md`。

验证结果：`npm run assets:fortune:prepare` 通过，当前准备 20 个 fortune assets；`npm run assets:fortune:check` 通过；`npm run build` 通过。构建过程中 Vite 仍提示 `WorldExperience` chunk 超过 500 kB，这是既有 3D 资源相关提示，不阻断构建；`assets:prune` 清理了上一轮未被当前 `index.html` 引用的旧 frontend hash 资源。

画面变化：有。占卜屋室内局部 `X=-6, Z=0` 位置应出现小号星座台模型，且运行时 URL 与原始 `zodiac_altar_base.glb` 分离。

截图：本次不由 Codex 生成截图；按当前小步模型摆位口径，由用户实机验证。

剩余风险：小号模型只是文件级复制后通过运行时 scale 缩小，几何内容仍来自原始模型；如果后续需要真正修改小号模型本体几何或材质，应对 `zodiac_altar_base_small.glb` 单独处理，不再改原始文件。

## 2026-07-08 / Layer 5A 室内模型错误改为单模型隔离

日期：2026-07-08

版本 / Layer：Layer 5A 占卜屋模型接入切片

现象：用户反馈模型又出问题，结合上一版截图和审查结果，室内模型组在某个 GLB 加载或渲染失败后会整体显示黄褐色方块、紫色圆柱和浅紫色半球等 fallback 占位体。

原因判断：`FortuneAssetStage.tsx` 原先把所有 `interiorAssets` 放在同一个 `FortuneAssetBoundary` 里，只要其中任意一个模型抛错，整个室内模型组都会进入 `InteriorFallback()`。这会把单个资源问题放大成“整间屋子模型都变成不明方块”的用户可见故障；同时 Error Boundary 进入错误态后不会因为资源稍后可用而自动恢复。

解决方案：移除室内整体 `InteriorFallback()`，将每个 `interiorAssets` 模型分别包在独立 `FortuneAssetBoundary` 和 `Suspense` 中，单个模型失败时只隐藏该模型并在控制台输出 `Fortune model <id> failed to render.`。为 Boundary 增加 `resetKey`，当模型 URL 变化时可以从错误态恢复。帐篷外壳仍保留整体 fallback，避免外壳加载失败时完全不可见。

涉及文件：`app/nav-world/src/modules/divination/FortuneAssetStage.tsx`、`validation/layer-5/debug.md`。

验证结果：`npm run assets:fortune:check` 通过；`npm run build` 通过。构建过程中 Vite 仍提示 `WorldExperience` chunk 超过 500 kB，这是既有 3D 资源相关提示，不阻断构建；`assets:prune` 清理了上一轮未被当前 `index.html` 引用的旧 frontend hash 资源。

画面变化：有。后续如果单个室内 GLB 出错，不应再出现整组黄方块/紫圆柱/半球 fallback；其他成功加载的室内模型应继续显示。

截图：本次不由 Codex 生成截图；按当前小步模型摆位口径，由用户实机验证。

剩余风险：该修复防止单模型错误拖垮整组室内模型，但不会修复某个具体 GLB 自身的贴图、网络或解析错误。如果仍有单个模型不显示，需要根据浏览器控制台的 `Fortune model <id> failed to render.` 继续定位具体资源。

## 2026-07-08 / Layer 5A 回退小号星座台和单模型隔离

日期：2026-07-08

版本 / Layer：Layer 5A 占卜屋模型接入切片

现象：用户要求回退前两次更改：一是复制小号 `zodiac_altar_base_small.glb` 并放到 `X=-6, Z=0`；二是把室内模型错误处理改成单模型隔离。

原因判断：用户明确要求撤销这两组改动，应恢复到这两步之前的行为，同时保留其他已经确认的 Layer 5A 摆位和资源调整，例如周易太极图、竹签旋转和现有资源准备逻辑。

解决方案：从 `prepare-fortune-assets.mjs` 移除 `zodiac_altar_base_small.glb` allowlist；从 `fortuneModelAssets.ts` 移除 `zodiac-altar-small`；删除 `resources/fortune/zodiac_altar_base_small.glb` 和 `app/nav-world/public/models/fortune/zodiac_altar_base_small.glb`；重新运行 `npm run assets:fortune:prepare`，恢复为 19 个 fortune assets。将 `FortuneAssetStage.tsx` 恢复为室内整体 `FortuneAssetBoundary` + `InteriorFallback()`，撤销单模型隔离和 `resetKey`。

涉及文件：`app/nav-world/scripts/prepare-fortune-assets.mjs`、`app/nav-world/src/modules/divination/fortuneModelAssets.ts`、`app/nav-world/src/modules/divination/FortuneAssetStage.tsx`、`resources/fortune/zodiac_altar_base_small.glb`、`app/nav-world/public/models/fortune/zodiac_altar_base_small.glb`、`validation/layer-5/debug.md`。

验证结果：`npm run assets:fortune:prepare` 通过，当前恢复为 19 个 fortune assets；`npm run assets:fortune:check` 通过；`npm run build` 通过。构建过程中 Vite 仍提示 `WorldExperience` chunk 超过 500 kB，这是既有 3D 资源相关提示，不阻断构建；`assets:prune` 清理了回退前构建生成、但当前 `index.html` 不再引用的旧 frontend hash 资源。

画面变化：有。小号星座台不再出现在 `X=-6, Z=0`；室内模型加载错误时恢复为整体 fallback 行为。

截图：本次不由 Codex 生成截图；按当前小步模型摆位口径，由用户实机验证。

剩余风险：回退后，如果任意室内 GLB 再次触发加载或渲染错误，室内模型组仍可能整体显示 `InteriorFallback()` 的黄褐色方块、紫色圆柱和浅紫色半球。这是本次按用户要求恢复的旧行为。

## 2026-07-08 / Layer 5A 旧 dev server 返回 HTML 导致 GLB 解析失败

日期：2026-07-08

版本 / Layer：Layer 5A 占卜屋模型接入切片

现象：用户实机控制台显示 `Could not load ./models/fortune/tarot_magic_circle.glb: Unexpected token '<', "<!DOCTYPE ..." is not valid JSON`，并出现 `Fortune shell failed to render`。页面仍在 `localhost:5173` 运行。

原因判断：磁盘上的 `app/nav-world/public/models/fortune/tarot_magic_circle.glb` 和 `app/frontend/models/fortune/tarot_magic_circle.glb` 均存在，但 `curl -I http://localhost:5173/models/fortune/tarot_magic_circle.glb` 返回 `Content-Type: text/html`，内容开头是 `<!DOCTYPE html>`。同一 dev server 下 `/models/world/island.glb` 能正常返回 GLB，说明问题不是 WebGL 或 Three.js 本身，而是 5173 这个较早启动的 Vite dev server 没刷新后续新增/重写的 fortune public 资源，导致 fortune GLB URL 被 SPA fallback 成 `index.html`。GLTFLoader 拿 HTML 当 GLB/JSON 解析，所以报 `Unexpected token '<'`。

解决方案：本次只记录原因。重启 `app/nav-world` 的 Vite dev server 后再访问即可；临时新开 `npm run dev -- --port 5174` 验证同一 URL 返回 `Content-Type: model/gltf-binary`，文件头为 `glTF`，说明当前资源文件本身正常。

涉及文件：`app/nav-world/public/models/fortune/tarot_magic_circle.glb`、`app/frontend/models/fortune/tarot_magic_circle.glb`、`validation/layer-5/debug.md`。

验证结果：`curl -I http://localhost:5173/models/fortune/tarot_magic_circle.glb` 返回 HTML；临时启动 `localhost:5174` 后，`curl -I http://localhost:5174/models/fortune/tarot_magic_circle.glb` 和 `curl -I http://localhost:5174/models/fortune/iching_floor_pattern.glb` 均返回 `model/gltf-binary`，文件头为 `glTF`。临时 5174 dev server 已关闭。

画面变化：无。本次只定位运行时服务状态，不改模型坐标或代码。

截图：本次不由 Codex 生成截图；用户已提供控制台截图作为现象依据。

剩余风险：如果继续使用未重启的 5173 dev server，fortune GLB 请求仍可能返回 HTML 并导致 shell/interior fallback。重启 5173 后如果仍报错，再按具体模型 URL 和控制台堆栈排查。

## 2026-07-08 / Layer 5A 清理旧 5173 服务并重启

日期：2026-07-08

版本 / Layer：Layer 5A 占卜屋模型接入切片

现象：用户按提示重新运行 dev server 后仍在 `localhost:5173` 看到同样的 `Unexpected token '<'` 模型加载错误。截图显示终端提示 `Port 5173 is in use, trying another one...`，新 Vite 实际启动在 `localhost:5174`，但浏览器仍访问旧的 `localhost:5173`。

原因判断：旧的 5173 Vite 进程仍占用端口并继续返回错误的 HTML fallback；用户新启动的 dev server 因端口占用自动切换到 5174，所以刷新 5173 不会使用新服务。页面内 React Error Boundary 也可能保留旧错误状态，需要在服务修复后重新加载页面。

解决方案：停止旧的 5173 Vite 进程和自动切到 5174 的新进程；重新在 `app/nav-world` 下启动 `npm run dev -- --port 5173`，确保端口 5173 被新进程占用。重新验证 `tarot_magic_circle.glb`、`tarot_table.glb` 和 `iching_floor_pattern.glb` 都返回 `Content-Type: model/gltf-binary`，文件头为 `glTF`。

涉及文件：`validation/layer-5/debug.md`。

验证结果：`curl -I http://localhost:5173/models/fortune/tarot_magic_circle.glb` 返回 `model/gltf-binary`；`curl -I http://localhost:5173/models/fortune/tarot_table.glb` 返回 `model/gltf-binary`；`curl -I http://localhost:5173/models/fortune/iching_floor_pattern.glb` 返回 `model/gltf-binary`。当前新的 dev server 运行在 `http://localhost:5173/`。

画面变化：无代码画面变化；运行时服务状态变化。用户需要对浏览器当前页面执行强制刷新，清掉旧 Error Boundary 状态。

截图：本次不由 Codex 生成截图；用户实机验证。

剩余风险：如果浏览器标签不强制刷新，旧页面内存中的错误状态可能继续显示；如果之后重新准备 `public/models/fortune/` 资源并继续使用同一个长时间运行的 dev server，仍可能再次遇到静态资源未刷新，需要重启 dev server。

## 2026-07-08 / Layer 5A 星座轮盘放到 X-6 Z0 地板

日期：2026-07-08

版本 / Layer：Layer 5A 占卜屋模型接入切片

现象：用户在资源 GLB 预览中选中 `fortune/zodiac_wheel.glb`，要求“把这个模型放在 x=-6 z=0 的地板上”。

原因判断：`zodiac_wheel.glb` 已在 fortune 资源 allowlist 中，运行时资源目录已有该文件，不需要复制新文件。模型尺寸约 `2.96 x 0.08 x 2.95`，底部 minY 约 `-0.02`，如果直接放在地板高度可能轻微穿进地面。

解决方案：在 `fortuneModelAssets.interiorAssets` 中新增 `zodiac-wheel-floor`，使用现有 `zodiac_wheel.glb`，位置设为 `[-6, 0.51, 0]`，让模型落在占卜屋局部 `X=-6, Z=0` 的地板上，并略高于地面以避免闪烁。其他模型位置不变。

涉及文件：`app/nav-world/src/modules/divination/fortuneModelAssets.ts`、`validation/layer-5/debug.md`。

验证结果：`npm run assets:fortune:check` 通过；`npm run build` 通过。构建过程中 Vite 仍提示 `WorldExperience` chunk 超过 500 kB，这是既有 3D 资源相关提示，不阻断构建；`assets:prune` 清理了上一轮未被当前 `index.html` 引用的旧 frontend hash 资源。

画面变化：有。占卜屋局部 `X=-6, Z=0` 地板位置应出现星座轮盘模型。

截图：本次不由 Codex 生成截图；按当前小步模型摆位口径，由用户实机验证。

剩余风险：模型原始直径接近 3 个单位，如果实机中太大或与地面/坐标辅助重叠，需要继续微调 `scale` 或 Y 高度。

## 2026-07-08 / Layer 5A 隐藏原占卜屋模块屏并新增三块空白内容屏

日期：2026-07-08

版本 / Layer：Layer 5A 占卜屋模型接入切片

现象：用户要求隐藏原先占卜屋的大屏幕，并在三个建模从中间看过去的略后方各放一个同类空白屏幕，方便后续补内容。

原因判断：截图中的原占卜屋大屏来自 Layer 4 的 `WorldModulePanels`，不是 GLB 模型；它当前显示 `Divination`、状态按钮和能力列表，会遮挡占卜屋室内模型摆位。后续星座、塔罗、周易需要各自独立内容承载面，直接复用一块总模块屏不利于分区布局。

解决方案：在 `WorldModulePanels.tsx` 里过滤掉 `definition.id === "divination"`，隐藏原占卜屋 Layer 4 模块表面，保留实验室和五子棋模块表面不变。在 `FortuneAssetStage.tsx` 中新增 `BlankContentScreens`，室内加载后显示三块空白竖屏：星座轮盘后方 `[-7.45, 2.0, 0]`、塔罗桌后方 `[0, 2.0, 5.85]`、周易桌后方 `[7.45, 2.0, 0]`，均朝向中心区域；屏幕只包含空白底板和轻量边框，不绑定交互和业务内容。

涉及文件：`app/nav-world/src/modules/WorldModulePanels.tsx`、`app/nav-world/src/modules/divination/FortuneAssetStage.tsx`、`validation/layer-5/debug.md`。

验证结果：`npm run assets:fortune:check` 通过；`npm run build` 通过。构建过程中 Vite 仍提示 `WorldExperience` chunk 超过 500 kB，这是既有 3D 资源相关提示，不阻断构建；`assets:prune` 清理了上一轮未被当前 `index.html` 引用的旧 frontend hash 资源。

画面变化：有。原占卜屋 `Divination` 模块大屏不再显示；占卜屋三个区域后方应出现三块空白内容屏。

截图：本次不由 Codex 生成截图；按当前小步模型摆位口径，由用户实机验证。

剩余风险：三块空白屏位置按当前局部坐标和“从中心看略后方”的口径估算；如果实机中屏幕遮挡模型、贴墙或角度不理想，需要继续微调位置、尺寸或旋转。

## 2026-07-08 / Layer 5A 愚者塔罗样始牌放到桌面

日期：2026-07-08

版本 / Layer：Layer 5A 占卜屋模型接入切片

现象：用户要求把 `/home/tang/sites/gluepudding/resources/fortune/tarot_card_sample_major_00_fool.glb` 作为塔罗牌原型放在塔罗桌桌面上。

原因判断：该样始牌源文件存在，但此前不在 `prepare-fortune-assets.mjs` allowlist 中，运行时不会复制到 `public/models/fortune/`。模型尺寸约 `0.405 x 0.021 x 0.68`，适合直接作为单张卡牌放在桌布表面。

解决方案：将 `tarot_card_sample_major_00_fool.glb` 加入 fortune 资源 allowlist 并输出到 `app/nav-world/public/models/fortune/`；在 `fortuneModelAssets.interiorAssets` 中新增 `tarot-card-fool-sample`，位置设为 `[0, 1.285, 4.45]`，放在塔罗桌布上方偏前的桌面中央，rotation 设为 `[0, 0.16, 0]`，scale 设为 `0.88`，避免和水晶球重叠。

涉及文件：`app/nav-world/scripts/prepare-fortune-assets.mjs`、`app/nav-world/src/modules/divination/fortuneModelAssets.ts`、`app/nav-world/public/models/fortune/tarot_card_sample_major_00_fool.glb`、`validation/layer-5/debug.md`。

验证结果：`npm run assets:fortune:prepare` 通过，当前准备 20 个 fortune assets；`npm run assets:fortune:check` 通过；`npm run build` 通过。构建过程中 Vite 仍提示 `WorldExperience` chunk 超过 500 kB，这是既有 3D 资源相关提示，不阻断构建；`assets:prune` 清理了上一轮未被当前 `index.html` 引用的旧 frontend hash 资源。

画面变化：有。塔罗桌桌面上应出现一张愚者塔罗样始牌。

截图：本次不由 Codex 生成截图；按当前小步模型摆位口径，由用户实机验证。

剩余风险：卡牌位置和高度按桌布当前高度估算；如果实机中卡牌悬空、压进桌布或被水晶球遮挡，需要继续小步调整 `position` 的 Y/Z 或 `scale`。

## 2026-07-08 / Layer 5A npm 强制刷新 dev server

日期：2026-07-08

版本 / Layer：Layer 5A 占卜屋模型接入切片

现象：用户要求“npm 强刷”，用于排除浏览器或 Vite dev server 继续使用旧模块、旧 public 资源或旧依赖预构建结果导致模型未更新的问题。

原因判断：此前出现过 GLB 请求被旧 dev server 返回 HTML 的情况，因此需要从 npm/Vite 侧重启服务并强制重新优化依赖，确保 `public/models/fortune/` 下的新资源由当前 5173 服务提供。

解决方案：停止原 `localhost:5173` 上的旧 `node` dev server，删除 `app/nav-world/node_modules/.vite`，再用 `npm run dev -- --host 0.0.0.0 --port 5173 --force` 启动新的 Vite dev server。

涉及文件：`validation/layer-5/debug.md`。本次未修改产品代码。

验证结果：新的 Vite dev server 已在 `http://localhost:5173/` 启动，并显示 `Forced re-optimization of dependencies`。直接请求 `http://localhost:5173/models/fortune/tarot_card_sample_major_00_fool.glb` 返回 `200 OK`，`Content-Type: model/gltf-binary`，文件头为 `glTF`。

画面变化：无代码层面的新增画面变化；该操作用于让浏览器拿到最新运行时资源。

截图：本次不由 Codex 生成截图；按当前小步模型摆位口径，由用户实机验证。

剩余风险：如果浏览器标签页仍显示旧画面，需要在该标签页执行一次浏览器强制刷新，避免 DevTools 或页面自身保留旧运行时状态。

## 2026-07-08 / Layer 5A 删除占卜屋交互可见球

日期：2026-07-08

版本 / Layer：Layer 5A 占卜屋模型接入切片

现象：用户截图中占卜屋内左侧空中出现一个淡紫色球体，要求“这个球删掉”。

原因判断：该球不是 GLB 模型，也不是塔罗桌水晶球，而是 `InteractionSystem` 为 `divination-house` 交互目标绘制的可见 aim marker。占卜屋进入 Layer 5A 室内模型调试后，这个通用交互提示球会悬在室内视野中，干扰模型摆位和空白屏观察。

解决方案：在 `InteractionSystem.tsx` 中只对 `divination-house` 隐藏可见 aim marker 球体；保留透明 raycast 命中球和地面 proximity ring 的逻辑，因此准星点击、靠近按 E 和选中状态仍可继续工作。实验室和五子棋的可见 aim marker 不变。

涉及文件：`app/nav-world/src/world/InteractionSystem.tsx`、`validation/layer-5/debug.md`。

验证结果：`npm run build` 通过。构建过程中 Vite 仍提示 `WorldExperience` chunk 超过 500 kB，这是既有 3D 资源相关提示，不阻断构建；`assets:prune` 清理了上一轮未被当前 `index.html` 引用的旧 frontend hash 资源。

画面变化：有。占卜屋内的淡紫色交互提示球应消失；其他模型和占卜屋交互能力不应受影响。

截图：本次不由 Codex 生成截图；按当前小步模型摆位口径，由用户实机验证。

剩余风险：占卜屋地面范围提示 ring 仍保留。如果后续用户希望连地面交互圈也隐藏，需要再单独关闭 `divination-house` 的可见 proximity ring，而不是删除交互命中逻辑。

## 2026-07-08 / Layer 5 正式验收并缩小目标范围

日期：2026-07-08

版本 / Layer：Layer 5 占卜屋模型摆放验收层

现象：用户明确确认“此层目标缩小，所有的建模已放置于规定位置，所有的交互逻辑均没做，包括点击，下放到 Layer 8 制作，Layer 5 确认验收”。

原因判断：Layer 5A 已围绕占卜屋外壳、塔罗桌、星座轮盘、周易桌、三块空白内容屏和无关可见提示物完成多轮实机微调。继续把点击、选中、高亮、面板、mock 数据、真实接口等业务交互放在 Layer 5，会扩大本层范围并拖慢后续分层验证。

解决方案：将 `VALIDATION_LAYERS.md` 中 Layer 5 从“占卜屋模拟层”调整为“占卜屋模型摆放验收层”，明确本层只验收模型位置和资源稳定性；点击、选中、高亮、卡牌翻面、星座输入、周易起卦、结果展示、mock 流程和真实接口全部下放到 Layer 8。同步更新 `TODO.md`，把星座台、塔罗桌、周易桌和三块空白内容屏标记为模型摆放已完成，并把真实场景区域交互标注为 Layer 8 任务。

涉及文件：`VALIDATION_LAYERS.md`、`TODO.md`、`validation/layer-5/debug.md`。

验证结果：文档更新完成；本次未修改运行时代码，因此不运行构建。Layer 5 验收事实来自用户实机确认。

画面变化：无。本次是验收口径和任务边界调整，不改变画面。

截图：不新增截图；沿用 Layer 5 已有实机截图和用户本轮确认。

剩余风险：Layer 5 不再覆盖占卜业务交互。Layer 8 开始时需要重新确认交互验收标准，包括准星/移动端命中、点击选中、内容屏承载、mock 兜底、真实接口失败处理和周易六爻展示顺序。
