import { spawn } from "node:child_process";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const workspaceRoot = process.env.WORKSPACE_ROOT || path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const artifactsDir = path.join(workspaceRoot, "artifacts");
const framesDir = path.join(artifactsDir, "dark-mode-frames");
const outputVideo = path.join(artifactsDir, "excalidraw-dark-mode-demo.mp4");

const appUrl = process.env.EXCALIDRAW_APP_URL || "http://localhost:3001/";

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function run() {
  const puppeteer = await import("puppeteer");

  await mkdir(framesDir, { recursive: true });

  const browser = await puppeteer.default.launch({
    headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox", "--window-size=1440,900"],
    defaultViewport: { width: 1440, height: 900 },
  });

  const page = await browser.newPage();

  await page.goto(appUrl, { waitUntil: "networkidle2", timeout: 120_000 });
  await sleep(2000);

  // Dismiss welcome screen if present.
  await page.keyboard.press("Escape");
  await sleep(500);

  let frame = 0;
  const capture = async () => {
    const file = path.join(framesDir, `frame-${String(frame++).padStart(3, "0")}.png`);
    await page.screenshot({ path: file });
  };

  for (let i = 0; i < 3; i++) {
    await capture();
    await sleep(400);
  }

  const setTheme = async (theme) => {
    await page.evaluate((nextTheme) => {
      localStorage.setItem("excalidraw-theme", nextTheme);
      window.dispatchEvent(new Event("storage"));
    }, theme);
    await page.reload({ waitUntil: "networkidle2" });
    await sleep(1500);
  };

  await setTheme("dark");

  for (let i = 0; i < 5; i++) {
    await capture();
    await sleep(400);
  }

  await setTheme("light");

  for (let i = 0; i < 3; i++) {
    await capture();
    await sleep(400);
  }

  await browser.close();

  await new Promise((resolve, reject) => {
    const ffmpeg = spawn(
      "ffmpeg",
      [
        "-y",
        "-framerate",
        "2",
        "-i",
        path.join(framesDir, "frame-%03d.png"),
        "-vf",
        "scale=1440:900:flags=lanczos",
        "-c:v",
        "libx264",
        "-pix_fmt",
        "yuv420p",
        "-movflags",
        "+faststart",
        outputVideo,
      ],
      { stdio: "inherit" },
    );

    ffmpeg.on("close", (code) => {
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`ffmpeg exited with code ${code}`));
      }
    });
  });

  await writeFile(
    path.join(artifactsDir, "dark-mode-demo-readme.txt"),
    `Demo video: ${outputVideo}\nSource: ${appUrl}\n`,
  );

  console.log(`Wrote ${outputVideo}`);
}

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
