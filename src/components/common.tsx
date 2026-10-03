import type { ReactNode } from 'react';
import { categoryOf } from '../shared/categories.ts';
import { PRINCIPLE_STATES } from '../shared/questions.ts';
import type { CategoryId, PrincipleState } from '../shared/types.ts';
import { Icon, type IconName } from './Icon.tsx';

export function CategoryChip({ category, full = false }: { category: CategoryId | 'connect'; full?: boolean }) {
  if (category === 'connect') return <span className="chip">CONNECT</span>;
  const c = categoryOf(category);
  return (
    <span className="chip" data-cat={category} title={c.label}>
      {full ? c.label : c.short}
    </span>
  );
}

export function StateBadge({ state }: { state: PrincipleState }) {
  const s = PRINCIPLE_STATES.find((x) => x.id === state);
  return (
    <span className="state-badge" data-state={state} title={s?.ja}>
      {s?.label ?? state}
    </span>
  );
}

export function StateSelect({ value, onChange }: { value: PrincipleState; onChange: (s: PrincipleState) => void }) {
  return (
    <select className="select" value={value} onChange={(e) => onChange(e.target.value as PrincipleState)} aria-label="状態">
      {PRINCIPLE_STATES.map((s) => (
        <option key={s.id} value={s.id}>
          {s.label}（{s.ja}）
        </option>
      ))}
    </select>
  );
}

export function Notice({
  kind = 'info',
  icon = 'info',
  children,
  action,
}: {
  kind?: 'info' | 'warn' | 'paused';
  icon?: IconName;
  children: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className={`notice ${kind === 'info' ? '' : kind}`} role={kind === 'paused' ? 'alert' : undefined}>
      <Icon name={icon} size={18} />
      <div className="notice-body">{children}</div>
      {action}
    </div>
  );
}

export function SectionLabel({ title, kicker }: { title: string; kicker?: string }) {
  return (
    <div className="section-label">
      {kicker && <span className="q-label">{kicker}</span>}
      <h2>{title}</h2>
      <span className="line" />
    </div>
  );
}

export function Loading({ label = '読み込み中…' }: { label?: string }) {
  return (
    <div className="empty" aria-busy="true">
      {label}
    </div>
  );
}

export function ErrorBox({ message }: { message: string }) {
  return (
    <Notice kind="warn" icon="info">
      {message}
    </Notice>
  );
}

export function PageHead({ kicker, title, sub, right }: { kicker: string; title: string; sub?: ReactNode; right?: ReactNode }) {
  return (
    <div className="page-head">
      <div>
        <div className="page-kicker">{kicker}</div>
        <h1 className="page-title">{title}</h1>
        {sub && <p className="page-sub">{sub}</p>}
      </div>
      {right}
    </div>
  );
}

/** 事実と AI の解釈をはっきり分けて表示する */
export function FactBox({ children, source }: { children: ReactNode; source?: ReactNode }) {
  return (
    <div className="fact-box">
      <div className="box-label">
        <Icon name="book" size={15} /> 事実（情報源に書かれていること）
      </div>
      <div>{children}</div>
      {source && <div className="small muted" style={{ marginTop: 8 }}>{source}</div>}
    </div>
  );
}

export function AiBox({ title = 'AIの解釈（仮説・まだ正解ではない）', children }: { title?: string; children: ReactNode }) {
  return (
    <div className="ai-box">
      <div className="box-label">
        <Icon name="spark" size={15} /> {title}
      </div>
      <div>{children}</div>
    </div>
  );
}

export function ExternalLink({ href, children }: { href: string; children: ReactNode }) {
  if (!/^https?:\/\//.test(href)) return <span>{children}</span>;
  return (
    <a href={href} target="_blank" rel="noopener noreferrer">
      {children} <Icon name="external" size={13} />
    </a>
  );
}
