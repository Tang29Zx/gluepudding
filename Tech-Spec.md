# 3D 实时站点大世界技术说明

本文档记录当前实现层的技术约束和接口边界。需求事实来源仍是 `REQUIREMENTS.md`，分层验收事实来源仍是 `VALIDATION_LAYERS.md`。

## Layer 4：模块外壳层

目标：让占卜屋、实验室、五子棋都能作为常驻 3D 模块表面贴在世界物体上，不发生整页跳转，也不让鼠标焦点离开 Canvas。

### 范围

- 本层只实现模块外壳、模块状态、错误隔离和验证入口。
- 本层不实现真实占卜、WebRTC、RDK、门禁控制或五子棋规则。
- 模块 UI 以真实 R3F 3D 表面呈现，常驻锚定在对应建筑或物体表面。
- 状态切换控件是可 raycast 的 3D mesh，准星命中后左键或 `E` 激活。
- 加载中、错误、离线状态通过内置调试切换复现，不使用随机失败。

### 类型和状态

```ts
type WorldModuleId = "divination" | "laboratory" | "gomoku";
type WorldModuleStatus = "loading" | "ready" | "error" | "offline";
```

交互目标和模块映射：

```text
divination-house -> divination
laboratory       -> laboratory
gomoku-board     -> gomoku
```

### 运行边界

- 模块状态保留在 `WorldExperience` 附近的局部 React state 中。
- 不引入中心化状态库；等后续出现跨模块共享状态需求后再评估。
- 单个模块渲染异常必须被局部 Error Boundary 捕获，并显示该模块的错误状态。
- 模块面板常驻显示，不再使用打开 / 关闭式 DOM 浮层。
- 模块状态切换时玩家移动和视角继续运行，Pointer Lock 不主动退出。
- 后续“进入某个区域才加载对应模块，其余不加载”作为性能优化，不属于本层最小验证。

### 验收

- 三个模块常驻显示在占卜屋入口、实验室大屏和五子棋棋盘附近。
- 三个模块的状态芯片都能通过准星左键或 `E` 在 Canvas 内切换。
- 三个模块都能切换 `loading`、`ready`、`error`、`offline`。
- 地址栏不发生整页跳转。
- 连续切换三个模块状态后，玩家仍停留在同一个世界中，移动和视角不被模块操作打断。
- 桌面端和移动端截图必须归档到 `validation/layer-4/` 并写入 `VALIDATION_LAYERS.md`。

## Layer 4.5：GLB 地形替换和资源接入准备层

目标：把 `resources/` 中的大场景 GLB 作为世界基础地形接入，同时继续把占卜屋代码留作 Layer 5 输入。

### 已有输入

- 世界大场景候选资源：`resources/float-island-low-ploy.zip`。
- 占卜屋现有代码：`resources/fortune/`。

### 接入边界

- 大场景源模型位于 `app/nav-world/public/models/world/island.glb`，体积约 86MB，已通过 Git LFS 管理；也可通过 `npm run assets:world:prepare` 从本地 `resources/float-island-low-ploy.zip` 重新生成。
- 构建后模型会复制到 `app/frontend/models/world/island.glb`；该构建输出继续被 `.gitignore` 忽略，不提交普通 Git。
- GLB 使用 `scale = 6`、`position = [-14.4, -10, 3.5]`，作为世界基础地形；旧圆形地板和网格只作为 GLB 加载中或加载失败兜底。
- 玩家贴地对 GLB 主岛体 `Icosphere` 做射线采样，并选择最高的朝上可走命中；树木、房屋墙体和装饰物第一版不参与碰撞。
- 无地形命中或坡度过陡时阻止水平移动，避免玩家走出浮岛。
- 出生点、占卜屋、实验室和五子棋区域已重排到浮岛空地，模块表面和交互命中点跟随新锚点。
- 占卜屋代码作为 Layer 5 输入，优先复用 `resources/fortune/src/types/fortuneTypes.ts`、`resources/fortune/src/adapters/fortuneApi.ts`、mock 流程和 UI 状态设计。
- `resources/fortune/node_modules/`、`resources/fortune/dist/` 和 `resources/fortune/.env` 不进入主工程源码；不要读取或记录 `.env` 内容。
- Python/FastAPI 部分只作为接口行为参考，是否接真实后端留到后续接口层决定。

### 下一步

- 再梳理占卜屋 demo 的可复用前端代码，并拆成 Layer 5 的最小 mock 接入任务。
