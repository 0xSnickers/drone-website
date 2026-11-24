# monitor-sdk

监控后台的上报 SDK，**零依赖**，浏览器端约 10 KB（minified）。

| 能力 | 方式 |
|---|---|
| 访问量 PV / UV / 会话 | 自动：首屏 + `pushState` / `replaceState` / `popstate` / `hashchange`；匿名访客 ID 持久化，30 分钟无活动轮换会话 |
| 用户埋点 | `monitor.track(name, props)`；或声明式 `<button data-track="buy_click" data-track-sku="42">` |
| JS 错误 / Promise 拒绝 / 资源加载失败 | 自动（`error` 捕获阶段 + `unhandledrejection`），同一错误 1 秒内去重，单页最多 100 条 |
| 接口异常 | 自动代理 `fetch` / `XMLHttpRequest`：网络错误或状态码 ≥ `httpErrorStatus`（默认 500） |
| 用户操作路径 | 最近 20 条（页面、点击、请求、埋点）随异常一起上报 |
| 页面性能 | TTFB、FCP、DOMContentLoaded、Load |
| 后端日志（Node） | `monitor-sdk/node`：`requestLogger()` 中间件 + `log()` |

发送策略：批量（10 条或 5 秒）、`text/plain` 发送 JSON（跨域无预检）、页面隐藏 / 关闭时 `sendBeacon`；网络错误 / 5xx / 429 重试，其余 4xx（appKey 错误、IP 被禁）丢弃。SDK 自己的上报请求不会被自己采集。

## 浏览器

```ts
import { createMonitor } from 'monitor-sdk';

const monitor = createMonitor({
  endpoint: 'https://monitor.example.com/api/v1', // 同源反向代理时可写 '/api'
  appKey: 'pk_xxx',                                // 后台「项目管理」中复制
  release: '1.4.2',
});

monitor.identify({ id: user.id });                 // 登录后关联用户；退出时 monitor.reset()
monitor.track('add_to_cart', { sku: 42 });
monitor.captureError(error, { orderId });          // 手动上报（catch 住的错误）
```

不用构建工具时：

```html
<!-- 放在 <head> 最前面，才能捕获更早发生的资源加载失败 -->
<script src="/monitor-sdk.global.js"></script>
<script>
  MonitorSDK.createMonitor({ endpoint: 'https://monitor.example.com/api/v1', appKey: 'pk_xxx' });
</script>
```

### 选项

| 选项 | 默认 | 说明 |
|---|---|---|
| `autoPageview` | `true` | 自动采集 PV（已有路由埋点时关闭，避免重复） |
| `captureErrors` | `true` | JS / Promise / 资源错误 |
| `captureHttp` | `true` | fetch / XHR 失败 |
| `httpErrorStatus` | `500` | 视为接口异常的最小状态码（改成 400 可包含 4xx） |
| `capturePerformance` | `true` | 首屏性能 |
| `autoTrackClicks` | `true` | `data-track` 声明式埋点 |
| `sampleRate` | `1` | 行为数据按访客采样（异常不采样） |
| `batchSize` / `flushInterval` | `10` / `5000` | 批量发送 |
| `beforeSend(event)` | — | 修改或丢弃事件（返回 `null`），用于脱敏 |
| `debug` | `false` | 控制台打印 |

### 接入 my-frontend-template 生成的项目

SDK 返回的对象实现了模板 `core/telemetry` 的 `Telemetry` 接口，只改 `src/services/telemetry.ts`：

```ts
export async function initTelemetry() {
  const { createMonitor } = await import('monitor-sdk');
  telemetry.setImplementation(
    createMonitor({ endpoint: env.monitor.endpoint, appKey: env.monitor.appKey, autoPageview: false, captureHttp: false }),
  );
}
```

`autoPageview: false`、`captureHttp: false` 是因为模板的 `RouteTracker` 和 http 客户端 errorReporter 已经在上报 PV 与接口错误。完整示例见 `../web/src/services/telemetry.ts`（含把接口错误归类为「接口」异常）。

## Node 后端日志

```ts
import { createLogShipper } from 'monitor-sdk/node';

const shipper = createLogShipper({ endpoint: 'http://monitor:9000/api/v1', appKey: 'pk_xxx', service: 'order-api' });
app.use(shipper.requestLogger());                       // Express / NestJS（platform-express）
shipper.log({ level: 'error', message: 'payment timeout', meta: { orderId } });
process.on('SIGTERM', () => void shipper.close());      // 退出前发送剩余日志
```

其他语言直接调用 `POST /api/v1/ingest/logs`（见 `../server/docs/API_CONTRACT.md` 第 11 节）。

## 开发

```bash
npm install
npm run check     # lint + typecheck + test（vitest + jsdom）+ build
npm run build     # dist/：ESM、CJS、IIFE（monitor-sdk.global.js）、类型声明
```

发布：`npm publish` 到私有 registry，或在其他项目中 `npm i <path>/sdk`（需先 `npm run build`）。`../web` 通过别名直接引用源码，不需要构建。
