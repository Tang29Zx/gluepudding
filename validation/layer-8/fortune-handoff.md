# Layer 8 Fortune 交接文档

日期：2026-07-08

面向协作者：新开 `fortune` 分支制作 Layer 8 占卜屋交互。用户本人会并行推进实验室和五子棋相关层，最后通过 PR 合并。

## 结论

Layer 5 已验收，只负责模型摆放。Layer 8 负责占卜屋真实交互和结果展示：塔罗、星座、周易都必须在同一个 3D 世界内完成，不整页跳转。

协作者分支建议只改占卜屋相关代码、占卜屋资源准备脚本和 Layer 8 验证记录，尽量避免碰实验室、五子棋、地形和部署相关文件，降低与 Layer 6 / Layer 7 / Layer 12 并行开发的冲突。

## 当前事实来源

- 需求边界以 `VALIDATION_LAYERS.md` 的 Layer 8 为准。
- Layer 5 模型摆位记录在 `validation/layer-5/debug.md`。
- Layer 8 调试和验收过程追加到 `validation/layer-8/debug.md`。
- 当前占卜屋模型入口在 `app/nav-world/src/modules/divination/FortuneAssetStage.tsx`。
- 当前占卜屋模型清单在 `app/nav-world/src/modules/divination/fortuneModelAssets.ts`。
- 当前轻量 GLB 复制脚本在 `app/nav-world/scripts/prepare-fortune-assets.mjs`。

注意：`Tech-Spec.md` 里如果仍出现旧的“Layer 5 占卜屋模拟业务层”文字，应视为历史说明；实际开发边界已经迁移到 Layer 8。

## 并行开发边界

用户并行做：

- Layer 6：世界内五子棋模拟层。
- Layer 7：实验室模拟层。
- Layer 12：真实五子棋集成层。

协作者做：

- Layer 8：占卜屋交互与真实占卜接口层。
- 分支名：`fortune`。
- PR 合并时只合并 Fortune/Divination 相关改动。

尽量不要改：

- `app/nav-world/src/modules/laboratory/`
- `app/nav-world/src/modules/gomoku/`
- `app/nav-world/src/world/IslandTerrain.tsx`
- 世界大场景资源脚本和 `models/world/`
- `WorldModulePanels.tsx`，除非必须接入占卜屋屏幕内容。

如果必须改 `WorldExperience.tsx` / `WorldScene.tsx` 传递玩家位置或交互状态，改动保持最小，并在 PR 描述里单独列出。

## 资源读取结论

用户提到的路径：

```text
/home/tang/sites/gluepudding/resources/fortune/textures
```

当前实际情况：

- `resources/fortune/textures/rws/`：78 张原始 RWS 塔罗 JPG，约 67MB。
- `resources/fortune/textures/rws-web/`：78 张压缩后的 Web 用 JPG，约 15MB。
- `resources/fortune/textures/rws/manifest.json`：原始牌面 manifest。
- `resources/fortune/textures/rws-web/manifest.json`：压缩牌面 manifest，包含 `id`、输出尺寸和大小。
- `resources/fortune/textures/` 目录下没有 JS / MJS 文件。

可复用 JS / MJS 实际在：

- `resources/fortune/download_rws_tarot_images.mjs`：定义完整 78 张牌的 ID 顺序和下载 manifest 逻辑。
- `resources/fortune/compress_rws_tarot_images.mjs`：把 `rws/` 压缩成 `rws-web/`，并生成 `rws-web/manifest.json`。
- `resources/fortune/generate_tarot_textured_sample.mjs`：手写 GLB，把一张 JPG 作为 embedded image 贴到单张牌正面；可复用卡牌尺寸、UV、材质思路。
- `resources/fortune/generate_tarot_major_sample.mjs`：用 Three.js 生成无外部贴图的愚者原型；可作为“空白卡牌模型”思路参考。

资源策略判断：

- 不要把 `resources/fortune/textures/rws/` 原图整体复制进运行时资源。
- 不要把 78 张牌都做成 embedded GLB，会造成体积和加载压力过大。
- 建议新增单独脚本复制 `rws-web/` 到 `app/nav-world/public/textures/fortune/rws-web/`。
- `prepare-fortune-assets.mjs` 当前检查 `public/models/fortune/` 不允许出现 `textures/`，所以塔罗贴图不要放进 `public/models/fortune/textures/`。
- 塔罗开始时显示 78 张空白牌；用户选中 3 张后，再从 `rws-web/manifest.json` 随机抽 3 张，并只加载这 3 张贴图。

## 当前占卜屋模型位置

这些坐标是 `FortuneAssetStage` 局部坐标，整个占卜屋 group 会再应用 `tentDoorFacingSpawnYaw = -2.47`。

- 塔罗桌中心：`[0, 0.05, 4.15]`
- 塔罗桌布：`[0, 1.06, 4.15]`
- 塔罗样始牌：`[0, 1.285, 4.45]`
- 星座轮盘地面：`[-6, 0.51, 0]`
- 周易桌中心：`[6, 0.05, 0]`
- 空白内容屏：
  - 星座屏：`[-7.45, 2.0, 0]`，rotation `[0, Math.PI / 2, 0]`
  - 塔罗屏：`[0, 2.0, 5.85]`，rotation `[0, Math.PI, 0]`
  - 周易屏：`[7.45, 2.0, 0]`，rotation `[0, -Math.PI / 2, 0]`

不要在 Layer 8 重新摆放 Layer 5 已验收模型。需要内容时，优先复用三块空白屏。

## 推荐实现结构

建议新增这些文件，保持占卜屋交互独立：

```text
app/nav-world/src/modules/divination/fortuneTypes.ts
app/nav-world/src/modules/divination/fortuneMockData.ts
app/nav-world/src/modules/divination/fortuneApi.ts
app/nav-world/src/modules/divination/FortuneInteractionLayer.tsx
app/nav-world/src/modules/divination/FortuneScreens.tsx
app/nav-world/src/modules/divination/TarotCardRing.tsx
app/nav-world/src/modules/divination/ZodiacInteraction.tsx
app/nav-world/src/modules/divination/IchingInteraction.tsx
app/nav-world/scripts/prepare-fortune-tarot-textures.mjs
```

推荐把 `BlankContentScreens` 从 `FortuneAssetStage.tsx` 拆成可显示内容的 `FortuneScreens`，但不要改变三块屏幕位置。

交互不要继续塞进全局 `divination-house` 粗粒度目标。Layer 8 应该创建占卜屋内部目标：塔罗牌、星座区域、周易铜钱/按钮。可以在 `FortuneInteractionLayer` 内用 `useThree()` + `Raycaster` 管自己的命中对象。

## 塔罗实现要求

用户目标：

- 开始塔罗牌时，78 张空白模型环绕用户身边。
- 用户选择 3 张。
- 选完 3 张后，从 `resources/fortune/textures` 的牌面里随机选择 3 张贴图渲染到选中的卡牌上。
- 在塔罗屏幕组件上显示解读。

建议流程：

1. 用户对准塔罗桌或塔罗样始牌，并左键点击时，触发“开始塔罗”。
2. 进入 `tarotPhase = "choosing"`。
3. 在玩家当前位置或塔罗桌附近生成 78 张空白牌，组成一圈或多圈环绕。
4. 空白牌初始不加载任何牌面 JPG，只显示背面/空白材质。
5. 准星命中空白牌后左键选中，选中牌高亮。
6. 选满 3 张后：
   - 从 `rws-web/manifest.json` 的 78 个 `id` 中无重复随机抽 3 个。
   - 将 3 张 JPG 贴到 3 张已选牌的正面。
   - 生成 `TarotReading` mock 结果。
   - 在塔罗屏显示三张牌名、牌位和解读。

关键实现建议：

- 随机抽牌必须在事件处理里执行一次，不要放在 React render 里，避免重渲染换牌。
- 78 张牌可以先用同一个轻量几何或 `tarot_card.glb` clone；只有已选 3 张需要加载贴图。
- 贴图建议用 `TextureLoader` 读取 `./textures/fortune/rws-web/<id>.jpg`。
- 如果 GLB 正面不好替换材质，可以在空白卡牌正面叠一张薄 `planeGeometry` 显示贴图。
- 选中三张后锁定结果；重新开始塔罗才清空。

最小数据结构建议：

```ts
type TarotPhase = "idle" | "choosing" | "revealed";

interface TarotCardMeta {
  id: string;
  title: string;
  imageUrl: string;
}

interface TarotSelection {
  slot: "past" | "present" | "future";
  card: TarotCardMeta;
  reversed: boolean;
  interpretation: string;
}
```

三张牌位建议先用中文：`过去`、`现在`、`未来`。

## 星座实现要求

用户目标：

- 星座逻辑部分，每一个区域作为可交互的。
- 用户选择自己的星座后，在屏幕上显示解读。

建议流程：

1. 在星座轮盘附近创建 12 个可命中的隐形区域或小标签。
2. 每个区域对应一个星座。
3. 准星命中区域后显示轻量高亮。
4. 左键选择星座。
5. 在星座屏显示星座名、日期、综合、爱情、事业、健康、幸运色、幸运数字、宜、忌和总结。

推荐星座 ID：

```ts
type ZodiacSign =
  | "aries"
  | "taurus"
  | "gemini"
  | "cancer"
  | "leo"
  | "virgo"
  | "libra"
  | "scorpio"
  | "sagittarius"
  | "capricorn"
  | "aquarius"
  | "pisces";
```

第一版可以只用 mock 解读，不等待后端。真实接口接入时通过 `fortuneApi.ts` 包一层，不让组件直接拼 fetch。

## 周易实现要求

用户目标：

- 先问用户想算什么。
- 通过掷铜钱得到正反面。
- 记录正反面，正反面代表不同数字。
- 经过运算解卦。
- 在屏幕组件上显示结果。

建议流程：

1. 用户对准周易桌或铜钱，触发“开始周易”。
2. 先询问问题：
   - MVP 可提供预设问题按钮：`今日运势`、`感情`、`事业`、`选择建议`。
   - 如果做自由输入，可以用世界内 `Html` 输入面板；输入聚焦时必须暂停/屏蔽玩家移动。
3. 用户确认后，开始掷铜钱。
4. 每一爻掷 3 枚铜钱，共 6 次，从下往上记录。
5. 记录每次 3 枚铜钱的正反面和数值。
6. 算出六爻、本卦、变爻、变卦和解释。
7. 在周易屏显示问题、六次投掷记录、卦象和解读。

铜钱数值建议：

```text
正面 = 3
反面 = 2

6 = 老阴，阴爻，变爻
7 = 少阳，阳爻，不变
8 = 少阴，阴爻，不变
9 = 老阳，阳爻，变爻
```

展示顺序注意：

- 运算数组按“从下往上”记录。
- 屏幕展示六爻时使用 `result.lines.slice().reverse()`，让视觉从上往下读。

第一版如果 64 卦完整表来不及，可以先实现稳定的 mock 解读和基础卦名映射，但必须保留数据结构，后续可替换为完整卦辞。

## 屏幕内容要求

三块空白屏是 Layer 5 留给 Layer 8 的承载面。Layer 8 需要把结果写到对应屏幕：

- 塔罗结果写到塔罗屏。
- 星座结果写到星座屏。
- 周易结果写到周易屏。

屏幕可以适当放大，保持人的舒适阅读

建议使用 `@react-three/drei` 的 `Text` 先做 Canvas 内文字，避免 DOM 浮层破坏 Pointer Lock。文字需要控制 `maxWidth`、字号和行数，避免溢出屏幕。

如果必须用输入框，可以只在周易提问阶段短暂使用 `Html` 或页面内 overlay，并明确暂停移动；不要用整页跳转。

## 接口和 mock

Layer 8 需要 `mock-first`：

- 没有后端时，星座、塔罗、周易都能完整跑通。
- 有后端时，接口失败要回到 mock 或显示世界内错误。
- 不读取、不记录、不提交任何 `.env`、token、私钥或设备地址。

建议 `fortuneApi.ts` 暴露：

```ts
getZodiacFortune(sign: ZodiacSign): Promise<ZodiacReading>
getTarotReading(cards: TarotSelection[]): Promise<TarotReading>
getIchingReading(input: IchingInput): Promise<IchingReading>
```

真实接口配置只读环境变量或安全配置，不硬编码。

## 验收标准

Layer 8 最小通过标准：

- 进入占卜屋后，塔罗、星座、周易三个区域可交互。
- 塔罗可以开始、显示 78 张空白牌、选中 3 张、随机贴上 3 张牌面、在塔罗屏显示解读。
- 星座可以选择 12 个区域之一，并在星座屏显示解读。
- 周易可以输入或选择想算的问题，完成 6 次铜钱投掷，记录正反面，算出结果并显示在周易屏。
- 所有流程均在 3D 世界内完成，不整页跳转。
- 外部接口不可用时，mock 流程仍能演示。
- 不破坏 Layer 5 已验收模型位置。
- 不影响用户并行开发的 Layer 6 / Layer 7 / Layer 12。

必须运行：

```bash
cd /home/tang/sites/gluepudding/app/nav-world
npm run assets:fortune:prepare
npm run assets:fortune:check
npm run build
```

如果新增塔罗贴图准备脚本，还要新增并运行对应 check，例如：

```bash
npm run assets:fortune:textures:prepare
npm run assets:fortune:textures:check
```

视觉验收需要桌面端和移动端截图，归档到 `validation/layer-8/`，并在 `VALIDATION_LAYERS.md` 或 `validation/layer-8/debug.md` 中引用。

## 已知坑

- `resources/` 不进 Git，只能作为本地输入；PR 里不能包含 `resources/fortune/textures/**`。
- 当前 `resources/feature-implementation/` 在本地未找到；不要把它作为必需依赖。如果后续恢复该目录，也不要读取或记录 `.env`。
- 旧 dev server 可能把新增 GLB 或贴图 URL 返回成 `index.html`，表现为 `Unexpected token '<'`。遇到这种情况先重启 Vite，并确认资源 URL 的 `Content-Type`。
- 当前 `prepare-fortune-assets.mjs` 会拒绝 `public/models/fortune/` 下的 `textures/` 目录；塔罗牌面应走单独 public 路径。
- 不要一次性加载 78 张高清图；会拖慢世界加载并影响移动端。
- 随机结果不要在 render 中生成；否则 React 重渲染会导致牌面变化。
- 周易六爻记录从下往上，展示从上往下，别把顺序做反。
