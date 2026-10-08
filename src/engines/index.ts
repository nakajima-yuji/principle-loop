// 思考エンジン（ENGINE）。PRINCIPLE LOOP の本体とは分けて、データとして持つ。
// - 自動では使わない。人間が「借りる」と選んだものだけを使う（なし、も選べる）
// - 2つ以上を混ぜられる（ENGINE MIX の土台）
// - 名前は「その人の考え方から借りた型」に付けたこのアプリでの呼び名。本人の思考の正確な再現ではない
// - 借りたあとは分解し、別のエンジンや自分の観察と混ぜ、原型が分からなくなるまで再構成してよい

import { ENGINE_LENSES, ENGINE_OPERATIONS, type TransformOp } from './transform.ts';

export type EngineOrigin = 'person' | 'personal-filter';

export type ThinkingEngine = {
  id: string;
  /** 人物由来の思考エンジン。一般操作はここに登録しない。 */
  origin: EngineOrigin;
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
  /** 人物そのものの断定を避けるための、モデルの根拠（任意） */
  evidence?: {
    facts: string[];
    observations: string[];
    hypotheses: string[];
  };
  /** この人物エンジンから借りられる一般操作のID */
  operationIds?: string[];
  /** この人物エンジンから借りられる観察レンズのID */
  lensIds?: string[];
};

export type PipelineStep =
  | { type: 'engine'; id: string }
  | { type: 'operation' | 'technique' | 'lens'; id: string };

export const ENGINE_PIPELINE_EXAMPLES: readonly { label: string; steps: PipelineStep[] }[] = [
  { label: '岡田だけ', steps: [{ type: 'engine', id: 'okada' }] },
  { label: '岡田 → 南方', steps: [{ type: 'engine', id: 'okada' }, { type: 'engine', id: 'minakata' }] },
  { label: '赤瀬川 → 岡田', steps: [{ type: 'engine', id: 'akasegawa' }, { type: 'engine', id: 'okada' }] },
  { label: '南方 → 林', steps: [{ type: 'engine', id: 'minakata' }, { type: 'engine', id: 'hayashi' }] },
  { label: '岡田 → 状態変化', steps: [{ type: 'engine', id: 'okada' }, { type: 'operation', id: 'state-change' }] },
  { label: '岡田 → 知らない前提', steps: [{ type: 'engine', id: 'okada' }, { type: 'lens', id: 'unknown-premise' }] },
  { label: '岡田 → 深層掘削', steps: [{ type: 'engine', id: 'okada' }, { type: 'technique', id: 'deep-drill' }] },
];

export const NONE_ENGINE_ID = 'none';

export const ENGINES: readonly ThinkingEngine[] = [
  {
    id: 'none',
    origin: 'person',
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
    origin: 'person',
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
      '【v3任意】不完全な理解でも暫定仮説を出し、説明しながらどう更新できる？',
      '【v3任意】複数の問題を一つの原理で説明できる？ 反例は？',
      '【v3任意】現代の常識を外し、別時代の制約で考えると何が変わる？',
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
    // v3.0 research candidates: selectable, not attributed as verified author methods.
    evidence: {
      facts: ['過去記事・著作・講演を一次資料として300件調査する計画（調査完了を意味しない）'],
      observations: ['既存の違和感検出・構造抽出・深層掘削を維持する'],
      hypotheses: ['即興仮説生成', '多問題統合', '時代的前提破壊'],
    },
    operationIds: ['deep-drill', 'state-change', 'unknown-premise', 'observation-shift', 'latent-function', 'improvised-hypothesis', 'multi-problem-unification', 'historical-premise-disruption'],
    lensIds: ['observer-subject', 'knowledge-gap', 'time-shift'],
  },
  {
    id: 'akasegawa',
    origin: 'person',
    name: 'AKASEGAWA',
    shortDescription: '日常の「なんだこれ？」を拾う',
    description: '用途不明、使われなくなったもの、偶然の形、痕跡、ズレ、余白、不自然な配置、誰かの行動の残りから、まだ名前の付いていない違和感を拾う。価値を決めず、意味になる前の観察を残す。',
    questions: ['これは何に使うものか分からないまま、何が気になる？', '誰かの行動の何が残っている？', '用途を決めずに形・痕跡・余白だけを見ると？', '名前を付ける前の違和感を、どんな場面で再現できる？'],
    process: ['なんだこれ？を拾う', '用途・意味を保留する', '形・痕跡・ズレ・余白を記録する', '別の状況で再配置する', '人がどう意味づけるか観察する'],
    suitableFor: ['街や日常の観察', '漫画の小道具・背景', 'ゲームの謎や痕跡', '意味が後から立ち上がる作品'],
    operationIds: ['unknown-premise', 'observation-shift', 'counterexample'],
    lensIds: ['knowledge-gap', 'observer-subject'],
  },
  {
    id: 'minakata',
    origin: 'person',
    name: 'MINAKATA',
    shortDescription: '遠くまで集め、萃点を探す',
    description: '評価や実装可能性で早く絞らず、異分野・反対・例外・極端な事例を大量に集める。遠いもの同士の関係が一点に集まる「萃点」を探し、探索空間を広げるコレクター。',
    questions: ['同じ関係は生物・物理・遊び・都市・儀式のどこにある？', '反対の例・失敗例・極端な例は？', '遠い分野をさらに一段つなぐと何が見える？', 'まだ評価せず、何を追加で集めるべき？'],
    process: ['大量化する', '遠距離化する', '異分野化する', '反対・例外・極端を集める', '関係を収集する', '連鎖して萃点を探す'],
    suitableFor: ['発想の幅を広げるとき', 'ゲームのルール候補集め', '世界設定・漫画の連想', '評価前のリサーチ'],
    operationIds: ['extreme', 'counterexample', 'state-change'],
    lensIds: ['time-shift', 'knowledge-gap'],
  },
  {
    id: 'hayashi',
    origin: 'person',
    name: 'HAYASHI',
    shortDescription: '既知を磨き、未知の面白さを守る｜v3.0',
    description: 'HAYASHI FILTER v3.0。王道との差分・一目で伝わる光点・操作と結果の因果を確認しつつ、伝達力と未知の可能性を別軸で扱う。低得点でも未知の原石を保護する。原案維持／小改善／大胆な改変を並列に出し、採否は人間が決める。林士平本人の公式手法ではなく、編集事例を参考にしたPRINCIPLE LOOP独自モデル。',
    questions: [
      '王道は何で、この案はどこを外している？',
      '一文・一画面で伝わる光点は何？',
      '操作と結果の因果は直感的に分かる？（ゲーム以外は媒体に読み替える）',
      '【感情の発火点】何が起きた瞬間に、どんな感情が生まれる？',
      '【期待と裏切り】何を予想し、どこで裏切られる？',
      '【光点の持続性】最初の驚きの先にどんな展開がある？',
      '【認知の障壁】初見の人はどこで理解を失う？',
      '【作者固有の魅力】編集で壊してはいけない核は何？',
      '【未知保護】既存の採点軸では測れない可能性は？',
      '【予測誤差】事前予測と実際の試遊反応はどう違った？',
      '伝達力と未知の可能性を別々に判定すると？',
      '原案維持・小改善・大胆な改変の3方向は？',
    ],
    process: [
      '媒体・狙う感情・王道を確認する',
      '差分・光点・因果を診断する',
      '7つの深層診断で魅力と障壁を分ける',
      '伝達力と未知の可能性を別軸で記録する',
      '原案維持・小改善・大胆な改変を並列に提示する',
      'BEST・FAR・WILDを異なる方向で保護する',
      '人間が選び、最小試作する',
      '実際の反応と予測誤差を照合する',
    ],
    viewpoints: ['伝達力 × 未知の可能性', '低評価でも未評価の原石を保護', '企画ごとに評価軸を調整', 'BEST / FAR / WILD', '採否は人間が決める'],
    suitableFor: ['ゲーム企画の編集', '漫画・絵本の入口', '映像の冒頭フック', '未知のアイデアの保護', '試遊結果による編集精度の改善'],
    evidence: {
      facts: ['林士平の編集インタビュー・事例を研究対象とする。出典はdocs/HAYASHI_FILTER_V3.mdを参照'],
      observations: ['王道との差分・伝達力・作者の魅力の保持は編集判断に有用な観点'],
      hypotheses: ['7深層診断', '伝達力と未知の可能性の2軸評価', '原案維持・小改善・大胆な改変の並列提案'],
    },
    operationIds: ['latent-function', 'extreme'],
    lensIds: ['time-shift', 'observer-subject'],
  },
  {
    id: 'ochiai',
    origin: 'person',
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
    origin: 'person',
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
    origin: 'person',
    name: 'KONDO',
    shortDescription: '不確実性をモデル化し、成立する実用品へ圧縮する',
    description:
      '【仮説】複雑で不確実な現実を、理解可能・検証可能・再現可能なモデルへ変換し、リスクを制御したうえで実用品へ落とす思考。慎重に止まるのではなく、調べる・数値化する・比較する・可視化する・シミュレーションする・小さく試すことで、分からない部分を制御可能な範囲まで縮めてから動く。これは近藤さん本人の思想の断定ではなく、観察から作った思考モデルである。',
    questions: [
      '【問題】本当の問題は何か？ 実行しない選択も含めて何を決める？',
      '【不確実性】何が不明で、判断を左右する変数は何か？',
      '【情報】必要な情報は何か？ 原理・制度・条件を説明できるか？',
      '【失敗】どこで壊れる？ 最悪ケース、損失の広がり、依存条件、可逆性は？',
      '【モデル】現実を直接試す前に、何を数値化・可視化・シミュレーションできる？',
      '【検証】最小の実験で何を確かめられる？ 成功・失敗の判定は？',
      '【実用品化】他人でも使える手順・ルール・ツールにできる？',
      '【判断】再現できるか？ 実行する価値があるか？ やらない方が合理的ではないか？',
    ],
    fixedQuestions: [
      '本当に必要か？',
      '原理を説明できるか？',
      '何が失敗するか？',
      '数値化できるか？',
      '小さく試せるか？',
      '再現できるか？',
      '他人にも使えるか？',
      'やらない方が合理的ではないか？',
    ],
    evidence: {
      facts: [
        '周囲の人のために実用アプリを作る',
        'FIREシミュレーターを作る',
        '日影シミュレーターを作る',
        'PDF高速読み取りアプリを作る',
        'NISAとビットコインに詳しい',
        '個別株投資は行わない',
      ],
      observations: [
        '困りごとや関心を、条件整理・可視化・シミュレーションを通じて道具に変える行動が見られる',
        '深く調べた内容を、他人にも使える実用的な形へ整理する傾向が見える',
      ],
      hypotheses: [
        'リスクを避けるというより、情報・モデル・小さな検証で不確実性を制御可能な範囲まで圧縮してから動く',
        '個別要因・投機性・予測依存・再現性の低さを警戒し、制度・長期運用・分散・最悪ケースを確認できる対象を選ぶ可能性がある',
      ],
    },
    process: [
      '本当の問題を定める',
      '不明点と判断変数を分解する',
      '原理・制度・条件を調べる',
      '失敗条件・最悪ケース・可逆性を先に見る',
      '数値化・比較・可視化する',
      '代理世界（モデル・シミュレーター）を作る',
      '小さく検証する',
      '反証・結果・前提を更新する',
      '成立条件と再現手順へ圧縮する',
      '他人でも使えるツール／手順にする',
      '実行・保留・見送りを判断する',
    ],
    viewpoints: [
      '不確実性圧縮',
      '失敗を先に見る',
      '代理世界を作ってから判断する',
      '複雑さを操作可能な判断材料へ圧縮する',
      '問題解決を他人も使える道具にする',
      'やらないことを合理的な意思決定として扱う',
      'ユーザーの「まず作る」と対照的に、調べる → 整理 → 検証 → 作る',
    ],
    suitableFor: ['FIRE・日影・投資など条件依存の判断', 'リスクのある計画の事前検証', '複雑な情報をシミュレーターやツールにする', '他人が再利用できる実用品を設計するとき', '「面白い」を成立条件・失敗条件のある試作へ変える'],
    operationIds: ['deep-drill', 'state-change', 'latent-function'],
    lensIds: ['time-shift', 'knowledge-gap'],
  },
];

export function getEngine(id: string): ThinkingEngine | undefined {
  return ENGINES.find((e) => e.id === id);
}

export function getOperation(id: string): TransformOp | undefined {
  return [...ENGINE_OPERATIONS, ...ENGINE_LENSES].find((op) => op.id === id);
}

export function validPipeline(steps: readonly PipelineStep[]): PipelineStep[] {
  return steps.filter((step) => {
    if (step.type === 'engine') return Boolean(getEngine(step.id));
    const op = getOperation(step.id);
    return Boolean(op && (step.type === op.kind || (step.type === 'operation' && op.kind === undefined)));
  });
}

export function pipelineLabel(steps: readonly PipelineStep[]): string {
  return validPipeline(steps)
    .map((step) => (step.type === 'engine' ? getEngine(step.id)?.name : getOperation(step.id)?.label) ?? step.id)
    .join(' → ');
}

/** 任意順序の組み合わせを、外部AIへ手動で渡すための短いプロンプトにする。 */
export function pipelineChatPrompt(steps: readonly PipelineStep[], target: { title: string; text: string }): string {
  const valid = validPipeline(steps);
  return [
    'PRINCIPLE LOOPの観察を、下記の順序で一段ずつ処理してください。固定パイプラインとして扱わず、各段階の出力を次段へ渡してください。',
    'AIは完成案を断定せず、観察方法がどう変わったかを短く示してください。',
    '',
    `【観察】${target.title}`,
    target.text,
    '',
    `【順序】${pipelineLabel(valid) || 'なし'}`,
    ...valid.map((step, i) => {
      const label = step.type === 'engine' ? getEngine(step.id)?.name : getOperation(step.id)?.label;
      const desc = step.type === 'engine' ? getEngine(step.id)?.shortDescription : getOperation(step.id)?.example;
      return `${i + 1}. ${label ?? step.id}：${desc ?? ''}`;
    }),
  ].join('\n');
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
