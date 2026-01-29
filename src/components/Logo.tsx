import React from 'react';

// Logo at project root assets/; Vite serves it via import
import logoSrc from '../../assets/logo.jpg';

interface LogoProps {
  /** Size in pixels (width/height for square) */
  size?: number;
  /** Show "COUP" text next to logo */
  withText?: boolean;
}

export const Logo: React.FC<LogoProps> = ({ size = 28, withText = true }) => {
  return (
    <div className="inline-flex items-center gap-2 shrink-0">
      <img
        src={logoSrc}
        alt=""
        className="rounded-md object-contain flex-shrink-0"
        width={size}
        height={size}
        style={{ width: size, height: size }}
      />
      {withText && (
        <span className="font-semibold tracking-wide text-slate-800 whitespace-nowrap">
          COUP
        </span>
      )}
    </div>
  );
};
