const getAvatarSrc = (url?: string | null) => {
  if (!url) return null;
  if (url.startsWith('http://') || url.startsWith('https://')) return url;
  if (url.startsWith('/')) return url;
  return `/api/auth/avatar/${url}`;
};

export { getAvatarSrc };
