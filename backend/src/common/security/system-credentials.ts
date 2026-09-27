/**
 * The system credentials that can be changed from the admin panel.
 *
 * It is a closed list on purpose. `SystemSetting` stores much more than
 * credentials (the setup lock, the maintenance state, internal flags) and an
 * endpoint accepting any key would amount to "write whatever you want into the
 * system configuration". Only what this screen needs to rotate gets in here.
 *
 * Without this list these credentials could only be written during setup, with
 * no way to rotate them when they expire or leak, which is exactly when it is
 * needed.
 */

export interface SystemCredentialDefinition {
  key: string;
  /** Stored encrypted and never returned to the browser. */
  secret: boolean;
  group: 'google' | 'discord' | 'anilist' | 'mal' | 'smtp' | 'plex';
  /**
   * The technical name, untranslated. It is the one shown in the provider's
   * console and in the environment variable: translating it would force people
   * to look up the equivalent right when copying a value from one place to the
   * other.
   */
  label: string;
}

export const SYSTEM_CREDENTIALS: readonly SystemCredentialDefinition[] = [
  { key: 'GOOGLE_CLIENT_ID', secret: false, group: 'google', label: 'Client ID' },
  { key: 'GOOGLE_CLIENT_SECRET', secret: true, group: 'google', label: 'Client Secret' },

  { key: 'DISCORD_CLIENT_ID', secret: false, group: 'discord', label: 'Client ID' },
  { key: 'DISCORD_CLIENT_SECRET', secret: true, group: 'discord', label: 'Client Secret' },
  { key: 'DISCORD_BOT_TOKEN', secret: true, group: 'discord', label: 'Bot Token' },

  { key: 'ANILIST_CLIENT_ID', secret: false, group: 'anilist', label: 'Client ID' },
  { key: 'ANILIST_CLIENT_SECRET', secret: true, group: 'anilist', label: 'Client Secret' },

  { key: 'MAL_CLIENT_ID', secret: false, group: 'mal', label: 'Client ID' },
  { key: 'MAL_CLIENT_SECRET', secret: true, group: 'mal', label: 'Client Secret' },

  { key: 'SMTP_HOST', secret: false, group: 'smtp', label: 'Host' },
  { key: 'SMTP_PORT', secret: false, group: 'smtp', label: 'Port' },
  { key: 'SMTP_USER', secret: false, group: 'smtp', label: 'User' },
  { key: 'SMTP_PASS', secret: true, group: 'smtp', label: 'Password' },
  { key: 'SMTP_FROM', secret: false, group: 'smtp', label: 'From' },

  { key: 'PLEX_CLIENT_ID', secret: false, group: 'plex', label: 'Client ID' },
] as const;

const BY_KEY = new Map(SYSTEM_CREDENTIALS.map((c) => [c.key, c]));

/** `undefined` if the key is not in the list: nothing outside it is touched. */
export function findCredential(key: string): SystemCredentialDefinition | undefined {
  return BY_KEY.get(key);
}

/**
 * How an already stored value is shown.
 *
 * A secret never goes back to the browser, not even partially: a few
 * characters of a client secret are a few characters less to guess, and an
 * administrator does not need to reread it, only to know whether it is set and
 * to be able to change it. Non-secret values (a client id, a mail host) are
 * returned, because it must be possible to check they are correct.
 */
export function displayValue(cred: SystemCredentialDefinition, value: string): string | null {
  if (!value) return null;
  return cred.secret ? null : value;
}
