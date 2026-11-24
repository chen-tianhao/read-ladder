import { segmentDocument } from '../src/segment.ts';
import { PASSAGES } from '../src/content.ts';

const samples: Array<[string, string]> = [
  ['zh 短句', '小船慢慢驶过宽阔的河面。'],
  ['zh 长句', '猫妈妈带着小猫去河边钓鱼，小猫坐下来，看见一只蜻蜓飞过来，就放下鱼竿去追。'],
  ['zh 引号', '猫妈妈说：「钓鱼要一心一意，不能三心二意。」'],
  ['en 短句', 'The little boat sailed across the wide river.'],
  ['en 对话', '"Please let me go," said the mouse. "One day I will help you."'],
  ['en 长句', 'When the green fades away, other colours show through, and those colours were in the leaf all along.'],
];

for (const [name, text] of samples) {
  console.log(`\n=== ${name}`);
  for (const level of [1, 2, 3] as const) {
    const seg = segmentDocument(text, level);
    const line = seg.paras
      .map((p) => p.chunks.map((c) => c.text).join(' ¦ '))
      .join(' / ');
    console.log(`L${level}: ${line}`);
  }
}

console.log('\n=== 预置内容区块数');
for (const p of PASSAGES) {
  const counts = ([1, 2, 3] as const).map(
    (lv) =>
      segmentDocument(p.body, lv).paras.reduce((n, para) => n + para.chunks.length, 0),
  );
  console.log(`${p.id.padEnd(8)} L1=${counts[0]}  L2=${counts[1]}  L3=${counts[2]}`);
}
