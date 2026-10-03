// HTML / XML の文字列を扱う小さな道具（依存ライブラリなし）

const NAMED: Record<string, string> = {
  amp: '&',
  lt: '<',
  gt: '>',
  quot: '"',
  apos: "'",
  nbsp: ' ',
  hellip: '…',
  mdash: '—',
  ndash: '–',
  lsquo: '‘',
  rsquo: '’',
  ldquo: '“',
  rdquo: '”',
  laquo: '«',
  raquo: '»',
  copy: '©',
  reg: '®',
  trade: '™',
  middot: '·',
  bull: '•',
  deg: '°',
  times: '×',
  eacute: 'é',
  egrave: 'è',
  aacute: 'á',
  oacute: 'ó',
  uuml: 'ü',
  ouml: 'ö',
  auml: 'ä',
  ccedil: 'ç',
  ntilde: 'ñ',
};

export function decodeEntities(s: string): string {
  return s.replace(/&(#x[0-9a-f]+|#\d+|[a-z][a-z0-9]*);/gi, (m, body: string) => {
    if (body[0] === '#') {
      const code = body[1] === 'x' || body[1] === 'X' ? parseInt(body.slice(2), 16) : parseInt(body.slice(1), 10);
      return Number.isFinite(code) && code > 0 && code < 0x110000 ? String.fromCodePoint(code) : m;
    }
    return NAMED[body.toLowerCase()] ?? m;
  });
}

export function stripCdata(s: string): string {
  return s.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1');
}

/** タグを除いて読める文字だけにする */
export function htmlToText(html: string): string {
  let src = stripCdata(html);
  // Atom の type="html" などでは、タグそのものが &lt;p&gt; のようにエスケープされて届く
  if (/&lt;\/?[a-z]/i.test(src)) src = decodeEntities(src);
  return decodeEntities(
    src
      .replace(/<(script|style|noscript|svg|iframe)[\s\S]*?<\/\1>/gi, ' ')
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<\/(p|div|li|h[1-6])>/gi, '\n')
      .replace(/<[^>]+>/g, ' '),
  )
    .replace(/[ \t ]+/g, ' ')
    .replace(/\s*\n\s*/g, '\n')
    .trim();
}

export function oneLine(s: string): string {
  return s.replace(/\s+/g, ' ').trim();
}

export function attr(tag: string, name: string): string | undefined {
  const m = new RegExp(`\\s${name}\\s*=\\s*("([^"]*)"|'([^']*)'|([^\\s>]+))`, 'i').exec(tag);
  return m ? decodeEntities(m[2] ?? m[3] ?? m[4] ?? '') : undefined;
}

/** 記事ページから本文らしい文章と og:image を取り出す（AI に渡す材料・サムネイル用） */
export function extractArticle(html: string, maxChars: number): { text: string; image?: string; description?: string } {
  const meta = (prop: string) => {
    const re = new RegExp(`<meta[^>]+(?:property|name)\\s*=\\s*["']${prop}["'][^>]*>`, 'i');
    const tag = re.exec(html)?.[0];
    return tag ? attr(tag, 'content') : undefined;
  };
  const image = meta('og:image') ?? meta('twitter:image');
  const description = meta('og:description') ?? meta('description');
  const body = html
    .replace(/<(script|style|noscript|svg|iframe|nav|header|footer|aside|form)[\s\S]*?<\/\1>/gi, ' ')
    .replace(/<!--[\s\S]*?-->/g, ' ');
  const paras = [...body.matchAll(/<p[\s>][\s\S]*?<\/p>/gi)]
    .map((m) => oneLine(htmlToText(m[0])))
    .filter((p) => p.length >= 40 && !/cookie|subscribe|newsletter|sign up|advertis|all rights reserved/i.test(p));
  let text = '';
  for (const p of paras) {
    if (text.length + p.length > maxChars) break;
    text += (text ? '\n' : '') + p;
  }
  return { text, image: image && /^https?:\/\//.test(image) ? image : undefined, description: description ? oneLine(description) : undefined };
}
