import { href } from '../router.ts';
import { FAILED_LABEL, isAnalysisFailed } from '../shared/item-status.ts';
import { getLightDeep } from '../shared/light-deep.ts';
import { formatDotDate } from '../shared/time.ts';
import type { DailyItem, UserDecision } from '../shared/types.ts';
import { CategoryChip } from './common.tsx';
import { Icon } from './Icon.tsx';
import { DecisionBadge, DecisionBar, LightDeepLines } from './loop.tsx';
import { Thumb } from './Thumb.tsx';

/** DAILY の 1 件：見出し → LIGHT DEEP の3行 → HUMAN SELECT。AI はここで止まる */
export function ItemCard({
  item,
  index,
  compact = false,
  highlight = false,
  decision,
}: {
  item: DailyItem;
  index: number;
  compact?: boolean;
  highlight?: boolean;
  decision?: UserDecision;
}) {
  const failed = isAnalysisFailed(item);
  const light = getLightDeep(item);
  return (
    <article
      className={`card ${compact ? 'compact' : ''} ${highlight && !failed ? 'potd' : ''} ${failed ? 'failed' : ''} ${decision === 'ARCHIVE' ? 'archived' : ''}`}
      aria-labelledby={`t-${item.id}`}
    >
      <div className="card-top">
        <span className={`num-badge ${highlight && !failed ? 'blue' : ''}`}>{index}</span>
        <CategoryChip category={item.category} />
        {failed && <span className="fail-badge">{FAILED_LABEL}</span>}
        {highlight && !failed && (
          <span className="small muted" title="PRINCIPLE OF THE DAY">
            <Icon name="crown" size={14} />
          </span>
        )}
        <span style={{ marginLeft: 'auto' }}>{decision && <DecisionBadge decision={decision} />}</span>
      </div>
      <div className="card-body">
        <div>
          <h2 className="card-title" id={`t-${item.id}`}>
            <a href={href('/deep', { id: item.id })}>{item.title}</a>
          </h2>
          {failed ? (
            <p className="card-hook">
              <span className="fail-note">AI の分析を作れませんでした（{item.failReason || '理由不明'}）。</span>
              {item.hook}
            </p>
          ) : (
            !light && <p className="card-hook">{item.hook}</p>
          )}
        </div>
        <Thumb category={item.category} seed={item.id} image={item.image} />
      </div>
      {!failed && light && <LightDeepLines value={light} compact />}
      <div className="card-meta">
        <span className="src">{item.sourceName || item.sourceTitle}</span>
        <span>{formatDotDate(item.sourceDate || item.date)}</span>
        <a className="card-open" href={href('/deep', { id: item.id })}>
          開く <Icon name="arrowRight" size={12} />
        </a>
      </div>
      <DecisionBar item={item} current={decision} compact />
    </article>
  );
}
