import type { Lang } from './segment';
import type { UiLang } from './i18n';

export interface Passage {
  id: string;
  lang: Lang;
  /** 建议年龄区间 */
  age: string;
  title: Record<UiLang, string>;
  /** 来源说明：公版出处或「原创」 */
  source: Record<UiLang, string>;
  /** 正文，空行分段 */
  body: string;
}

/**
 * 预置内容全部为公版作品或原创改写，可自由用于教学。
 * 未收录任何仍在版权保护期内的现当代作品。
 */
export const PASSAGES: Passage[] = [
  {
    id: 'kitten',
    lang: 'zh',
    age: '6–8',
    title: { zh: '小猫钓鱼', en: 'The Kitten Goes Fishing' },
    source: { zh: '原创改写', en: 'Original retelling' },
    body: `猫妈妈带着小猫去河边钓鱼。小猫坐下来，看见一只蜻蜓飞过来，就放下鱼竿去追。蜻蜓飞走了，小猫回到河边，鱼早就跑了。
过了一会儿，一只蝴蝶飞过来，小猫又放下了鱼竿。蝴蝶飞进花丛里，怎么也找不到了。
太阳快落山了，猫妈妈的桶里装满了鱼，小猫的桶里空空的。猫妈妈说：「钓鱼要一心一意，不能三心二意。」
小猫点点头。第二天，它安安静静地坐了一整天，真的钓上来一条大鱼。`,
  },
  {
    id: 'goose',
    lang: 'zh',
    age: '6–8',
    title: { zh: '咏鹅', en: 'Ode to the Goose' },
    source: { zh: '公版 · 骆宾王（唐）', en: 'Public domain · Luo Binwang (Tang)' },
    body: `鹅，鹅，鹅，曲项向天歌。
白毛浮绿水，红掌拨清波。
小注：一群白鹅弯着脖子，朝着天空唱歌。雪白的羽毛浮在绿水上，红色的脚掌拨动清清的水波。
写下这首诗的时候，骆宾王只有七岁。`,
  },
  {
    id: 'bees',
    lang: 'zh',
    age: '9–11',
    title: { zh: '蜜蜂怎样找到回家的路', en: 'How Bees Find Their Way Home' },
    source: { zh: '原创科普', en: 'Original' },
    body: `蜜蜂出门采蜜，常常要飞好几公里。它是怎么找到回家的路的呢？
科学家发现，蜜蜂会把太阳当作指南针。就算是阴天，它也能看见我们看不见的偏振光，知道太阳在哪个方向。
蜜蜂还会记住一路上的地标：一棵大树，一座房子的墙角，一片开花的草地。飞回家的时候，它一边飞一边数着这些标记。
更神奇的是，蜜蜂回到蜂巢以后会跳一种「八字舞」。舞蹈的方向告诉同伴花丛在哪一边，舞蹈的快慢告诉同伴花丛有多远。`,
  },
  {
    id: 'stump',
    lang: 'zh',
    age: '12–15',
    title: { zh: '守株待兔', en: 'Waiting by the Tree Stump' },
    source: { zh: '公版 · 出自《韩非子》', en: 'Public domain · from Han Feizi' },
    body: `宋国有一个农夫，他的田里立着一截树桩。有一天，一只兔子跑得太快，一头撞在树桩上，死了。
农夫白捡了一只兔子，高兴极了。从那天起，他放下锄头，天天守在树桩旁边，等着下一只兔子撞上来。
日子一天天过去，兔子再也没有出现，田里的草却越长越高。到了秋天，别人的田里堆满了粮食，他的田里一片荒草。
宋国人听说了这件事，都笑他。后来人们用「守株待兔」来形容那些不肯出力、只想靠运气的人。`,
  },
  {
    id: 'lion',
    lang: 'en',
    age: '8–10',
    title: { zh: '狮子和老鼠', en: 'The Lion and the Mouse' },
    source: { zh: '公版 · 伊索寓言', en: 'Public domain · Aesop' },
    body: `A lion was asleep in the sun. A little mouse ran over his paw and woke him up. The lion caught the mouse and opened his mouth wide.
"Please let me go," said the mouse. "One day I will help you."
The lion laughed. How could a tiny mouse help a lion? But he let the mouse go.
Weeks later, the lion was caught in a net. He roared and pulled, but the ropes held fast. The mouse heard him and ran over. She gnawed through the ropes, one by one, until the lion was free.
"You laughed at me," said the mouse. "But even a small friend can be a big help."`,
  },
  {
    id: 'crow',
    lang: 'en',
    age: '8–10',
    title: { zh: '狐狸和乌鸦', en: 'The Fox and the Crow' },
    source: { zh: '公版 · 伊索寓言', en: 'Public domain · Aesop' },
    body: `A crow found a piece of cheese and flew up into a tree to eat it. A fox walked by and smelled the cheese. He wanted it very much.
"Good morning, beautiful crow," said the fox. "Your feathers are so bright. Your eyes are so clear. If your voice is as lovely as your face, you must be the queen of all birds."
The crow was very pleased. She opened her beak to sing, and the cheese fell down. The fox caught it and ran away.
"Thank you," he called back. "That was all I wanted."`,
  },
  {
    id: 'swing',
    lang: 'en',
    age: '6–8',
    title: { zh: '秋千', en: 'The Swing' },
    source: {
      zh: '公版 · 史蒂文森《儿童诗园》',
      en: 'Public domain · R. L. Stevenson',
    },
    body: `How do you like to go up in a swing,
Up in the air so blue?
Oh, I do think it the pleasantest thing
Ever a child can do!

Up in the air and over the wall,
Till I can see so wide,
Rivers and trees and cattle and all
Over the countryside—

Till I look down on the garden green,
Down on the roof so brown—
Up in the air I go flying again,
Up in the air and down!`,
  },
  {
    id: 'leaves',
    lang: 'en',
    age: '12–15',
    title: { zh: '叶子为什么会变色', en: 'Why Do Leaves Change Colour?' },
    source: { zh: '原创科普', en: 'Original' },
    body: `In summer, the leaves on a tree are green. The green comes from a chemical called chlorophyll. Chlorophyll catches sunlight, and the tree uses that light to make sugar. This is how the tree feeds itself.
In autumn, the days get shorter and the nights get colder. The tree stops making chlorophyll. When the green fades away, other colours show through. Those colours were in the leaf all along, hidden under the green. Yellow and orange were there for months. Red is different: the tree makes it fresh in autumn, from sugar left in the leaf.
Some years the colours are bright. Some years they are dull. It depends on the weather. Warm sunny days and cool nights give the brightest reds. A windy storm can strip a tree in a single night.
So the next time you see a red leaf, remember: it is not a dying thing. It is a colour that was waiting.`,
  },
];
