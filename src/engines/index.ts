// 思考エンジン（ENGINE）。PRINCIPLE LOOP の本体とは分けて、データとして持つ。
// - 自動では使わない。人間が「借りる」と選んだものだけを使う（なし、も選べる）
// - 2つ以上を混ぜられる（ENGINE MIX の土台）
// - 名前は「その人の考え方から借りた型」に付けたこのアプリでの呼び名。本人の思考の正確な再現ではない
// - 借りたあとは分解し、別のエンジンや自分の観察と混ぜ、原型が分からなくなるまで再構成してよい

export type ThinkingEngine = {
  id: string;
  name: string;
  description: string;
  shortDescription: string;
  questions: string[];
  process: string[];
  suitableFor: string[];
  /** 追加の視点（任意） */
  viewpoints?: string[];
  /** 毎回使う固定の問い（任意） */
  fixedQuestions?: string[];
};

export const NONE_ENGINE_ID = 'none';

export const ENGINES: readonly ThinkingEngine[] = [
  {
    id: 'none',
    name: 'NONE',
    shortDescription: '借りない。自分の感覚のまま進む',
    description:
      'どの思考エンジンも使わない。「なんか面白い」を言葉にしすぎず、そのまま小さく試したいときに選ぶ。エンジンを使わないことも、立派な選択肢の一つ。',
    questions: ['いま一番気になっているのはどこ？', '説明できなくても、試してみたいことは？'],
    process: ['気になったところをそのまま書く', '一番小さい形で試す', '起きたことを DIARY に戻す'],
    suitableFor: ['直感を壊したくないとき', 'まだ言葉にならない違和感', 'とにかく手を動かしたいとき'],
  },
  {
    id: 'okada',
    name: 'OKADA',
    shortDescription: '違和感から構造を抜く',
    description:
      '「ここ妙だな」から始める構造抽出。具体から構造を抜き出し、別の具体へ移植できる形にする。完成案は作らない。構造の種が得られたら止め、展開（TRANSFORM）へ渡す。具体案ができたら、もう一度ここへ戻してよい（再帰できる）。',
    questions: [
      'どこが「妙」だった？ 最初の違和感は何？',
      '観察のしかたを変えると（近づく・離れる・時間を変える）何が見える？',
      '固有名詞を全部消すと何が残る？',
      '何と何の関係によって、この現象は成立している？',
      'まったく違う分野に、同じ構造は存在する？',
      'その構造だけを別の対象へ移したら何ができる？',
    ],
    fixedQuestions: [
      '固有名詞を全部消すと何が残る？',
      '何と何の関係によって、この現象は成立している？',
      'まったく違う分野に、同じ構造は存在する？',
      'その構造だけを別の対象へ移したら何ができる？',
    ],
    process: [
      '違和感を探す',
      '観察方法を変える',
      '現象を分解する',
      '固有名詞・固有要素を消す',
      '関係だけを残す',
      '別分野で同型構造を探す',
      '移植する',
      '再具体化する',
    ],
    viewpoints: ['観測すると相手にも影響する', '情報を取得しようとすると自分も露出する', '痕跡', '罠', '偽装', '誤誘導'],
    suitableFor: ['日常の観察（公園・街・子どもの遊び）', '作品やゲームの仕組みの分解', '探索・推理・かくれんぼ型の体験', '表面ではなく構造を取り換えたいとき'],
  },
  {
    id: 'ochiai',
    name: 'OCHIAI',
    shortDescription: '前提・境界・観測方法を変える',
    description:
      '当たり前になっている前提を書き出し、境界（人と機械、自然と人工、物理とデジタルなど）を引き直し、観測する方法そのものを替える。新しいメディアや計算機で、現象を別の形に置き直す。',
    questions: [
      'この現象が当たり前に前提にしていることは？ それを外すと？',
      'どこに境界が引かれている？（人／機械、自然／人工、物理／デジタル、見る／見られる）',
      '境界を溶かす・引き直すと何が起きる？',
      '観測の方法（センサー・解像度・時間・メディア）を替えると、何が見える？',
      '計算機や新しい素材に置き換えると、何が「自然」になる？',
    ],
    process: ['前提を書き出す', '境界を見つける', '境界を溶かす・引き直す', '観測方法を替える', '別のメディアで置き直す', '体験として確かめる'],
    suitableFor: ['メディア・技術の新しい使い道', '展示・インスタレーション・空間', '人と機械・自然の関係を考えるとき', '「見え方」そのものを作品にしたいとき'],
  },
  {
    id: 'matsuoka',
    name: 'MATSUOKA',
    shortDescription: '分ける・つなぐ・ずらす・編集する',
    description:
      '情報を分け、関係づけ、見立て、文脈をずらして編集し直す。ばらばらの素材を「意味のつながり」で結び直し、物語や型として取り出す。',
    questions: [
      'どこで分けられる？ 分け方を変えると何が見える？',
      '何と何をつなぐと意味が変わる？',
      '何に見立てられる？（〜のようなもの）',
      '順番・文脈・視点をずらすと、どう読める？',
      'どんな型（対比・連想・見立て・要約・物語）で編集し直せる？',
    ],
    process: ['情報を分ける', '見立てる', '関係づける', 'ずらす', '編集し直す', '物語・型として取り出す'],
    suitableFor: ['物語・絵本・映像の構成', '複数の素材を一つの世界にまとめたいとき', '言葉・タイトル・見せ方を決めるとき', '知識同士をつなげたいとき'],
  },
  {
    id: 'kondo',
    name: 'KONDO',
    shortDescription: '1テーマを深く掘り、不確実性を減らす',
    description:
      '1つのテーマを縦方向に深く掘る（目安は約3週間）。情報を集め、前提を洗い、仮説を立て、実験し、反証する。知識を「盾」（間違いを防ぐ）にも「武器」（比較・反証・先読み）にも使い、結果を決めている土台（釜）そのものを操作する。',
    questions: [
      '対象はどこまでに絞る？（1テーマ・約3週間）',
      '前提として疑っていないものは？',
      '不確実性が一番大きいのはどこ？',
      '反証するには、何を確かめればいい？',
      'この結果を決めている「釜」（土台・前提条件）はどこ？',
      '釜そのものを操作するなら、何を変える？',
    ],
    process: [
      '対象を定める',
      '情報を集める',
      '前提を洗う',
      '仮説を立てる',
      '実験する',
      '反証する',
      '知識を追加する',
      'さらに掘る',
      '結果を決めている「釜」を特定する',
      '釜そのものを操作する',
    ],
    suitableFor: ['1つの技術・素材を深く理解したいとき', 'リスクの高い判断の前', '横に飛んで見つけた地点を縦に掘るとき', '「なぜ効くのか」を確かめたいとき'],
  },
];

export function getEngine(id: string): ThinkingEngine | undefined {
  return ENGINES.find((e) => e.id === id);
}

/**
 * エンジンの選択を切り替える。複数選べる（ENGINE MIX）。
 * 「なし」を選ぶと他は外れ、他を選ぶと「なし」は外れる。
 */
export function toggleEngine(selected: readonly string[], id: string): string[] {
  if (!getEngine(id)) return [...selected];
  if (selected.includes(id)) return selected.filter((x) => x !== id);
  if (id === NONE_ENGINE_ID) return [NONE_ENGINE_ID];
  return [...selected.filter((x) => x !== NONE_ENGINE_ID), id];
}

/** 選んだエンジンの問いをまとめる（重複は 1 回だけ） */
export function mixQuestions(ids: readonly string[]): { engine: ThinkingEngine; question: string }[] {
  const seen = new Set<string>();
  const out: { engine: ThinkingEngine; question: string }[] = [];
  for (const id of ids) {
    const e = getEngine(id);
    if (!e || e.id === NONE_ENGINE_ID) continue;
    for (const q of e.questions) {
      if (seen.has(q)) continue;
      seen.add(q);
      out.push({ engine: e, question: q });
    }
  }
  return out;
}

/**
 * 外部の AI チャットに自分で貼り付けるための相談文（自動では実行しない）。
 * AI に結論を出させず、問いへの「材料」だけを返してもらう。
 */
export function engineChatPrompt(ids: readonly string[], target: { title: string; text: string }): string {
  const engines = ids.map(getEngine).filter((e): e is ThinkingEngine => Boolean(e) && e?.id !== NONE_ENGINE_ID);
  return [
    '次の観察を、指定した思考の型を借りて少しだけ掘りたい。',
    '結論や完成案は出さないでください。問いごとに短い材料（1〜2行）を出し、最後に「まだ分からないこと」を挙げてください。',
    '',
    `【観察】${target.title}`,
    target.text,
    '',
    ...engines.flatMap((e) => [`【借りる型：${e.name}｜${e.shortDescription}】`, ...e.questions.map((q) => `- ${q}`), '']),
    engines.length > 1 ? '型同士がぶつかるところ（矛盾・ずれ）も1つ挙げてください。' : '',
  ]
    .filter((l, i, a) => !(l === '' && a[i - 1] === ''))
    .join('\n')
    .trim();
}
