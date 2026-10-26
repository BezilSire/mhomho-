import React from 'react';
import {
  Cloud,
  Flame,
  Flower2,
  Gem,
  Heart,
  Leaf,
  Moon,
  Mountain,
  Orbit,
  PawPrint,
  Smile,
  Sparkles,
  Star,
  Sun,
  Waves,
  Zap,
  type LucideIcon,
} from 'lucide-react';
import {
  AVATAR_KEYS,
  DEFAULT_AVATAR_KEY,
  normalizeAvatarKey,
  type AvatarKey,
} from '../../shared/community.ts';

export interface AvatarOption {
  key: AvatarKey;
  label: string;
  from: string;
  to: string;
  Icon: LucideIcon;
}

/**
 * Preset avatars are code, not uploads. Each option is a tiny gradient + icon
 * pair, so changing a profile picture costs a few bytes in D1.
 */
export const AVATAR_OPTIONS: AvatarOption[] = [
  { key: 'sun', label: 'Sunrise', from: '#F59E0B', to: '#EF4444', Icon: Sun },
  { key: 'wave', label: 'Wave', from: '#0EA5E9', to: '#2563EB', Icon: Waves },
  { key: 'leaf', label: 'Leaf', from: '#22C55E', to: '#0F766E', Icon: Leaf },
  { key: 'bolt', label: 'Bolt', from: '#FACC15', to: '#F97316', Icon: Zap },
  { key: 'star', label: 'Star', from: '#A78BFA', to: '#7C3AED', Icon: Star },
  { key: 'moon', label: 'Moon', from: '#64748B', to: '#1E293B', Icon: Moon },
  { key: 'heart', label: 'Heart', from: '#FB7185', to: '#E11D48', Icon: Heart },
  { key: 'flower', label: 'Flower', from: '#F472B6', to: '#BE185D', Icon: Flower2 },
  { key: 'mountain', label: 'Mountain', from: '#84CC16', to: '#15803D', Icon: Mountain },
  { key: 'orbit', label: 'Orbit', from: '#22D3EE', to: '#4338CA', Icon: Orbit },
  { key: 'spark', label: 'Spark', from: '#FDE047', to: '#F59E0B', Icon: Sparkles },
  { key: 'cloud', label: 'Cloud', from: '#93C5FD', to: '#60A5FA', Icon: Cloud },
  { key: 'flame', label: 'Flame', from: '#FB923C', to: '#DC2626', Icon: Flame },
  { key: 'gem', label: 'Gem', from: '#2DD4BF', to: '#0D9488', Icon: Gem },
  { key: 'paw', label: 'Paw', from: '#FDBA74', to: '#C2410C', Icon: PawPrint },
  { key: 'smile', label: 'Smile', from: '#FCD34D', to: '#F59E0B', Icon: Smile },
];

const AVATAR_BY_KEY = new Map(AVATAR_OPTIONS.map((option) => [option.key, option]));

function fallbackOption(handle: string): AvatarOption {
  let hash = 0;
  for (let index = 0; index < handle.length; index += 1) {
    hash = (hash * 31 + handle.charCodeAt(index)) >>> 0;
  }
  return AVATAR_OPTIONS[hash % AVATAR_OPTIONS.length] ?? AVATAR_OPTIONS[0];
}

export interface AvatarProps {
  avatarKey?: string | null;
  handle?: string;
  size?: number;
  className?: string;
  title?: string;
}

export const Avatar: React.FC<AvatarProps> = ({
  avatarKey,
  handle = '',
  size = 40,
  className = '',
  title,
}) => {
  const option = avatarKey ? AVATAR_BY_KEY.get(normalizeAvatarKey(avatarKey)) : undefined;
  const fallback = option ?? fallbackOption(handle);
  const label = title || (option ? option.label : `${handle || 'Creator'} initials`);
  const initials =
    handle.replace(/^@/, '').trim().slice(0, 2).toUpperCase() || 'MH';

  return (
    <span
      className={`inline-grid shrink-0 place-items-center overflow-hidden rounded-full text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.18)] ${className}`}
      style={{
        width: size,
        height: size,
        background: `linear-gradient(135deg, ${fallback.from}, ${fallback.to})`,
      }}
      title={label}
      aria-label={label}
    >
      {option ? (
        <option.Icon
          size={Math.max(14, Math.round(size * 0.44))}
          strokeWidth={2.1}
          aria-hidden="true"
        />
      ) : (
        <span
          className="font-extrabold leading-none"
          style={{ fontSize: Math.max(10, Math.round(size * 0.34)) }}
        >
          {initials}
        </span>
      )}
    </span>
  );
};

export interface AvatarPickerProps {
  value: string;
  onChange: (key: AvatarKey) => void;
  handle?: string;
}

export const AvatarPicker: React.FC<AvatarPickerProps> = ({ value, onChange, handle }) => {
  const current = normalizeAvatarKey(value || DEFAULT_AVATAR_KEY);
  return (
    <div className="grid grid-cols-8 gap-2" role="radiogroup" aria-label="Choose an avatar">
      {AVATAR_KEYS.map((key) => {
        const option = AVATAR_BY_KEY.get(key) ?? AVATAR_OPTIONS[0];
        const selected = key === current;
        return (
          <button
            key={key}
            type="button"
            role="radio"
            aria-checked={selected}
            aria-label={option.label}
            title={option.label}
            onClick={() => onChange(key)}
            className={`relative grid aspect-square place-items-center rounded-full transition-transform cursor-pointer ${
              selected
                ? 'scale-105 ring-2 ring-[var(--text)] ring-offset-2 ring-offset-[var(--surface)]'
                : 'opacity-80 hover:scale-105 hover:opacity-100'
            }`}
            style={{ background: `linear-gradient(135deg, ${option.from}, ${option.to})` }}
          >
            <option.Icon
              size={18}
              strokeWidth={2.1}
              className="text-white"
              aria-hidden="true"
            />
          </button>
        );
      })}
      {handle ? <span className="sr-only">Avatar for {handle}</span> : null}
    </div>
  );
};
