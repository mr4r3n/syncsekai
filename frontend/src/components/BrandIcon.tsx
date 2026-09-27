'use client';

import React from 'react';

/**
 * Brand icon, with the correct variant for the theme.
 *
 * Several brands are monochrome and black (X, GitHub, TikTok): on the dark
 * theme they disappear. For those the catalog provides a second variant in
 * white, and here both are rendered, letting CSS show the appropriate one. It
 * is done with CSS rather than reading the theme in JavaScript because the theme is decided on
 * the server and on the client: reading it during render would cause a hydration
 * mismatch and a flash on first paint.
 *
 * The .icono-marca-* rules live in globals.css.
 */
export function BrandIcon({
  icon,
  iconDark,
  alt = '',
  size = 16,
  className = '',
}: {
  icon: string;
  iconDark?: string | null;
  alt?: string;
  size?: number;
  className?: string;
}) {
  const common = `${className} object-contain shrink-0`;

  if (!iconDark) {
    return <img src={icon} alt={alt} width={size} height={size} className={common} />;
  }

  return (
    <>
      <img src={icon} alt={alt} width={size} height={size} className={`${common} icono-marca-claro`} />
      <img
        src={iconDark}
        alt=""
        aria-hidden="true"
        width={size}
        height={size}
        className={`${common} icono-marca-oscuro`}
      />
    </>
  );
}
