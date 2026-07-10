# Layer 2 调试记录

本文件只记录 Layer 2：移动和相机层 的问题、原因判断、解决方案和验证结果。不要记录 secret、token、私钥、密码或内部敏感地址。

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

## 2026-07-07 / Layer 2 启动和缓存

现象：用户刷新后出现长时间加载、初始化失败、旧 hash JS 报 MIME 错误或资源缺失。

原因判断：3D world chunk 较大，旧 `index.html` 可能引用已删除的 hash 资源；缺失 JS/CSS 曾被 Nginx 回退成 HTML，浏览器因此拒绝 module script。

解决方案：保持 `WorldExperience` 动态加载；构建使用 `emptyOutDir: false` 保留旧 assets；Nginx 为 `/assets/` 设置独立 `try_files $uri =404`；入口 HTML 禁止长期缓存；启用 JS/CSS gzip；Vite 构建阶段为 3D chunk 注入 `modulepreload`。

涉及文件：`gluepudding/app/nav-world/src/App.tsx`、`gluepudding/app/nav-world/vite.config.ts`、Nginx `gluepudding` 站点配置、`MEMORY.md`。

验证结果：`tsc --noEmit` 和 `npm run build` 通过；线上入口引用新 hash 资源；JS 资源返回 `application/javascript`；gzip 正常。

画面变化：有，启动阶段显示轻量渐变和阶段进度。

截图：历史截图暂未按新规则补齐；后续画面变化必须归档到 `validation/` 并写入 `VALIDATION_LAYERS.md`。

剩余风险：正式开启长期缓存前，仍建议使用版本查询参数绕过本地浏览器缓存。

## 2026-07-07 / Layer 2 移动控制

现象：用户按 `Ctrl + Space + W` 或 `Ctrl + W` 时页面像“没了”。

原因判断：`Ctrl + W` 是浏览器关闭当前标签页快捷键，不是应用崩溃。

解决方案：疾跑键从 `Ctrl` 改为 `Shift`，避免用户正常移动时触发浏览器关闭标签页。

涉及文件：`gluepudding/app/nav-world/src/world/PlayerController.tsx`、`REQUIREMENTS.md`、`TODO.md`、`VALIDATION_LAYERS.md`、`MEMORY.md`。

验证结果：`tsc --noEmit` 和 `npm run build` 通过；线上入口引用新 hash 资源；fallback 路径仍可打开。

画面变化：无。

截图：无，控制行为变化不改变画面。

剩余风险：浏览器层面的 `Ctrl + W` 仍会关闭标签页，应用不拦截系统快捷键。

## 2026-07-07 / Layer 2 跳跃手感

现象：跳跃先显得轻飘，之后用户希望跳得更高，并反馈刚落地马上再跳有粘脚感。

原因判断：初始重力和起跳速度组合导致滞空手感不理想；落地前短按 `Space` 会因为当时仍处于空中而被丢弃。

解决方案：采用偏重、短滞空参数 `gravity: 34`、`jumpVelocity: 8.8`；加入 `jumpBufferSeconds: 0.12`，让落地前短按可在落地瞬间生效。

涉及文件：`gluepudding/app/nav-world/src/world/sceneConfig.ts`、`gluepudding/app/nav-world/src/world/PlayerController.tsx`、`MEMORY.md`。

验证结果：`tsc --noEmit` 和 `npm run build` 通过；线上入口引用新 hash 资源。

画面变化：无，属于控制手感变化。

截图：无，控制行为变化不改变静态画面。

剩余风险：最终跳跃数值仍以用户实机手感为准。

## 2026-07-07 / Layer 2 空中转向

现象：用户要求在空中不能转向。

原因判断：移动逻辑每帧按当前 yaw 和 `WASD` 重新计算水平移动方向，人在空中也能改变飞行轨迹。

解决方案：起跳瞬间锁定水平速度；空中鼠标仍可转视角，但玩家轨迹不再在空中改向；落地后重新读取当前方向和按键。

涉及文件：`gluepudding/app/nav-world/src/world/PlayerController.tsx`、`MEMORY.md`。

验证结果：`tsc --noEmit` 和 `npm run build` 通过；线上入口引用新 hash 资源。

画面变化：无，属于控制行为变化。

截图：无，控制行为变化不改变静态画面。

剩余风险：没有碰撞系统，空中轨迹仍只受地面边界限制。

## 2026-07-07 / Layer 2 HUD 文案

现象：用户要求去掉 3D 运行态左上角 `gluepudding 3D World` 字样。

原因判断：运行态 HUD 中 `.world-brand` 可见品牌块占据左上角，影响沉浸感。

解决方案：删除 3D 运行态 HUD 的品牌链接块，只保留状态信息；2D 兜底页品牌入口保持可读。

涉及文件：`gluepudding/app/nav-world/src/world/WorldExperience.tsx`、`gluepudding/app/nav-world/src/styles.css`、`MEMORY.md`。

验证结果：`tsc --noEmit` 和 `npm run build` 通过；线上入口引用新 hash 资源；gzip 正常。

画面变化：有，左上角品牌字样被移除。

截图：本条发生在截图归档新规则之前，后续视觉变化必须补电脑端和手机端截图到 `validation/` 并写入 `VALIDATION_LAYERS.md`。

剩余风险：无已知功能风险。

## 2026-07-07 / Layer 2 调试记录迁移

现象：用户要求 `debug.md` 放进每个 Layer 底下，每个 Layer 单独管理。

原因判断：单个根目录 `debug.md` 会把不同 Layer 的问题混在一起，不利于分层推进和回溯。

解决方案：改为 `validation/layer-N/debug.md`；将 Layer 2 相关记录迁入 `validation/layer-2/debug.md`；为 `VALIDATION_LAYERS.md` 中的每个 Layer 建立各自的 `debug.md`；删除根目录 `debug.md`。

涉及文件：`AGENTS.md`、`MEMORY.md`、`VALIDATION_LAYERS.md`、`validation/layer-*/debug.md`。

验证结果：已确认新规则写入 `AGENTS.md`、`MEMORY.md` 和 `VALIDATION_LAYERS.md`；已创建各 Layer debug 文件；根目录 `debug.md` 已移除。

画面变化：无，文档结构变更。

截图：无，未改变应用画面。

剩余风险：后续进入各 Layer 时，需要把“暂无记录”替换为真实调试记录。

## 2026-07-07 / Layer 2 验证目录纠正

现象：用户纠正不要在 `validation-screenshots/` 底下做，要求统一放在 `validation/` 底下。

原因判断：项目已有 `validation/layer-0` 和 `validation/layer-1` 截图目录，继续使用 `validation-screenshots/` 会形成两套验证产物位置。

解决方案：将每层 `debug.md` 从 `validation-screenshots/layer-N/debug.md` 迁移到 `validation/layer-N/debug.md`；将 `AGENTS.md`、`MEMORY.md`、`VALIDATION_LAYERS.md` 和各层 debug 文件中的路径统一改为 `validation/`；删除空的 `validation-screenshots/` 目录。

涉及文件：`AGENTS.md`、`MEMORY.md`、`VALIDATION_LAYERS.md`、`validation/layer-*/debug.md`。

验证结果：已确认根目录没有 `debug.md`；已确认 `validation-screenshots/` 不存在；已确认 Layer 0 到 Layer 14 都在 `validation/layer-N/debug.md` 有独立调试文件。

画面变化：无，文档和目录结构变更。

截图：无，未改变应用画面。

剩余风险：无。

## 2026-07-09 / Layer 2 视角俯仰范围

现象：用户希望视角上下限再提高和拉低一点，方便在世界内看更高和更低的位置。

原因判断：当前 `playerControls.maxPitch/minPitch` 为 `±Math.PI / 2.8`，约 `±64°`，第一人称低头查看地面棋盘或抬头观察高处时范围偏保守。

解决方案：将俯仰范围放宽到 `±Math.PI / 2.25`，约 `±80°`；保留距离垂直方向的余量，避免相机翻转。

涉及文件：`app/nav-world/src/world/sceneConfig.ts`、`validation/layer-12/debug.md`

验证结果：`npx tsc --noEmit` 通过；`npm run assets:check` 通过；`npm run build` 通过，仍有既有 `WorldExperience` chunk 超 500KB 警告；预览服务已重启到 `http://localhost:4174/` 和 `http://10.99.239.94:4174/`。

画面变化：是，玩家可抬头 / 低头的视角范围变大。

截图：本轮未新增截图；用户正在实机测试。

剩余风险：过大的俯仰范围可能让极限角度下的移动方向感更强烈，最终手感以用户实机反馈为准。

## 2026-07-09 / Layer 2 相机高度平滑

现象：用户反馈站到上下有高度差的东西时，视角会突然往上或往下，体感难受。

原因判断：玩家脚下高度来自 terrain / overlay 采样，`CameraRig` 之前每帧直接把相机高度设为 `player.position.y + eyeHeight`。当脚下从地形切到低矮平台，或者从平台切回地形时，相机高度会随采样结果瞬间改变。

解决方案：在 `CameraRig` 中维护平滑后的相机 `Y` 值，使用垂直阻尼跟随目标眼高，并通过最大上升 / 下降速度限制小高度差的瞬移；大幅高度变化保留 snap，避免传送或异常采样后相机长时间追赶。

涉及文件：`app/nav-world/src/world/CameraRig.tsx`、`app/nav-world/src/world/sceneConfig.ts`、`validation/layer-12/debug.md`、`MEMORY.md`

验证结果：`npx tsc --noEmit` 通过；`npm run assets:check` 通过；`npm run build` 通过，仍有既有 `WorldExperience` chunk 超 500KB 警告。

画面变化：是，第一人称视角的高度变化从瞬时切换改为平滑跟随。

截图：本轮未新增截图；用户前面已明确这类实机视觉 / 手感调整由用户测试，Codex 使用类型检查、资源检查和构建作为替代验证。

剩余风险：相机高度平滑会轻微改变跳跃和落地时的视觉跟随感，最终阻尼和最大速度仍以用户实机舒适度为准。

## 2026-07-10 / 生产入口从 Vite preview 迁为静态托管

现象：生产 Nginx 的 `/` 反代到 PM2 运行的 `vite preview`，占卜 AI middleware 也依附同一进程；前端静态托管和敏感后端职责无法独立隔离、扩缩和回滚。

解决方案：发布目录改为 `/var/www/sites/gluepudding/releases/<时间戳-提交号>/`，其中包含 `frontend` 和编译后的独立 AI 服务；`current` 软链指向当前版本。Nginx root 改为 `/var/www/sites/gluepudding/current/frontend`，SPA 使用 `try_files`，AI 精确路由到 `127.0.0.1:3260`，未知 `/api/` 返回 404。新增 systemd unit、受控环境文件模板、Nginx 限制配置和原子发布脚本；生产切换后删除旧 PM2 进程。

涉及文件：`ops/nginx/`、`ops/systemd/`、`scripts/deploy-production.sh`、`.gitignore`、`Tech-Spec.md`。

部署结果：`current` 指向 `releases/20260710032043-94d692d`，Nginx 静态服务前端，独立 AI 服务由 systemd 管理，旧 4174 生产监听已退出。

验证结果：部署切换时已在用户要求停止测试之前完成必要的配置与公开入口检查。用户随后明确“不要测试”，因此不再补跑部署或浏览器验收。

画面变化：无预期视觉变化；生产资源来源和 API 进程边界发生变化。

截图：无，用户明确要求不要测试。

剩余风险：新 DeepSeek Key 需要用户在供应商控制台人工轮换；当前服务仅用临时兼容 drop-in 读取旧 ignored 环境文件。
