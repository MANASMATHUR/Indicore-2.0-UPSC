'use client';

import { useState, useEffect } from 'react';

export default function Logo({ 
  variant = 'light', 
  className = '',
  showText = true,
  size = 'default' 
}) {
  const [imgError, setImgError] = useState(false);
  const [imgLoaded, setImgLoaded] = useState(false);
  
  const sizeClasses = {
    sm: { container: 'h-8', text: 'text-lg', icon: 'w-8 h-8' },
    default: { container: 'h-10', text: 'text-2xl', icon: 'w-10 h-10' },
    lg: { container: 'h-12', text: 'text-3xl', icon: 'w-12 h-12' }
  };

  const sizes = sizeClasses[size];
  // Use the Indicore Logo.png file
  const logoSrc = '/logo.png';

  // Try to load image to check if it exists
  useEffect(() => {
    const img = new window.Image();
    img.onload = () => {
      setImgError(false);
      setImgLoaded(true);
    };
    img.onerror = () => {
      setImgError(true);
      setImgLoaded(true);
    };
    img.src = logoSrc;
  }, [logoSrc]);

  return (
    <div className={`flex items-center space-x-2 sm:space-x-3 ${className}`}>
      {imgLoaded && !imgError ? (
        <>
          <div className={`relative flex items-center justify-center`} style={{ height: sizes.container.replace('h-', '').replace('h', '') + 'px', width: 'auto' }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={logoSrc}
              alt="Indicore Logo"
              className="h-full w-auto object-contain"
              style={{ maxHeight: '100%', maxWidth: '200px' }}
              onError={() => setImgError(true)}
              loading="eager"
              fetchPriority="high"
            />
          </div>
          {showText && (
            <span className={`${sizes.text} font-semibold tracking-tight ${variant === 'dark' ? 'text-white' : 'text-gray-900 dark:text-white'}`}>
              Indicore
            </span>
          )}
        </>
      ) : (
        <>
          <div className={`relative ${sizes.icon} flex-shrink-0`}>
            <div className={`w-full h-full bg-gradient-to-br from-red-600 to-orange-600 rounded-lg flex items-center justify-center shadow-sm`}>
              <span className={`${size === 'sm' ? 'text-sm' : size === 'lg' ? 'text-lg' : 'text-base'} text-white font-bold`}>
                I
              </span>
            </div>
          </div>
          {showText && (
            <span className={`${sizes.text} font-semibold tracking-tight ${variant === 'dark' ? 'text-white' : 'text-gray-900 dark:text-white'}`}>
              Indicore
            </span>
          )}
        </>
      )}
    </div>
  );
}

