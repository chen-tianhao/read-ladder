# Read Ladder · 阅读阶梯

给阅读困难（阅读障碍 /  dyslexia）的孩子用的分块阅读练习工具。把一段文字切成带底色的
小块，点一下就能听，也能导出成 PDF 打印。

纯静态站点：没有后端、没有数据库、没有 API Key，构建产物约 21 KB（gzip）。

---

## 功能

| 能力 | 说明 |
| --- | --- |
| 分块 | 中英文自动识别，按三档粒度切成带底色的区块 |
| 朗读 | 点色块即读；电脑上鼠标悬停 2 秒也读；中英双语自动选音 |
| 导出 | 打印样式表直接出 PDF，色块与文字都保留 |
| 内容 | 中英各 4 篇公版 / 原创短文，按年龄段标注 |
| 界面 | 中英一键切换，语言、等级、语速、字号全部本地记忆 |
| 分享 | `?doc=lion&level=2&lang=en` 深链，可直接定位到某篇某档 |

## 三档辅助等级

| 等级 | 中文 | 英文 | 区块间距 |
| --- | --- | --- | --- |
| 1 · 长句块 | 6–12 字，遇逗号句号断开 | 4–6 词，遇标点断开 | 0.58em |
| 2 · 短语 | 词 + 虚词后缀（宽阔的、带着、坐下来） | 2–3 词，不落在介词冠词上 | 0.38em |
| 3 · 词 | 一行一个词 | 一行一个词 | 0.15em |

区块之间的间距随等级放大：块越大，块与块之间的留白越宽，这样孩子不只看颜色，
也能靠间距感知「这里是一组」。中英文都适用，英文还会叠加正文本身的空格。

已知取舍：汉语词短且无空格，所以中文的 2 档与 3 档差异比英文小（约 10–20%），
差别主要出现在「词 + 的/着/了」这类融合上。再往下机械合并（比如固定 4 字一段）
会切出「驶过宽阔的」这种错误意群，对理解反而有害，因此没有采用。

## 本地开发

```bash
npm install
npm run dev      # http://127.0.0.1:5173
npm run build    # 类型检查 + 产物输出到 dist/
npm run preview  # 预览 dist/
```

浏览器要求：`Intl.Segmenter`（Chrome 87+ / Safari 14.1+ / Firefox 125+）与
`speechSynthesis`。旧浏览器会退化为按字符切分，功能仍可用。

## 部署到 Cloudflare Pages

1. 把本仓库推到 GitHub（默认分支 `main`）。
2. 打开 Cloudflare 控制台 → Workers & Pages → Create → Pages → Connect to Git。
3. 选择仓库，构建配置填：

   | 项 | 值 |
   | --- | --- |
   | Framework preset | None |
   | Build command | `npm run build` |
   | Build output directory | `dist` |

4. 在 Settings → Environment variables 增加 `NODE_VERSION = 22`
   （Vite 8 需要 Node ≥ 20.19，Cloudflare 默认版本可能偏低）。
5. Save and Deploy。之后每次 push 到 `main` 都会自动构建发布，
   其他分支会生成独立的预览链接。

免费额度足够个人使用：500 次构建/月、静态请求与带宽不限、100 个自定义域。
纯静态站不消耗 Functions 配额。若绑定自有域名，在 Custom domains 里加一条 CNAME 即可。

## 项目结构

```
index.html            页面骨架，静态文案带 data-i18n
src/
  main.ts             状态、渲染、交互、快捷键绑定
  segment.ts          切块引擎：分词 → 单元 → 三档聚合
  tts.ts              Web Speech API 封装（分句队列 / 语音挑选 / iOS 解锁）
  content.ts          8 篇预置内容
  i18n.ts             界面文案与 DOM 替换
  store.ts            localStorage 状态
  style.css           设计 token、响应式、打印样式
scripts/
  segtest.ts          切块结果自检：node scripts/segtest.ts
```

## 设计约定

- 底色 `#FAF8F3` 米白，避免纯白眩光；正文 `#2B2A26`，不用纯黑。
- 行高 2.05、字距 0.015em、行宽上限 66ch、左对齐不两端对齐。
- 五种低饱和度的区块色循环使用，文字与底色对比度均在 12:1 以上。
- 打印字号跟随界面选择的字号（96dpi 下 1px = 0.75pt），页眉会标注当前辅助等级与字号。
- 打印时必须保留 `print-color-adjust: exact`，否则浏览器默认不打印背景色。

## 内容版权

预置的 8 篇全部为公版作品或原创改写（伊索寓言、史蒂文森童诗、骆宾王《咏鹅》、
《韩非子》寓言，以及 4 篇原创）。未收录任何仍在版权保护期内的作品。

## 已知限制

- 中文分词依赖浏览器 ICU 词典，个别词会切得偏碎（如「坐下｜来」）。
  可在 `src/segment.ts` 的 `SUFFIX_CHARS` 中补充后缀字来缝合。
- 朗读音色由操作系统提供，不同设备不一致。若需要跨设备统一音色，
  可以接入 Cloudflare Workers AI 的 MeloTTS（需额外 Pages Functions）。
- 悬停朗读在触屏上无效，自动退化为点击。
