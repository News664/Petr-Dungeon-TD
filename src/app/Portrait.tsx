import { createContext, useContext } from 'react';
import { portraitFor } from '../art/manifest';
import type { ArtManifest } from '../art/manifest';
import type { Adventurer } from '../sim';

/** Loaded once at start-up from public/art/manifest.json. Null until it arrives, or if there is none. */
export const ArtContext = createContext<ArtManifest | null>(null);

export const CLASS_COLOR: Record<string, string> = { Guardian: '#6f9bd8', Gunner: '#d8a64a', Alchemist: '#b07fd8', Medic: '#74c7b6' };

/** Simple class emblems, drawn in a 24x24 box. */
const EMBLEM: Record<string, string> = {
  Guardian: 'M12 3 L19 6 V12 C19 16.5 16 19.5 12 21 C8 19.5 5 16.5 5 12 V6 Z',
  Gunner: 'M12 4 A8 8 0 1 0 12 20 A8 8 0 1 0 12 4 M12 2 V8 M12 16 V22 M2 12 H8 M16 12 H22',
  Alchemist: 'M10 3 H14 V9 L19 19 C19.6 20.3 18.8 21 17.5 21 H6.5 C5.2 21 4.4 20.3 5 19 L10 9 Z M8 15 H16',
  Medic: 'M10 4 H14 V10 H20 V14 H14 V20 H10 V14 H4 V10 H10 Z',
};

type Subject = Pick<Adventurer, 'name' | 'classId' | 'gauge' | 'condition'>;

/**
 * A character's picture. Uses her art from the manifest when it exists
 * (matched by her name in lower case), then her class's shared art (matched
 * by the class name in lower case); otherwise a class emblem that greys over
 * from the bottom as the stone creeps up.
 */
export function Portrait({ adv, size = 36 }: { adv: Subject; size?: number }) {
  const manifest = useContext(ArtContext);
  // Her own pictures if they exist; otherwise the shared pictures for her class, if those exist.
  const art = manifest?.characters.find((c) => c.id === adv.name.toLowerCase()) ?? manifest?.characters.find((c) => c.id === adv.classId.toLowerCase());
  const label = `${adv.name}, ${adv.classId}`;
  if (manifest && art) {
    const picture = portraitFor(art, { gauge: adv.gauge, condition: adv.condition });
    return <img className="portrait" src={`./${manifest.basePath}/${picture.file}`} alt={label} title={label} width={size} height={size} style={{ objectFit: 'cover', objectPosition: 'top' }} />;
  }
  const stone = adv.condition === 'ready' ? adv.gauge : 100;
  const color = CLASS_COLOR[adv.classId] ?? '#8a8f99';
  const clip = `stone-${adv.name}-${size}`;
  return (
    <svg className="portrait" width={size} height={size} viewBox="0 0 24 24" role="img" aria-label={label}>
      <title>{label}</title>
      <defs>
        <clipPath id={clip}>
          <rect x="0" y={24 - (24 * stone) / 100} width="24" height="24" />
        </clipPath>
      </defs>
      <rect width="24" height="24" rx="5" fill="#15181d" />
      <path d={EMBLEM[adv.classId] ?? EMBLEM.Guardian} fill="none" stroke={color} strokeWidth="1.6" strokeLinejoin="round" strokeLinecap="round" transform="translate(3 3) scale(0.75)" />
      <g clipPath={`url(#${clip})`}>
        <rect width="24" height="24" rx="5" fill={adv.condition === 'lost' ? '#3a3d42' : '#6d727a'} />
        <path d={EMBLEM[adv.classId] ?? EMBLEM.Guardian} fill="none" stroke="#c9ccd1" strokeWidth="1.6" strokeLinejoin="round" strokeLinecap="round" transform="translate(3 3) scale(0.75)" />
      </g>
      <rect x="0.5" y="0.5" width="23" height="23" rx="4.5" fill="none" stroke={adv.condition === 'ready' ? color : '#8a8f99'} strokeOpacity="0.7" />
    </svg>
  );
}
