import React from 'react';
import finchLogoPng from '../assets/finch-logo.png';
import finchIconPng from '../assets/finch-icon.png';
import finchLogoLightPng from '../assets/finch-logo-light.png';
import finchIconLightPng from '../assets/finch-icon-light.png';

interface FinchLogoProps {
  variant?: 'full' | 'icon';
  theme?: 'dark' | 'light'; // 'dark' = for dark backgrounds (light text), 'light' = for light backgrounds (green text)
  className?: string;
  height?: number | string;
  alt?: string;
}

export const FinchLogo: React.FC<FinchLogoProps> = ({
  variant = 'full',
  theme = 'dark',
  className = '',
  height = 36,
  alt = 'finch',
}) => {
  const isDarkBg = theme === 'dark';

  if (variant === 'icon') {
    return (
      <img
        src={isDarkBg ? finchIconLightPng : finchIconPng}
        alt={alt}
        className={`object-contain inline-block ${className}`}
        style={{ height }}
      />
    );
  }

  return (
    <img
      src={isDarkBg ? finchLogoLightPng : finchLogoPng}
      alt={alt}
      className={`object-contain inline-block ${className}`}
      style={{ height }}
    />
  );
};
