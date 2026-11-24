import { defineConfig } from 'tsup';

export default defineConfig([
  {
    entry: { index: 'src/index.ts', node: 'src/node.ts' },
    format: ['esm', 'cjs'],
    dts: true,
    clean: true,
    target: 'es2020',
  },
  {
    // <script src="monitor-sdk.global.js"> 直接引入：window.MonitorSDK.createMonitor(...)
    entry: { 'monitor-sdk': 'src/index.ts' },
    format: ['iife'],
    globalName: 'MonitorSDK',
    minify: true,
    target: 'es2017',
  },
]);
