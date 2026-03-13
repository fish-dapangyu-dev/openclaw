// @ts-ignore - noVNC types are not available
import RFB from "@novnc/novnc";
// ui/src/ui/components/claw-computer-panel.ts
import { LitElement, html, css } from "lit";
import { customElement, state, property } from "lit/decorators.js";
import { createRef, ref, Ref } from "lit/directives/ref.js";
// @ts-ignore - noVNC types are not available

// Compatible with both .default and non-.default versions
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const RFBClass = (RFB as any).default || RFB;

// RFB instance type definition
interface RFBInstance {
  disconnect(): void;
  addEventListener(event: string, callback: (e?: unknown) => void): void;
  scaleViewport: boolean;
  clipViewport: boolean;
  resizeSession: boolean;
  resize?(): void;
}

@customElement("claw-computer-panel")
export class ClawComputerPanel extends LitElement {
  @property() vncUrl = "ws://localhost:8081";
  @property() password = "";

  @state() status = "等待連接...";
  @state() isConnected = false;
  @state() isFitted = true;

  private rfb: RFBInstance | null = null;
  private screenRef: Ref<HTMLDivElement> = createRef<HTMLDivElement>();
  private autoConnectAttempted = false;

  static styles = css`
    :host {
      display: block;
      height: 100%;
      background: var(--bg-accent);
      color: var(--text);
      font-family: system-ui, sans-serif;
    }
    .container {
      height: 100%;
      display: flex;
      flex-direction: column;
      position: relative;
    }
    .screen-container {
      flex: 1;
      width: 100%;
      height: 100%;
      background: var(--bg-accent);
      overflow: hidden;
      position: relative;
      display: flex;
      align-items: center;
      justify-content: center;
    }
    .screen {
      /* Remove fixed width/height to allow shrink-wrapping */
      width: auto;
      height: auto;
      /* Maximize but preserve aspect ratio via flex item behavior */
      max-width: 100%;
      max-height: 100%;
      display: flex;
      align-items: center;
      justify-content: center;
    }
    .screen > div {
      /* Fix for noVNC wrapper div */
      display: flex !important;
      align-items: center !important;
      justify-content: center !important;
      width: 100% !important;
      height: 100% !important;
      background: transparent !important;
    }
    .screen canvas {
      /* Force canvas to maintain aspect ratio within container */
      max-width: 100% !important;
      max-height: 100% !important;
      width: auto !important;
      height: auto !important;
      /* Remove default canvas outline/border */
      outline: none;
      display: block; /* Remove inline gap */
      margin: auto !important;
    }
    .status-overlay {
      position: absolute;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      background: var(--card);
      padding: 16px 24px;
      border-radius: 8px;
      color: var(--text);
      font-weight: 500;
      pointer-events: none;
      z-index: 10;
      border: 1px solid var(--border);
      box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
    }
  `;

  render() {
    return html`
      <div class="container">
        ${!this.isConnected ? html`<div class="status-overlay">${this.status}</div>` : null}
        <div class="screen-container">
          <div ${ref(this.screenRef)} class="screen"></div>
        </div>
      </div>
    `;
  }

  private connect = async () => {
    const url = this.vncUrl || "ws://localhost:8081";
    if (this.rfb) {
      this.rfb.disconnect();
    }

    this.status = "正在連接...";
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    let screen = this.screenRef.value;

    if (!screen) {
      // Fallback: try to find the element via shadowRoot if ref failed
      screen = this.shadowRoot?.querySelector(".screen") as HTMLDivElement;
    }

    if (!screen) {
      console.error("Screen element not found");
      this.status = "初始化失败：找不到屏幕元素";
      return;
    }

    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const Constructor = RFBClass as new (
        target: HTMLElement,
        url: string,
        options?: unknown,
      ) => RFBInstance;

      this.rfb = new Constructor(screen, url, {
        credentials: { password: this.password || undefined },
        resizeSession: true,
        clipViewport: true,
      });

      if (this.rfb) {
        this.rfb.scaleViewport = this.isFitted;
      }

      this.rfb?.addEventListener("connect", () => {
        this.isConnected = true;
        this.status = "已連線成功 ✓（改變視窗大小會自動適配）";
        setTimeout(() => this.rfb?.resize?.(), 100);
      });

      this.rfb?.addEventListener("disconnect", () => {
        this.isConnected = false;
        this.status = "連線中斷";
        this.rfb = null;
      });
    } catch (error) {
      console.error("Failed to create RFB instance:", error);
      this.status = `连接失败: ${error as string}`;
    }
  };

  private disconnect = () => {
    if (this.rfb) {
      this.rfb.disconnect();
    }
  };

  private setFitMode(fitted: boolean) {
    this.isFitted = fitted;
    if (this.rfb) {
      this.rfb.scaleViewport = fitted;
      this.rfb.clipViewport = true;
      setTimeout(() => this.rfb?.resize?.(), 50);
    }
  }

  private handleResize = () => {
    if (this.rfb && this.isConnected) {
      setTimeout(() => this.rfb?.resize?.(), 80);
    }
  };

  private toggleFullscreen = () => {
    const container = this.shadowRoot?.querySelector(".screen-container");
    if (container) {
      void (container as HTMLElement).requestFullscreen?.();
    }
  };

  private handlePasswordKeydown = (e: KeyboardEvent) => {
    if (e.key === "Enter") {
      void this.connect();
    }
  };

  firstUpdated() {
    window.addEventListener("resize", this.handleResize);

    // Auto-connect if URL is configured
    if (this.vncUrl) {
      // Use setTimeout to ensure DOM is fully ready and to allow UI to render first
      setTimeout(() => {
        void this.connect();
      }, 100);
    }
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    window.removeEventListener("resize", this.handleResize);
    this.disconnect();
  }
}
