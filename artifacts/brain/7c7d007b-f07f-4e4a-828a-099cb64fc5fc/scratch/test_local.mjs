import { chromium } from '@playwright/test';
import { writeFileSync, mkdirSync } from 'fs';
import { join } from 'path';

const BASE_URL = 'http://localhost:5173';
const ts = Date.now();
const testUser = {
  name: `LocalTest_${ts}`,
  email: `localtest_${ts}@example.com`,
  password: 'Password123!',
};

async function run() {
  console.log('Launching browser...');
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1400, height: 900 }
  });
  const page = await context.newPage();

  // Monitor console errors and API calls
  page.on('console', msg => {
    if (msg.type() === 'error') {
      console.log(`[BROWSER ERROR] ${msg.text()}`);
    }
  });

  try {
    console.log(`Navigating to ${BASE_URL}/register...`);
    await page.goto(`${BASE_URL}/register`);
    await page.waitForLoadState('networkidle');

    console.log('Registering test user...');
    await page.fill('#name', testUser.name);
    await page.fill('#email', testUser.email);
    await page.fill('#password', testUser.password);
    await page.fill('#confirmPassword', testUser.password);
    
    await Promise.all([
      page.waitForURL('**/chat'),
      page.click('button[type="submit"]')
    ]);
    console.log('Registration successful! Redirected to /chat.');

    await page.waitForTimeout(2000);

    // Save desktop screenshot
    await page.screenshot({ path: 'artifacts/desktop_chat_main.png' });
    console.log('Saved desktop main page screenshot.');

    // 1. Verify Calls Tab (Desktop)
    console.log('Clicking Calls Tab (Desktop)...');
    await page.locator('.hidden.md\\:flex button:has-text("Calls")').click();
    await page.waitForTimeout(1000);
    await page.screenshot({ path: 'artifacts/desktop_calls_tab.png' });
    console.log('Saved desktop calls tab screenshot.');

    // 2. Verify People Tab (Desktop)
    console.log('Clicking People Tab (Desktop)...');
    await page.locator('.hidden.md\\:flex button:has-text("People")').click();
    await page.waitForTimeout(1000);
    await page.screenshot({ path: 'artifacts/desktop_people_tab.png' });
    console.log('Saved desktop people tab screenshot.');

    // Close the NewChatModal
    console.log('Closing NewChatModal (pressing Escape)...');
    await page.keyboard.press('Escape');
    await page.waitForTimeout(1000);

    // 3. Verify Mobile Layout
    console.log('Resizing viewport to mobile (375x800)...');
    await page.setViewportSize({ width: 375, height: 800 });
    await page.waitForTimeout(1000);
    await page.screenshot({ path: 'artifacts/mobile_chats_tab.png' });
    console.log('Saved mobile main chats tab screenshot.');

    // Click Calls tab on Mobile
    console.log('Clicking Calls tab (Mobile)...');
    await page.locator('.md\\:hidden button:has-text("Calls")').click();
    await page.waitForTimeout(1000);
    await page.screenshot({ path: 'artifacts/mobile_calls_tab.png' });
    console.log('Saved mobile calls tab screenshot.');

    // Click Settings tab on Mobile
    console.log('Clicking Settings tab (Mobile)...');
    await page.locator('.md\\:hidden button:has-text("Settings")').click();
    await page.waitForTimeout(1000);
    await page.screenshot({ path: 'artifacts/mobile_settings_tab.png' });
    console.log('Saved mobile settings tab screenshot.');

    console.log('All local validation checks PASSED successfully!');
  } catch (err) {
    console.error('Validation failed with error:', err);
  } finally {
    await browser.close();
  }
}

run();
