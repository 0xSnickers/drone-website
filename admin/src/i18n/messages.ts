import type { AppLocale } from '@/core/i18n/locales';
import { baseMessages, mergeMessages } from '@/core/i18n/messages';
import { monitorEnUS } from './extra/en-US';
import { monitorZhCN } from './extra/zh-CN';

/**
 * 本项目的语言包 = core 基础语言包 + 监控后台文案（./extra，按模块分组）。
 * en-US 的类型来自 zh-CN，两种语言的 key 在编译期保持一致。
 */
const extra = {
  'zh-CN': monitorZhCN,
  'en-US': monitorEnUS,
} satisfies Record<AppLocale, object>;

export const messages = {
  'zh-CN': mergeMessages(baseMessages['zh-CN'], extra['zh-CN']),
  'en-US': mergeMessages(baseMessages['en-US'], extra['en-US']),
};

export type AppMessages = (typeof messages)['zh-CN'];
