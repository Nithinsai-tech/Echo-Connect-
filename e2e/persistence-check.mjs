/** Quick API persistence check after accept */
import { chromium } from '@playwright/test';

const BASE = 'https://echo-connect-8q3n.vercel.app';
const API = 'https://echo-connect-production.up.railway.app/api';
const ts = Date.now();
const A = { name: `PersistA${ts}`, email: `pa${ts}@example.com`, password: 'TestPass123!' };
const B = { name: `PersistB${ts}`, email: `pb${ts}@example.com`, password: 'TestPass123!' };

async function reg(page, u) {
  await page.goto(`${BASE}/register`);
  await page.fill('#name', u.name);
  await page.fill('#email', u.email);
  await page.fill('#password', u.password);
  await page.fill('#confirmPassword', u.password);
  await Promise.all([page.waitForURL('**/chat**'), page.click('button[type="submit"]')]);
  return page.evaluate(() => localStorage.getItem('accessToken') || sessionStorage.getItem('accessToken'));
}

async function api(token, path, method = 'GET', body) {
  const r = await fetch(`${API}${path}`, {
    method,
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: body ? JSON.stringify(body) : undefined,
  });
  return r.json();
}

const browser = await chromium.launch({ headless: true });
const ctxA = await browser.newContext({ viewport: { width: 1400, height: 900 } });
const ctxB = await browser.newContext({ viewport: { width: 1400, height: 900 } });
const pA = await ctxA.newPage();
const pB = await ctxB.newPage();

const tokA = await reg(pA, A);
const tokB = await reg(pB, B);

// search B, send request
await pA.bringToFront();
await pA.getByRole('button', { name: 'New Chat' }).click();
await pA.getByText('Find People / Add Contact').click();
await pA.locator('input[placeholder*="Search globally"]').fill(B.name);
await pA.waitForTimeout(1500);
const searchBefore = await api(tokA, `/users/search?q=${encodeURIComponent(B.name)}`);
const bId = searchBefore.data?.[0]?._id;
await pA.getByRole('button', { name: 'Add Friend' }).click();
await pA.waitForTimeout(2000);
const searchAfter = await api(tokA, `/users/search?q=${encodeURIComponent(B.name)}`);

await pB.bringToFront();
await pB.getByRole('button', { name: 'Requests' }).click();
await pB.waitForTimeout(2000);
const reqs = await api(tokB, '/contacts/requests');
const reqId = reqs.incoming?.[0]?._id;
await pB.getByRole('button', { name: 'Accept' }).first().click();
await pB.waitForTimeout(2000);

const contactsA = await api(tokA, '/users');
const contactsB = await api(tokB, '/users');

await pA.reload({ waitUntil: 'networkidle' });
await pB.reload({ waitUntil: 'networkidle' });
await pA.waitForTimeout(3000);
const tokA2 = await pA.evaluate(() => localStorage.getItem('accessToken') || sessionStorage.getItem('accessToken'));
const tokB2 = await pB.evaluate(() => localStorage.getItem('accessToken') || sessionStorage.getItem('accessToken'));
const contactsA2 = await api(tokA2, '/users');
const contactsB2 = await api(tokB2, '/users');

console.log(JSON.stringify({
  searchAfterRelationship: searchAfter.data?.[0]?.relationship,
  contactsAfterAccept: { A: contactsA.count, B: contactsB.count },
  contactsAfterReload: { A: contactsA2.count, B: contactsB2.count },
  namesAfterReload: { A: contactsA2.data?.map(u => u.name), B: contactsB2.data?.map(u => u.name) },
}, null, 2));

await browser.close();
