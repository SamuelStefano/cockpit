import { join } from 'node:path';
import { chromium } from 'playwright';

export async function runBrowserSteps({ step, dir, url, email, password }) {
  const browser = await chromium.launch({ headless: true });
  let pairCode = null;
  try {
    const page = await (await browser.newContext({ viewport: { width: 1280, height: 800 } })).newPage();
    let n = 0;
    const shot = async (rec, label) => {
      const file = `${String(++n).padStart(2, '0')}-${label}.png`;
      await page.screenshot({ path: join(dir, file) });
      rec.screenshot = file;
    };

    await step(`Open the Deck (${url})`, async (rec) => {
      await page.goto(url, { waitUntil: 'networkidle', timeout: 45_000 });
      await page.locator('#root *').first().waitFor({ timeout: 15_000 });
      await shot(rec, 'landing');
      return (await page.locator('body').innerText()).replace(/\s+/g, ' ').slice(0, 300);
    });

    await step('Sign-up tab', async (rec) => {
      const tab = page.getByRole('button', { name: 'Criar conta' });
      if (!(await tab.count())) throw new Error('"Criar conta" tab not found (public auth gate not shown)');
      await tab.first().click();
      await page.waitForTimeout(400);
      await shot(rec, 'signup');
    });

    await step('Forgot-password screen', async (rec) => {
      await page.getByRole('button', { name: 'Entrar' }).first().click();
      const forgot = page.getByRole('button', { name: /esqueci|recuperar/i });
      if (!(await forgot.count())) throw new Error('forgot-password button not found');
      await forgot.first().click();
      await page.waitForTimeout(400);
      await shot(rec, 'forgot');
    });

    if (!email || !password) return { pairCode };

    await step('Log in with the e2e account', async (rec) => {
      await page.goto(url, { waitUntil: 'networkidle', timeout: 45_000 });
      await page.locator('input[type="email"]').fill(email);
      await page.locator('input[type="password"]').fill(password);
      await page.locator('form button[type="submit"]').click();
      await page.waitForTimeout(3000);
      await shot(rec, 'logged-in');
    });

    await step('Reach the pairing screen and read the pairing code', async (rec) => {
      const deadline = Date.now() + 45_000;
      while (Date.now() < deadline && !pairCode) {
        const body = await page.locator('body').innerText();
        pairCode = body.match(/DECK_PAIR_CODE=([A-Za-z0-9_-]{4,})/)?.[1] ?? null;
        if (!pairCode) await page.waitForTimeout(1000);
      }
      await shot(rec, 'pairing');
      if (!pairCode) throw new Error('no pairing code visible on the page');
    });
    return { pairCode, page };
  } finally {
    await browser.close();
  }
}
