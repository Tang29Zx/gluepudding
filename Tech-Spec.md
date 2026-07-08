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

## Layer 4.5：资源接入准备层

目标：只记录 `resources/` 中已有资源如何进入后续层，不做资源迁移、解压或代码集成。

### 已有输入

- 世界大场景候选资源：`resources/float-island-low-ploy.zip`。
- 占卜屋现有代码：`resources/fortune/`。

### 接入边界

- 大场景资源优先在 Layer 4.5 后续实现中接入，用于确定世界比例、出生点、交互点和性能边界。
- 占卜屋代码作为 Layer 5 输入，优先复用 `resources/fortune/src/types/fortuneTypes.ts`、`resources/fortune/src/adapters/fortuneApi.ts`、mock 流程和 UI 状态设计。
- `resources/fortune/node_modules/`、`resources/fortune/dist/` 和 `resources/fortune/.env` 不进入主工程源码；不要读取或记录 `.env` 内容。
- Python/FastAPI 部分只作为接口行为参考，是否接真实后端留到后续接口层决定。

### 下一步

- 先检查大场景压缩包里的模型格式、贴图结构和比例，再决定迁移到 `gluepudding/app/nav-world/public/models/world/` 或等价资源目录。
- 再梳理占卜屋 demo 的可复用前端代码，并拆成 Layer 5 的最小 mock 接入任务。
