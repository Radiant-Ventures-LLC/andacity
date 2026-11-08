#!/usr/bin/env node
// Renders the illustrated placeholder photos the seed data points at
// (public/img/demo/{hotel,car}-{1..4}.jpg). Same flat, saturated-gradient style
// as public/images/hero/*.svg so mock inventory reads as intentional art,
// not broken photos.
//
// Usage (needs `playwright` resolvable and a Chromium; PW_CHANNEL=chrome uses system Chrome):
//   node scripts/assets/demo-placeholders.mjs [outDir]
import { chromium } from "playwright";
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";

const OUT = process.argv[2] || "public/img/demo";
const W = 1200;
const H = 900;

const svg = (title, defs, body) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}">
<title>${title}</title><defs>${defs}</defs>${body}</svg>`;

const lin = (id, stops, x2 = 0, y2 = 1) =>
  `<linearGradient id="${id}" x1="0" y1="0" x2="${x2}" y2="${y2}">${stops
    .map(([o, c, a = 1]) => `<stop offset="${o}%" stop-color="${c}" stop-opacity="${a}"/>`)
    .join("")}</linearGradient>`;
const rad = (id, cx, cy, r, stops) =>
  `<radialGradient id="${id}" cx="${cx}%" cy="${cy}%" r="${r}%">${stops
    .map(([o, c, a = 1]) => `<stop offset="${o}%" stop-color="${c}" stop-opacity="${a}"/>`)
    .join("")}</radialGradient>`;

// Deterministic "lit window" pattern so renders are stable between runs.
const windows = (x, y, cols, rows, w, h, gx, gy, lit, dim, seed = 1) => {
  let s = seed, out = "";
  for (let r = 0; r < rows; r++)
    for (let c = 0; c < cols; c++) {
      s = (s * 9301 + 49297) % 233280;
      const on = s / 233280 > 0.32;
      out += `<rect x="${x + c * (w + gx)}" y="${y + r * (h + gy)}" width="${w}" height="${h}" rx="2" fill="${on ? lit : dim}"/>`;
    }
  return out;
};

const palm = (x, y, s = 1, fill = "#06302c") => `<g transform="translate(${x} ${y}) scale(${s})" fill="${fill}">
<path d="M-6 0 C-2 -120 6 -200 18 -260 L28 -258 C16 -196 10 -120 8 0Z"/>
<path d="M22 -262 C-30 -290 -90 -280 -130 -240 C-80 -262 -30 -262 22 -250Z"/>
<path d="M22 -262 C70 -300 130 -296 168 -258 C120 -276 70 -270 26 -250Z"/>
<path d="M22 -262 C0 -320 -50 -340 -96 -330 C-50 -318 -10 -300 18 -254Z"/>
<path d="M22 -262 C50 -326 100 -344 140 -334 C96 -320 60 -300 28 -252Z"/>
<path d="M22 -262 C-10 -240 -40 -200 -52 -150 C-24 -196 0 -226 24 -250Z"/></g>`;

// Side-profile car built from a body path + wheels; body path is in a 600x200 box.
const car = (x, y, s, body, color, glass, trim = "#0b1020") => `<g transform="translate(${x} ${y}) scale(${s})">
<ellipse cx="300" cy="196" rx="300" ry="16" fill="#000" opacity="0.28"/>
<path d="${body.shell}" fill="${color}"/>
${body.seats ? `<path d="${body.seats}" fill="${trim}"/>` : ""}
<path d="${body.glass}" fill="${glass}"/>
<path d="${body.shell}" fill="url(#sheen)"/>
<rect x="${body.light[0]}" y="${body.light[1]}" width="26" height="12" rx="5" fill="#fff7cc"/>
<rect x="${body.tail[0]}" y="${body.tail[1]}" width="16" height="12" rx="4" fill="#ef4444"/>
${body.wheels.map((wx) => `<circle cx="${wx}" cy="168" r="40" fill="${trim}"/><circle cx="${wx}" cy="168" r="22" fill="#cbd5e1"/><circle cx="${wx}" cy="168" r="8" fill="${trim}"/>`).join("")}
</g>`;

const BODIES = {
  hatch: {
    shell: "M40 160 C30 130 40 104 78 98 L170 88 C214 50 260 30 330 28 L410 30 C450 34 470 60 500 96 L548 106 C572 112 580 132 576 160Z",
    glass: "M190 92 C226 60 262 46 320 44 L400 46 C430 50 448 72 466 96Z",
    light: [548, 116], tail: [42, 112], wheels: [150, 470],
  },
  suv: {
    shell: "M30 162 C24 120 30 96 60 90 L120 84 L170 30 C178 22 190 18 204 18 L430 18 C452 18 466 30 476 48 L512 88 L560 96 C580 100 588 124 584 162Z",
    glass: "M140 86 L188 38 C192 34 198 32 206 32 L300 32 L300 86Z M312 32 L424 32 C440 32 452 40 460 54 L486 86 L312 86Z",
    light: [556, 104], tail: [32, 100], wheels: [148, 462],
  },
  sedan: {
    shell: "M24 160 C18 130 30 110 70 104 L170 96 C220 54 270 40 330 40 L390 42 C430 46 460 70 490 98 L556 108 C584 114 592 136 588 160Z",
    glass: "M190 98 C230 64 270 54 326 54 L340 54 L340 98Z M352 54 L388 56 C418 60 440 76 462 98 L352 98Z",
    light: [560, 118], tail: [26, 114], wheels: [148, 474],
  },
  convertible: {
    shell: "M20 160 C14 132 24 116 64 110 L540 104 C578 108 592 132 588 160Z",
    glass: "M404 106 L426 62 L438 62 L420 106Z",
    seats: "M226 108 C226 72 236 62 254 62 C272 62 278 74 278 108Z M318 108 C318 78 326 68 342 68 C358 68 364 78 364 108Z",
    light: [560, 116], tail: [22, 118], wheels: [146, 472],
  },
};
const SHEEN = lin("sheen", [[0, "#ffffff", 0.32], [45, "#ffffff", 0.04], [100, "#000000", 0.18]]);

const IMAGES = {
  "hotel-1": svg("City tower hotel at dusk",
    lin("sky", [[0, "#1e1b4b"], [45, "#7c3aed"], [78, "#ec4899"], [100, "#fb923c"]], 0.3, 1) +
      rad("glow", 22, 74, 60, [[0, "#fde68a", 0.7], [100, "#fde68a", 0]]) +
      lin("tower", [[0, "#312e81"], [100, "#0f0a2e"]], 1, 0) +
      lin("tower2", [[0, "#4c1d95"], [100, "#1e1b4b"]], 1, 0),
    `<rect width="${W}" height="${H}" fill="url(#sky)"/><rect width="${W}" height="${H}" fill="url(#glow)"/>
<circle cx="930" cy="190" r="54" fill="#fff7ed" opacity="0.9"/>
<rect x="40" y="430" width="170" height="470" fill="#2e1065" opacity="0.7"/>
<rect x="960" y="380" width="200" height="520" fill="#2e1065" opacity="0.7"/>
<rect x="760" y="300" width="190" height="600" fill="url(#tower2)"/>${windows(782, 330, 5, 15, 22, 18, 12, 18, "#fcd34d", "#3b2a6b", 7)}
<path d="M380 900 V170 L500 110 L620 170 V900Z" fill="url(#tower)"/>
<rect x="490" y="40" width="6" height="80" fill="#c4b5fd"/>${windows(408, 200, 6, 15, 20, 20, 14, 18, "#fde68a", "#2b2560", 3)}
<rect x="220" y="520" width="150" height="380" fill="url(#tower2)"/>${windows(238, 548, 4, 9, 20, 18, 12, 16, "#fdba74", "#3b2a6b", 11)}
<rect x="0" y="840" width="${W}" height="60" fill="#0b0720"/>
<rect x="430" y="800" width="140" height="40" rx="6" fill="#fde68a" opacity="0.9"/>`),

  "hotel-2": svg("Coastal resort with pool",
    lin("sky", [[0, "#0e7490"], [55, "#67e8f9"], [100, "#fed7aa"]]) +
      rad("sun", 78, 30, 40, [[0, "#fff7ed", 0.95], [100, "#fff7ed", 0]]) +
      lin("sea", [[0, "#0891b2"], [100, "#155e75"]]) +
      lin("pool", [[0, "#22d3ee"], [100, "#0ea5e9"]], 1, 0),
    `<rect width="${W}" height="${H}" fill="url(#sky)"/><rect width="${W}" height="${H}" fill="url(#sun)"/>
<circle cx="940" cy="270" r="70" fill="#fff7ed"/>
<rect y="470" width="${W}" height="140" fill="url(#sea)"/>
<path d="M0 520 H1200 M0 560 H1200" stroke="#a5f3fc" stroke-width="3" stroke-dasharray="60 40" opacity="0.5"/>
<rect x="150" y="380" width="900" height="260" fill="#fff7ed"/><rect x="150" y="370" width="900" height="20" fill="#fdba74"/>
${Array.from({ length: 9 }, (_, i) => `<path d="M${190 + i * 98} 620 V470 a34 34 0 0 1 68 0 V620Z" fill="#0e7490" opacity="0.85"/>`).join("")}
<rect x="300" y="250" width="600" height="130" fill="#ffedd5"/>
${Array.from({ length: 6 }, (_, i) => `<rect x="${330 + i * 95}" y="285" width="60" height="70" rx="30" fill="#155e75" opacity="0.8"/>`).join("")}
<rect y="640" width="${W}" height="260" fill="#fde7c7"/>
<rect x="120" y="690" width="960" height="140" rx="70" fill="url(#pool)"/>
<path d="M200 750 q40 -14 80 0 t80 0 t80 0 M620 790 q40 -14 80 0 t80 0 t80 0" stroke="#e0f2fe" stroke-width="5" fill="none" opacity="0.8"/>
${palm(80, 700, 1.25)}${palm(1100, 690, 1.1)}`),

  "hotel-3": svg("Mountain lodge at twilight",
    lin("sky", [[0, "#0c1445"], [50, "#4338ca"], [100, "#f9a8d4"]]) +
      lin("mtn", [[0, "#e0e7ff"], [30, "#818cf8"], [100, "#1e1b4b"]]) +
      lin("snow", [[0, "#f8fafc"], [100, "#c7d2fe"]]),
    `<rect width="${W}" height="${H}" fill="url(#sky)"/>
${Array.from({ length: 40 }, (_, i) => `<circle cx="${(i * 233) % W}" cy="${(i * 97) % 300}" r="${1 + (i % 3)}" fill="#fff" opacity="0.7"/>`).join("")}
<path d="M0 560 L240 260 L380 420 L600 150 L820 440 L960 300 L1200 560Z" fill="url(#mtn)"/>
<path d="M540 225 L600 150 L660 230 L630 220 L600 245 L570 218Z M200 310 L240 260 L280 306 L250 300Z M920 350 L960 300 L1000 346 L970 340Z" fill="#f8fafc"/>
<path d="M0 640 C300 560 700 600 1200 560 V900 H0Z" fill="url(#snow)"/>
${[[90, 650], [170, 620], [1040, 600], [1120, 630], [980, 650]].map(([x, y]) => `<path d="M${x} ${y} l-40 110 h80Z M${x} ${y + 40} l-50 120 h100Z" fill="#1e3a5f"/>`).join("")}
<path d="M360 760 L600 470 L840 760Z" fill="#7c2d12"/><path d="M400 760 L600 520 L800 760Z" fill="#9a3412"/>
<path d="M340 770 L600 450 L860 770" stroke="#f8fafc" stroke-width="22" fill="none" stroke-linejoin="round"/>
<path d="M520 760 V640 H680 V760Z" fill="#fbbf24"/><path d="M560 640 L600 590 L640 640Z" fill="#fde68a"/>
<rect x="596" y="640" width="8" height="120" fill="#9a3412"/><rect x="520" y="696" width="160" height="8" fill="#9a3412"/>
<rect x="430" y="700" width="60" height="60" fill="#fcd34d"/><rect x="710" y="700" width="60" height="60" fill="#fcd34d"/>
<rect x="320" y="760" width="560" height="26" rx="6" fill="#451a03"/>
<ellipse cx="600" cy="800" rx="320" ry="18" fill="#fbbf24" opacity="0.25"/>`),

  "hotel-4": svg("Boutique townhouse hotel street",
    lin("sky", [[0, "#fdba74"], [60, "#fde68a"], [100, "#fef3c7"]]) +
      lin("street", [[0, "#a8a29e"], [100, "#57534e"]]),
    `<rect width="${W}" height="${H}" fill="url(#sky)"/>
${[["#b45309", "#7c2d12", 0, 150], ["#0f766e", "#134e4a", 240, 100], ["#be123c", "#881337", 480, 130], ["#1d4ed8", "#1e3a8a", 720, 90], ["#a16207", "#713f12", 960, 160]]
  .map(([wall, dark, x, top], i) => `<rect x="${x}" y="${top}" width="240" height="${760 - top}" fill="${wall}"/>
<rect x="${x}" y="${top}" width="240" height="22" fill="${dark}"/>
${[0, 1, 2].map((r) => `<rect x="${x + 36}" y="${top + 60 + r * 150}" width="64" height="100" rx="32" fill="#fef3c7" opacity="${(i + r) % 2 ? 0.9 : 0.55}"/><rect x="${x + 140}" y="${top + 60 + r * 150}" width="64" height="100" rx="32" fill="#fef3c7" opacity="${(i + r) % 2 ? 0.55 : 0.9}"/><rect x="${x + 24}" y="${top + 160 + r * 150}" width="192" height="8" fill="${dark}"/>`).join("")}
<path d="M${x + 20} 600 H${x + 220} L${x + 205} 650 H${x + 35}Z" fill="${i % 2 ? "#fef3c7" : dark}"/>
${Array.from({ length: 5 }, (_, k) => `<rect x="${x + 35 + k * 34}" y="600" width="17" height="50" fill="${i % 2 ? dark : "#fef3c7"}" opacity="0.6"/>`).join("")}
<rect x="${x + 90}" y="670" width="60" height="90" rx="4" fill="${dark}"/>`).join("")}
<rect y="760" width="${W}" height="140" fill="url(#street)"/>
<path d="M0 830 H1200" stroke="#fef3c7" stroke-width="6" stroke-dasharray="70 50" opacity="0.6"/>
${[236, 716].map((x) => `<rect x="${x}" y="560" width="8" height="200" fill="#1c1917"/><circle cx="${x + 4}" cy="550" r="18" fill="#fde68a"/>`).join("")}`),

  "car-1": svg("Compact hatchback on an open road",
    lin("sky", [[0, "#0f766e"], [60, "#5eead4"], [100, "#fde68a"]]) + lin("road", [[0, "#334155"], [100, "#0f172a"]]) + SHEEN,
    `<rect width="${W}" height="${H}" fill="url(#sky)"/><circle cx="900" cy="260" r="80" fill="#fff7ed" opacity="0.9"/>
<path d="M0 520 C200 440 420 470 600 500 C820 540 1000 470 1200 440 V620 H0Z" fill="#65a30d"/>
<path d="M0 560 C260 500 520 560 760 560 C960 560 1080 520 1200 500 V640 H0Z" fill="#3f6212"/>
<rect y="620" width="${W}" height="280" fill="url(#road)"/>
<path d="M0 760 H1200" stroke="#fde047" stroke-width="10" stroke-dasharray="90 60"/>
${car(300, 470, 1.0, BODIES.hatch, "#f97316", "#1e293b")}`),

  "car-2": svg("SUV in the desert",
    lin("sky", [[0, "#7c2d12"], [45, "#ea580c"], [100, "#fde68a"]]) + lin("road", [[0, "#78350f"], [100, "#451a03"]]) + SHEEN,
    `<rect width="${W}" height="${H}" fill="url(#sky)"/><circle cx="260" cy="300" r="90" fill="#fef3c7" opacity="0.9"/>
<path d="M0 560 L120 420 H260 L320 560Z M760 560 L860 380 H1040 L1120 560Z" fill="#9a3412"/>
<path d="M120 420 H260 L250 440 H130Z M860 380 H1040 L1030 400 H870Z" fill="#c2410c"/>
<rect y="560" width="${W}" height="340" fill="#d97706"/>
<path d="M0 700 C300 660 900 660 1200 700 V900 H0Z" fill="url(#road)"/>
${[[1040, 560], [140, 600]].map(([x, y]) => `<path d="M${x} ${y} v-110 m0 40 h-26 v-40 m26 70 h24 v-50" stroke="#14532d" stroke-width="18" stroke-linecap="round" fill="none"/>`).join("")}
${car(280, 520, 1.05, BODIES.suv, "#0f766e", "#0b1324")}`),

  "car-3": svg("Sedan on a city street at night",
    lin("sky", [[0, "#020617"], [60, "#1e3a8a"], [100, "#6d28d9"]]) + lin("road", [[0, "#1e293b"], [100, "#020617"]]) + SHEEN,
    `<rect width="${W}" height="${H}" fill="url(#sky)"/>
${[[40, 260, 140], [200, 180, 160], [380, 300, 120], [520, 140, 180], [720, 240, 150], [890, 200, 130], [1040, 280, 160]]
  .map(([x, y, w], i) => `<rect x="${x}" y="${y}" width="${w}" height="${640 - y}" fill="#0f172a"/>${windows(x + 14, y + 20, Math.floor((w - 14) / 30), Math.floor((600 - y) / 34), 16, 18, 14, 16, "#fbbf24", "#1e293b", i + 2)}`).join("")}
<rect y="640" width="${W}" height="260" fill="url(#road)"/>
<path d="M0 770 H1200" stroke="#e2e8f0" stroke-width="8" stroke-dasharray="80 60" opacity="0.7"/>
<ellipse cx="600" cy="740" rx="420" ry="30" fill="#60a5fa" opacity="0.18"/>
${car(290, 520, 1.05, BODIES.sedan, "#e2e8f0", "#0f172a")}`),

  "car-4": svg("Convertible on a coastal highway",
    lin("sky", [[0, "#0369a1"], [55, "#7dd3fc"], [100, "#fbcfe8"]]) + lin("sea", [[0, "#0284c7"], [100, "#075985"]]) + lin("road", [[0, "#475569"], [100, "#1e293b"]]) + SHEEN,
    `<rect width="${W}" height="${H}" fill="url(#sky)"/><circle cx="980" cy="240" r="64" fill="#fff7ed"/>
<rect y="460" width="${W}" height="180" fill="url(#sea)"/>
<path d="M0 500 H1200 M0 540 H1200" stroke="#bae6fd" stroke-width="3" stroke-dasharray="50 50" opacity="0.6"/>
<path d="M0 470 L160 330 L300 440 L420 380 L520 470Z" fill="#166534"/>
<rect y="640" width="${W}" height="260" fill="url(#road)"/>
<rect y="630" width="${W}" height="14" fill="#e2e8f0"/>
<path d="M0 770 H1200" stroke="#fde047" stroke-width="8" stroke-dasharray="80 60"/>
${palm(1110, 650, 1.0, "#14532d")}
${car(280, 540, 1.05, BODIES.convertible, "#dc2626", "#bae6fd")}`),
};

await mkdir(OUT, { recursive: true });
const browser = await chromium.launch(process.env.PW_CHANNEL ? { channel: process.env.PW_CHANNEL } : {});
const page = await browser.newPage({ viewport: { width: W, height: H } });
for (const [name, markup] of Object.entries(IMAGES)) {
  await page.setContent(`<html><body style="margin:0">${markup}</body></html>`);
  const buf = await page.screenshot({ type: "jpeg", quality: 82, clip: { x: 0, y: 0, width: W, height: H } });
  await writeFile(join(OUT, `${name}.jpg`), buf);
  console.log(`${name}.jpg ${(buf.length / 1024).toFixed(0)} KB`);
}
await browser.close();
