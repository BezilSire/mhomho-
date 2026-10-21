import React from 'react';

export interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
}

export const Card: React.FC<CardProps> = ({ children, className = '', style, ...props }) => {
  return (
    <div
      style={{
        backgroundColor: 'var(--surface)',
        border: '1px solid var(--line)',
        borderRadius: 'var(--r-card)',
        padding: '14px',
        marginBottom: '12px',
        boxShadow: 'none',
        ...style,
      }}
      className={className}
      {...props}
    >
      {children}
    </div>
  );
};
