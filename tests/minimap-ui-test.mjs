import { chromium } from "playwright";
import { writeFileSync, mkdirSync } from "fs";
import { join } from "path";

const BASE_URL = "http://localhost:3001";
const OUT_DIR = "/Users/arnavverma/Desktop/excalidraw/tests";
const screenshots = [];
const consoleMessages = [];
const results = [];

function record(area, control, status, evidence) {
  results.push({ area, control, status, evidence });
}

async function screenshot(page, name) {
  const path = join(OUT_DIR, `minimap-${name}.png`);
  await page.screenshot({ path, fullPage: false });
  screenshots.push({ name, path: `minimap-${name}.png` });
  return path;
}

async function getViewportRectStyle(page) {
  return page.locator(".Minimap__viewport").evaluate((el) => {
    const s = el.style;
    return { left: s.left, top: s.top, width: s.width, height: s.height };
  });
}

async function getMinimapCanvasPixelData(page) {
  return page.locator(".Minimap__canvas").evaluate((canvas) => {
    const ctx = canvas.getContext("2d");
    const w = canvas.width;
    const h = canvas.height;
    const data = ctx.getImageData(0, 0, w, h).data;
    let nonBg = 0;
    for (let i = 0; i < data.length; i += 4) {
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];
      const a = data[i + 3];
      if (a > 10 && !(r > 240 && g > 240 && b > 240)) {
        nonBg++;
      }
    }
    return { width: canvas.clientWidth, height: canvas.clientHeight, nonBgPixels: nonBg };
  });
}

async function main() {
  mkdirSync(OUT_DIR, { recursive: true });

  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });

  page.on("console", (msg) => {
    if (msg.type() === "error") {
      consoleMessages.push(`ERROR: ${msg.text()}`);
    }
  });
  page.on("pageerror", (err) => {
    consoleMessages.push(`PAGEERROR: ${err.message}`);
  });

  await page.goto(BASE_URL, { waitUntil: "networkidle" });
  await page.waitForTimeout(1500);

  // Dismiss welcome screen if present
  const welcomeDismiss = page.locator('button:has-text("Got it")');
  if (await welcomeDismiss.count()) {
    await welcomeDismiss.first().click();
    await page.waitForTimeout(500);
  }

  await screenshot(page, "01-initial-load");

  // Test 1: Minimap appears bottom-left above zoom controls, 160x120
  const minimap = page.locator(".Minimap");
  const minimapVisible = await minimap.isVisible();
  const container = page.locator(".Minimap__container");
  const containerBox = await container.boundingBox();
  const zoomActions = page.locator(".zoom-actions");
  const zoomBox = await zoomActions.boundingBox();
  const footerLeft = page.locator(".layer-ui__wrapper__footer-left");

  let test1Status = "FAIL";
  let test1Evidence = "";
  if (!minimapVisible) {
    test1Evidence = "Minimap not visible in DOM";
  } else if (!containerBox) {
    test1Evidence = "Minimap container has no bounding box";
  } else {
    const w = Math.round(containerBox.width);
    const h = Math.round(containerBox.height);
    const aboveZoom = zoomBox ? containerBox.y + containerBox.height <= zoomBox.y + 2 : null;
    const inFooterLeft = await footerLeft.locator(".Minimap").count() > 0;
    const sizeOk = w === 160 && h === 120;
    if (sizeOk && inFooterLeft && aboveZoom) {
      test1Status = "PASS";
      test1Evidence = `Minimap ${w}x${h}px, above zoom controls (minimap bottom=${Math.round(containerBox.y + containerBox.height)}, zoom top=${Math.round(zoomBox?.y ?? 0)})`;
    } else {
      test1Evidence = `Size ${w}x${h} (expected 160x120), inFooterLeft=${inFooterLeft}, aboveZoom=${aboveZoom}`;
    }
  }
  record("Minimap", "Appears bottom-left 160x120 above zoom", test1Status, test1Evidence);

  // Test 2: Draw rectangle - minimap shows thumbnail
  await page.keyboard.press("r");
  await page.waitForTimeout(300);
  const canvas = page.locator("canvas.excalidraw__canvas").first();
  const canvasBox = await canvas.boundingBox();
  if (!canvasBox) {
    record("Minimap", "Rectangle thumbnail on minimap", "FAIL", "Main canvas not found");
  } else {
    const beforeDraw = await getMinimapCanvasPixelData(page);
    const cx = canvasBox.x + canvasBox.width * 0.45;
    const cy = canvasBox.y + canvasBox.height * 0.4;
    await page.mouse.move(cx, cy);
    await page.mouse.down();
    await page.mouse.move(cx + 180, cy + 120, { steps: 10 });
    await page.mouse.up();
    await page.waitForTimeout(800);
    await screenshot(page, "02-after-rectangle");
    const afterDraw = await getMinimapCanvasPixelData(page);
    const thumbOk = afterDraw.nonBgPixels > beforeDraw.nonBgPixels + 50;
    record(
      "Minimap",
      "Shows rectangle thumbnail after draw",
      thumbOk ? "PASS" : "FAIL",
      `nonBg pixels before=${beforeDraw.nonBgPixels} after=${afterDraw.nonBgPixels}`,
    );
  }

  // Test 3: Pan/zoom - viewport rect moves
  const viewportBefore = await getViewportRectStyle(page);
  await page.keyboard.press("v");
  await page.waitForTimeout(200);
  // Pan with hand tool - press h and drag
  await page.keyboard.press("h");
  await page.waitForTimeout(200);
  if (canvasBox) {
    await page.mouse.move(canvasBox.x + 400, canvasBox.y + 300);
    await page.mouse.down();
    await page.mouse.move(canvasBox.x + 200, canvasBox.y + 150, { steps: 8 });
    await page.mouse.up();
    await page.waitForTimeout(500);
  }
  const viewportAfterPan = await getViewportRectStyle(page);
  await screenshot(page, "03-after-pan");

  const panMoved =
    viewportBefore.left !== viewportAfterPan.left ||
    viewportBefore.top !== viewportAfterPan.top;

  // Zoom in via button
  const zoomIn = page.locator('button[title="Zoom in"]').first();
  if (await zoomIn.count()) {
    await zoomIn.click();
    await zoomIn.click();
    await page.waitForTimeout(400);
  }
  const viewportAfterZoom = await getViewportRectStyle(page);
  await screenshot(page, "04-after-zoom");
  const zoomChanged =
    viewportAfterPan.width !== viewportAfterZoom.width ||
    viewportAfterPan.height !== viewportAfterZoom.height;

  record(
    "Minimap",
    "Viewport rect moves on pan/zoom",
    panMoved || zoomChanged ? "PASS" : "FAIL",
    `pan: before=${JSON.stringify(viewportBefore)} afterPan=${JSON.stringify(viewportAfterPan)}; zoom rect=${JSON.stringify(viewportAfterZoom)}`,
  );

  // Test 4: Click minimap - main canvas pans
  const scrollBefore = await page.evaluate(() => {
    const app = window.h?.app;
    if (!app) return null;
    return { scrollX: app.state.scrollX, scrollY: app.state.scrollY };
  });

  const minimapBox = await container.boundingBox();
  if (minimapBox && scrollBefore) {
    // Click bottom-right corner of minimap (different from center viewport)
    const clickX = minimapBox.x + minimapBox.width * 0.85;
    const clickY = minimapBox.y + minimapBox.height * 0.85;
    await page.mouse.click(clickX, clickY);
    await page.waitForTimeout(600);
    await screenshot(page, "05-after-minimap-click");
    const scrollAfter = await page.evaluate(() => {
      const app = window.h?.app;
      if (!app) return null;
      return { scrollX: app.state.scrollX, scrollY: app.state.scrollY };
    });
    const panned =
      scrollAfter &&
      (Math.abs(scrollAfter.scrollX - scrollBefore.scrollX) > 1 ||
        Math.abs(scrollAfter.scrollY - scrollBefore.scrollY) > 1);
    record(
      "Minimap",
      "Click pans main canvas",
      panned ? "PASS" : "FAIL",
      `scroll before=${JSON.stringify(scrollBefore)} after=${JSON.stringify(scrollAfter)}`,
    );
  } else {
    record(
      "Minimap",
      "Click pans main canvas",
      "SUSPECT",
      "Could not read window.h.app scroll state or minimap box missing",
    );
  }

  // Test 5: Console errors
  record(
    "App",
    "No console errors",
    consoleMessages.length === 0 ? "PASS" : "FAIL",
    consoleMessages.length ? consoleMessages.join("; ") : "No console errors captured",
  );

  await browser.close();

  const report = {
    results,
    consoleMessages,
    screenshots,
    timestamp: "2026-08-03-0940",
  };
  writeFileSync(join(OUT_DIR, "minimap-ui-test-output.json"), JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report, null, 2));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
