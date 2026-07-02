/**
 * Minimal Redis (Tair) client for Cloudflare Workers.
 * Uses cloudflare:sockets connect() via dynamic import (only available at runtime).
 *
 * Key format: {site}:article:{type}:{slug}
 */

const TAIR_HOST = "r-0xibcglmce6bxri39ppd.redis.rds-aliyun-america.rds.aliyuncs.com";
const TAIR_PORT = 6379;
const TAIR_PASSWORD = "P%7ySpwF+G_S)13+#VR9FkifaI";

const encoder = new TextEncoder();
const decoder = new TextDecoder();

// Dynamic import — cloudflare:sockets only exists in CF Workers runtime,
// not during Next.js build. Lazy-load on first use.
let _connect: any = null;
async function getConnect(): Promise<any> {
  if (!_connect) {
    try {
      // Use variable to prevent TypeScript from resolving at build time
      const moduleName = "cloudflare:sockets";
      const mod: any = await import(moduleName);
      _connect = mod.connect;
    } catch {
      return null;
    }
  }
  return _connect;
}

class TairClient {
  private socket: any;
  private reader: ReadableStreamDefaultReader<Uint8Array> | null = null;
  private writer: WritableStreamDefaultWriter<Uint8Array> | null = null;
  private buffer = "";

  async open() {
    const connect = await getConnect();
    if (!connect) throw new Error("cloudflare:sockets not available");
    this.socket = connect(`${TAIR_HOST}:${TAIR_PORT}`);
    this.writer = this.socket.writable.getWriter();
    this.reader = this.socket.readable.getReader();
    await this.send("AUTH", TAIR_PASSWORD);
  }

  private async writeRaw(data: string) {
    if (!this.writer) throw new Error("Not connected");
    await this.writer.write(encoder.encode(data));
  }

  private async readLine(): Promise<string> {
    while (!this.buffer.includes("\r\n")) {
      if (!this.reader) throw new Error("Not connected");
      const { value, done } = await this.reader.read();
      if (done) throw new Error("Connection closed");
      this.buffer += decoder.decode(value, { stream: true });
    }
    const idx = this.buffer.indexOf("\r\n");
    const line = this.buffer.substring(0, idx);
    this.buffer = this.buffer.substring(idx + 2);
    return line;
  }

  private async readBytes(n: number): Promise<string> {
    while (this.buffer.length < n + 2) {
      if (!this.reader) throw new Error("Not connected");
      const { value, done } = await this.reader.read();
      if (done) throw new Error("Connection closed");
      this.buffer += decoder.decode(value, { stream: true });
    }
    const data = this.buffer.substring(0, n);
    this.buffer = this.buffer.substring(n + 2);
    return data;
  }

  async send(...args: string[]): Promise<string | null> {
    let cmd = `*${args.length}\r\n`;
    for (const arg of args) {
      const byteLen = encoder.encode(arg).byteLength;
      cmd += `$${byteLen}\r\n${arg}\r\n`;
    }
    await this.writeRaw(cmd);

    const line = await this.readLine();
    const prefix = line[0];
    const payload = line.substring(1);

    switch (prefix) {
      case "+":
        return payload;
      case "-":
        throw new Error(`Redis error: ${payload}`);
      case ":":
        return payload;
      case "$": {
        const len = parseInt(payload, 10);
        if (len === -1) return null;
        return await this.readBytes(len);
      }
      default:
        throw new Error(`Unknown RESP prefix: ${prefix}`);
    }
  }

  close() {
    try { this.reader?.releaseLock(); } catch {}
    try { this.writer?.releaseLock(); } catch {}
    try { this.socket?.close(); } catch {}
  }
}

export async function tairGet(key: string): Promise<any> {
  const client = new TairClient();
  try {
    await client.open();
    const raw = await client.send("GET", key);
    client.close();
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    try { client.close(); } catch {}
    return null;
  }
}

export async function tairSet(key: string, value: any): Promise<void> {
  const client = new TairClient();
  try {
    await client.open();
    await client.send("SET", key, JSON.stringify(value));
    client.close();
  } catch {
    try { client.close(); } catch {}
  }
}
