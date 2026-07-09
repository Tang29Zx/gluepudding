# Layer 7 调试记录

本文件只记录 Layer 7：世界内五子棋模拟层 的问题、原因判断、解决方案和验证结果。不要记录 secret、token、私钥、密码或内部敏感地址。

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

## 2026-07-09 / PR #3 game 合入后审计

日期：2026-07-09

版本 / Layer：Layer 7 世界内游戏入口，PR #3 `game -> main`

现象：`game` PR 已被自动合并到 `main`，尚未经过本地审计。检查发现 `app/nav-world/public/game/shadow-game.html` 通过 `unpkg.com` 加载 Three.js 和 addons，游戏入口依赖外部 CDN，且远端脚本会在同源 iframe 中执行。

原因判断：`shadow-game.html` 是放在 `public/` 下的独立静态游戏页，没有经过主 Vite 应用打包，因此原实现用 importmap 从 CDN 取 `three`、`OrbitControls` 和 `GLTFLoader`。这会让离线 / 国内网络环境下游戏不可用，也扩大了外部脚本信任范围。

解决方案：从项目锁定依赖 `node_modules/three` 复制 `three.module.js`、`OrbitControls.js`、`GLTFLoader.js` 及其必要 utils 到 `app/nav-world/public/vendor/three/`，并保留 Three.js MIT license；将游戏页 importmap 改为加载本项目静态 vendor 路径。

涉及文件：`app/nav-world/public/game/shadow-game.html`、`app/nav-world/public/vendor/three/`、`validation/layer-7/debug.md`、`MEMORY.md`。

验证结果：`npm run build` 和 `npm run assets:check` 通过；`game` 合入后的主线未发现类型检查或构建阻断问题。

画面变化：否。游戏入口加载来源改变，但 UI 和玩法不变。

截图：本轮未新增截图；这是合入后安全和可用性审计修复，使用构建和静态检查替代。

剩余风险：未做自动化游戏 iframe 玩法通关测试；`shadow-game.html` 仍是独立静态页，后续如继续扩展，建议逐步迁入 Vite 模块或补专门 e2e。
