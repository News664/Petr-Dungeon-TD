import type { FloorData } from '../sim';
import type { ViewMarker } from './DungeonView';

interface Props {
  floor: FloorData;
  floorId: string;
  discovered: string[] | undefined;
  x: number;
  y: number;
  facing: number;
  openGates: string[];
  markers: ViewMarker[];
}

const S = 20;
const GLYPH: Record<string, { text: string; color: string }> = {
  E: { text: 'E', color: 'var(--ward)' },
  '>': { text: '▼', color: 'var(--ward)' },
  '<': { text: '▲', color: 'var(--ward)' },
  G: { text: '◆', color: 'var(--amber)' },
  B: { text: 'B', color: 'var(--danger)' },
  X: { text: '?', color: 'var(--danger)' },
  K: { text: 'k', color: 'var(--amber)' },
  $: { text: '▣', color: 'var(--amber)' },
  '^': { text: '!', color: 'var(--danger)' },
  L: { text: '▮', color: 'var(--stone)' },
  C: { text: '✦', color: 'var(--divine)' },
};

/** The party's own chart of the floor: only what it has seen. */
export function AutoMap({ floor, floorId, discovered, x, y, facing, openGates, markers }: Props) {
  const width = floor.grid[0]?.length ?? 0;
  const height = floor.grid.length;
  const seen = (cx: number, cy: number) => discovered?.[cy]?.[cx] === '1';
  return (
    <svg className="automap" viewBox={`0 0 ${width * S} ${height * S}`} role="img" aria-label={`Map of ${floor.name}`}>
      <rect width={width * S} height={height * S} fill="var(--bg-inset)" />
      {floor.grid.flatMap((row, cy) =>
        [...row].map((tile, cx) => {
          if (!seen(cx, cy)) return null;
          const wall = tile === '#';
          const gateShut = tile === '=' && !openGates.includes(`${floorId}:${cx},${cy}`);
          const glyph = GLYPH[tile];
          return (
            <g key={`${cx},${cy}`}>
              <rect x={cx * S} y={cy * S} width={S} height={S} fill={wall ? '#2b3038' : tile === '~' ? '#3a3f52' : tile === 'w' ? '#1f3a52' : '#1b1f25'} stroke="#0d0f12" strokeWidth={1} />
              {gateShut && <rect x={cx * S + S / 2 - 2} y={cy * S + 2} width={4} height={S - 4} fill="var(--stone)" />}
              {tile === '~' && (
                <text x={cx * S + S / 2} y={cy * S + S / 2 + 4} textAnchor="middle" fontSize={12} fill="#aab2cc">
                  ≈
                </text>
              )}
              {tile === 'w' && (
                <text x={cx * S + S / 2} y={cy * S + S / 2 + 4} textAnchor="middle" fontSize={12} fill="#5a8fb8">
                  ≋
                </text>
              )}
              {glyph && (
                <text x={cx * S + S / 2} y={cy * S + S / 2 + 4} textAnchor="middle" fontSize={11} fontWeight={700} fill={glyph.color}>
                  {glyph.text}
                </text>
              )}
            </g>
          );
        }),
      )}
      {markers.map((m) =>
        m.kind === 'boss' ? null : (
          <circle
            key={`${m.kind}${m.x},${m.y}`}
            cx={m.x * S + S / 2}
            cy={m.y * S + S / 2}
            r={m.kind === 'elite' ? 6 : 4}
            fill={m.kind === 'elite' ? 'var(--danger)' : 'var(--stone)'}
            stroke="#0d0f12"
          />
        ),
      )}
      <polygon
        points={`0,${-S * 0.36} ${S * 0.28},${S * 0.3} ${-S * 0.28},${S * 0.3}`}
        fill="var(--text)"
        transform={`translate(${x * S + S / 2} ${y * S + S / 2}) rotate(${facing * 90})`}
      />
    </svg>
  );
}
