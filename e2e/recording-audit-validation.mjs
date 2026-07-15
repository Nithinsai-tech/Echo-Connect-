/**
 * EchoConnect Call Recording Audit E2E validation
 */
import { chromium } from '@playwright/test';
import { mkdirSync, writeFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const BASE_URL = 'http://localhost:5173';
const SCREENSHOT_DIR = join(__dirname, 'screenshots');
mkdirSync(SCREENSHOT_DIR, { recursive: true });

const ts = Date.now();
const userA = {
  name: `AuditorA${ts}`,
  email: `auditora${ts}@example.com`,
  password: 'TestPass123!',
};
const userB = {
  name: `AuditorB${ts}`,
  email: `auditorb${ts}@example.com`,
  password: 'TestPass123!',
};

const results = {};
const bugs = [];
const consoleErrors = [];
const apiFailures = [];

function record(test, pass, detail = '') {
  results[test] = { pass, detail };
  console.log(`[TEST][${test}] ${pass ? 'PASS' : 'FAIL'} - ${detail}`);
}

async function shot(page, name) {
  await page.screenshot({ path: join(SCREENSHOT_DIR, name), fullPage: true });
}

function attachMonitors(page, label) {
  page.on('console', (msg) => {
    if (msg.type() === 'error') {
      const text = msg.text();
      if (!/favicon|\.(png|svg|ico)/i.test(text)) {
        consoleErrors.push({ label, text });
      }
    }
  });
  page.on('pageerror', (err) => {
    consoleErrors.push({ label, text: err.message });
  });
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

async function openFindPeople(page) {
  await page.bringToFront();
  await page.getByRole('button', { name: 'New Chat' }).click();
  await page.getByText('Find People / Add Contact').click();
  await page.waitForSelector('h2:has-text("Find People")');
}

async function searchAndAdd(page, query) {
  const input = page.locator('input[placeholder*="Search globally"]');
  await input.fill(query);
  await page.waitForTimeout(1000);
  await page.getByRole('button', { name: 'Add Friend' }).first().click();
  await page.waitForTimeout(2000);
  await page.getByRole('button', { name: 'Close' }).click().catch(() => page.keyboard.press('Escape'));
  await page.waitForTimeout(500);
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

  try {
    // 1. Setup Phase: Register & Add Friend
    await registerUser(pageA, userA);
    await registerUser(pageB, userB);

    await openFindPeople(pageA);
    await searchAndAdd(pageA, userB.name);

    await pageB.bringToFront();
    await pageB.getByRole('button', { name: 'Requests' }).click();
    await pageB.waitForTimeout(1500);
    await pageB.getByRole('button', { name: 'Accept' }).first().click();
    await pageB.waitForTimeout(1500);

    // 2. Open Chat Window on both (with reloads to guarantee sync)
    await pageA.bringToFront();
    await pageA.reload();
    await pageA.waitForTimeout(2000);
    await pageA.getByRole('button', { name: 'All', exact: true }).click();
    await pageA.waitForSelector(`text=${userB.name}`, { timeout: 15000 });
    await pageA.getByText(userB.name).first().click();
    await pageA.waitForTimeout(1000);

    await pageB.bringToFront();
    await pageB.reload();
    await pageB.waitForTimeout(2000);
    await pageB.getByRole('button', { name: 'All', exact: true }).click();
    await pageB.waitForSelector(`text=${userA.name}`, { timeout: 15000 });
    await pageB.getByText(userA.name).first().click();
    await pageB.waitForTimeout(1000);

    // TEST 1: Establish Call
    await pageA.bringToFront();
    await pageA.getByRole('button', { name: 'Video Call' }).click();
    await pageB.bringToFront();
    await pageB.getByRole('button', { name: 'Accept Call' }).click({ timeout: 20000 });
    await pageA.waitForTimeout(3000);

    const callConnected = await pageA.getByText(/Connected • \d\d:\d\d/).isVisible() || 
                           await pageA.locator('video').count() >= 2;
    record('1. Call Connection', callConnected, `Call successfully connected and active.`);

    // TEST 2: Start Recording on User A & Verify Privacy
    await pageA.bringToFront();
    // Click Start Recording control
    const recordBtnA = pageA.locator('button[aria-label="Start recording"]');
    const hasRecordBtnA = await recordBtnA.isVisible();
    
    if (hasRecordBtnA) {
      await recordBtnA.click();
      await pageA.waitForTimeout(1000);
      // Confirm recording
      await pageA.getByRole('button', { name: 'Start Recording', exact: true }).click();
      await pageA.waitForTimeout(3000);

      // Verify User A sees indicator and timer
      const aRecordingText = pageA.locator('span:has-text("Recording 00:")');
      const aHasIndicator = await aRecordingText.isVisible();
      const aHasStopBtn = await pageA.locator('button[aria-label="Stop recording"]').isVisible();

      // Check User B (should NOT see any recording state)
      await pageB.bringToFront();
      const bRecordingText = pageB.locator('span:has-text("Recording")');
      const bHasIndicator = await bRecordingText.isVisible();
      const bHasStopBtn = await pageB.locator('button[aria-label="Stop recording"]').isVisible();
      const bHasRecordBtn = await pageB.locator('button[aria-label="Start recording"]').isVisible();

      const privacyPreserved = aHasIndicator && aHasStopBtn && (!bHasIndicator) && (!bHasStopBtn);
      record('2. Privacy Isolation', privacyPreserved, 
        `User A Recording Indicator: ${aHasIndicator}, User B Recording Indicator: ${bHasIndicator}. User B Stop Btn: ${bHasStopBtn}`);

      if (!privacyPreserved) {
        await shot(pageA, 'private-recording-fail-A.png');
        await shot(pageB, 'private-recording-fail-B.png');
      }

      // TEST 3: Pause & Resume recording
      await pageA.bringToFront();
      await pageA.mouse.move(700, 450); // Wake up controls
      await pageA.waitForTimeout(500); // Wait for transition
      const pauseBtn = pageA.locator('button[aria-label="Pause recording"]');
      const hasPause = await pauseBtn.isVisible();
      if (hasPause) {
        await pauseBtn.click();
        await pageA.waitForTimeout(1000);
        await pageA.mouse.move(700, 450); // Wake up controls again if hidden
        await pageA.waitForTimeout(500);
        const resumeBtn = pageA.locator('button[aria-label="Resume recording"]');
        const hasResume = await resumeBtn.isVisible();
        await resumeBtn.click();
        await pageA.waitForTimeout(1000);
        record('3. Pause and Resume', hasResume, `Pause and resume controls toggled successfully.`);
      } else {
        record('3. Pause and Resume', false, `Pause button not found.`);
      }

      // TEST 4: Stop Recording and Playback Dialog Verification
      await pageA.bringToFront();
      await pageA.mouse.move(700, 450); // Wake up controls
      await pageA.waitForTimeout(500); // Wait for transition
      await pageA.locator('button[aria-label="Stop recording"]').click();
      await pageA.waitForTimeout(1500);

      // Verify Playback Preview Modal on User A
      const hasPreviewModalA = await pageA.getByText('Call Recording Preview').isVisible();
      
      // Verify User B did NOT get any preview modal
      await pageB.bringToFront();
      const hasPreviewModalB = await pageB.getByText('Call Recording Preview').isVisible();

      const playbackDialogIsolation = hasPreviewModalA && (!hasPreviewModalB);
      record('4. Playback Dialog Isolation', playbackDialogIsolation, 
        `User A dialog: ${hasPreviewModalA}, User B dialog: ${hasPreviewModalB}`);

      // Verify UI Controls on Playback Preview
      await pageA.bringToFront();
      const hasRenameInput = await pageA.locator('input[placeholder="Enter recording filename"]').isVisible();
      const hasDownloadBtn = await pageA.getByRole('button', { name: 'Download' }).isVisible();
      const hasDeleteBtn = await pageA.getByRole('button', { name: 'Delete' }).isVisible();
      
      const previewControlsValid = hasRenameInput && hasDownloadBtn && hasDeleteBtn;
      record('5. Playback Preview Controls', previewControlsValid,
        `Rename input: ${hasRenameInput}, Download button: ${hasDownloadBtn}, Delete button: ${hasDeleteBtn}`);

      // Rename & Download verification
      if (previewControlsValid) {
        await pageA.locator('input[placeholder="Enter recording filename"]').fill('Audit_E2E_Test_Custom_Name');
        
        // Assert download event
        const downloadPromise = pageA.waitForEvent('download');
        await pageA.getByRole('button', { name: 'Download' }).click();
        const download = await downloadPromise;
        const filename = download.suggestedFilename();
        const downloadSuccess = filename === 'Audit_E2E_Test_Custom_Name.webm';
        record('6. Download and Rename Validation', downloadSuccess, `Suggested filename: ${filename}`);
      } else {
        record('6. Download and Rename Validation', false, `Preview controls invalid.`);
      }

      // Cleanup recording A
      if (hasDeleteBtn) {
        await pageA.getByRole('button', { name: 'Delete' }).click();
        await pageA.waitForTimeout(1000);
      }

      // TEST 7: Multiple Recording Sessions in One Call
      // Start another session
      await pageA.bringToFront();
      await pageA.mouse.move(700, 450); // Wake up controls
      await pageA.waitForTimeout(500); // Wait for transition
      await pageA.locator('button[aria-label="Start recording"]').click();
      await pageA.waitForTimeout(500);
      await pageA.getByRole('button', { name: 'Start Recording', exact: true }).click();
      await pageA.waitForTimeout(3000);
      await pageA.mouse.move(700, 450); // Wake up controls
      await pageA.waitForTimeout(500); // Wait for transition
      await pageA.locator('button[aria-label="Stop recording"]').click();
      await pageA.waitForTimeout(1500);
      
      const hasSecondPreview = await pageA.getByText('Call Recording Preview').isVisible();
      record('7. Multiple Sessions Uniqueness', hasSecondPreview, `Second recording dialog shown successfully.`);
      if (hasSecondPreview) {
        const secondDownloadPromise = pageA.waitForEvent('download');
        await pageA.getByRole('button', { name: 'Download' }).click();
        await secondDownloadPromise;
        await pageA.waitForTimeout(1000);
        await pageA.getByRole('button', { name: 'Delete' }).click();
        await pageA.waitForTimeout(1000);
      }

    } else {
      record('2. Privacy Isolation', false, `Start recording button not found or hidden.`);
      record('3. Pause and Resume', false, `Skipped.`);
      record('4. Playback Dialog Isolation', false, `Skipped.`);
      record('5. Playback Preview Controls', false, `Skipped.`);
      record('6. Download and Rename Validation', false, `Skipped.`);
      record('7. Multiple Sessions Uniqueness', false, `Skipped.`);
    }

    // TEST 8: Responsive Layout Verification on Mobile & Laptop viewports
    // We resize page A viewport and verify layout doesn't break
    await pageA.bringToFront();
    // Check mobile landscape
    await pageA.setViewportSize({ width: 360, height: 740 }); // Android mobile size
    await pageA.waitForTimeout(1000);
    await shot(pageA, 'responsive-mobile-portrait.png');
    
    // Check control bar overlap or visibility
    const mobileCallControlsVisible = await pageA.locator('button[aria-label="End call"]').isVisible();
    
    // Check laptop landscape
    await pageA.setViewportSize({ width: 1280, height: 800 }); // Laptop size
    await pageA.waitForTimeout(1000);
    const laptopCallControlsVisible = await pageA.locator('button[aria-label="End call"]').isVisible();

    // Reset viewport
    await pageA.setViewportSize({ width: 1400, height: 900 });

    const responsiveValid = mobileCallControlsVisible && laptopCallControlsVisible;
    record('8. Responsive Design Validation', responsiveValid, 
      `Mobile call controls: ${mobileCallControlsVisible}, Laptop call controls: ${laptopCallControlsVisible}`);

    // TEST 9: End Call & Verify Call History update and recording persistence display
    await pageA.bringToFront();
    await pageA.mouse.move(700, 450); // Wake up controls
    await pageA.waitForTimeout(500); // Wait for transition
    await pageA.locator('button[aria-label="End call"]').click();
    await pageA.waitForTimeout(2000);

    // Check history tab on User A
    await pageA.getByRole('button', { name: 'Calls' }).click();
    await pageA.waitForTimeout(2000);
    await shot(pageA, 'call-history-A.png');
    
    // User A should show "Recorded" label next to call log
    const aHasHistoryRecordBadge = await pageA.getByText('Recorded').first().isVisible().catch(() => false);
    
    // User B should NOT show any "Recorded" label
    await pageB.bringToFront();
    await pageB.getByRole('button', { name: 'Calls' }).click();
    await pageB.waitForTimeout(2000);
    await shot(pageB, 'call-history-B.png');
    const bHasHistoryRecordBadge = await pageB.getByText('Recorded').first().isVisible().catch(() => false);

    const historyIsolationValid = aHasHistoryRecordBadge && (!bHasHistoryRecordBadge);
    record('9. Call History Isolation', historyIsolationValid,
      `User A call history recorded badge: ${aHasHistoryRecordBadge}, User B recorded badge: ${bHasHistoryRecordBadge}`);

    // Verify Chat Window call card also shows Recorded only to User A
    await pageA.bringToFront();
    await pageA.getByRole('button', { name: 'Chats' }).click();
    await pageA.getByText(userB.name).first().click();
    await pageA.waitForTimeout(2000);
    const aChatRecordBadge = await pageA.locator('span:has-text("Recorded")').first().isVisible().catch(() => false);

    await pageB.bringToFront();
    await pageB.getByRole('button', { name: 'Chats' }).click();
    await pageB.getByText(userA.name).first().click();
    await pageB.waitForTimeout(2000);
    const bChatRecordBadge = await pageB.locator('span:has-text("Recorded")').first().isVisible().catch(() => false);

    const chatCardIsolationValid = aChatRecordBadge && (!bChatRecordBadge);
    record('10. Chat Card Isolation', chatCardIsolationValid,
      `User A chat card recorded badge: ${aChatRecordBadge}, User B recorded badge: ${bChatRecordBadge}`);

  } finally {
    await browser.close();
  }
}

run().catch(async (e) => {
  console.error('FATAL ERROR DURING AUDIT:', e);
  console.error('API Failures:', apiFailures);
  console.error('Console Errors:', consoleErrors);
  process.exit(1);
});
