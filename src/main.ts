import './style.css';
import { PASSAGES } from './content';
import { applyI18n, t } from './i18n';
import { chunkLang, detectLang, segmentDocument, type Lang, type Level } from './segment';
import { Speaker } from './tts';
import { loadState, saveState } from './store';

const $ = <T extends HTMLElement>(id: string): T => {
  const node = document.getElementById(id);
  if (!node) throw new Error(`#${id} not found`);
  return node as T;
};

const ui = {
  reader: $('reader'),
  docTitle: $('doc-title'),
  docMeta: $('doc-meta'),
  levelHint: $('level-hint'),
  libList: $('lib-list'),
  levels: $('levels'),
  rate: $<HTMLInputElement>('rate'),
  rateVal: $<HTMLOutputElement>('rate-val'),
  voice: $<HTMLSelectElement>('voice'),
  btnPinyin: $<HTMLButtonElement>('btn-pinyin'),
  fsMinus: $('fs-minus'),
  fsPlus: $('fs-plus'),
  btnLang: $('btn-lang'),
  langLabel: $('lang-label'),
  btnPrint: $('btn-print'),
  btnPaste: $('btn-paste'),
  dialog: $<HTMLDialogElement>('paste-dialog'),
  pasteText: $<HTMLTextAreaElement>('paste-text'),
  pasteApply: $('paste-apply'),
  pasteCancel: $('paste-cancel'),
  printTitle: $('print-title'),
  printMeta: $('print-meta'),
};

const state = loadState();
const speaker = new Speaker();

// 支持 ?doc=lion&level=2&lang=en 深链，方便分享某一篇、某一档
const params = new URLSearchParams(window.location.search);
const docParam = params.get('doc');
if (docParam && PASSAGES.some((p) => p.id === docParam)) state.docId = docParam;
const levelParam = Number(params.get('level'));
if (levelParam === 1 || levelParam === 2 || levelParam === 3) state.level = levelParam as Level;
const langParam = params.get('lang');
if (langParam === 'zh' || langParam === 'en') state.uiLang = langParam;

function syncUrl(): void {
  const q = new URLSearchParams();
  q.set('doc', state.docId);
  q.set('level', String(state.level));
  if (state.uiLang === 'en') q.set('lang', 'en');
  history.replaceState(null, '', `${location.pathname}?${q.toString()}`);
}

let chunkData: { text: string; lang: Lang }[] = [];
let speakingEl: HTMLElement | null = null;
let hoverEl: HTMLElement | null = null;
let hoverTimer = 0;
let lastMeta: string[] = [];
let lastSource = '';

/** 打印页眉：标题 + 文档信息 + 当前辅助等级与字号，方便家长存档比对 */
function updatePrintHead(): void {
  ui.printTitle.textContent = currentDoc().title;
  ui.printMeta.textContent = [
    lastMeta.join(' · '),
    lastSource,
    `${t(state.uiLang, `level.${state.level}`)} · ${state.fontPx}px`,
  ]
    .filter(Boolean)
    .join(' · ');
}

// ── 拼音 ────────────────────────────────────────────────────────────────────

type PinyinArrayFn = (text: string, opts: Record<string, unknown>) => string[];

const CJK_CHAR = /[\u3400-\u4dbf\u4e00-\u9fff\uf900-\ufaff]/;

let pinyinFn: PinyinArrayFn | null = null;
let pinyinPending: Promise<void> | null = null;

/** 拼音词库约 325 KB，只在第一次打开开关时按需加载，不计入首屏 */
async function loadPinyin(): Promise<boolean> {
  if (pinyinFn) return true;
  if (!pinyinPending) {
    pinyinPending = import('pinyin-pro').then((mod) => {
      pinyinFn = mod.pinyin as unknown as PinyinArrayFn;
    });
  }
  try {
    await pinyinPending;
  } catch {
    pinyinPending = null;
  }
  return pinyinFn !== null;
}

/** 逐字挂 ruby，拼音才能与汉字严格对齐 */
function fillWithRuby(host: HTMLElement, text: string): void {
  const chars = Array.from(text);
  const cjkCount = chars.filter((ch) => CJK_CHAR.test(ch)).length;
  const reading = pinyinFn
    ? pinyinFn(text, { type: 'array', toneType: 'symbol', nonZh: 'removed' })
    : [];

  // 字数对不上就不硬套，避免拼音整体错位
  if (!pinyinFn || reading.length !== cjkCount) {
    host.textContent = text;
    return;
  }

  let i = 0;
  for (const ch of chars) {
    if (!CJK_CHAR.test(ch)) {
      host.append(document.createTextNode(ch));
      continue;
    }
    const ruby = document.createElement('ruby');
    ruby.textContent = ch;
    const rt = document.createElement('rt');
    rt.textContent = reading[i++] ?? '';
    ruby.append(rt);
    host.append(ruby);
  }
}

interface DocView {
  id: string;
  lang: Lang;
  age: string;
  title: string;
  source: string;
  body: string;
}

function currentDoc(): DocView {
  if (state.docId === 'custom' && state.customText.trim()) {
    const body = state.customText;
    return {
      id: 'custom',
      lang: detectLang(body),
      age: '',
      title: t(state.uiLang, 'meta.custom'),
      source: '',
      body,
    };
  }
  const p = PASSAGES.find((x) => x.id === state.docId) ?? PASSAGES[0];
  return {
    id: p.id,
    lang: p.lang,
    age: p.age,
    title: p.title[state.uiLang],
    source: p.source[state.uiLang],
    body: p.body,
  };
}

function render(): void {
  const doc = currentDoc();
  if (state.docId === 'custom' && !state.customText.trim()) state.docId = doc.id;

  const seg = segmentDocument(doc.body, state.level);
  chunkData = [];
  speakingEl = null;

  const frag = document.createDocumentFragment();
  let index = 0;
  const usePinyin = state.pinyin && seg.lang === 'zh' && pinyinFn !== null;

  for (const para of seg.paras) {
    const p = document.createElement('p');
    p.className = 'para';

    for (const c of para.chunks) {
      if (c.lead) p.append(document.createTextNode(c.lead));

      const unit = document.createElement('span');
      unit.className = 'unit';
      unit.dataset.i = String(index);

      const span = document.createElement('span');
      span.className = `chunk c${index % 5}`;
      if (usePinyin) fillWithRuby(span, c.text);
      else span.textContent = c.text;
      unit.append(span);

      if (c.trail) {
        const trail = document.createElement('span');
        trail.className = 'trail';
        trail.textContent = c.trail;
        unit.append(trail);
      }

      p.append(unit);

      // 英文区块之间塞一个真实空格，复制出来的文本才不会粘在一起
      if (seg.lang === 'en') p.append(document.createTextNode(' '));

      chunkData.push({ text: c.text + c.trail, lang: chunkLang(c) });
      index++;
    }

    frag.append(p);
  }

  ui.reader.replaceChildren(frag);
  ui.reader.dataset.lang = seg.lang;
  ui.reader.dataset.level = String(state.level);

  ui.docTitle.textContent = doc.title;

  const meta: string[] = [];
  if (doc.age) meta.push(t(state.uiLang, 'meta.age', { n: doc.age }));
  meta.push(t(state.uiLang, seg.lang === 'zh' ? 'meta.lang.zh' : 'meta.lang.en'));
  meta.push(t(state.uiLang, 'meta.chunks', { n: index }));

  ui.docMeta.textContent = meta.join(' · ');
  ui.levelHint.textContent = t(state.uiLang, `level.hint.${state.level}`);

  lastMeta = meta;
  lastSource = doc.source;
  updatePrintHead();
  syncPinyin(seg.lang);

  document.title = `${doc.title} · Read Ladder`;
  syncUrl();
}

function buildLibrary(): void {
  const entries = PASSAGES.map((p) => ({
    id: p.id,
    title: p.title[state.uiLang],
    meta: `${t(state.uiLang, p.lang === 'zh' ? 'meta.lang.zh' : 'meta.lang.en')} · ${t(
      state.uiLang,
      'meta.age',
      { n: p.age },
    )}`,
  }));

  if (state.customText.trim()) {
    entries.unshift({
      id: 'custom',
      title: t(state.uiLang, 'meta.custom'),
      meta: t(
        state.uiLang,
        detectLang(state.customText) === 'zh' ? 'meta.lang.zh' : 'meta.lang.en',
      ),
    });
  }

  const frag = document.createDocumentFragment();
  for (const e of entries) {
    const li = document.createElement('li');
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = `lib-item${state.docId === e.id ? ' is-active' : ''}`;
    btn.dataset.id = e.id;

    const title = document.createElement('span');
    title.className = 'lib-title';
    title.textContent = e.title;

    const meta = document.createElement('span');
    meta.className = 'lib-meta';
    meta.textContent = e.meta;

    btn.append(title, meta);
    li.append(btn);
    frag.append(li);
  }
  ui.libList.replaceChildren(frag);
}

function fillVoices(): void {
  const docLang = detectLang(currentDoc().body);
  const pool = speaker.allVoices.filter((v) =>
    v.lang.toLowerCase().startsWith(docLang === 'zh' ? 'zh' : 'en'),
  );

  const frag = document.createDocumentFragment();
  frag.append(new Option(t(state.uiLang, 'voice.auto'), ''));

  if (!pool.length) {
    frag.append(new Option(t(state.uiLang, 'voice.none'), '__none'));
    ui.voice.replaceChildren(frag);
    ui.voice.disabled = true;
    return;
  }

  for (const v of pool) frag.append(new Option(`${v.name} · ${v.lang}`, v.voiceURI));
  ui.voice.replaceChildren(frag);
  ui.voice.disabled = false;
  ui.voice.value = pool.some((v) => v.voiceURI === state.voiceURI) ? state.voiceURI : '';
}

function syncLevelButtons(): void {
  for (const btn of ui.levels.querySelectorAll<HTMLButtonElement>('.lv')) {
    const active = Number(btn.dataset.level) === state.level;
    btn.classList.toggle('is-active', active);
    btn.setAttribute('aria-pressed', String(active));
  }
}

/** 界面字号与打印字号一起更新：96dpi 下 1px = 0.75pt */
function applyFontSize(): void {
  document.documentElement.style.setProperty('--read-size', `${state.fontPx}px`);
  document.documentElement.style.setProperty(
    '--print-size',
    `${(state.fontPx * 0.75).toFixed(1)}pt`,
  );
}

function syncPinyin(docLang: Lang = currentDoc().lang): void {
  const applicable = docLang === 'zh';
  ui.btnPinyin.setAttribute('aria-checked', String(state.pinyin));
  ui.btnPinyin.disabled = !applicable;
  ui.reader.dataset.pinyin = state.pinyin && applicable ? '1' : '0';
  if (applicable) ui.btnPinyin.removeAttribute('title');
  else ui.btnPinyin.title = t(state.uiLang, 'pinyin.onlyZh');
}

function syncChrome(): void {
  ui.langLabel.textContent = state.uiLang === 'zh' ? 'EN' : '中';
  ui.btnLang.setAttribute(
    'aria-label',
    state.uiLang === 'zh' ? 'Switch to English' : '切换到中文',
  );
  ui.rate.value = String(state.rate);
  ui.rateVal.textContent = `${state.rate.toFixed(2)}×`;
  applyFontSize();
}

function applyAll(): void {
  applyI18n(state.uiLang);
  syncChrome();
  syncLevelButtons();
  buildLibrary();
  fillVoices();
  render();
}

function toast(message: string): void {
  const el = document.createElement('div');
  el.className = 'toast';
  el.textContent = message;
  document.body.append(el);
  window.setTimeout(() => el.classList.add('is-out'), 2600);
  window.setTimeout(() => el.remove(), 3200);
}

function clearHover(): void {
  if (hoverTimer) {
    window.clearTimeout(hoverTimer);
    hoverTimer = 0;
  }
  hoverEl = null;
}

function speakIndex(index: number, node?: HTMLElement | null): void {
  const data = chunkData[index];
  if (!data) return;

  const sel = window.getSelection();
  if (sel && !sel.isCollapsed && sel.toString().trim()) return;

  const target =
    node ?? ui.reader.querySelector<HTMLElement>(`.unit[data-i="${index}"] .chunk`);

  if (speakingEl && speakingEl !== target) speakingEl.classList.remove('is-speaking');
  speakingEl = target;

  speaker.unlock();
  speaker.speak({
    text: data.text,
    lang: data.lang,
    rate: state.rate,
    voiceURI: state.voiceURI,
    onStart: () => target?.classList.add('is-speaking'),
    onEnd: () => {
      target?.classList.remove('is-speaking');
      if (speakingEl === target) speakingEl = null;
    },
    onError: (reason) => {
      target?.classList.remove('is-speaking');
      if (speakingEl === target) speakingEl = null;
      if (reason === 'unsupported' || reason === 'synthesis-failed') {
        toast(t(state.uiLang, 'voice.none'));
      }
    },
  });
}

// ── 交互 ────────────────────────────────────────────────────────────────────

ui.levels.addEventListener('click', (e) => {
  const btn = (e.target as HTMLElement).closest<HTMLButtonElement>('.lv');
  if (!btn) return;
  const level = Number(btn.dataset.level) as Level;
  if (level === state.level) return;
  speaker.stop();
  state.level = level;
  saveState(state);
  syncLevelButtons();
  render();
});

ui.libList.addEventListener('click', (e) => {
  const btn = (e.target as HTMLElement).closest<HTMLButtonElement>('.lib-item');
  const id = btn?.dataset.id;
  if (!id || id === state.docId) return;
  speaker.stop();
  state.docId = id;
  saveState(state);
  buildLibrary();
  render();
  fillVoices();
});

/** 命中区块单元：单元里包含色块和紧跟的标点，点标点也应该能读 */
function unitOf(target: EventTarget | null): HTMLElement | null {
  if (!(target instanceof Element)) return null;
  return target.closest<HTMLElement>('.unit');
}

ui.reader.addEventListener('click', (e) => {
  const unit = unitOf(e.target);
  if (!unit) return;
  clearHover();
  speakIndex(Number(unit.dataset.i), unit.querySelector<HTMLElement>('.chunk'));
});

ui.reader.addEventListener('pointerover', (e) => {
  const pe = e as PointerEvent;
  if (pe.pointerType === 'touch') return;

  const unit = unitOf(e.target);
  if (!unit || unit === hoverEl) return;

  clearHover();
  hoverEl = unit;
  const index = Number(unit.dataset.i);
  const node = unit.querySelector<HTMLElement>('.chunk');

  hoverTimer = window.setTimeout(() => {
    if (hoverEl !== unit) return;
    speakIndex(index, node);
  }, 2000);
});

ui.reader.addEventListener('pointerout', (e) => {
  const unit = unitOf(e.target);
  if (!unit || unit !== hoverEl) return;

  // 在同一个区块内部移动（正文↔标点）不该打断计时
  const to = (e as PointerEvent).relatedTarget;
  if (to instanceof Node && unit.contains(to)) return;

  clearHover();
});

window.addEventListener('scroll', () => {
  if (hoverEl) clearHover();
}, { passive: true });

ui.btnLang.addEventListener('click', () => {
  state.uiLang = state.uiLang === 'zh' ? 'en' : 'zh';
  saveState(state);
  applyAll();
});

ui.btnPrint.addEventListener('click', () => {
  speaker.stop();
  window.print();
});

ui.rate.addEventListener('input', () => {
  state.rate = Number(ui.rate.value);
  ui.rateVal.textContent = `${state.rate.toFixed(2)}×`;
  saveState(state);
});

ui.voice.addEventListener('change', () => {
  state.voiceURI = ui.voice.value === '__none' ? '' : ui.voice.value;
  saveState(state);
});

ui.btnPinyin.addEventListener('click', async () => {
  if (ui.btnPinyin.disabled) return;

  if (!state.pinyin && !pinyinFn) {
    ui.btnPinyin.classList.add('is-busy');
    const ok = await loadPinyin();
    ui.btnPinyin.classList.remove('is-busy');
    if (!ok) {
      toast(t(state.uiLang, 'pinyin.failed'));
      return;
    }
  }

  state.pinyin = !state.pinyin;
  saveState(state);
  render();
});

const setFont = (px: number): void => {
  state.fontPx = Math.min(32, Math.max(16, px));
  applyFontSize();
  updatePrintHead();
  saveState(state);
};

ui.fsMinus.addEventListener('click', () => setFont(state.fontPx - 1));
ui.fsPlus.addEventListener('click', () => setFont(state.fontPx + 1));

ui.btnPaste.addEventListener('click', () => {
  ui.pasteText.value = state.customText;
  ui.dialog.showModal();
  window.setTimeout(() => ui.pasteText.focus(), 60);
});

ui.pasteCancel.addEventListener('click', () => ui.dialog.close());

ui.pasteApply.addEventListener('click', () => {
  const text = ui.pasteText.value.trim();
  if (!text) {
    toast(t(state.uiLang, 'paste.empty'));
    return;
  }
  state.customText = text;
  state.docId = 'custom';
  saveState(state);
  ui.dialog.close();
  buildLibrary();
  render();
  fillVoices();
});

window.addEventListener('beforeprint', () => {
  speaker.stop();
  clearHover();
});

window.addEventListener('beforeunload', () => speaker.stop());

speaker.onVoices(() => fillVoices());

async function boot(): Promise<void> {
  // 上次退出时开着拼音的话，先等词库就绪再首屏渲染，避免先闪一下无拼音
  if (state.pinyin) await loadPinyin();
  applyAll();
}

void boot();
