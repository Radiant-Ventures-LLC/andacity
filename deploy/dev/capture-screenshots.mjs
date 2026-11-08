#!/usr/bin/env node
// Capture portfolio screenshots of dev.andacity.com through the Cloudflare Access gate.
//
// Usage (needs the `playwright` package resolvable, e.g. `npm i -g playwright`):
//   set -a; . ~/.config/andacity/access-service-token; set +a
//   node deploy/dev/capture-screenshots.mjs [outDir] [baseUrl]
//
// Auth: sends CF-Access-Client-Id / CF-Access-Client-Secret (service token) on every request.

import { chromium } from "playwright";
import { mkdir } from "node:fs/promises";
import { join } from "node:path";

const OUT = process.argv[2] || "tmp/dev-screenshots";
const BASE = (process.argv[3] || "https://dev.andacity.com").replace(/\/$/, "");
const { CF_ACCESS_CLIENT_ID: id, CF_ACCESS_CLIENT_SECRET: secret } = process.env;
if (!id || !secret) throw new Error("CF_ACCESS_CLIENT_ID / CF_ACCESS_CLIENT_SECRET not set");

// Dates inside the seeded horizon (2026-11-07 .. 2027-03-06).
const DEPART = "2026-12-10";
const RETURN = "2026-12-17";

const PAGES = [
  ["01-home", "/"],
  ["02-explore", "/explore/"],
  ["03-destinations", "/destinations/"],
  ["04-destination-detail", { discover: "/destinations/", match: /^\/destinations\/[^/?#]+\/?$/ }],
  ["05-hotels", "/hotels/"],
  ["06-hotels-paris", "/hotels/in/paris/"],
  ["07-hotel-detail", { discover: "/hotels/in/paris/", match: /^\/hotels\/(?!in\/|search\/|stay\/)[^/?#]+\/?$/ }],
  ["08-flights", "/flights/"],
  ["09-flight-results-den-jfk", `/flights/search/DEN-JFK/${DEPART}/return/${RETURN}/`],
  ["10-flight-itinerary", { discover: `/flights/search/DEN-JFK/${DEPART}/return/${RETURN}/`, match: /^\/flights\/itinerary\// }],
  ["11-car-rentals", "/car-rentals/"],
  ["12-car-results-den", `/car-rentals/search/DEN/${DEPART}/2026-12-14/`],
  ["13-my-trips", "/my-trips/"],
];

const VIEWPORTS = [
  ["desktop", { width: 1440, height: 900 }, 1],
  ["mobile", { width: 390, height: 844 }, 3],
];

await mkdir(OUT, { recursive: true });
// PW_CHANNEL=chrome uses the system Google Chrome instead of Playwright's bundled build.
const browser = await chromium.launch(process.env.PW_CHANNEL ? { channel: process.env.PW_CHANNEL } : {});
const report = [];

for (const [vpName, viewport, deviceScaleFactor] of VIEWPORTS) {
  const ctx = await browser.newContext({
    viewport,
    deviceScaleFactor,
    isMobile: vpName === "mobile",
    extraHTTPHeaders: { "CF-Access-Client-Id": id, "CF-Access-Client-Secret": secret },
  });
  const page = await ctx.newPage();
  const consoleErrors = [];
  page.on("pageerror", (e) => consoleErrors.push(String(e).slice(0, 200)));

  for (const [name, target] of PAGES) {
    let path = target;
    if (typeof target === "object") {
      await page.goto(BASE + target.discover, { waitUntil: "networkidle", timeout: 60_000 });
      const hrefs = await page.$$eval("a[href]", (as) => as.map((a) => new URL(a.href).pathname));
      path = hrefs.find((h) => target.match.test(h));
      if (!path) { report.push({ vp: vpName, name, status: "no-link-found" }); continue; }
    }
    consoleErrors.length = 0;
    const res = await page.goto(BASE + path, { waitUntil: "networkidle", timeout: 60_000 });
    await page.waitForTimeout(600); // let fonts/images and entrance transitions settle
    const brokenImages = await page.$$eval("img", (imgs) => imgs.filter((i) => i.complete && i.naturalWidth === 0).length);
    const file = join(OUT, `${name}--${vpName}.png`);
    await page.screenshot({ path: file, fullPage: false });
    await page.screenshot({ path: file.replace(/\.png$/, "--full.png"), fullPage: true });
    report.push({ vp: vpName, name, path, status: res?.status(), errors: consoleErrors.length, brokenImages });
  }
  await ctx.close();
}

await browser.close();
console.table(report);
