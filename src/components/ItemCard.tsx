import { markActive } from '../data/heartbeat.ts';
import { toggleSaved } from '../data/store.ts';
import { toast } from '../data/toast.ts';
import { href } from '../router.ts';
import { formatDotDate } from '../shared/time.ts';
import type { DailyItem } from '../shared/types.ts';
import { CategoryChip } from './common.tsx';
import { Icon } from './Icon.tsx';
import { Thumb } from './Thumb.tsx';

export function onToggleSave(item: DailyItem) {
  const saved = toggleSaved(item);
  markActive();
  toast(saved ? 'DIARY に保存しました' : 'DIARY から外しました');
}

export function ItemCard({
  item,
  index,
  compact = false,
  highlight = false,
  saved,
}: {
  item: DailyItem;
  index: number;
  compact?: boolean;
  highlight?: boolean;
  saved: boolean;
}) {
  return (
    <article className={`card ${compact ? 'compact' : ''} ${highlight ? 'potd' : ''}`} aria-labelledby={`t-${item.id}`}>
      <div className="card-top">
        <span className={`num-badge ${highlight ? 'blue' : ''}`}>{index}</span>
        <CategoryChip category={item.category} />
        {highlight && (
          <span className="small muted" title="PRINCIPLE OF THE DAY">
            <Icon name="crown" size={14} />
          </span>
        )}
      </div>
      <div className="card-body">
        <div>
          <h2 className="card-title" id={`t-${item.id}`}>
            <a href={href('/read', { id: item.id })}>{item.title}</a>
          </h2>
          <p className="card-hook">{item.hook}</p>
        </div>
        <Thumb category={item.category} seed={item.id} image={item.image} />
      </div>
      <div className="card-meta">
        <span className="src">{item.sourceName || item.sourceTitle}</span>
        <span>{formatDotDate(item.sourceDate || item.date)}</span>
      </div>
      <div className="card-actions">
        <a className={`btn ${highlight ? 'primary' : ''}`} href={href('/read', { id: item.id })}>
          <Icon name="read" size={16} /> 読む
        </a>
        <a className="btn" href={href('/deep', { id: item.id })}>
          <Icon name="search" size={16} /> 掘る
        </a>
        <button type="button" className={`btn ${saved ? 'saved' : ''}`} onClick={() => onToggleSave(item)} aria-pressed={saved}>
          <Icon name={saved ? 'bookmarkFill' : 'bookmark'} size={16} /> {saved ? '保存済み' : '保存'}
        </button>
      </div>
    </article>
  );
}
