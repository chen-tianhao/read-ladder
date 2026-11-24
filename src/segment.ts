/**
 * 切块引擎
 * ---------------------------------------------------------------------------
 * 输入一段文字，输出「段落 → 区块」结构。三档辅助本质上只是同一份词序列的
 * 三种聚合粒度，因此分词只做一次，聚合规则独立可调。
 *
 * L1 长句块：中文 6–12 字 / 英文 4–6 词，遇逗号、句号断开
 * L2 短语：  中文 2–4 字（只合并单字词）/ 英文 2–3 词
 * L3 词：    一行一个词
 *
 * 分词使用浏览器内置 Intl.Segmenter（ICU 词典），零依赖、零下载。
 */

export type Lang = 'zh' | 'en';
export type Level = 1 | 2 | 3;

export interface Chunk {
  /** 区块前的不着色字符，例如左引号 */
  lead: string;
  /** 区块正文，包含区块内部的标点 */
  text: string;
  /** 区块后的标点，不着色 */
  trail: string;
  /** 折合长度：中文按字数，英文按词数 */
  size: number;
}

export interface Para {
  chunks: Chunk[];
}

export interface Segmented {
  lang: Lang;
  paras: Para[];
}

interface Unit {
  lead: string;
  text: string;
  trail: string;
  /** 句末标点，必然断开 */
  stop: boolean;
  /** 句中标点（逗号类），L1 在此断开 */
  clause: boolean;
}

const STOP_PUNCT = /[。！？!?；;.…]/;
const CLAUSE_PUNCT = /[，,、：:—–]/;
const SPACE_ONLY = /^\s+$/;
const CJK = /[\u3400-\u4dbf\u4e00-\u9fff\uf900-\ufaff]/g;

/** 只能黏在前一个词后面的虚词，短语级合并时优先并进来 */
const PARTICLE_SUFFIX = new Set([
  '的', '地', '得', '了', '着', '过', '们', '之', '所', '而', '且',
  '吧', '呢', '吗', '啊', '呀', '嘛', '来',
]);

/**
 * 补语 / 方位后缀字。ICU 会把「驶过」「河边」拆成两个单字，这里把它们缝回去。
 * 只在两侧都是单字、且右侧字属于此后缀集合时触发。
 */
const SUFFIX_CHARS = new Set([
  '过', '着', '了', '得', '们', '儿', '边', '面', '里', '外',
  '来', '去', '起', '开', '住', '掉', '见', '到',
]);

/** 英文里不应该出现在区块末尾的功能词 */
const FUNCTION_WORDS = new Set([
  'a', 'an', 'the', 'of', 'to', 'in', 'on', 'at', 'and', 'or', 'but', 'with',
  'for', 'from', 'by', 'as', 'is', 'was', 'were', 'are', 'be', 'been', 'being',
  'that', 'this', 'these', 'those', 'his', 'her', 'their', 'its', 'my', 'your',
  'our', 'he', 'she', 'it', 'they', 'we', 'you', 'i', 'not', 'so', 'than',
  'then', 'if', 'when', 'while', 'into', 'over', 'under', 'after', 'before',
  'up', 'down', 'out', 'off', 'there', 'here',
]);

const RANGE: Record<Lang, Record<1 | 2, { min: number; max: number }>> = {
  zh: { 1: { min: 6, max: 12 }, 2: { min: 2, max: 4 } },
  en: { 1: { min: 4, max: 6 }, 2: { min: 2, max: 3 } },
};

/** 判断文本主体语言。中文占比超过 30% 视为中文。 */
export function detectLang(text: string): Lang {
  const cjk = (text.match(CJK) || []).length;
  if (cjk === 0) return 'en';
  const latin = (text.match(/[A-Za-z]/g) || []).length;
  return cjk / (cjk + latin) > 0.3 ? 'zh' : 'en';
}

const segmenterCache = new Map<string, Intl.Segmenter | null>();

function getSegmenter(lang: Lang): Intl.Segmenter | null {
  const locale = lang === 'zh' ? 'zh-CN' : 'en-US';
  if (segmenterCache.has(locale)) return segmenterCache.get(locale) ?? null;
  let seg: Intl.Segmenter | null = null;
  try {
    if (typeof Intl !== 'undefined' && typeof Intl.Segmenter === 'function') {
      seg = new Intl.Segmenter(locale, { granularity: 'word' });
    }
  } catch {
    seg = null;
  }
  segmenterCache.set(locale, seg);
  return seg;
}

interface Token {
  text: string;
  word: boolean;
}

/**
 * 切分为词 / 非词两类 token。
 * 现代浏览器走 Intl.Segmenter；极旧环境降级为按字符边界切分（可读但粒度偏粗）。
 */
function tokenize(text: string, lang: Lang): Token[] {
  const seg = getSegmenter(lang);
  const out: Token[] = [];

  if (seg) {
    for (const part of seg.segment(text)) {
      out.push({ text: part.segment, word: part.isWordLike === true });
    }
    return out;
  }

  const re =
    /[\u3400-\u4dbf\u4e00-\u9fff]|[A-Za-z0-9]+(?:['’\-][A-Za-z0-9]+)*|\s+|[^\s]/g;
  for (const m of text.matchAll(re)) {
    const t = m[0];
    const word = /[A-Za-z0-9\u3400-\u4dbf\u4e00-\u9fff]/.test(t);
    out.push({ text: t, word });
  }
  return out;
}

/** 把 token 组装成「词 + 紧随其后的标点」单元 */
function toUnits(text: string, lang: Lang): Unit[] {
  const units: Unit[] = [];
  let pendingLead = '';
  let cur: Unit | null = null;

  for (const tk of tokenize(text, lang)) {
    if (tk.word) {
      if (cur) units.push(cur);
      cur = { lead: pendingLead, text: tk.text, trail: '', stop: false, clause: false };
      pendingLead = '';
      continue;
    }
    if (SPACE_ONLY.test(tk.text)) continue;
    if (!cur) {
      pendingLead += tk.text;
      continue;
    }
    cur.trail += tk.text;
    if (STOP_PUNCT.test(tk.text)) cur.stop = true;
    if (CLAUSE_PUNCT.test(tk.text)) cur.clause = true;
  }

  if (cur) units.push(cur);
  return units;
}

function sizeOf(text: string, lang: Lang): number {
  return lang === 'zh' ? Array.from(text).length : 1;
}

/**
 * ICU 对部分常用词会切成两个单字（驶｜过、河｜边）。若后一个字是补语或方位
 * 后缀，就把它们缝回一个词。这一步属于分词修正，对三档粒度同时生效。
 */
function mergeSuffixSingles(units: Unit[]): Unit[] {
  const out: Unit[] = [];
  for (let i = 0; i < units.length; i++) {
    const cur = units[i];
    const next = units[i + 1];
    if (
      next &&
      cur.text.length === 1 &&
      next.text.length === 1 &&
      !cur.stop &&
      !cur.clause &&
      SUFFIX_CHARS.has(next.text)
    ) {
      out.push({
        lead: cur.lead,
        text: cur.text + next.text,
        trail: next.trail,
        stop: next.stop,
        clause: next.clause,
      });
      i++;
      continue;
    }
    out.push(cur);
  }
  return out;
}

function unitsSize(units: Unit[], lang: Lang): number {
  let n = 0;
  for (const u of units) n += sizeOf(u.text, lang);
  return n;
}

function lastWord(units: Unit[]): string {
  const t = units[units.length - 1]?.text ?? '';
  return t.toLowerCase().replace(/[^a-z']/g, '');
}

/** 按粒度把单元序列聚合成区块 */
function groupUnits(units: Unit[], lang: Lang, level: Level): Unit[][] {
  if (level === 3) return units.map((u) => [u]);

  const { min, max } = RANGE[lang][level];
  const groups: Unit[][] = [];
  let cur: Unit[] = [];

  const flush = () => {
    if (cur.length) groups.push(cur);
    cur = [];
  };

  let atClauseStart = true;

  for (const u of units) {
    if (cur.length) {
      const curSize = unitsSize(cur, lang);
      const addSize = sizeOf(u.text, lang);
      const overflow = curSize + addSize > max;

      let blocked = false;
      if (level === 2 && lang === 'zh') {
        // 虚词后缀（宽阔 + 的）无条件黏上；句首单字可与后一个双字词组成
        // 三字主语（猫 + 妈妈 → 猫妈妈），其余情况不硬拼两个实词
        const isParticle = u.text.length === 1 && PARTICLE_SUFFIX.has(u.text);
        const headMerge =
          atClauseStart && cur.length === 1 && curSize === 1 && addSize === 2;
        blocked = !isParticle && !headMerge;
      }

      if (overflow || blocked) {
        flush();
        atClauseStart = false;
      }
    }

    cur.push(u);

    // 句末标点、句中标点都是天然的停顿，任何粒度都在此断开
    if (u.stop || u.clause) {
      flush();
      atClauseStart = true;
    }
  }
  flush();

  // 英文不要让区块停在介词、冠词上：把下一块的首词挪过来
  if (lang === 'en') {
    for (let i = 0; i < groups.length - 1; i++) {
      let guard = 0;
      while (
        guard < 2 &&
        groups[i].length < max + 1 &&
        FUNCTION_WORDS.has(lastWord(groups[i])) &&
        groups[i + 1].length > 1
      ) {
        groups[i].push(groups[i + 1].shift() as Unit);
        guard++;
      }
    }

    // 英文里孤零零一个词成块很不自然，并回上一块
    for (let i = 1; i < groups.length; i++) {
      if (groups[i].length === 1 && unitsSize(groups[i - 1], lang) < max + 1) {
        groups[i - 1] = groups[i - 1].concat(groups[i]);
        groups.splice(i, 1);
        i--;
      }
    }
  }

  // 末尾只剩一个孤词时并回上一块，避免读起来断在半截
  if (groups.length > 1) {
    const last = groups[groups.length - 1];
    const lastSize = unitsSize(last, lang);
    if (last.length === 1 && lastSize < min) {
      const prev = groups[groups.length - 2];
      if (unitsSize(prev, lang) + lastSize <= max + 2) {
        groups.pop();
        groups[groups.length - 1] = prev.concat(last);
      }
    }
  }

  return groups.filter((g) => g.length > 0);
}

function toChunk(units: Unit[], lang: Lang): Chunk {
  const body = units
    .map((u, i) => (i === units.length - 1 ? u.text : u.text + u.trail))
    .join(lang === 'en' ? ' ' : '');

  return {
    lead: units[0].lead,
    text: body,
    trail: units[units.length - 1].trail,
    size: unitsSize(units, lang),
  };
}

/** 切分整篇文档 */
export function segmentDocument(raw: string, level: Level): Segmented {
  const text = raw.replace(/\r\n?/g, '\n').trim();
  const lang = detectLang(text);
  const paras = text
    .split(/\n+/)
    .map((line) => line.trim())
    .filter(Boolean);

  return {
    lang,
    paras: paras.map((line) => {
      const units = toUnits(line, lang);
      const fixed = lang === 'zh' ? mergeSuffixSingles(units) : units;
      return { chunks: groupUnits(fixed, lang, level).map((g) => toChunk(g, lang)) };
    }),
  };
}

/** 单个区块的朗读语言：区块自身含中文就用中文读 */
export function chunkLang(chunk: Chunk): Lang {
  const cjk = (chunk.text.match(CJK) || []).length;
  return cjk > 0 ? 'zh' : 'en';
}
