import { useState } from 'react';
import type { CategoryId } from '../shared/types.ts';

// サムネイル。画像 URL があれば使い、無い・読み込めないときはカテゴリごとの図形を描く。
// 図形は「その分野の構造」を抽象化した静かなモチーフにしている。

interface ThumbProps {
  category: CategoryId;
  seed: string;
  image?: string;
  className?: string;
  alt?: string;
}

export function Thumb({ category, seed, image, className, alt = '' }: ThumbProps) {
  const [failed, setFailed] = useState(false);
  return (
    <div className={`thumb ${className ?? ''}`}>
      {image && !failed ? (
        <img src={image} alt={alt} loading="lazy" referrerPolicy="no-referrer" onError={() => setFailed(true)} />
      ) : (
        <Motif category={category} seed={seed} />
      )}
    </div>
  );
}

function hashString(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function rng(seed: string) {
  let a = hashString(seed) || 1;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const PALETTE: Record<CategoryId, { a: string; b: string; ink: string; soft: string }> = {
  nature: { a: '#f0f9f3', b: '#d9efe2', ink: '#1f8a54', soft: '#7cc39c' },
  tech: { a: '#f1f5ff', b: '#dbe5fb', ink: '#2c5fd6', soft: '#93aeea' },
  science: { a: '#eef9f7', b: '#d3ece8', ink: '#0f8b7d', soft: '#7fc4bb' },
  mind: { a: '#f5f2fe', b: '#e3dcfa', ink: '#6a51cf', soft: '#b3a5ea' },
  build: { a: '#eef7fc', b: '#d3e9f5', ink: '#1b7fae', soft: '#86bfdc' },
  culture: { a: '#fdf3f4', b: '#f6dde1', ink: '#c2414b', soft: '#e3a0a7' },
  foreign: { a: '#f0f1fb', b: '#dadef3', ink: '#3b4293', soft: '#9ba1d6' },
};

export function Motif({ category, seed }: { category: CategoryId; seed: string }) {
  const p = PALETTE[category];
  const r = rng(`${category}:${seed}`);
  const gid = `g-${hashString(seed + category).toString(36)}`;
  return (
    <svg viewBox="0 0 120 120" role="img" aria-label="">
      <defs>
        <linearGradient id={gid} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor={p.a} />
          <stop offset="1" stopColor={p.b} />
        </linearGradient>
      </defs>
      <rect width="120" height="120" fill={`url(#${gid})`} />
      {renderMotif(category, r, p)}
    </svg>
  );
}

type Rand = () => number;
type Pal = (typeof PALETTE)[CategoryId];

function renderMotif(category: CategoryId, r: Rand, p: Pal) {
  switch (category) {
    case 'nature':
      return network(r, p);
    case 'tech':
      return swarm(r, p);
    case 'science':
      return grains(r, p);
    case 'mind':
      return choice(r, p);
    case 'build':
      return tower(r, p);
    case 'culture':
      return cycle(r, p);
    case 'foreign':
      return lens(r, p);
  }
}

// 粘菌・ネットワーク：全点をつなぐ最小の網（最小全域木）に、少しだけ冗長な道を足す
function network(r: Rand, p: Pal) {
  const pts = Array.from({ length: 9 }, () => [16 + r() * 88, 16 + r() * 88] as const);
  const dist = (i: number, j: number) => Math.hypot(pts[i][0] - pts[j][0], pts[i][1] - pts[j][1]);
  const edges: { a: number; b: number; w: number }[] = [];
  const inTree = new Set([0]);
  while (inTree.size < pts.length) {
    let best = { a: 0, b: 0, d: Infinity };
    for (const i of inTree) {
      for (let j = 0; j < pts.length; j++) {
        if (!inTree.has(j) && dist(i, j) < best.d) best = { a: i, b: j, d: dist(i, j) };
      }
    }
    inTree.add(best.b);
    edges.push({ a: best.a, b: best.b, w: 1.6 + r() * 3.6 });
  }
  for (let k = 0; k < 2; k++) {
    const a = Math.floor(r() * pts.length);
    const b = (a + 2 + Math.floor(r() * 3)) % pts.length;
    if (!edges.some((e) => (e.a === a && e.b === b) || (e.a === b && e.b === a))) edges.push({ a, b, w: 1.2 });
  }
  return (
    <g strokeLinecap="round">
      {edges.map((e, k) => (
        <path
          key={k}
          d={`M${pts[e.a][0]} ${pts[e.a][1]} Q ${(pts[e.a][0] + pts[e.b][0]) / 2 + (r() - 0.5) * 14} ${(pts[e.a][1] + pts[e.b][1]) / 2 + (r() - 0.5) * 14} ${pts[e.b][0]} ${pts[e.b][1]}`}
          stroke={e.w > 3 ? p.ink : p.soft}
          strokeWidth={e.w}
          fill="none"
          opacity={0.85}
        />
      ))}
      {pts.map((pt, k) => (
        <circle key={k} cx={pt[0]} cy={pt[1]} r={3 + r() * 2.5} fill="#fff" stroke={p.ink} strokeWidth={2} />
      ))}
    </g>
  );
}

// 群れ：点の格子のうち「星形の内側」だけが濃い
function swarm(r: Rand, p: Pal) {
  const rot = r() * Math.PI * 2;
  const star: [number, number][] = Array.from({ length: 10 }, (_, i) => {
    const rad = i % 2 === 0 ? 46 : 20;
    const a = rot + (i * Math.PI) / 5;
    return [60 + rad * Math.cos(a), 60 + rad * Math.sin(a)];
  });
  const inside = (x: number, y: number) => {
    let c = false;
    for (let i = 0, j = star.length - 1; i < star.length; j = i++) {
      const [xi, yi] = star[i];
      const [xj, yj] = star[j];
      if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) c = !c;
    }
    return c;
  };
  const dots: { x: number; y: number; on: boolean }[] = [];
  for (let y = 10; y <= 110; y += 8) {
    for (let x = 10; x <= 110; x += 8) {
      const jx = x + (r() - 0.5) * 2;
      const jy = y + (r() - 0.5) * 2;
      const on = inside(jx, jy);
      if (on || r() < 0.18) dots.push({ x: jx, y: jy, on });
    }
  }
  return (
    <g>
      {dots.map((d, k) => (
        <circle key={k} cx={d.x} cy={d.y} r={d.on ? 2.7 : 1.8} fill={d.on ? p.ink : p.soft} opacity={d.on ? 0.92 : 0.55} />
      ))}
    </g>
  );
}

// 粒：小さい粒が下、大きい粒が上
function grains(r: Rand, p: Pal) {
  const small = Array.from({ length: 70 }, () => ({ x: 20 + r() * 80, y: 62 + r() * 40, s: 2.2 + r() * 1.6 }));
  const big = Array.from({ length: 4 }, (_, i) => ({ x: 28 + i * 21 + (r() - 0.5) * 6, y: 36 + r() * 12, s: 8 + r() * 4 }));
  return (
    <g>
      <rect x="14" y="20" width="92" height="88" rx="10" fill="#fff" opacity={0.55} stroke={p.soft} strokeWidth={1.5} />
      {small.map((g, k) => (
        <circle key={k} cx={g.x} cy={g.y} r={g.s} fill={k % 4 === 0 ? p.ink : p.soft} opacity={0.75} />
      ))}
      {big.map((g, k) => (
        <circle key={`b${k}`} cx={g.x} cy={g.y} r={g.s} fill="#fff" stroke={p.ink} strokeWidth={2.2} />
      ))}
      <path d="M8 14c4-3 8 3 12 0M100 14c4-3 8 3 12 0" stroke={p.ink} strokeWidth={1.6} fill="none" strokeLinecap="round" />
    </g>
  );
}

// 選択：既定値（最初からチェック済み）の行と、空の行
function choice(r: Rand, p: Pal) {
  const def = Math.floor(r() * 3);
  return (
    <g>
      {[0, 1, 2].map((i) => {
        const y = 26 + i * 26;
        const on = i === def;
        return (
          <g key={i}>
            <rect x="18" y={y} width="84" height="18" rx="9" fill="#fff" opacity={on ? 1 : 0.7} stroke={on ? p.ink : p.soft} strokeWidth={1.6} />
            <circle cx="29" cy={y + 9} r="5.5" fill={on ? p.ink : '#fff'} stroke={on ? p.ink : p.soft} strokeWidth={1.6} />
            {on && <path d={`M26.2 ${y + 9.2}l2 2 3.6-4`} stroke="#fff" strokeWidth={1.6} fill="none" strokeLinecap="round" />}
            <rect x="40" y={y + 6.5} width={on ? 46 : 30 + r() * 20} height="5" rx="2.5" fill={on ? p.ink : p.soft} opacity={on ? 0.8 : 0.6} />
          </g>
        );
      })}
      <path d="M66 98l6 14 3-6 6-2z" fill={p.ink} opacity={0.85} />
    </g>
  );
}

// 塔と気流
function tower(r: Rand, p: Pal) {
  const x = 42 + r() * 12;
  return (
    <g strokeLinecap="round" strokeLinejoin="round">
      <path d="M0 104h120" stroke={p.soft} strokeWidth={2} />
      <rect x={x - 26} y="74" width="62" height="30" rx="2" fill="#fff" stroke={p.ink} strokeWidth={2} />
      <rect x={x} y="30" width="20" height="48" fill="#fff" stroke={p.ink} strokeWidth={2} />
      {[0, 1, 2].map((i) => (
        <rect key={i} x={x + 3 + i * 5} y="34" width="3" height="12" rx="1" fill={p.ink} opacity={0.75} />
      ))}
      <path d={`M8 34c14 0 22 2 ${x - 10} 6`} stroke={p.ink} strokeWidth={2} fill="none" />
      <path d={`M${x - 10} 40l2 -5M${x - 10} 40l-5 -2`} stroke={p.ink} strokeWidth={2} />
      <path d={`M10 52c12 0 20 2 ${x - 12} 4`} stroke={p.soft} strokeWidth={2} fill="none" />
      <path d={`M${x + 10} 26c0 -8 8 -14 18 -14M${x + 30} 18c6 -4 10 -8 12 -12`} stroke={p.soft} strokeWidth={2} fill="none" />
      <path d={`M${x + 10} 86c-6 0 -10 4 -10 8`} stroke={p.ink} strokeWidth={1.6} fill="none" opacity={0.6} />
    </g>
  );
}

// 周期：作り直しの循環と、ふたつの社殿
function cycle(r: Rand, p: Pal) {
  const rot = Math.floor(r() * 360);
  return (
    <g strokeLinecap="round" strokeLinejoin="round" fill="none">
      <g transform={`rotate(${rot} 60 60)`}>
        <path d="M60 22a38 38 0 0 1 36 26" stroke={p.ink} strokeWidth={2.4} />
        <path d="M96 48l1-9M96 48l-8-3" stroke={p.ink} strokeWidth={2.4} />
        <path d="M60 98a38 38 0 0 1-36-26" stroke={p.soft} strokeWidth={2.4} />
        <path d="M24 72l-1 9M24 72l8 3" stroke={p.soft} strokeWidth={2.4} />
      </g>
      {[38, 82].map((cx, i) => (
        <g key={i} opacity={i === 0 ? 1 : 0.55}>
          <path d={`M${cx - 15} 58l15-9 15 9`} stroke={p.ink} strokeWidth={2} />
          <rect x={cx - 11} y="58" width="22" height="16" fill="#fff" stroke={p.ink} strokeWidth={2} />
          <path d={`M${cx - 4} 74v-8h8v8`} stroke={p.ink} strokeWidth={1.6} />
        </g>
      ))}
    </g>
  );
}

// レンズ：同心の輪（フレネル）と、そろう光
function lens(r: Rand, p: Pal) {
  const cx = 40 + r() * 6;
  return (
    <g fill="none" strokeLinecap="round">
      {[0, 1, 2, 3, 4].map((i) => (
        <path key={i} d={`M${cx - 2 - i * 2} ${18 + i * 2}c${10 - i} 14 ${10 - i} 70 0 84`} stroke={i % 2 ? p.soft : p.ink} strokeWidth={2.2 - i * 0.2} />
      ))}
      {[0, 1, 2, 3, 4, 5].map((i) => {
        const y = 30 + i * 12;
        return <path key={`r${i}`} d={`M${cx + 14} ${y}H112`} stroke={p.ink} strokeWidth={1.4} opacity={0.35 + (i % 3) * 0.2} />;
      })}
      {[0, 1, 2, 3, 4, 5].map((i) => {
        const y = 30 + i * 12;
        return <path key={`l${i}`} d={`M10 60L${cx - 4} ${y}`} stroke={p.soft} strokeWidth={1.2} opacity={0.8} />;
      })}
      <circle cx="10" cy="60" r="4" fill={p.ink} />
    </g>
  );
}
