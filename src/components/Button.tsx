import React from 'react';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'ghost' | 'danger';
  size?: 'normal' | 'sm';
  fullWidth?: boolean;
  children: React.ReactNode;
}

export const Button: React.FC<ButtonProps> = ({
  variant = 'primary',
  size = 'normal',
  fullWidth = true,
  className = '',
  disabled,
  children,
  ...props
}) => {
  const isPrimary = variant === 'primary';
  const isDanger = variant === 'danger';
  const isSmall = size === 'sm';

  return (
    <button
      disabled={disabled}
      style={{
        minHeight: isSmall ? '40px' : 'var(--tap)',
        width: fullWidth ? '100%' : 'auto',
        borderRadius: 'var(--r-btn)',
        background: isPrimary ? 'var(--grad)' : 'transparent',
        border: isPrimary ? '0' : `1px solid ${isDanger ? 'var(--err)' : 'var(--line)'}`,
        color: isPrimary ? 'var(--ink)' : isDanger ? 'var(--err)' : 'var(--text)',
        fontFamily: 'var(--font)',
        fontWeight: isPrimary ? 800 : 600,
        fontSize: isSmall ? '13px' : '15px',
        padding: isSmall ? '0 14px' : '0 18px',
        opacity: disabled ? 0.45 : 1,
        cursor: disabled ? 'not-allowed' : 'pointer',
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        transition: 'opacity 0.15s ease',
      }}
      className={`select-none focus-visible:outline-2 focus-visible:outline-[var(--a1)] ${className}`}
      {...props}
    >
      {children}
    </button>
  );
};
