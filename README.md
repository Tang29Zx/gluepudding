# gluepudding 3D World

`gluepudding` 当前目标是总站级 3D 实时大世界入口，不是普通跳转导航页。

本项目明确面向中文用户。README、协作文档、验证记录和产品 UI 文案默认使用中文；代码标识、命令、路径、类型名和接口名保持英文。

用户进入后应停留在同一个 3D 世界里移动、观察和操作：占卜屋、实验室、五子棋等能力会逐层接入世界内模块，不默认整页跳转到其他站点。

## 当前状态

- 当前已确认：Layer 4 模块外壳层。
- 当前推进：Layer 4.5 GLB 地形替换和资源接入准备层。
- 目标用户：中文用户。
- 主前端工程：`app/nav-world/`。
- 构建输出目录：`app/frontend/`。
- 资源参考目录：`resources/`，只作本地输入，不进 Git。
- 世界源模型：`app/nav-world/public/models/world/island.glb` 通过 Git LFS 管理。

## 先读这些文档

协作者开始前先读：

- `AGENTS.md`：项目协作规则、验证规则、安全规则。
- `MEMORY.md`：长期项目记忆和已确认口径。
- `REQUIREMENTS.md`：当前需求事实来源。
- `TODO.md`：当前任务拆分。
- `VALIDATION_LAYERS.md`：分层验收标准。
- `Tech-Spec.md`：当前技术边界。
- `validation/layer-N/debug.md`：对应 Layer 的问题、修复和验证记录。

## 本地启动

```bash
cd app/nav-world
npm install
npm run dev
```

默认打开：

```text
http://127.0.0.1:5173/
```

协作者默认只需要本地浏览器访问上面的地址，不需要额外远程环境。

## 构建和本地预览

别人 clone 后按本地预览即可，不需要访问项目服务器。首次运行先安装依赖：

```bash
cd app/nav-world
npm install
npm run build
npm run preview -- --host 127.0.0.1 --port 4174
```

本机预览：

```text
http://127.0.0.1:4174/
```

构建脚本会先运行 TypeScript 检查，再执行 Vite build，并清理未跟踪且不被当前 `index.html` 引用的前端构建资源。

如果本机 `4174` 已被占用，可以换本机端口：

```bash
npm run preview -- --host 127.0.0.1 --port 4175
```

然后打开：

```text
http://127.0.0.1:4175/
```

## 常用命令

```bash
cd app/nav-world
npm run dev
npm run assets:world:prepare
npm run build
npm run assets:check
npm run preview -- --host 127.0.0.1 --port 4174
```

说明：

- `npm run dev`：启动开发服务器。
- `npm run assets:world:prepare`：从 `resources/float-island-low-ploy.zip` 解出 `source/island.glb` 到 `app/nav-world/public/models/world/island.glb`，只在本地重新生成源模型时需要。
- `npm run build`：类型检查、构建并清理未跟踪旧资源。
- `npm run assets:check`：只检查构建资源清理状态，不修改文件。
- `npm run preview`：预览构建结果。

## Git LFS

世界源模型较大，仓库使用 Git LFS 管理：

- `app/nav-world/public/models/world/island.glb`

首次 clone 后确认拉取 LFS 对象：

```bash
git lfs install
git lfs pull
```

如果 `island.glb` 只有几行 pointer 文本，不是真实约 86MB 文件，说明还没有执行 `git lfs pull` 或 LFS 流量 / 权限不可用。

## resources 目录规则

`resources/` 是本地参考输入，不是仓库交付物。

当前已知输入：

- `resources/float-island-low-ploy.zip`：世界大场景候选资源。
- `resources/fortune/`：占卜屋现有代码输入。

不要做这些事：

- 不要把 `resources/` 提交进 Git。
- 不要把 `resources/fortune/node_modules/` 或 `resources/fortune/dist/` 接入主工程源码。
- 不要读取、复制、打印、提交或记录 `resources/fortune/.env` 内容。
- 不要在没有任务说明时移动、解压或删除 `resources/` 里的文件。

`.gitignore` 已经忽略整个 `resources/`。

Layer 4.5 还会生成运行时模型文件：

- `app/nav-world/public/models/world/island.glb`
- `app/frontend/models/world/island.glb`

其中 `app/nav-world/public/models/world/island.glb` 是源模型，已通过 Git LFS 进入仓库；`app/frontend/models/world/island.glb` 是构建输出，继续被 `.gitignore` 忽略，不要提交。

## 协作者适合做的工作

如果不负责建模和核心架构，优先做这些低风险任务：

- 清点资源文件结构，不读取 secret。
- 整理模型尺寸、格式、贴图、许可备注。
- 记录浏览器验证现象。
- 补充 `validation/layer-N/debug.md` 的问题复现和截图说明。
- 按 `VALIDATION_LAYERS.md` 做桌面端 / 移动端验收。
- 检查文档里的任务状态是否和实际一致。

暂时不要做这些：

- 不要重写世界架构。
- 不要引入新的状态库或大依赖。
- 不要把真实业务接口直接写进渲染组件。
- 不要硬编码 token、密钥、设备地址或私钥。
- 不要把世界内交互改回整页跳转。

## 验证规则

代码或 UI 改动完成前，至少运行相关检查：

```bash
cd app/nav-world
npm run build
npm run assets:check
```

如果有用户可见画面变化，还需要：

- 生成桌面端截图。
- 生成移动端截图。
- 截图放入 `validation/layer-N/` 或对应版本目录。
- 在 `VALIDATION_LAYERS.md` 引用截图。
- 在对应 `validation/layer-N/debug.md` 记录现象、原因、解决方案、验证结果和截图路径。

如果只是文档变化，不需要截图，但最终说明要写明未截图原因。

## 当前交互口径

Layer 4 / 4.5 已确认的方向：

- 模块表面常驻贴在 3D 世界物体上。
- 世界基础地形使用 Git LFS 管理的 `app/nav-world/public/models/world/island.glb`；`resources/float-island-low-ploy.zip` 只在需要重新生成源模型时使用。
- 玩家贴地使用 GLB 主岛体 `Icosphere` 的最高朝上命中面，不做树木、房屋墙体或装饰物碰撞。
- 占卜屋、实验室、五子棋不通过整页跳转打开。
- 主交互保持在 Canvas 内。
- 鼠标焦点不应因为模块操作离开 Canvas。
- 准星命中 3D 控件后，用左键或 `E` 执行动作。
- `resources/` 里的真实输入留到后续 Layer 清点和接入。

## Git 注意事项

提交前检查：

```bash
git status --short
git diff --stat
```

不要提交：

- `.env`、`.env.*`
- 私钥、证书、token、密码
- `node_modules/`
- `dist/`
- `resources/`
- `app/frontend/models/world/*.glb`
- 临时截图或未归档截图

如果工作区已有别人改动，不要回滚；只处理自己任务相关文件。
