type MessageHandler = (msg: any) => void;
type OpenHandler = () => void;

const WS_URL = process.env.BUN_PUBLIC_APP_WS_AUDIO_URL || "ws://localhost:3001";

class SocketManager {
  private static instance: SocketManager;
  private ws: WebSocket | null = null;
  private reconnectTimeout: NodeJS.Timeout | null = null;
  private pingInterval: NodeJS.Timeout | null = null;
  private reconnectDelay = 1000;

  private onMessageRef: { current: MessageHandler | null } = { current: null };
  private onOpenRef: { current: OpenHandler | null } = { current: null };
  private debug = false;

  private constructor() {}

  public static getInstance() {
    if (!SocketManager.instance) {
      SocketManager.instance = new SocketManager();
    }
    return SocketManager.instance;
  }

  public configure({
    onMessage,
    onOpen,
    debug = false,
  }: {
    onMessage: MessageHandler;
    onOpen: OpenHandler;
    debug?: boolean;
  }) {
    this.onMessageRef.current = onMessage;
    this.onOpenRef.current = onOpen;
    this.debug = debug;
  }

  public connect() {
    if (!WS_URL) throw new Error("WS URL not found");

    this.cleanup();

    if (this.debug) console.log("🔌 Connecting to WebSocket...");

    const ws = new WebSocket(WS_URL);
    this.ws = ws;

    ws.onopen = () => {
      if (this.debug) console.log("✅ WebSocket connected");
      this.onOpenRef.current?.();
      this.reconnectDelay = 1000;

      this.pingInterval = setInterval(() => {
        this.safeSend({ type: "ping" });
      }, 10_000);
    };

    ws.onmessage = ({ data }) => {
      try {
        const msg = JSON.parse(data);
        this.onMessageRef.current?.(msg);
      } catch (err) {
        if (this.debug) console.error("📛 Invalid WS message", err);
      }
    };

    ws.onerror = () => {
      if (this.debug) console.error("🚨 WebSocket error, closing...");
      ws.close();
    };

    ws.onclose = () => {
      if (this.debug)
        console.warn(
          `❌ WebSocket closed. Reconnecting in ${this.reconnectDelay / 1000}s`
        );
      this.reconnectTimeout = setTimeout(() => {
        this.reconnectDelay = Math.min(this.reconnectDelay * 2, 30_000);
        this.connect();
      }, this.reconnectDelay);
    };
  }

  public cleanup() {
    if (this.debug) console.log("🧹 Cleaning up WebSocket...");

    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }

    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
      this.reconnectTimeout = null;
    }

    if (this.pingInterval) {
      clearInterval(this.pingInterval);
      this.pingInterval = null;
    }
  }

  public safeSend(msg: any) {
    const json = JSON.stringify(msg);
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(json);
      if (this.debug) console.log("📤 Sent:", json);
    } else {
      if (this.debug) console.warn("⚠️ Cannot send message: socket not open");
    }
  }

  public get socket() {
    return this.ws;
  }
}

export default SocketManager;
