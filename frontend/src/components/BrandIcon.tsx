'use client';

import React from 'react';

/**
 * Icono de una marca, con la variante correcta para el tema.
 *
 * Varias marcas son monocromas y negras (X, GitHub, TikTok): sobre el tema
 * oscuro desaparecen. Para esas el catálogo trae una segunda variante en
 * blanco, y aquí se pintan las dos dejando que el CSS enseñe la que toca. Se
 * hace con CSS y no leyendo el tema en JavaScript porque el tema se decide en
 * el servidor y en el cliente: leerlo al renderizar daría una discrepancia de
 * hidratación y un parpadeo en la primera pintura.
 *
 * Las reglas .icono-marca-* viven en globals.css.
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
  const comun = `${className} object-contain shrink-0`;

  if (!iconDark) {
    return <img src={icon} alt={alt} width={size} height={size} className={comun} />;
  }

  return (
    <>
      <img src={icon} alt={alt} width={size} height={size} className={`${comun} icono-marca-claro`} />
      <img
        src={iconDark}
        alt=""
        aria-hidden="true"
        width={size}
        height={size}
        className={`${comun} icono-marca-oscuro`}
      />
    </>
  );
}
