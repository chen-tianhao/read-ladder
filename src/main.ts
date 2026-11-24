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

  for (const para of seg.paras) {
    const p = document.createElement('p');
    p.className = 'para';

    for (const c of para.chunks) {
      if (c.lead) p.append(document.createTextNode(c.lead));

      const span = document.createElement('span');
      span.className = `chunk c${index % 5}`;
      span.dataset.i = String(index);
      span.textContent = c.text;
      p.append(span);

      if (c.trail) {
        const trail = document.createElement('span');
        trail.className = 'trail';
        trail.textContent = c.trail;
        p.append(trail);
      }

      // 英文区块之间塞一个真实空格，复制出来的文本才不会粘在一起
      if (seg.lang === 'en') p.append(document.createTextNode(' '));

      chunkData.push({ text: c.text + c.trail, lang: chunkLang(c) });
      index++;
    }

    frag.append(p);
  }

  ui.reader.replaceChildren(frag);
  ui.reader.dataset.lang = seg.lang;

  ui.docTitle.textContent = doc.title;

  const meta: string[] = [];
  if (doc.age) meta.push(t(state.uiLang, 'meta.age', { n: doc.age }));
  meta.push(t(state.uiLang, seg.lang === 'zh' ? 'meta.lang.zh' : 'meta.lang.en'));
  meta.push(t(state.uiLang, 'meta.chunks', { n: index }));

  ui.docMeta.textContent = meta.join(' · ');
  ui.levelHint.textContent = t(state.uiLang, `level.hint.${state.level}`);

  ui.printTitle.textContent = doc.title;
  ui.printMeta.textContent = [meta.join(' · '), doc.source].filter(Boolean).join(' · ');

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

function syncChrome(): void {
  ui.langLabel.textContent = state.uiLang === 'zh' ? 'EN' : '中';
  ui.btnLang.setAttribute(
    'aria-label',
    state.uiLang === 'zh' ? 'Switch to English' : '切换到中文',
  );
  ui.rate.value = String(state.rate);
  ui.rateVal.textContent = `${state.rate.toFixed(2)}×`;
  document.documentElement.style.setProperty('--read-size', `${state.fontPx}px`);
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

  const target = node ?? ui.reader.querySelector<HTMLElement>(`.chunk[data-i="${index}"]`);

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

ui.reader.addEventListener('click', (e) => {
  const target = (e.target as HTMLElement).closest<HTMLElement>('.chunk');
  if (!target) return;
  clearHover();
  speakIndex(Number(target.dataset.i), target);
});

ui.reader.addEventListener('pointerover', (e) => {
  const pe = e as PointerEvent;
  if (pe.pointerType === 'touch') return;

  const target = (e.target as HTMLElement).closest<HTMLElement>('.chunk');
  if (!target || target === hoverEl) return;

  clearHover();
  hoverEl = target;
  const index = Number(target.dataset.i);

  hoverTimer = window.setTimeout(() => {
    if (hoverEl !== target) return;
    speakIndex(index, target);
  }, 2000);
});

ui.reader.addEventListener('pointerout', (e) => {
  const target = (e.target as HTMLElement).closest<HTMLElement>('.chunk');
  if (target && target === hoverEl) clearHover();
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

const setFont = (px: number): void => {
  state.fontPx = Math.min(32, Math.max(16, px));
  document.documentElement.style.setProperty('--read-size', `${state.fontPx}px`);
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

applyAll();
