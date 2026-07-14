/**
 * EchoConnect Contact & Friend Request E2E validation (deployed only)
 */
import { chromium } from '@playwright/test';
import { mkdirSync, writeFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const BASE_URL = 'https://echo-connect-8q3n.vercel.app';
const SCREENSHOT_DIR = join(__dirname, 'screenshots');
mkdirSync(SCREENSHOT_DIR, { recursive: true });

const ts = Date.now();
const userA = {
  name: `E2EUserA${ts}`,
  email: `e2eusera${ts}@example.com`,
  password: 'TestPass123!',
};
const userB = {
  name: `E2EUserB${ts}`,
  email: `e2euserb${ts}@example.com`,
  password: 'TestPass123!',
};

const results = {};
const bugs = [];
const consoleErrors = [];
const apiFailures = [];
const socketErrors = [];

function record(test, pass, detail = '') {
  results[test] = { pass, detail };
}

async function shot(page, name) {
  await page.screenshot({ path: join(SCREENSHOT_DIR, name), fullPage: true });
}

function attachMonitors(page, label) {
  page.on('console', (msg) => {
    if (msg.type() === 'error') {
      const text = msg.text();
      if (!/favicon|\.(png|svg|ico)/i.test(text)) consoleErrors.push({ label, text });
    }
  });
  page.on('pageerror', (err) => consoleErrors.push({ label, text: err.message }));
  page.on('response', (res) => {
    const url = res.url();
    if (url.includes('/api/') && res.status() >= 400) {
      apiFailures.push({ label, url, status: res.status() });
    }
  });
}

async function registerUser(page, user) {
  await page.bringToFront();
  await page.goto(`${BASE_URL}/register`, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.fill('#name', user.name);
  await page.fill('#email', user.email);
  await page.fill('#password', user.password);
  await page.fill('#confirmPassword', user.password);
  await Promise.all([
    page.waitForURL('**/chat**', { timeout: 60000 }),
    page.click('button[type="submit"]:has-text("Create Account")'),
  ]);
  await page.waitForTimeout(2000);
}

async function loginUser(page, user) {
  await page.bringToFront();
  await page.goto(`${BASE_URL}/login`, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.fill('#email', user.email);
  await page.fill('#password', user.password);
  await Promise.all([
    page.waitForURL('**/chat**', { timeout: 60000 }),
    page.click('button[type="submit"]:has-text("Sign In")'),
  ]);
  await page.waitForTimeout(2000);
}

async function logoutUser(page) {
  await page.bringToFront();
  await page.evaluate(() => localStorage.clear());
  await page.goto(`${BASE_URL}/login`, { waitUntil: 'domcontentloaded' });
}

async function openFindPeople(page) {
  await page.bringToFront();
  await page.getByRole('button', { name: 'New Chat' }).click();
  await page.getByText('Find People / Add Contact').click();
  await page.waitForSelector('h2:has-text("Find People")');
}

async function searchAndWait(page, query) {
  const input = page.locator('input[placeholder*="Search globally"]');
  await input.fill('');
  const respPromise = page.waitForResponse(
    (r) => r.url().includes('/users/search') && r.request().method() === 'GET',
    { timeout: 15000 }
  ).catch(() => null);
  await input.fill(query);
  const resp = await respPromise;
  await page.waitForTimeout(800);
  return resp;
}

async function run() {
  const browser = await chromium.launch({
    headless: true,
    args: [
      '--use-fake-ui-for-media-stream',
      '--use-fake-device-for-media-stream',
      '--disable-background-timer-throttling',
      '--disable-backgrounding-occluded-windows',
      '--disable-renderer-backgrounding',
    ],
  });

  const ctxOpts = {
    permissions: ['camera', 'microphone'],
    viewport: { width: 1400, height: 900 },
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36',
  };

  const contextA = await browser.newContext(ctxOpts);
  const contextB = await browser.newContext(ctxOpts);
  const pageA = await contextA.newPage();
  const pageB = await contextB.newPage();
  attachMonitors(pageA, 'UserA');
  attachMonitors(pageB, 'UserB');

  let searchRequestsBeforeType = 0;

  try {
    // TEST 1
    try {
      await registerUser(pageA, userA);
      await registerUser(pageB, userB);
      const aNoContacts = await pageA.getByText('No contacts yet').isVisible({ timeout: 10000 });
      const bNoContacts = await pageB.getByText('No contacts yet').isVisible({ timeout: 10000 });
      record('1. Registration', aNoContacts && bNoContacts,
        `A empty:${aNoContacts} B empty:${bNoContacts}`);
      if (!aNoContacts || !bNoContacts) await shot(pageA, 'fail-01-registration.png');
    } catch (e) {
      record('1. Registration', false, e.message);
      await shot(pageA, 'fail-01-registration.png');
      bugs.push({ test: '1', issue: e.message });
      throw e;
    }

    // TEST 2
    try {
      await openFindPeople(pageA);
      const emptyVisible = await pageA.getByText('Search EchoConnect Directory').isVisible();
      const noAddFriend = (await pageA.getByRole('button', { name: 'Add Friend' }).count()) === 0;

      pageA.on('request', (req) => {
        if (req.url().includes('/users/search')) searchRequestsBeforeType++;
      });
      await pageA.waitForTimeout(500);
      const noEarlySearch = searchRequestsBeforeType === 0;

      const r1 = await searchAndWait(pageA, userB.name);
      const fullName = await pageA.getByText(userB.name).first().isVisible({ timeout: 5000 });

      const r2 = await searchAndWait(pageA, userB.name.slice(0, 8).toLowerCase());
      const partialName = await pageA.getByText(userB.name).first().isVisible({ timeout: 5000 });

      const r3 = await searchAndWait(pageA, userB.email);
      const fullEmail = await pageA.getByText(userB.email).isVisible({ timeout: 5000 });

      const r4 = await searchAndWait(pageA, userB.email.split('@')[0].slice(0, 8));
      const partialEmail = await pageA.getByText(userB.email).isVisible({ timeout: 5000 });

      const pass = emptyVisible && noAddFriend && noEarlySearch && fullName && partialName && fullEmail && partialEmail;
      record('2. Search', pass,
        `empty:${emptyVisible} noEarly:${noEarlySearch} name:${fullName}(${r1?.status()}) partial:${partialName} email:${fullEmail}(${r3?.status()})`);
      if (!pass) await shot(pageA, 'fail-02-search.png');
      await pageA.getByRole('button', { name: 'Close' }).click().catch(() => pageA.keyboard.press('Escape'));
      await pageA.waitForTimeout(500);
    } catch (e) {
      record('2. Search', false, e.message);
      await shot(pageA, 'fail-02-search.png');
      bugs.push({ test: '2', issue: e.message });
    }

    // TEST 3
    try {
      await openFindPeople(pageA);
      await searchAndWait(pageA, userB.name);
      const addBtn = pageA.getByRole('button', { name: 'Add Friend' });
      await addBtn.click();
      await pageA.waitForTimeout(2000);
      const pendingShown = await pageA.getByText('Pending').isVisible({ timeout: 10000 }).catch(() => false)
        || await pageA.getByRole('button', { name: 'Requests' }).locator('span').filter({ hasText: /^\d+$/ }).isVisible().catch(() => false);

      const dupClickBlocked = await addBtn.isVisible().catch(() => false) === false;
      const stillPending = await pageA.getByText('Pending').isVisible();

      await searchAndWait(pageA, userA.name);
      const selfAdd = await pageA.getByRole('button', { name: 'Add Friend' }).isVisible().catch(() => false);
      const selfBlocked = !selfAdd;

      const pass = pendingShown && stillPending && selfBlocked;
      record('3. Friend Request', pass,
        `pending:${pendingShown} dupBlocked:${dupClickBlocked || stillPending} selfBlocked:${selfBlocked}`);
      if (!pass) await shot(pageA, 'fail-03-friend-request.png');
      await pageA.keyboard.press('Escape');
    } catch (e) {
      record('3. Friend Request', false, e.message);
      await shot(pageA, 'fail-03-friend-request.png');
      bugs.push({ test: '3', issue: e.message });
    }

    // TEST 4
    try {
      await pageB.bringToFront();
      await pageB.getByRole('button', { name: 'Requests' }).click();
      await pageB.waitForTimeout(3000);
      const incoming = await pageB.getByText(userA.name).first().isVisible({ timeout: 20000 });
      const badge = await pageB.locator('button').filter({ hasText: 'Requests' }).locator('span').filter({ hasText: /^1$/ }).isVisible().catch(() => false);
      const acceptBtn = await pageB.getByRole('button', { name: 'Accept' }).first().isVisible({ timeout: 5000 });
      const pass = incoming && acceptBtn;
      record('4. Real-Time', pass, `incoming:${incoming} badge:${badge} accept:${acceptBtn}`);
      if (!pass) await shot(pageB, 'fail-04-realtime.png');
    } catch (e) {
      record('4. Real-Time', false, e.message);
      await shot(pageB, 'fail-04-realtime.png');
      bugs.push({ test: '4', issue: e.message });
    }

    // TEST 5
    try {
      await pageB.bringToFront();
      await pageB.getByRole('button', { name: 'Accept' }).first().click();
      await pageB.waitForTimeout(3000);
      const requestGone = !(await pageB.getByText('Incoming Friend Requests').isVisible().catch(() => false));

      await pageA.bringToFront();
      await pageA.getByRole('button', { name: 'All', exact: true }).click();
      await pageA.waitForTimeout(2000);
      const aContact = await pageA.getByText(userB.name).first().isVisible({ timeout: 15000 });

      await pageB.bringToFront();
      await pageB.getByRole('button', { name: 'All', exact: true }).click();
      const bContact = await pageB.getByText(userA.name).first().isVisible({ timeout: 15000 });

      const pass = requestGone && aContact && bContact;
      record('5. Accept', pass, `gone:${requestGone} A:${aContact} B:${bContact}`);
      if (!pass) { await shot(pageA, 'fail-05-a.png'); await shot(pageB, 'fail-05-b.png'); }
    } catch (e) {
      record('5. Accept', false, e.message);
      await shot(pageB, 'fail-05-accept.png');
      bugs.push({ test: '5', issue: e.message });
    }

    // TEST 6
    try {
      await pageA.reload({ waitUntil: 'networkidle' });
      await pageB.reload({ waitUntil: 'networkidle' });
      await pageA.waitForTimeout(5000);
      await pageB.waitForTimeout(5000);
      const aRefresh = await pageA.getByText(userB.name).first().isVisible({ timeout: 20000 })
        || await pageA.locator('[aria-label*="Chat room"]').filter({ hasText: userB.name }).isVisible({ timeout: 5000 }).catch(() => false);
      const bRefresh = await pageB.getByText(userA.name).first().isVisible({ timeout: 20000 })
        || await pageB.locator('[aria-label*="Chat room"]').filter({ hasText: userA.name }).isVisible({ timeout: 5000 }).catch(() => false);

      await logoutUser(pageA);
      await loginUser(pageA, userA);
      const aLogin = await pageA.getByText(userB.name).first().isVisible({ timeout: 15000 });

      await logoutUser(pageB);
      await loginUser(pageB, userB);
      const bLogin = await pageB.getByText(userA.name).first().isVisible({ timeout: 15000 });

      const pass = aRefresh && bRefresh && aLogin && bLogin;
      record('6. Persistence', pass, `refresh A:${aRefresh} B:${bRefresh} relogin A:${aLogin} B:${bLogin}`);
      if (!pass) await shot(pageA, 'fail-06-persistence.png');
    } catch (e) {
      record('6. Persistence', false, e.message);
      await shot(pageA, 'fail-06-persistence.png');
      bugs.push({ test: '6', issue: e.message });
    }

    // TEST 7
    try {
      await pageA.bringToFront();
      const chatTarget = pageA.locator('[aria-label*="Chat room"]').filter({ hasText: userB.name }).first();
      if (await chatTarget.isVisible({ timeout: 5000 }).catch(() => false)) {
        await chatTarget.click();
      } else {
        await pageA.getByText(userB.name).first().click();
      }
      await pageA.waitForTimeout(2000);
      const msg = `E2E smoke ${ts}`;
      await pageA.locator('textarea').fill(msg);
      await pageA.getByRole('button', { name: 'Send message' }).click();
      await pageB.bringToFront();
      await pageB.getByText(userA.name).first().click();
      await pageB.waitForTimeout(3000);
      const received = await pageB.getByText(msg).isVisible({ timeout: 20000 });
      record('7. Messaging Smoke', received, received ? 'ok' : 'not received');
      if (!received) await shot(pageB, 'fail-07-messaging.png');
    } catch (e) {
      record('7. Messaging Smoke', false, e.message);
      await shot(pageA, 'fail-07-messaging.png');
      bugs.push({ test: '7', issue: e.message });
    }

    // TEST 8
    try {
      await pageA.bringToFront();
      await pageA.getByRole('button', { name: 'Video Call' }).click();
      await pageB.bringToFront();
      await pageB.getByRole('button', { name: 'Accept Call' }).click({ timeout: 25000 });
      await pageA.waitForTimeout(4000);
      const videoCountA = await pageA.locator('video').count();
      const videoCountB = await pageB.locator('video').count();
      const hasVideo = videoCountA >= 1 && videoCountB >= 1;
      await pageA.bringToFront();
      await pageA.getByRole('button', { name: 'End call' }).click({ timeout: 10000 });
      await pageA.waitForTimeout(1000);
      record('8. Video Call Smoke', hasVideo, `videos A:${videoCountA} B:${videoCountB}`);
      if (!hasVideo) await shot(pageA, 'fail-08-video.png');
    } catch (e) {
      record('8. Video Call Smoke', false, e.message);
      await shot(pageA, 'fail-08-video.png');
      bugs.push({ test: '8', issue: e.message });
    }

    // TEST 9
    const badApi = apiFailures.filter((f) => !f.url?.includes('/auth/login') && f.status !== 401);
    const badConsole = consoleErrors.filter((e) =>
      !e.text.includes('401') && !e.text.includes('Invalid token') && !e.text.includes('Network Error')
    );
    record('9. Console', badConsole.length === 0 && badApi.length === 0,
      `jsErrors:${badConsole.length} apiFails:${badApi.length}`);

    const allPass = Object.values(results).every((r) => r.pass);
    if (allPass) await shot(pageA, 'final-success.png');

    const report = { timestamp: new Date().toISOString(), url: BASE_URL, users: { userA: userA.email, userB: userB.email }, results, bugs, consoleErrors: badConsole.slice(0, 15), apiFailures: badApi.slice(0, 15), verdict: allPass ? 'PRODUCTION READY' : 'NOT PRODUCTION READY' };
    writeFileSync(join(SCREENSHOT_DIR, 'report.json'), JSON.stringify(report, null, 2));
    console.log(JSON.stringify(report, null, 2));
  } finally {
    await browser.close();
  }
}

run().catch((e) => { console.error('FATAL:', e); process.exit(1); });
