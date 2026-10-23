import React from 'react';

export type TagVariant = 'ok' | 'warn' | 'err';

export interface TagProps {
  variant: TagVariant;
  children: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
}

export const Tag: React.FC<TagProps> = ({
  variant,
  children,
  className = '',
  style,
}) => {
  const colorVar =
    variant === 'ok'
      ? 'var(--ok)'
      : variant === 'warn'
      ? 'var(--warn)'
      : 'var(--err)';

  return (
    <span
      style={{
        display: 'inline-block',
        fontSize: '10px',
        fontWeight: 700,
        letterSpacing: '0.06em',
        textTransform: 'uppercase',
        padding: '3px 8px',
        borderRadius: '999px',
        border: '1px solid currentColor',
        color: colorVar,
        lineHeight: 1.3,
        fontFamily: 'var(--font)',
        whiteSpace: 'nowrap',
        ...style,
      }}
      className={className}
    >
      {children}
    </span>
  );
};
