/** 界面文案。内容正文不翻译，只翻译界面骨架。 */

export type UiLang = 'zh' | 'en';

type Dict = Record<string, string>;

const zh: Dict = {
  'app.title': '阅读阶梯',
  'app.tagline': '把一段话切成小台阶，一步一步读下去',
  'a11y.skip': '跳到正文',

  'tool.level': '辅助等级',
  'tool.rate': '语速',
  'tool.voice': '语音',
  'tool.font': '字号',
  'level.1': '长句块',
  'level.2': '短语',
  'level.3': '词',
  'level.hint.1': '每个色块是一句或半句，先练断句。',
  'level.hint.2': '每个色块是一小组词，读起来更轻。',
  'level.hint.3': '每个色块是一个词，适合刚起步的读者。',

  'library.title': '内容库',
  'action.paste': '粘贴文本',
  'action.export': '导出 PDF',
  'action.cancel': '取消',
  'action.apply': '开始阅读',

  'voice.auto': '自动选择',
  'voice.none': '系统未安装语音',
  'hint.block': '点一下色块就会朗读；电脑上把鼠标停在色块上两秒也会朗读。',

  'paste.title': '粘贴一段文字',
  'paste.desc': '中文或英文都可以，建议整段粘贴，标点会帮你带出停顿。',
  'paste.placeholder': '把要读的文字粘贴到这里…',
  'paste.empty': '请先粘贴一些文字。',

  'footer.note': '预置内容均为公版或原创，可自由用于教学。',

  'meta.age': '{n} 岁',
  'meta.lang.zh': '中文',
  'meta.lang.en': '英文',
  'meta.chunks': '{n} 个色块',
  'meta.custom': '我的文本',

  'print.title': '阅读阶梯 · Read Ladder',
};

const en: Dict = {
  'app.title': 'Read Ladder',
  'app.tagline': 'Break a passage into small steps and read one at a time',
  'a11y.skip': 'Skip to text',

  'tool.level': 'Support level',
  'tool.rate': 'Speed',
  'tool.voice': 'Voice',
  'tool.font': 'Text size',
  'level.1': 'Clause',
  'level.2': 'Phrase',
  'level.3': 'Word',
  'level.hint.1': 'Each block is a sentence or a clause — practise where to pause.',
  'level.hint.2': 'Each block is a small group of words — lighter to hold in mind.',
  'level.hint.3': 'Each block is a single word — for readers just starting out.',

  'library.title': 'Library',
  'action.paste': 'Paste text',
  'action.export': 'Export PDF',
  'action.cancel': 'Cancel',
  'action.apply': 'Start reading',

  'voice.auto': 'Automatic',
  'voice.none': 'No system voices found',
  'hint.block': 'Tap a block to hear it. On a computer, hover over it for two seconds.',

  'paste.title': 'Paste a passage',
  'paste.desc': 'Chinese or English. Paste a whole paragraph — punctuation carries the pauses.',
  'paste.placeholder': 'Paste the text you want to read…',
  'paste.empty': 'Please paste some text first.',

  'footer.note': 'All built-in passages are public domain or original, free for classroom use.',

  'meta.age': 'ages {n}',
  'meta.lang.zh': 'Chinese',
  'meta.lang.en': 'English',
  'meta.chunks': '{n} blocks',
  'meta.custom': 'My text',

  'print.title': 'Read Ladder',
};

const DICTS: Record<UiLang, Dict> = { zh, en };

export function t(lang: UiLang, key: string, vars?: Record<string, string | number>): string {
  let s = DICTS[lang][key] ?? DICTS.zh[key] ?? key;
  if (vars) {
    for (const [k, v] of Object.entries(vars)) {
      s = s.replaceAll(`{${k}}`, String(v));
    }
  }
  return s;
}

/** 把页面里所有 data-i18n / data-i18n-placeholder 节点刷成当前语言 */
export function applyI18n(lang: UiLang): void {
  document.documentElement.lang = lang === 'zh' ? 'zh-CN' : 'en';

  for (const el of document.querySelectorAll<HTMLElement>('[data-i18n]')) {
    const key = el.dataset.i18n;
    if (key) el.textContent = t(lang, key);
  }
  for (const el of document.querySelectorAll<HTMLElement>('[data-i18n-placeholder]')) {
    const key = el.dataset.i18nPlaceholder;
    if (key) el.setAttribute('placeholder', t(lang, key));
  }
  for (const el of document.querySelectorAll<HTMLElement>('[data-i18n-label]')) {
    const key = el.dataset.i18nLabel;
    if (key) el.setAttribute('aria-label', t(lang, key));
  }
}
