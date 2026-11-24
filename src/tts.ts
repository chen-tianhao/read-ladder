import type { Lang } from './segment';

/**
 * Web Speech API 封装。
 *
 * 处理了三件会在真机上咬人的事：
 * 1. getVoices() 首次调用常常返回空数组，必须监听 voiceschanged；
 * 2. Chrome 桌面端对超过约 15 秒的 utterance 会静默截断，所以按句切分排队；
 * 3. iOS Safari 要求首次 speak 发生在真实用户手势里，因此提供 unlock()。
 */
export class Speaker {
  readonly supported: boolean;
  private voices: SpeechSynthesisVoice[] = [];
  private listeners = new Set<() => void>();
  private token = 0;
  private unlocked = false;

  constructor() {
    this.supported =
      typeof window !== 'undefined' &&
      'speechSynthesis' in window &&
      typeof SpeechSynthesisUtterance === 'function';

    if (!this.supported) return;

    const sync = () => {
      const list = window.speechSynthesis.getVoices();
      if (list.length) {
        this.voices = list;
        this.listeners.forEach((fn) => fn());
      }
    };

    sync();
    window.speechSynthesis.addEventListener('voiceschanged', sync);
    window.setTimeout(sync, 400);
  }

  get allVoices(): SpeechSynthesisVoice[] {
    return this.voices;
  }

  onVoices(fn: () => void): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  /** iOS 首次朗读必须由手势触发，这里用一段静音把它解锁 */
  unlock(): void {
    if (!this.supported || this.unlocked) return;
    this.unlocked = true;
    try {
      const u = new SpeechSynthesisUtterance(' ');
      u.volume = 0;
      window.speechSynthesis.speak(u);
    } catch {
      /* 忽略：部分浏览器不支持 volume=0 的空朗读 */
    }
  }

  pickVoice(lang: Lang, voiceURI?: string): SpeechSynthesisVoice | null {
    if (!this.voices.length) return null;
    if (voiceURI) {
      const hit = this.voices.find((v) => v.voiceURI === voiceURI);
      if (hit) return hit;
    }
    const prefix = lang === 'zh' ? 'zh' : 'en';
    const pool = this.voices.filter((v) => v.lang.toLowerCase().startsWith(prefix));
    if (!pool.length) return null;

    const preferred =
      lang === 'zh'
        ? ['Tingting', 'Ting-Ting', 'Xiaoxiao', 'Huihui', 'Yaoyao', 'Meijia', 'Sinji', 'Google']
        : ['Samantha', 'Aria', 'Google US English', 'Karen', 'Daniel', 'Alex', 'Google'];

    for (const name of preferred) {
      const hit = pool.find((v) => v.name.includes(name));
      if (hit) return hit;
    }
    return pool.find((v) => v.localService) ?? pool[0];
  }

  stop(): void {
    if (!this.supported) return;
    this.token++;
    try {
      window.speechSynthesis.cancel();
    } catch {
      /* 忽略 */
    }
  }

  speak(opts: {
    text: string;
    lang: Lang;
    rate: number;
    voiceURI?: string;
    onStart?: () => void;
    onEnd?: () => void;
    onError?: (reason: string) => void;
  }): void {
    if (!this.supported) {
      opts.onError?.('unsupported');
      return;
    }

    const text = opts.text.trim();
    if (!text) return;

    const wasBusy = window.speechSynthesis.speaking || window.speechSynthesis.pending;
    this.stop();
    const my = ++this.token;

    const pieces = splitForSpeech(text);
    let index = 0;

    const step = () => {
      if (my !== this.token) return;
      if (index >= pieces.length) {
        opts.onEnd?.();
        return;
      }
      const piece = pieces[index++];
      const u = new SpeechSynthesisUtterance(piece);
      u.lang = opts.lang === 'zh' ? 'zh-CN' : 'en-US';
      u.rate = opts.rate;
      u.pitch = 1;

      const voice = this.pickVoice(opts.lang, opts.voiceURI);
      if (voice) {
        u.voice = voice;
        u.lang = voice.lang;
      }

      u.onstart = () => {
        if (index === 1) opts.onStart?.();
      };
      u.onend = () => {
        if (my !== this.token) return;
        step();
      };
      u.onerror = (ev) => {
        const reason = (ev as SpeechSynthesisErrorEvent).error;
        if (reason === 'interrupted' || reason === 'canceled') return;
        opts.onError?.(reason || 'error');
      };

      window.speechSynthesis.speak(u);
    };

    // Chrome 在 cancel() 之后立刻 speak() 偶发无声，给它一帧喘息
    if (wasBusy) window.setTimeout(step, 60);
    else step();
  }
}

/** 按句切分，保证每段都远低于 Chrome 的截断阈值 */
export function splitForSpeech(text: string): string[] {
  const MAX = 160;
  const rough = text
    .split(/(?<=[。！？!?；;…])|(?<=\.\s)/)
    .map((s) => s.trim())
    .filter(Boolean);

  const out: string[] = [];
  for (const piece of rough) {
    if (piece.length <= MAX) {
      out.push(piece);
      continue;
    }
    let rest = piece;
    while (rest.length > MAX) {
      let cut = rest.lastIndexOf('，', MAX);
      if (cut < 40) cut = rest.lastIndexOf(',', MAX);
      if (cut < 40) cut = rest.lastIndexOf(' ', MAX);
      if (cut < 40) cut = MAX - 1;
      out.push(rest.slice(0, cut + 1).trim());
      rest = rest.slice(cut + 1);
    }
    if (rest.trim()) out.push(rest.trim());
  }
  return out.length ? out : [text];
}
