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
  const logoSrc = variant === 'dark' ? '/logo-dark.png' : '/logo-white.png';

  // Try to load image to check if it exists (silently, without triggering Next.js warnings)
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

  // Show fallback while checking or if error
  if (!imgLoaded || imgError) {
    return (
      <div className={`flex items-center space-x-3 ${className}`}>
        <div className={`relative ${sizes.icon}`}>
          <div className={`absolute inset-0 bg-gradient-to-br from-orange-500 to-red-600 rounded-lg flex items-center justify-center shadow-md`}>
            <svg className={`${size === 'sm' ? 'w-5 h-5' : size === 'lg' ? 'w-8 h-8' : 'w-6 h-6'} text-white`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
              <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
              <path d="M8 7h8M8 11h8M8 15h4" />
            </svg>
          </div>
        </div>
        {showText && (
          <span className={`${sizes.text} font-bold ${variant === 'dark' ? 'text-white' : 'text-black'}`}>
            Indicore
          </span>
        )}
      </div>
    );
  }

  return (
    <div className={`flex items-center space-x-3 ${className}`}>
      {!imgError ? (
        <>
          <div className={`relative ${sizes.container} w-auto`}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={logoSrc}
              alt="Indicore Logo"
              className={`${sizes.container} w-auto object-contain`}
              onError={() => setImgError(true)}
            />
          </div>
          {showText && (
            <span className={`${sizes.text} font-bold ${variant === 'dark' ? 'text-white' : 'text-black'}`}>
              Indicore
            </span>
          )}
        </>
      ) : (
        <>
          <div className={`relative ${sizes.icon}`}>
            <div className={`absolute inset-0 bg-gradient-to-br from-orange-500 to-red-600 rounded-lg flex items-center justify-center shadow-md`}>
              <svg className={`${size === 'sm' ? 'w-5 h-5' : size === 'lg' ? 'w-8 h-8' : 'w-6 h-6'} text-white`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
                <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
                <path d="M8 7h8M8 11h8M8 15h4" />
              </svg>
            </div>
          </div>
          {showText && (
            <span className={`${sizes.text} font-bold ${variant === 'dark' ? 'text-white' : 'text-black'}`}>
              Indicore
            </span>
          )}
        </>
      )}
    </div>
  );
}

