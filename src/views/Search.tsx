import { useMemo, useState, type FormEvent, type ReactNode } from 'react';
import { CategoryChip, Loading, PageHead } from '../components/common.tsx';
import { Icon } from '../components/Icon.tsx';
import { loadArchive, useAsync } from '../data/api.ts';
import { usePersonal } from '../data/store.ts';
import { highlightRanges, searchAll } from '../lib/search.ts';
import { href, navigate } from '../router.ts';
import { isCategoryId } from '../shared/categories.ts';
import { formatDotDate } from '../shared/time.ts';

function Highlight({ text, query }: { text: string; query: string }) {
  const ranges = highlightRanges(text, query);
  if (!ranges.length) return <>{text}</>;
  const out: ReactNode[] = [];
  let pos = 0;
  ranges.forEach(([s, e], i) => {
    if (s < pos) return;
    out.push(text.slice(pos, s));
    out.push(<mark key={i}>{text.slice(s, e)}</mark>);
    pos = e;
  });
  out.push(text.slice(pos));
  return <>{out}</>;
}

export function SearchView({ q }: { q: string }) {
  const archive = useAsync(loadArchive, []);
  const personal = usePersonal();
  const [text, setText] = useState(q);
  const hits = useMemo(() => searchAll(q, archive.data, personal.diary), [q, archive.data, personal.diary]);

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    navigate('/search', { q: text.trim() });
  };

  return (
    <div className="page stack">
      <PageHead kicker="SEARCH" title="検索" sub="DAILY（過去分を含む）・DIARY（メモ・観察・実験結果を含む）・タグを、このブラウザの中で全文検索します。" />
      <form className="row" onSubmit={onSubmit} role="search">
        <input className="text" style={{ flex: 1, minWidth: 0 }} type="search" value={text} onChange={(e) => setText(e.target.value)} placeholder="例：フィードバック　#自己組織化" aria-label="検索語" autoFocus />
        <button type="submit" className="btn primary">
          <Icon name="search" size={16} /> 検索
        </button>
      </form>

      {archive.loading && !archive.data ? (
        <Loading />
      ) : !q ? (
        <div className="empty">言葉を入れて検索してください。スペースで区切ると AND 検索になります。</div>
      ) : (
        <>
          <p className="small muted">「{q}」の結果：{hits.length} 件</p>
          <div className="result-list">
            {hits.map((h) => (
              <a key={`${h.kind}-${h.id}`} className="result-item" href={h.kind === 'diary' ? href('/diary', { id: h.id }) : href('/read', { id: h.id })}>
                <span>
                  <span className="row" style={{ gap: 6 }}>
                    {isCategoryId(h.category) && <CategoryChip category={h.category} />}
                    <span className="tag">{h.kind === 'diary' ? 'DIARY' : 'DAILY'}</span>
                    <span className="small muted">{formatDotDate(h.date)}</span>
                  </span>
                  <strong style={{ display: 'block', marginTop: 6 }}>
                    <Highlight text={h.title} query={q} />
                  </strong>
                  <span className="small muted" style={{ display: 'block', marginTop: 2 }}>
                    <Highlight text={h.principle || h.snippet} query={q} />
                  </span>
                </span>
                <Icon name="arrowRight" size={18} />
              </a>
            ))}
            {hits.length === 0 && <div className="empty">見つかりませんでした。別の言葉や、タグ（#なし）で試してください。</div>}
          </div>
        </>
      )}
    </div>
  );
}
