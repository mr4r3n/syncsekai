'use client';

// --- VECTOR BRAND AND CLIENT ICONS ---
function ChromeBrandIcon({ className = "w-8 h-8" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none">
      <path d="M12 2C16.03 2 19.49 4.45 20.97 7.95L12 12V2Z" fill="#EA4335" />
      <path d="M20.97 7.95C21.63 9.17 22 10.54 22 12C22 17.18 18.06 21.43 13 21.96L8.8 14.68L12 12L20.97 7.95Z" fill="#FBBC04" />
      <path d="M13 21.96C12.67 21.99 12.34 22 12 22C6.48 22 2 17.52 2 12C2 8.57 3.73 5.54 6.38 3.75L9.6 9.32L12 12L8.8 14.68L13 21.96Z" fill="#34A853" />
      <path d="M6.38 3.75C7.94 2.65 9.89 2 12 2L12 12L9.6 9.32L6.38 3.75Z" fill="#EA4335" />
      <circle cx="12" cy="12" r="5" fill="#FFFFFF" />
      <circle cx="12" cy="12" r="3.7" fill="#1A73E8" />
    </svg>
  );
}

function WindowsBrandIcon({ className = "w-8 h-8" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="#00A4EF">
      <path d="M0 3.449L9.75 2.1v9.451H0V3.449zm0 8.877h9.75v9.451L0 20.426v-8.1zm10.55-9.61L24 0v11.55H10.55V2.716zm0 9.61H24V24l-13.45-2.716v-8.958z" />
    </svg>
  );
}

function AppleBrandIcon({ className = "w-8 h-8" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.81-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M15.97 6.37c.66-.81 1.11-1.94.99-3.07-1 .04-2.16.67-2.84 1.48-.59.69-1.12 1.83-.98 2.94 1.11.09 2.18-.58 2.83-1.35" />
    </svg>
  );
}

function FireTvBrandIcon({ className = "w-10 h-8" }: { className?: string }) {
  return (
    <div className={`flex flex-col items-center justify-center ${className}`}>
      <span className="font-black text-[#FF9900] tracking-tighter text-xs italic font-sans leading-none">
        fire<span className="text-white font-normal ml-0.5">tv</span>
      </span>
      <svg className="w-8 h-1.5 mt-0.5" viewBox="0 0 50 10" fill="none">
        <path d="M2 3C15 8 35 8 48 3" stroke="#FF9900" strokeWidth="3" strokeLinecap="round" />
        <path d="M44 1.5L48 3L45 5.5" fill="#FF9900" />
      </svg>
    </div>
  );
}

function PlexBrandIcon({ className = "w-8 h-8" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none">
      <path d="M7 4L15 12L7 20H11L19 12L11 4H7Z" fill="#E5A00D" />
    </svg>
  );
}

function SafariBrandIcon({ className = "w-8 h-8" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none">
      <circle cx="12" cy="12" r="10" fill="#006CFF" />
      <circle cx="12" cy="12" r="9" stroke="white" strokeWidth="0.8" strokeDasharray="1 1" />
      <polygon points="12,4 14,12 12,20 10,12" fill="#FF3B30" />
      <polygon points="12,20 14,12 12,4 10,12" fill="#FFFFFF" opacity="0.9" />
      <circle cx="12" cy="12" r="1.5" fill="#006CFF" />
    </svg>
  );
}

function FirefoxBrandIcon({ className = "w-8 h-8" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none">
      <circle cx="12" cy="12" r="10" fill="#6C2BD9" />
      <path
        d="M12 3C7 3 4 7 4 12C4 16.4 7.6 20 12 20C16.4 20 20 16.4 20 12C20 8 17 5 15 5C14 6 14.5 7.5 13.5 8.5C12.5 9.5 11 9 10.5 8C10 7 10.5 5.5 12 3Z"
        fill="#FF7139"
      />
      <circle cx="12" cy="12" r="5" fill="#FFB703" />
      <circle cx="11" cy="11" r="3" fill="#006CFF" />
    </svg>
  );
}

function EdgeBrandIcon({ className = "w-8 h-8" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none">
      <circle cx="12" cy="12" r="10" fill="#0078D7" />
      <path
        d="M12 4C7.58 4 4 7.58 4 12C4 16.42 7.58 20 12 20C15.5 20 18.5 17.5 19.5 14C19 14.5 18 15 17 15C14.24 15 12 12.76 12 10C12 7.5 13.5 5.5 15.5 4.5C14.5 4.2 13.3 4 12 4Z"
        fill="#00C7F2"
      />
      <path
        d="M17 10C17 13 14.5 15.5 11.5 15.5C9.5 15.5 8 14.5 7.5 13.5C8.5 17 12 19 15.5 18C18 17.2 19.5 15 19.5 12C19.5 9.5 18.5 8 17 7V10Z"
        fill="#50E6FF"
      />
    </svg>
  );
}

function AndroidBrandIcon({ className = "w-8 h-8" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="#3DDC84">
      <path d="M6 18c0 .55.45 1 1 1h1v3.5c0 .83.67 1.5 1.5 1.5s1.5-.67 1.5-1.5V19h2v3.5c0 .83.67 1.5 1.5 1.5s1.5-.67 1.5-1.5V19h1c.55 0 1-.45 1-1V8H6v10zM3.5 8C2.67 8 2 8.67 2 9.5v7c0 .83.67 1.5 1.5 1.5S5 17.33 5 16.5v-7C5 8.67 4.33 8 3.5 8zm17 0c-.83 0-1.5.67-1.5 1.5v7c0 .83.67 1.5 1.5 1.5s1.5-.67 1.5-1.5v-7c0-.83-.67-1.5-1.5-1.5zm-4.97-4.84l1.3-1.3c.2-.2.2-.51 0-.71-.2-.2-.51-.2-.71 0l-1.48 1.48C13.72 2.24 12.88 2 12 2c-.88 0-1.72.24-2.64.63L7.88 1.15c-.2-.2-.51-.2-.71 0-.2.2-.2.51 0 .71l1.3 1.3C6.71 4.34 5.5 6.02 5.5 8h13c0-1.98-1.21-3.66-2.97-4.84zM9 6c-.55 0-1-.45-1-1s.45-1 1-1 1 .45 1 1-.45 1-1 1zm6 0c-.55 0-1-.45-1-1s.45-1 1-1 1 .45 1 1-.45 1-1 1z" />
    </svg>
  );
}

function LinuxBrandIcon({ className = "w-8 h-8" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="#FCC624">
      <path d="M12 2C9.5 2 7.5 4 7.5 6.5C7.5 8 8 9.5 9 10.5C8 11.5 7 13 7 15C7 17.5 9 20 12 20C15 20 17 17.5 17 15C17 13 16 11.5 15 10.5C16 9.5 16.5 8 16.5 6.5C16.5 4 14.5 2 12 2Z" fill="#333333" />
      <circle cx="10.5" cy="6" r="1" fill="#FCC624" />
      <circle cx="13.5" cy="6" r="1" fill="#FCC624" />
      <ellipse cx="12" cy="7.5" rx="1.5" ry="1" fill="#E67E22" />
      <ellipse cx="12" cy="14" rx="3.5" ry="4" fill="#FFFFFF" />
      <path d="M6 19C7 19 8 18 8 17C8 16 7 15 6 15C5 15 4 16 4 17C4 18 5 19 6 19ZM18 19C19 19 20 18 20 17C20 16 19 15 18 15C17 15 16 16 16 17C16 18 17 19 18 19Z" fill="#E67E22" />
    </svg>
  );
}

function renderDeviceBrandIcon(iconType: string, browser: string, os: string) {
  const type = (iconType || '').toUpperCase();
  const b = (browser || '').toLowerCase();
  const o = (os || '').toLowerCase();

  if (type === 'CHROME' || b.includes('chrome')) return <ChromeBrandIcon className="w-8 h-8 shrink-0" />;
  if (type === 'WINDOWS' || o.includes('windows')) return <WindowsBrandIcon className="w-8 h-8 shrink-0" />;
  if (type === 'FIRETV' || o.includes('fire') || b.includes('fire')) return <FireTvBrandIcon className="w-10 h-8 shrink-0" />;
  if (type === 'PLEX' || b.includes('plex') || b.includes('pms') || b.includes('plexamp')) return <PlexBrandIcon className="w-8 h-8 shrink-0" />;
  if (type === 'IOS' || o.includes('ios') || o.includes('iphone') || o.includes('ipad')) return <AppleBrandIcon className="w-8 h-8 shrink-0 text-white" />;
  if (type === 'SAFARI' || b.includes('safari') || o.includes('mac')) return <SafariBrandIcon className="w-8 h-8 shrink-0" />;
  if (type === 'FIREFOX' || b.includes('firefox')) return <FirefoxBrandIcon className="w-8 h-8 shrink-0" />;
  if (type === 'EDGE' || b.includes('edge')) return <EdgeBrandIcon className="w-8 h-8 shrink-0" />;
  if (type === 'ANDROID' || o.includes('android')) return <AndroidBrandIcon className="w-8 h-8 shrink-0" />;
  if (type === 'LINUX' || o.includes('linux')) return <LinuxBrandIcon className="w-8 h-8 shrink-0" />;
  return <ChromeBrandIcon className="w-8 h-8 shrink-0" />;
}

export {
  renderDeviceBrandIcon,
  ChromeBrandIcon,
  WindowsBrandIcon,
  AppleBrandIcon,
  FireTvBrandIcon,
  PlexBrandIcon,
  SafariBrandIcon,
  FirefoxBrandIcon,
  EdgeBrandIcon,
  AndroidBrandIcon,
  LinuxBrandIcon,
};
