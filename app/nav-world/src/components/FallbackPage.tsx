import { staticAssetUrl } from "../assets/staticAssetUrl";

export type FallbackReason = "starting" | "webgl-unavailable" | "error";

interface FallbackPageProps {
  reason: FallbackReason;
}

const statusCopy: Record<FallbackReason, string> = {
  starting: "3D 世界仍在准备，当前先展示二维入口。",
  "webgl-unavailable": "当前浏览器无法启动 WebGL，已切换到二维入口。",
  error: "3D 世界本次未能完成初始化，已切换到二维入口。",
};

const worldPreviewUrl = staticAssetUrl("./images/world-overview.webp");

const fallbackRoutes = [
  {
    description: "塔罗、星座与周易的世界区域；二维模式下可先返回总站。",
    href: "https://home.gluepudding.com",
    index: "01",
    label: "总站独立入口",
    title: "占卜屋",
  },
  {
    description: "WebRTC 画面与设备能力；二维模式下使用 IoT 独立入口。",
    href: "https://iot.gluepudding.com",
    index: "02",
    label: "IoT 独立入口",
    title: "天空实验室",
  },
  {
    description: "世界内的原生棋局；二维模式下直接进入独立五子棋页面。",
    href: "https://game.gluepudding.com/wuziqi/",
    index: "03",
    label: "五子棋独立入口",
    title: "五子棋",
  },
] as const;

export function FallbackPage({ reason }: FallbackPageProps) {
  return (
    <div className="fallback-page">
      <header className="site-header">
        <a className="brand" href="#top" aria-label="回到二维入口顶部">
          <span className="brand-mark" aria-hidden="true">
            GP
          </span>
          <span>gluepudding</span>
        </a>

        <nav className="site-nav" aria-label="主导航">
          <a href="./">重试 3D</a>
          <a href="#regions">区域入口</a>
        </nav>
      </header>

      <main id="top">
        <section className="fallback-hero section-shell">
          <div className="fallback-hero-copy">
            <p className="eyebrow">GLUEPUDDING / 2D 入口</p>
            <h1>世界暂时以二维方式展开</h1>
            <p className="hero-intro">
              浮岛上的占卜屋、天空实验室和五子棋仍是同一个世界。
              当前设备无法保持 3D 体验时，可以从这里重新尝试，或进入对应的独立服务。
            </p>
            <p className="fallback-status" role="status">
              {statusCopy[reason]}
            </p>

            <div className="hero-actions">
              <a className="button primary" href="./">
                重新尝试 3D 世界
              </a>
              <a className="button secondary" href="#regions">
                查看区域入口
              </a>
            </div>
          </div>

          <figure className="world-preview">
            <img
              alt="gluepudding 浮岛世界的出生点，占卜屋与天空实验室位于前方"
              src={worldPreviewUrl}
            />
            <figcaption>
              <span>浮岛出生点</span>
              <span>占卜屋 · 天空实验室 · 五子棋</span>
            </figcaption>
          </figure>
        </section>

        <section className="fallback-regions" id="regions">
          <div className="section-shell">
            <div className="section-heading">
              <p className="eyebrow">区域入口</p>
              <h2>从同一个世界，进入三种体验</h2>
              <p>独立入口只在 3D 不可用时使用；服务能力与项目边界保持不变。</p>
            </div>

            <div className="route-list" aria-label="独立降级入口列表">
              {fallbackRoutes.map((route) => (
                <a className="route-row" href={route.href} key={route.index}>
                  <span className="route-index">{route.index}</span>
                  <span className="route-copy">
                    <strong>{route.title}</strong>
                    <small>{route.description}</small>
                  </span>
                  <span className="route-label">{route.label}</span>
                  <span className="route-arrow" aria-hidden="true">
                    ↗
                  </span>
                </a>
              ))}
            </div>
          </div>
        </section>

        <section className="fallback-context section-shell" id="fallback">
          <p className="eyebrow">关于二维模式</p>
          <div>
            <h2>不让一次渲染失败中断访问</h2>
            <p>
              二维入口不加载 WebRTC、3D 模型或设备控制信息，只提供安全、可读的服务导航。
              更换支持 WebGL 的浏览器或设备后，可以随时重新进入完整世界。
            </p>
          </div>
        </section>
      </main>

      <footer className="site-footer">
        <p>© 2026 gluepudding</p>
        <div className="filing-links" aria-label="备案信息">
          <a href="https://beian.miit.gov.cn/" target="_blank" rel="noreferrer">
            沪ICP备2026022375号-1
          </a>
          <a href="https://beian.mps.gov.cn/#/query/webSearch" target="_blank" rel="noreferrer">
            沪公网安备31011202022649号
          </a>
        </div>
      </footer>
    </div>
  );
}
