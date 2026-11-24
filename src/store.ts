import type { UiLang } from './i18n';
import type { Level } from './segment';

const KEY = 'read-ladder:v1';

export interface State {
  uiLang: UiLang;
  level: Level;
  rate: number;
  fontPx: number;
  voiceURI: string;
  docId: string;
  customText: string;
  /** 汉字上方显示拼音，默认关闭 */
  pinyin: boolean;
}

export const DEFAULTS: State = {
  uiLang: 'zh',
  level: 2,
  rate: 0.9,
  fontPx: 20,
  voiceURI: '',
  docId: 'kitten',
  customText: '',
  pinyin: false,
};

export function loadState(): State {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) {
      // 首次访问跟随浏览器语言，之后一律以用户选择为准
      const nav = typeof navigator !== 'undefined' ? navigator.language : 'zh';
      return { ...DEFAULTS, uiLang: nav.toLowerCase().startsWith('zh') ? 'zh' : 'en' };
    }
    const parsed = JSON.parse(raw) as Partial<State>;
    return { ...DEFAULTS, ...parsed };
  } catch {
    return { ...DEFAULTS };
  }
}

export function saveState(state: State): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(state));
  } catch {
    /* 隐私模式下写入会失败，忽略即可 */
  }
}
