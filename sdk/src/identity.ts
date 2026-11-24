const VISITOR_KEY = '__monitor_vid';
const SESSION_KEY = '__monitor_sid';
const USER_KEY = '__monitor_uid';
/** 30 分钟无活动视为新会话（与常见统计工具一致）。 */
export const SESSION_TIMEOUT_MS = 30 * 60 * 1000;

const memory = new Map<string, string>();

/** localStorage 不可用（隐私模式、iframe 限制）时退化为内存。 */
const storage = {
  get(key: string) {
    try {
      return window.localStorage.getItem(key) ?? memory.get(key) ?? null;
    } catch {
      return memory.get(key) ?? null;
    }
  },
  set(key: string, value: string) {
    memory.set(key, value);
    try {
      window.localStorage.setItem(key, value);
    } catch {
      // 忽略
    }
  },
  remove(key: string) {
    memory.delete(key);
    try {
      window.localStorage.removeItem(key);
    } catch {
      // 忽略
    }
  },
};

export function uuid(): string {
  const c = globalThis.crypto;
  if (c && typeof c.randomUUID === 'function') return c.randomUUID();
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (ch) => {
    const r = (Math.random() * 16) | 0;
    return (ch === 'x' ? r : (r & 0x3) | 0x8).toString(16);
  });
}

/** 匿名访客 ID：首次访问生成并持久化，用于 UV 统计。 */
export function getVisitorId() {
  let id = storage.get(VISITOR_KEY);
  if (!id) {
    id = uuid();
    storage.set(VISITOR_KEY, id);
  }
  return id;
}

/** 会话 ID：跨标签页共享，超过 30 分钟无活动后轮换。每次调用都会刷新活动时间。 */
export function getSessionId(now = Date.now()) {
  const raw = storage.get(SESSION_KEY);
  let session: { id: string; last: number } | null = null;
  try {
    session = raw ? (JSON.parse(raw) as { id: string; last: number }) : null;
  } catch {
    session = null;
  }
  if (!session || now - session.last > SESSION_TIMEOUT_MS) session = { id: uuid(), last: now };
  session.last = now;
  storage.set(SESSION_KEY, JSON.stringify(session));
  return session.id;
}

export const userStore = {
  get: () => storage.get(USER_KEY) ?? undefined,
  set: (id: string) => storage.set(USER_KEY, id),
  clear: () => storage.remove(USER_KEY),
};

/** 按访客做确定性采样：同一个访客要么全部上报、要么全部不报，保证 UV / 会话数据完整。 */
export function inSample(visitorId: string, rate: number) {
  if (rate >= 1) return true;
  if (rate <= 0) return false;
  let hash = 0;
  for (let i = 0; i < visitorId.length; i++) hash = (hash * 31 + visitorId.charCodeAt(i)) >>> 0;
  return hash % 10_000 < rate * 10_000;
}
