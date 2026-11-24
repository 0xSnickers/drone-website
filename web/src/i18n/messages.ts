import type { AppLocale } from '@/core/i18n/locales';
import { baseMessages, mergeMessages } from '@/core/i18n/messages';
import { enExtra } from './locales/en-US';
import { zhExtra } from './locales/zh-CN';

/**
 * 本项目的语言包 = core 基础语言包 + 业务扩展语言包（locales/zh-CN, locales/en-US）。
 * 两种语言的 key 由 ExtraMessages 类型静态约束一致。
 */
const extra = {
  'zh-CN': zhExtra,
  'en-US': enExtra,
} satisfies Record<AppLocale, object>;

export const messages = {
  'zh-CN': mergeMessages(baseMessages['zh-CN'], extra['zh-CN']),
  'en-US': mergeMessages(baseMessages['en-US'], extra['en-US']),
};

export type AppMessages = (typeof messages)['zh-CN'];
