/**
 * Check of the email template.
 *
 *     npx ts-node -T scripts/check-email-template.ts
 *     npx ts-node -T scripts/check-email-template.ts --save  (writes the HTML to /tmp)
 *
 * An email cannot be tested like a page: there is no console, no error, and the
 * recipient does not report that it arrived broken. What is checked here is what
 * would break an email silently.
 */
import assert from 'node:assert/strict';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { emailTemplate, escapeHtml } from '../src/common/email/email-template';

const link = 'https://syncsekai.com/activate/abc123';

const withButton = emailTemplate({
  frontendUrl: 'https://syncsekai.com',
  title: 'Activate your account',
  paragraphs: [`Hi <strong>${escapeHtml('<script>x</script>')}</strong>, almost there.`],
  button: { text: 'Activate account', url: link },
  note: 'The link expires in 24 hours.',
});

const withCode = emailTemplate({
  title: 'Your sign-in code',
  paragraphs: ['Enter this code to continue:'],
  code: '482913',
  note: 'It expires in 10 minutes.',
});

const dangerous = emailTemplate({
  title: 'Confirm you want to delete your account',
  paragraphs: ['This cannot be undone.'],
  button: { text: 'Confirm deletion', url: link, danger: true },
});

// The username ends up inside the email HTML.
assert.ok(
  !withButton.includes('<script>'),
  'the username reaches the email unescaped: a <script> there is HTML injected into the recipient\'s inbox',
);
assert.ok(withButton.includes('&lt;script&gt;'), 'escaping did not leave the text visible');

// With images blocked (which is how it almost always arrives) the email must
// still say who it is from and what to do.
const withoutImages = withButton.replace(/<img[^>]*>/g, '');
assert.ok(withoutImages.includes('SyncSekai'), 'without images the email does not say who it is from');
assert.ok(withoutImages.includes('Activate your account'), 'without images the headline is lost');

// If the client strips the button, the text link is all that is left.
const count = withButton.split(link).length - 1;
assert.ok(count >= 2, `the link appears ${count} time(s): without the text copy, a stripped button leaves the email useless`);

// Outlook uses the Word engine: no flex, no grid, no stylesheet.
for (const [name, html] of Object.entries({ withButton, withCode, dangerous })) {
  assert.ok(!/<style[\s>]/i.test(html), `${name}: has <style>, and some clients drop it entirely`);
  assert.ok(!/display:\s*(flex|grid)/i.test(html), `${name}: uses flex or grid, which Outlook does not apply`);
  assert.ok(html.startsWith('<!doctype html>'), `${name}: without a doctype some clients guess the mode`);
  // Without these two, Gmail and Outlook in dark mode invert an email that is
  // already dark and leave it grey on grey.
  assert.ok(/name="color-scheme" content="dark"/.test(html), `${name}: missing the color-scheme meta`);
  assert.ok(
    /name="supported-color-schemes" content="dark"/.test(html),
    `${name}: missing the supported-color-schemes meta`,
  );
}

assert.ok(withCode.includes('482913'), 'the code does not appear');
assert.ok(dangerous.includes('#BE123C'), 'the destructive button is not red');

if (process.argv.includes('--save')) {
  const target = os.tmpdir();
  for (const [name, html] of Object.entries({ withButton, withCode, dangerous })) {
    const file = path.join(target, `email-${name}.html`);
    fs.writeFileSync(file, html, 'utf8');
    console.log(file);
  }
}

console.log('email template: OK (escaping, no images, no button, 3 shapes)');
