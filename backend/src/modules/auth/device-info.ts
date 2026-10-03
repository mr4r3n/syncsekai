export function detectDeviceInfo(userAgent?: string): {
  deviceName: string;
  deviceType: string;
  browser: string;
  os: string;
  iconType: string;
} {
  const ua = userAgent || '';
  let os = 'Windows';
  let browser = 'Google Chrome';
  let deviceType = 'DESKTOP';
  let iconType = 'CHROME';
  // The name is stored with the session and shown in any language, so it
  // carries no preposition: "Chrome · Windows" reads the same in both.
  let deviceName = 'Chrome · Windows';

  // 1. Detect the operating system
  if (/iPhone/i.test(ua)) {
    os = 'iOS';
    deviceType = 'MOBILE';
    iconType = 'IOS';
    deviceName = 'iPhone';
  } else if (/iPad/i.test(ua)) {
    os = 'iOS';
    deviceType = 'TABLET';
    iconType = 'IOS';
    deviceName = 'iPad';
  } else if (/Android/i.test(ua)) {
    os = 'Android';
    deviceType = 'MOBILE';
    iconType = 'ANDROID';
    deviceName = 'Android';
  } else if (/Macintosh|Mac OS/i.test(ua)) {
    os = 'macOS';
    deviceType = 'DESKTOP';
    iconType = 'SAFARI';
    deviceName = 'MacBook / macOS';
  } else if (/Windows/i.test(ua)) {
    os = 'Windows';
    deviceType = 'DESKTOP';
    iconType = 'WINDOWS';
    deviceName = 'Windows PC';
  } else if (/Linux/i.test(ua)) {
    os = 'Linux';
    deviceType = 'SERVER';
    iconType = 'LINUX';
    deviceName = 'Linux Server / NAS';
  } else if (/AFT|FireTV/i.test(ua)) {
    os = 'Fire OS';
    deviceType = 'TV';
    iconType = 'FIRETV';
    deviceName = 'Amazon Fire TV';
  }

  // 2. Detect the client / browser
  if (/Plexamp/i.test(ua)) {
    browser = 'Plexamp';
    iconType = 'PLEX';
    deviceName = `Plexamp · ${os}`;
  } else if (/PlexDash/i.test(ua)) {
    browser = 'Plex Dash';
    iconType = 'PLEX';
    deviceName = `Plex Dash · ${os}`;
  } else if (/PlexMediaServer/i.test(ua)) {
    browser = 'Plex Media Server';
    iconType = 'PLEX';
    deviceType = 'SERVER';
    deviceName = 'Plex Media Server';
  } else if (/Edg\//i.test(ua)) {
    browser = 'Microsoft Edge';
    iconType = 'EDGE';
    deviceName = `Edge · ${os}`;
  } else if (/Chrome\//i.test(ua) || /CriOS\//i.test(ua)) {
    browser = 'Google Chrome';
    iconType = 'CHROME';
    deviceName = `Chrome · ${os}`;
  } else if (/Firefox\//i.test(ua) || /FxiOS\//i.test(ua)) {
    browser = 'Mozilla Firefox';
    iconType = 'FIREFOX';
    deviceName = `Firefox · ${os}`;
  } else if (/Safari\//i.test(ua) && !/Chrome/i.test(ua)) {
    browser = 'Apple Safari';
    iconType = 'SAFARI';
    deviceName = `Safari · ${os}`;
  }

  return {
    deviceName,
    deviceType,
    browser,
    os,
    iconType,
  };
}
