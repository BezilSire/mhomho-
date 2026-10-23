import React from 'react';
import { CROWD_PATHS } from './mhomhoLogoPaths.ts';

export interface MhomhoLogoProps {
  /** Optional rendered height. Width follows the 664:310 aspect ratio. */
  height?: number;
  className?: string;
  title?: string;
}

/**
 * Official Mhomho logo: the faceted M standing in front of a crowd, with the
 * HOMHO wordmark. Transparent background so it sits on any surface.
 */
export const MhomhoLogo: React.FC<MhomhoLogoProps> = ({
  height,
  className = '',
  title = 'Mhomho Media',
}) => {
  // Unique gradient/def IDs so multiple logos can live on the same page.
  const rawId = React.useId();
  const id = (name: string) => `${rawId.replace(/[^a-zA-Z0-9_-]/g, '')}${name}`;
  const ref = (name: string) => `url(#${id(name)})`;

  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="12 612 664 310"
      role="img"
      aria-label={title}
      className={className}
      style={height ? { height, width: 'auto' } : undefined}
    >
      <title>{title}</title>
      <defs>
        <linearGradient id={id('gB')} gradientUnits="userSpaceOnUse" x1="549.9" y1="424.6" x2="332.1" y2="256.4">
          <stop offset="0" stopColor="#A5001C" />
          <stop offset="1" stopColor="#FFFF3D" />
        </linearGradient>
        <linearGradient id={id('g_f1')} gradientUnits="userSpaceOnUse" x1="394.7" y1="528.1" x2="317.6" y2="425">
          <stop offset="0" stopColor="#F2B720" />
          <stop offset="1" stopColor="#F7F256" />
        </linearGradient>
        <linearGradient id={id('g_f1b')} gradientUnits="userSpaceOnUse" x1="425.5" y1="334.2" x2="370.2" y2="290.7">
          <stop offset="0" stopColor="#DE681F" />
          <stop offset="1" stopColor="#FDE541" />
        </linearGradient>
        <linearGradient id={id('g_f2')} gradientUnits="userSpaceOnUse" x1="14.6" y1="681.8" x2="17.1" y2="798.4">
          <stop offset="0" stopColor="#EEAC34" />
          <stop offset="1" stopColor="#D2381B" />
        </linearGradient>
        <linearGradient id={id('g_f3a')} gradientUnits="userSpaceOnUse" x1="481.2" y1="376.7" x2="446.9" y2="349.9">
          <stop offset="0" stopColor="#DF4421" />
          <stop offset="1" stopColor="#DA762F" />
        </linearGradient>
        <linearGradient id={id('g_f3b')} gradientUnits="userSpaceOnUse" x1="483.9" y1="236" x2="437.2" y2="213.2">
          <stop offset="0" stopColor="#CC1E39" />
          <stop offset="1" stopColor="#DB5220" />
        </linearGradient>
        <linearGradient id={id('g_f4')} gradientUnits="userSpaceOnUse" x1="402.3" y1="720.3" x2="357.3" y2="639.9">
          <stop offset="0" stopColor="#DC2C31" />
          <stop offset="1" stopColor="#71131C" />
        </linearGradient>
        <linearGradient id={id('gC0')} gradientUnits="userSpaceOnUse" x1="614.6" y1="476.3" x2="385.5" y2="298.7">
          <stop offset="0" stopColor="#530F17" />
          <stop offset="1" stopColor="#512E11" />
        </linearGradient>
        <linearGradient id={id('gC1')} gradientUnits="userSpaceOnUse" x1="409.2" y1="845.4" x2="305.6" y2="631.3">
          <stop offset="0" stopColor="#801622" />
          <stop offset="1" stopColor="#826639" />
        </linearGradient>
        <linearGradient id={id('gC2')} gradientUnits="userSpaceOnUse" x1="410.9" y1="844.3" x2="306.6" y2="630">
          <stop offset="0" stopColor="#AA0916" />
          <stop offset="1" stopColor="#B3A661" />
        </linearGradient>
        <linearGradient id={id('gC3')} gradientUnits="userSpaceOnUse" x1="427.3" y1="832.4" x2="316.8" y2="617.1">
          <stop offset="0" stopColor="#C70000" />
          <stop offset="1" stopColor="#DCD367" />
        </linearGradient>
        <linearGradient id={id('gT')} gradientUnits="userSpaceOnUse" x1="283" y1="0" x2="662" y2="0">
          <stop offset="0" stopColor="#ECB73B" />
          <stop offset="0.1" stopColor="#EBA330" />
          <stop offset="0.2" stopColor="#E59F37" />
          <stop offset="0.4" stopColor="#D88134" />
          <stop offset="0.5" stopColor="#D76229" />
          <stop offset="0.6" stopColor="#C94228" />
          <stop offset="0.8" stopColor="#C6392B" />
          <stop offset="0.9" stopColor="#BD3234" />
          <stop offset="1" stopColor="#9D3246" />
        </linearGradient>
        <path id={id('mOut')} d="M44,629.5 L45,800.2 L100.5,748 L153.3,795.5 L206,747.5 L260.5,799.5 L260.5,630 L152.5,726Z" />
        <g id={id('mFacets')}>
          <use href={`#${id('mOut')}`} fill={ref('gB')} />
          <path d="M44,629.5 L100.5,680 L100.5,748 L44,706Z" fill={ref('g_f1')} />
          <path d="M44,706 L100.5,748 L45,800.2Z" fill={ref('g_f1b')} />
          <path d="M100.5,680 L152.5,726 L153.3,795.5 L100.5,748Z" fill={ref('g_f2')} />
          <path d="M152.5,726 L260.5,630 L153.3,795.5Z" fill={ref('g_f3a')} />
          <path d="M260.5,630 L260.5,694 L206,747.5 L153.3,795.5Z" fill={ref('g_f3b')} />
          <path d="M206,747.5 L260.5,694 L260.5,799.5Z" fill={ref('g_f4')} />
        </g>
      </defs>

      {/* Big faceted M */}
      <use href={`#${id('mFacets')}`} />

      {/* Crowd */}
      <g>
        {CROWD_PATHS.map((d, index) => (
          <path key={index} fill={ref(`gC${index}`)} fillRule="evenodd" d={d} />
        ))}
      </g>

      {/* HOMHO */}
      <path
        fill={ref('gT')}
        fillRule="evenodd"
        d="M284.4,737H301.2V760.5H327.5V737H344.2V801.2H327.5V776.7H301.2V801.2H284.4Z"
      />
      <path
        fill={ref('gT')}
        fillRule="evenodd"
        d="M354.2,769.2a35.8,33.8 0 1,0 71.5,0a35.8,33.8 0 1,0 -71.5,0ZM371.2,769.4a18.6,18.4 0 1,0 37.2,0a18.6,18.4 0 1,0 -37.2,0Z"
      />
      <use
        href={`#${id('mFacets')}`}
        transform="translate(434.2 736.2) scale(0.3406 0.3852) translate(-44 -629.5)"
      />
      <path
        fill={ref('gT')}
        fillRule="evenodd"
        d="M520.3,737H535.4V760H564.6V737H580V801.2H564.6V776.8H535.4V801.2H520.3Z"
      />
      <path
        fill={ref('gT')}
        fillRule="evenodd"
        d="M589.5,769a35.4,33.5 0 1,0 70.8,0a35.4,33.5 0 1,0 -70.8,0ZM606.8,769.2a18.8,18.5 0 1,0 37.5,0a18.8,18.5 0 1,0 -37.5,0Z"
      />
    </svg>
  );
};

