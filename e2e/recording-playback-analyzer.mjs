import { chromium } from '@playwright/test';
import { readFileSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const BASE_URL = 'http://localhost:5173';
const DOWNLOAD_DIR = join(__dirname, 'downloads');
mkdirSync(DOWNLOAD_DIR, { recursive: true });

const ts = Date.now();
const userA = {
  name: `AnalyzerA${ts}`,
  email: `analyzera${ts}@example.com`,
  password: 'TestPass123!',
};
const userB = {
  name: `AnalyzerB${ts}`,
  email: `analyzerb${ts}@example.com`,
  password: 'TestPass123!',
};

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
  console.log('Launching browser contexts...');
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

  try {
    console.log('Registering users...');
    await registerUser(pageA, userA);
    await registerUser(pageB, userB);

    console.log('Establishing friendship...');
    await openFindPeople(pageA);
    await searchAndAdd(pageA, userB.name);

    await pageB.bringToFront();
    await pageB.getByRole('button', { name: 'Requests' }).click();
    await pageB.waitForTimeout(1500);
    await pageB.getByRole('button', { name: 'Accept' }).first().click();
    await pageB.waitForTimeout(1500);

    console.log('Opening chat windows...');
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

    console.log('Initiating video call...');
    await pageA.bringToFront();
    await pageA.getByRole('button', { name: 'Video Call' }).click();
    await pageA.waitForTimeout(2000);

    console.log('Answering call...');
    await pageB.bringToFront();
    await pageB.getByRole('button', { name: 'Accept Call' }).click();
    await pageB.waitForTimeout(3000);

    console.log('Starting call recording (User A)...');
    await pageA.bringToFront();
    await pageA.mouse.move(700, 450); // Wake up controls
    await pageA.waitForTimeout(500);
    await pageA.locator('button[aria-label="Start recording"]').click();
    await pageA.waitForTimeout(1000);

    const hasConfirm = await pageA.getByRole('button', { name: 'Start Recording', exact: true }).isVisible();
    if (hasConfirm) {
      await pageA.getByRole('button', { name: 'Start Recording', exact: true }).click();
      console.log('Confirmed recording dialog.');
    }

    console.log('Recording active call... waiting 30 seconds...');
    await pageA.waitForTimeout(30000);

    console.log('Stopping recording...');
    await pageA.mouse.move(700, 450); // Wake up controls
    await pageA.waitForTimeout(500);
    await pageA.locator('button[aria-label="Stop recording"]').click();
    await pageA.waitForTimeout(2000);

    console.log('Downloading recording...');
    const downloadPromise = pageA.waitForEvent('download');
    await pageA.getByRole('button', { name: 'Download' }).click();
    const download = await downloadPromise;
    const downloadPath = join(DOWNLOAD_DIR, 'playback-test.webm');
    await download.saveAs(downloadPath);
    console.log(`Recording downloaded successfully to: ${downloadPath}`);

    // Dismiss the playback modal so it does not block the UI
    await pageA.getByRole('button', { name: 'Delete' }).click();
    await pageA.waitForTimeout(1000);

    console.log('Ending call...');
    await pageA.getByRole('button', { name: 'End Call' }).click();
    await pageA.waitForTimeout(2000);

    console.log('Analyzing recording content...');
    const pageC = await contextA.newPage();
    const fileBuffer = readFileSync(downloadPath);
    await pageC.goto('about:blank');
    
    const analysis = await pageC.evaluate(async (byteArray) => {
      const blob = new Blob([new Uint8Array(byteArray)], { type: 'video/webm' });
      const url = URL.createObjectURL(blob);
      
      const video = document.createElement('video');
      video.id = 'playback-video';
      video.src = url;
      video.controls = true;
      video.autoplay = true;
      video.muted = false;
      document.body.appendChild(video);

      await new Promise((resolve) => {
        if (video.readyState >= 1) resolve();
        else video.onloadedmetadata = resolve;
      });

      const AudioContextClass = window.AudioContext || window.webkitAudioContext;
      const ctx = new AudioContextClass();
      const source = ctx.createMediaElementSource(video);
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 256;
      source.connect(analyser);
      analyser.connect(ctx.destination);

      video.play();
      // Wait for playback and sample audio energy
      await new Promise(r => setTimeout(r, 3000));

      const bufferLength = analyser.frequencyBinCount;
      const dataArray = new Uint8Array(bufferLength);
      analyser.getByteFrequencyData(dataArray);

      let sum = 0;
      for (let i = 0; i < bufferLength; i++) {
        sum += dataArray[i];
      }
      const avgAmplitude = sum / bufferLength;

      return {
        duration: video.duration,
        videoWidth: video.videoWidth,
        videoHeight: video.videoHeight,
        avgAmplitude,
        frequencies: Array.from(dataArray)
      };
    }, Array.from(fileBuffer));

    console.log('\n================ RECORDING ANALYSIS REPORT ================');
    console.log(`- File Path: ${downloadPath}`);
    console.log(`- Video Resolution: ${analysis.videoWidth}x${analysis.videoHeight}`);
    console.log(`- Duration: ${analysis.duration.toFixed(2)} seconds`);
    console.log(`- Average Audio Amplitude: ${analysis.avgAmplitude.toFixed(2)}`);
    console.log(`- Frequency Data Sampled: [${analysis.frequencies.slice(0, 10).join(', ')}...]`);
    
    const isPlaybackSmooth = analysis.duration > 0 && !isNaN(analysis.duration);
    const hasVideoTrack = analysis.videoWidth > 0 && analysis.videoHeight > 0;
    const hasAudioTrack = analysis.avgAmplitude > 0;

    console.log('\nVerification Summary:');
    console.log(`[✔] File plays back successfully: ${isPlaybackSmooth}`);
    console.log(`[✔] Video track is present and correct: ${hasVideoTrack}`);
    console.log(`[✔] Audio track contains active sound: ${hasAudioTrack}`);
    console.log('===========================================================\n');

    if (isPlaybackSmooth && hasVideoTrack && hasAudioTrack) {
      console.log('VERDICT: SUCCESS - Recording is uncorrupted and contains active audio/video!');
    } else {
      console.error('VERDICT: FAILURE - Corrupt or empty tracks found!');
      process.exit(1);
    }

  } finally {
    await browser.close();
  }
}

run().catch((err) => {
  console.error('Playback analysis failed:', err);
  process.exit(1);
});
