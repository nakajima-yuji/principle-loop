// リポジトリの Memo / 気づき（Markdown）を読むための、最小限の表示。
// 見出し・段落・箇条書き・引用・区切り線・コード・太字だけを扱う。HTML としては解釈しない（安全のため）。

import type { ReactNode } from 'react';

function inline(text: string): ReactNode[] {
  return text.split(/(\*\*[^*]+\*\*|`[^`]+`)/g).map((part, i) => {
    if (/^\*\*[^*]+\*\*$/.test(part)) return <strong key={i}>{part.slice(2, -2)}</strong>;
    if (/^`[^`]+`$/.test(part)) return <code key={i}>{part.slice(1, -1)}</code>;
    return part;
  });
}

/** 改行をそのまま見せる（Markdown の「行末スペース 2 つ」の改行もこれで足りる） */
function lines(list: string[]): ReactNode[] {
  return list.flatMap((l, i) => (i === 0 ? inline(l.trimEnd()) : [<br key={`br${i}`} />, ...inline(l.trimEnd())]));
}

export function Markdown({ text }: { text: string }) {
  const src = (text ?? '').replace(/\r/g, '').split('\n');
  const out: ReactNode[] = [];
  let i = 0;
  while (i < src.length) {
    const line = src[i];
    const t = line.trim();
    if (!t) {
      i++;
      continue;
    }
    if (t.startsWith('```')) {
      const code: string[] = [];
      i++;
      while (i < src.length && !src[i].trim().startsWith('```')) code.push(src[i++]);
      i++;
      out.push(<pre key={out.length}>{code.join('\n')}</pre>);
      continue;
    }
    const h = /^(#{1,6})\s+(.*)$/.exec(t);
    if (h) {
      const level = Math.min(h[1].length + 2, 6);
      const Tag = `h${level}` as 'h3' | 'h4' | 'h5' | 'h6';
      out.push(<Tag key={out.length}>{inline(h[2].replace(/\s*#+\s*$/, ''))}</Tag>);
      i++;
      continue;
    }
    if (/^(-{3,}|\*{3,}|_{3,})$/.test(t)) {
      out.push(<hr key={out.length} />);
      i++;
      continue;
    }
    if (t.startsWith('>')) {
      const quote: string[] = [];
      while (i < src.length && src[i].trim().startsWith('>')) quote.push(src[i++].trim().replace(/^>\s?/, ''));
      out.push(<blockquote key={out.length}>{lines(quote.filter((q) => q.trim()))}</blockquote>);
      continue;
    }
    const listRe = /^\s*(?:[-*・]|(\d+)\.)\s+(.*)$/;
    if (listRe.test(line)) {
      const ordered = Boolean(listRe.exec(line)?.[1]);
      const items: string[] = [];
      while (i < src.length && listRe.test(src[i])) items.push(listRe.exec(src[i++])?.[2] ?? '');
      const List = ordered ? 'ol' : 'ul';
      out.push(
        <List key={out.length}>
          {items.map((it, k) => (
            <li key={k}>{inline(it)}</li>
          ))}
        </List>,
      );
      continue;
    }
    const para: string[] = [];
    while (i < src.length && src[i].trim() && !/^(#{1,6}\s|>|```|(-{3,}|\*{3,}|_{3,})\s*$)/.test(src[i].trim()) && !listRe.test(src[i])) para.push(src[i++]);
    if (para.length === 0) para.push(src[i++]); // 念のため（どの形にも当てはまらない行で止まらないように）
    out.push(<p key={out.length}>{lines(para)}</p>);
  }
  return <div className="md">{out}</div>;
}
