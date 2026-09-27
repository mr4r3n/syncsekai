/**
 * The template for the emails the application sends.
 *
 * Format rules, for compatibility across email clients:
 *
 * - Everything with `<table>`. Outlook uses the Word engine and applies neither
 *   flex nor grid.
 * - Inline styles. No `<style>`: Gmail honours it, others drop it.
 * - **The image must not be necessary.** Almost every client blocks remote
 *   images until the user asks for them, so the logo is decoration and the
 *   name is written next to it.
 * - **Neither must the button.** It always comes with the link as text, because
 *   some clients strip links with a background and they become invisible.
 * - Dark, like the site, but with every color set by hand and both
 *   `color-scheme` metas. Without them, Gmail and Outlook in dark mode invert an
 *   email that was already dark and leave it grey on grey.
 *
 * The colors are the same dark theme tokens as `globals.css`, copied as
 * literals: CSS variables are not available in an email.
 */

/** `--accent-primary` */
const ACCENT = '#FF634A';
/** `--btn-primary-text`. On the coral, white only reaches 2.9:1. */
const TEXT_ON_ACCENT = '#0A0A0A';
/** A red that reaches 4.5:1 with white text; the brand coral does not. */
const DANGER = '#BE123C';
/** `--bg-app` */
const BACKGROUND = '#1A1A1A';
/** `--bg-surface`, without transparency: there is nothing behind an email. */
const CARD = '#252525';
const CARD_SOFT = '#2E2E2E';
/** `--text-primary` / `--text-secondary` / `--text-muted` */
const TEXT = '#F4F4F6';
const TEXT_SOFT = '#D4D4D8';
const TEXT_MUTED = '#A1A1AA';
/** `--border-subtle`, resolved over the card. */
const BORDER = '#3A3A3A';
const FONT =
  "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif";

export interface EmailButton {
  text: string;
  url: string;
  /** Red, for what cannot be undone: deleting the account. */
  danger?: boolean;
}

export interface EmailOptions {
  /** The headline inside the box. */
  title: string;
  /** Body paragraphs, already escaped if they come from user data. */
  paragraphs: string[];
  button?: EmailButton;
  /** A value to copy as is: a one-time code. */
  code?: string;
  /** Small footer note: expiry, what to do if it was not you. */
  note?: string;
  /** Base URL for the logo. Without it the email is the same, with no image. */
  frontendUrl?: string;
}

/** `<`, `&` and friends, in an email that contains the username. */
export function escapeHtml(value: string): string {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export function emailTemplate(options: EmailOptions): string {
  const { title, paragraphs, button, code, note, frontendUrl } = options;

  const logo = frontendUrl
    ? `<img src="${frontendUrl}/icon.png" width="28" height="28" alt=""
           style="display:block;border:0;border-radius:6px;" />`
    : '';

  const body = paragraphs
    .map(
      (p) =>
        `<p style="margin:0 0 14px 0;font-size:14px;line-height:1.6;color:${TEXT_SOFT};">${p}</p>`,
    )
    .join('');

  const codeBlock = code
    ? `<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
         <tr><td align="center" style="padding:8px 0 20px 0;">
           <div style="display:inline-block;padding:14px 28px;background:${CARD_SOFT};border:1px solid ${BORDER};border-radius:8px;
                       font-family:'SFMono-Regular',Consolas,'Liberation Mono',Menlo,monospace;
                       font-size:26px;font-weight:700;letter-spacing:6px;color:${TEXT};">${escapeHtml(code)}</div>
         </td></tr>
       </table>`
    : '';

  // Link as text under the button: some clients remove colored backgrounds.
  const buttonBlock = button
    ? `<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
         <tr><td align="center" style="padding:10px 0 18px 0;">
           <a href="${button.url}"
              style="display:inline-block;padding:13px 30px;
                     background:${button.danger ? DANGER : ACCENT};
                     color:${button.danger ? '#FFFFFF' : TEXT_ON_ACCENT};
                     font-size:14px;font-weight:700;text-decoration:none;border-radius:8px;">${escapeHtml(button.text)}</a>
         </td></tr>
         <tr><td align="center" style="padding:0 0 6px 0;font-size:11px;line-height:1.5;color:${TEXT_MUTED};word-break:break-all;">
           If the button does not work, copy this link:<br />
           <a href="${button.url}" style="color:${ACCENT};">${button.url}</a>
         </td></tr>
       </table>`
    : '';

  const noteBlock = note
    ? `<p style="margin:18px 0 0 0;padding-top:16px;border-top:1px solid ${BORDER};
                 font-size:12px;line-height:1.5;color:${TEXT_MUTED};">${note}</p>`
    : '';

  return `<!doctype html>
<html lang="en"><head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width,initial-scale=1" />
<meta name="color-scheme" content="dark" />
<meta name="supported-color-schemes" content="dark" />
<title>${escapeHtml(title)}</title>
</head>
<body style="margin:0;padding:0;background:${BACKGROUND};">
<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background:${BACKGROUND};">
  <tr><td align="center" style="padding:32px 16px;">

    <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%"
           style="max-width:520px;background:${CARD};border:1px solid ${BORDER};border-radius:12px;font-family:${FONT};">

      <tr><td style="padding:22px 28px;border-bottom:1px solid ${BORDER};">
        <table role="presentation" cellpadding="0" cellspacing="0" border="0">
          <tr>
            ${logo ? `<td style="padding-right:10px;">${logo}</td>` : ''}
            <td style="font-size:15px;font-weight:700;color:${TEXT};letter-spacing:-0.2px;">SyncSekai</td>
          </tr>
        </table>
      </td></tr>

      <tr><td style="padding:28px;">
        <h1 style="margin:0 0 14px 0;font-size:19px;font-weight:700;line-height:1.3;color:${TEXT};">${escapeHtml(title)}</h1>
        ${body}
        ${codeBlock}
        ${buttonBlock}
        ${noteBlock}
      </td></tr>

      <tr><td style="padding:16px 28px;border-top:1px solid ${BORDER};font-size:11px;line-height:1.5;color:${TEXT_MUTED};">
        This message is sent automatically. No reply is needed.
      </td></tr>

    </table>
  </td></tr>
</table>
</body></html>`;
}
