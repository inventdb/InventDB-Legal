/**
 * The walk-in: a first visit to the sign-in page opens with a short film of
 * the firm, drawn in line.
 *
 *   1. The scales draw up in the middle, swing and come to rest; the name is
 *      set beneath them.
 *   2. The camera tilts down to the street: the name rises out of view as the
 *      building comes up and is drawn.
 *   3. A walk up to the doors, which open.
 *   4. The corridor. It stops at each pair of doors: they open, and a card
 *      says what that part of the practice holds.
 *   5. The far door, marked Chambers: the office, the desk, the booklet.
 *   6. The booklet lifts until its leather fills the view; the gilt title is
 *      set on it; the leather draws in until it is the real booklet's cover,
 *      lying on the sign-in page. Then `onDone` hands over and the booklet
 *      opens.
 *
 * Everything moves or is drawn; nothing fades. "Skip to sign in" is there
 * throughout. It plays once per device (Login decides), never with reduced
 * motion, and the scenes are hidden from assistive technology: they say
 * nothing the booklet does not.
 */
import { useEffect, useRef } from "react";

import { CHAPTERS } from "./DeskBook";

const esc = (t: string) =>
  t.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c] as string);
const pt = (p: number[]) => `${p[0].toFixed(1)} ${p[1].toFixed(1)}`;
const poly = (pts: number[][], cls: string) => `<path class="${cls}" d="M${pts.map(pt).join(" L")} Z"/>`;

/** Each scene is drawn around (800, 500): the point the camera moves into. */
function viewBox(needW: number, needH: number) {
  const a = window.innerWidth / window.innerHeight;
  const W = Math.max(needW, needH * a);
  const H = W / a;
  return { W, H, attr: `${(800 - W / 2).toFixed(1)} ${(500 - H / 2).toFixed(1)} ${W.toFixed(1)} ${H.toFixed(1)}` };
}

function buildingShapes() {
  let s = '<rect class="gr" x="-4000" y="640" width="9600" height="5000"/><path class="w2" d="M660 640 H940 L1180 1500 H420 Z"/>';
  [330, 1270].forEach((x) => {
    s += `<rect class="w2" x="${x - 22}" y="602" width="44" height="38"/><circle class="leafy" cx="${x}" cy="580" r="26"/>`;
  });
  s += '<path class="w2" d="M350 250 L800 128 L1250 250 Z"/>';
  s += '<path class="w" fill-rule="evenodd" d="M380 280 H1220 V590 H380 Z M740 410 V590 H860 V410 Z"/>';
  s += '<rect class="w2" x="360" y="250" width="880" height="32"/>';
  s += '<path class="ln-only" d="M428 236 L800 146 L1172 236 Z"/>';
  s += '<circle class="brass-s" cx="800" cy="204" r="17"/><path class="ln-only brass-l" d="M786 204 H814 M800 192 V218"/>';
  [480, 580, 1020, 1120].forEach((x) => {
    s += `<rect class="win" x="${x - 22}" y="328" width="44" height="90"/><rect class="win" x="${x - 22}" y="450" width="44" height="106"/>`;
    s += `<path class="ln-only" d="M${x} 328 V418 M${x} 450 V556 M${x - 22} 372 H${x + 22} M${x - 22} 503 H${x + 22}"/>`;
  });
  [430, 530, 630, 970, 1070, 1170].forEach((x) => {
    s += `<rect class="w" x="${x - 20}" y="300" width="40" height="278"/><rect class="w2" x="${x - 28}" y="284" width="56" height="16"/><rect class="w2" x="${x - 26}" y="578" width="52" height="12"/>`;
    s += `<path class="ln-only" d="M${x - 7} 304 V574 M${x + 7} 304 V574"/>`;
  });
  s += '<path class="w2" d="M726 396 H874 V590 H860 V410 H740 V590 H726 Z"/><rect class="w2" x="714" y="384" width="172" height="12"/>';
  s += '<g class="leaf-l"><rect class="door" x="740" y="410" width="60" height="180"/><rect class="ln-only" x="750" y="424" width="40" height="70"/><rect class="ln-only" x="750" y="504" width="40" height="72"/><circle class="brass" cx="792" cy="500" r="3"/></g>';
  s += '<g class="leaf-r"><rect class="door" x="800" y="410" width="60" height="180"/><rect class="ln-only" x="810" y="424" width="40" height="70"/><rect class="ln-only" x="810" y="504" width="40" height="72"/><circle class="brass" cx="808" cy="500" r="3"/></g>';
  [712, 888].forEach((x) => {
    s += `<rect class="brass-s" x="${x - 8}" y="418" width="16" height="22" rx="3"/>`;
  });
  s += '<rect class="plaque" x="898" y="468" width="48" height="46" rx="3"/><path class="ln-only brass-l" d="M906 482 H938 M906 492 H930 M906 502 H936"/>';
  s += '<rect class="w2" x="700" y="590" width="200" height="16"/><rect class="w2" x="680" y="606" width="240" height="16"/><rect class="w2" x="660" y="622" width="280" height="18"/>';
  s += '<circle class="brass-s" cx="1360" cy="186" r="30"/>';
  return s;
}

function building(vb: { attr: string }) {
  const sky = `<svg class="in-sky" viewBox="${vb.attr}"><path fill-rule="evenodd" d="M-4000 -4000 H5600 V5600 H-4000 Z M740 410 V590 H860 V410 Z"/></svg>`;
  const fills = `<svg class="in-fills" viewBox="${vb.attr}">${buildingShapes()}</svg>`;
  const lines = `<svg class="in-lines drawing" viewBox="${vb.attr}">${buildingShapes()}<path d="M-4000 640 H5600"/></svg>`;
  return sky + fills + lines;
}

const K = 7;
const f = (d: number) => 1 / (1 + K * d);
const hwAt = (d: number) => 1200 * f(d);

function corridor(vb: { attr: string }) {
  const P = (side: number, d: number, v: number) => {
    const hw = 1200 * f(d);
    const hh = 1040 * f(d);
    return [800 + side * hw, 500 - hh + 2 * hh * v];
  };
  const d0 = -0.12;
  let s = "";
  s += poly([P(-1, d0, 0), P(1, d0, 0), P(1, 1, 0), P(-1, 1, 0)], "w2");
  s += poly([P(-1, d0, 1), P(1, d0, 1), P(1, 1, 1), P(-1, 1, 1)], "gr");
  s += poly([P(-1, d0, 0), P(-1, 1, 0), P(-1, 1, 1), P(-1, d0, 1)], "w");
  s += poly([P(1, d0, 0), P(1, 1, 0), P(1, 1, 1), P(1, d0, 1)], "w");
  const r = 0.4;
  s += poly(
    [
      [800 - r * 1200 * f(d0), 500 + 1040 * f(d0)],
      [800 + r * 1200 * f(d0), 500 + 1040 * f(d0)],
      [800 + r * 150, 630],
      [800 - r * 150, 630],
    ],
    "runner",
  );
  [-1, 1].forEach((side) =>
    [0.62, 0.95].forEach((v) => {
      s += `<path class="ln-only" d="M${pt(P(side, d0, v))} L${pt(P(side, 1, v))}"/>`;
    }),
  );
  [0.15, 0.35, 0.55, 0.75, 0.9].forEach((d) => {
    const y = 500 - 1040 * f(d) + 30 * f(d);
    const hl = 120 * f(d);
    s += `<path class="ln-only brass-l" d="M${(800 - hl).toFixed(1)} ${y.toFixed(1)} H${(800 + hl).toFixed(1)}"/>`;
  });
  const names: Record<string, string[]> = {
    "-1": [CHAPTERS[0].group, CHAPTERS[1].group, CHAPTERS[2].group],
    "1": [CHAPTERS[3].group, CHAPTERS[4].group, CHAPTERS[5].group],
  };
  [
    [0.22, 0.32],
    [0.45, 0.55],
    [0.7, 0.78],
  ].forEach(([d1, d2], i) => {
    [-1, 1].forEach((side) => {
      const dm = (d1 + d2) / 2;
      const door = [P(side, d1, 0.38), P(side, d2, 0.38), P(side, d2, 1), P(side, d1, 1)];
      s += poly(door, "door-in");
      const k = P(side, d2 - (d2 - d1) * 0.18, 0.7);
      s += `<g class="leaf-sd ${side < 0 ? "lw" : "rw"}" data-pair="${i}">${poly(door, "door-s")}<circle class="brass" cx="${k[0].toFixed(1)}" cy="${k[1].toFixed(1)}" r="${(10 * f(dm)).toFixed(1)}"/></g>`;
      const c = P(side, dm, 0.29);
      const p1 = P(side, d1, 0.29);
      const p2 = P(side, d2, 0.29);
      const ang = (Math.atan2((p2[1] - p1[1]) * side, (p2[0] - p1[0]) * side) * 180) / Math.PI;
      const u = f(dm) * 3.4;
      s += `<g transform="translate(${pt(c)}) skewY(${ang.toFixed(1)}) scale(${(u * 0.62).toFixed(3)} ${u.toFixed(3)})"><rect class="plaque" x="-78" y="-15" width="156" height="22" rx="3"/><text class="sans" x="0" y="1" text-anchor="middle" style="font-size:13px">${esc(names[String(side)][i])}</text></g>`;
    });
  });
  s += '<path class="w2" fill-rule="evenodd" d="M650 370 H950 V630 H650 Z M762 420 V630 H838 V420 Z"/>';
  s += '<rect class="plaque" x="770" y="400" width="60" height="14" rx="2"/><text class="sans" x="800" y="410.5" text-anchor="middle" style="font-size:9px">Chambers</text>';
  s += '<g class="leaf-e"><rect class="door" x="762" y="420" width="76" height="210"/><rect class="ln-only" x="772" y="434" width="56" height="84"/><rect class="ln-only" x="772" y="530" width="56" height="88"/><circle class="brass" cx="830" cy="528" r="3"/></g>';
  [
    [-1, 0],
    [1, 0],
    [-1, 1],
    [1, 1],
  ].forEach(([side, v]) => {
    s += `<path class="ln-only" d="M${pt(P(side, d0, v))} L${pt(P(side, 1, v))}"/>`;
  });
  return `<svg viewBox="${vb.attr}">${s}</svg>`;
}

function office(vb: { attr: string }) {
  let s =
    '<rect class="w" x="-4000" y="-4000" width="9600" height="4720"/><rect class="gr" x="-4000" y="720" width="9600" height="5000"/><path class="ln-only" d="M-4000 720 H5600"/>';
  s += '<ellipse class="runner" cx="800" cy="800" rx="460" ry="56"/>';
  s +=
    '<rect class="win2" x="650" y="160" width="300" height="200"/><path class="ln-only" d="M800 160 V360 M650 260 H950"/><rect class="w2" x="636" y="360" width="328" height="12"/><circle class="brass-s" cx="905" cy="205" r="14"/>';
  let seed = 7;
  const rnd = () => {
    seed = (seed * 9301 + 49297) % 233280;
    return seed / 233280;
  };
  [
    [300, 560],
    [1040, 1300],
  ].forEach(([a, b]) => {
    s += `<rect class="w2" x="${a}" y="150" width="${b - a}" height="570"/>`;
    for (let y = 250; y <= 650; y += 100) {
      let x = a + 10;
      while (x < b - 26) {
        const w = 12 + Math.round(rnd() * 12);
        const h = 58 + Math.round(rnd() * 28);
        const cls = ["bk1", "bk2", "bk3", "w"][Math.floor(rnd() * 4)];
        if (rnd() < 0.1) {
          x += 18;
          continue;
        }
        s += `<rect class="${cls}" x="${x}" y="${y - h}" width="${w}" height="${h}"/>`;
        x += w + 2;
      }
      s += `<path class="ln-only" d="M${a} ${y} H${b}"/>`;
    }
  });
  s += '<rect class="door" x="712" y="378" width="176" height="112" rx="18"/>';
  s += '<path class="desk" d="M560 470 H1040 L1100 540 H500 Z"/><rect class="desk2" x="500" y="540" width="600" height="160"/>';
  s +=
    '<path class="ln-only" d="M520 560 H680 V620 H520 Z M520 630 H680 V688 H520 Z M920 560 H1080 V620 H920 Z M920 630 H1080 V688 H920 Z"/><path class="ln-only brass-l" d="M585 590 H615 M585 659 H615 M985 590 H1015 M985 659 H1015"/>';
  s += '<rect class="w2" x="512" y="700" width="576" height="20"/>';
  s +=
    '<path class="lamp-light" d="M606 440 L634 440 L700 524 L540 524 Z"/><ellipse class="brass-s" cx="620" cy="512" rx="26" ry="6"/><path class="ln-only brass-l" d="M620 508 V442"/><path class="brass-s" d="M596 442 H644 L633 414 H607 Z"/>';
  s += '<path class="paper" d="M880 494 L948 488 L960 522 L888 530 Z"/><path class="ln-only" d="M892 502 L940 498 M894 510 L944 506"/>';
  s += '<circle class="w2" cx="990" cy="500" r="10"/><path class="ln-only" d="M984 494 L1012 464"/>';
  s += '<path class="paper" d="M744 521 L856 521 L858 527 L742 527 Z"/><path class="book" d="M752 482 L848 482 L856 521 L744 521 Z"/>';
  return `<svg viewBox="${vb.attr}">${s}</svg>`;
}

const MARK =
  '<svg viewBox="0 0 128 128"><g class="m-post"><circle fill="currentColor" cx="64" cy="27" r="15"/><path fill="currentColor" d="M53 38 L75 38 L64 120 Z"/></g><g class="m-beam"><path fill="currentColor" d="M64 46 L16 30 L16 44 L64 62 Z"/><path fill="currentColor" d="M64 46 L112 30 L112 44 L64 62 Z"/><path class="pan" d="M16 32 L2 76 L30 76 Z"/><path class="pan" d="M112 32 L98 76 L126 76 Z"/></g></svg>';
const COVER_MARK =
  '<svg viewBox="0 0 128 128"><circle cx="64" cy="28" r="13.5" fill="currentColor"/><path d="M55 41 C57 60 60 86 64 117 C68 86 71 60 73 41 Z" fill="currentColor"/><path d="M64 46 C50 44 34 40 22 34 L22 41.5 C36 48.5 52 54 64 57 Z" fill="currentColor"/><path d="M64 46 C78 44 94 40 106 34 L106 41.5 C92 48.5 76 54 64 57 Z" fill="currentColor"/><path d="M22 35 L8 67 L36 67 Z" fill="none" stroke="currentColor" stroke-width="5.5" stroke-linejoin="round"/><path d="M8 67 A14 14 0 0 0 36 67 Z" fill="currentColor"/><path d="M106 35 L92 67 L120 67 Z" fill="none" stroke="currentColor" stroke-width="5.5" stroke-linejoin="round"/><path d="M92 67 A14 14 0 0 0 120 67 Z" fill="currentColor"/></svg>';
const letters = (t: string) =>
  t
    .split("")
    .map((c) => `<span class="in-ch">${esc(c)}</span>`)
    .join("");

export function DeskIntro({ narrow, onDone }: { narrow: boolean; onDone: (skipped: boolean) => void }) {
  const host = useRef<HTMLDivElement>(null);
  const done = useRef(onDone);
  done.current = onDone;
  const skipBtn = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const el = host.current;
    if (!el) return;
    const portrait = window.innerWidth < window.innerHeight;
    const vbB = portrait ? viewBox(820, 900) : viewBox(1000, 1060);
    const vbC = viewBox(700, 520);
    const vbO = viewBox(portrait ? 900 : 1000, 660);
    const caps = [0, 1, 2]
      .map((i) =>
        (
          [
            [CHAPTERS[i], "l"],
            [CHAPTERS[i + 3], "r"],
          ] as const
        )
          .map(
            ([c, side]) =>
              `<div class="in-cap ${side}" data-pair="${i}"><span class="g">${esc(c.group)}</span><b>${esc(c.title)}</b><span class="s">${esc(c.sections)}</span></div>`,
          )
          .join(""),
      )
      .join("");
    el.querySelector(".in-stage")!.innerHTML =
      `<div class="in-cover"><div class="in-scene" id="in-office">${office(vbO)}</div><div class="in-scene" id="in-hall">${corridor(vbC)}</div><div class="in-scene" id="in-bldg">${building(vbB)}</div></div>` +
      `<div class="in-leather"></div>${caps}` +
      `<div class="in-brand"><span class="row">${MARK}<b>${letters("InventDB")}<em>${letters("Legal")}</em></b></span><span class="tag">Legal practice management</span></div>`;

    const anims: Animation[] = [];
    let alive = true;
    const A = (
      node: Element | null,
      frames: Keyframe[],
      delay: number,
      dur: number,
      easing = "cubic-bezier(0.45, 0, 0.25, 1)",
      fill: FillMode = "both",
    ) => {
      if (!node) return null;
      const a = node.animate(frames, { delay, duration: dur, easing, fill });
      anims.push(a);
      return a;
    };
    const show = (node: Element | null, at: number) =>
      A(node, [{ visibility: "hidden" }, { visibility: "visible" }], at, 1, "linear");
    const hide = (node: Element | null, at: number) =>
      A(node, [{ visibility: "visible" }, { visibility: "hidden" }], at, 1, "linear", "forwards");
    // A camera move whose speed feels even: the scale grows geometrically, eased only at its ends.
    const zoom = (node: Element | null, s0: number, s1: number, delay: number, dur: number, fill: FillMode, easing?: string) => {
      const k: Keyframe[] = [];
      for (let i = 0; i <= 16; i++) k.push({ transform: `translateY(0px) scale(${(s0 * Math.pow(s1 / s0, i / 16)).toFixed(4)})` });
      return A(node, k, delay, dur, easing ?? "cubic-bezier(0.42, 0, 0.3, 1)", fill);
    };
    const SOFT = "cubic-bezier(0.42, 0, 0.3, 1)";
    const PASS = "cubic-bezier(0.5, 0, 0.6, 1)";
    const q = (sel: string) => el.querySelector(sel);

    // 1. The scales, then the name.
    A(q(".m-post"), [{ transform: "scaleY(0)" }, { transform: "scaleY(1)" }], 200, 800, "cubic-bezier(0.2, 0.6, 0.3, 1)");
    A(
      q(".m-beam"),
      [
        { transform: "rotate(0deg) scaleX(0)", offset: 0, easing: "ease-out" },
        { transform: "rotate(-14deg) scaleX(1)", offset: 0.24, easing: "ease-in-out" },
        { transform: "rotate(9deg) scaleX(1)", offset: 0.46, easing: "ease-in-out" },
        { transform: "rotate(-5deg) scaleX(1)", offset: 0.64, easing: "ease-in-out" },
        { transform: "rotate(2deg) scaleX(1)", offset: 0.8, easing: "ease-in-out" },
        { transform: "rotate(-0.6deg) scaleX(1)", offset: 0.92, easing: "ease-in-out" },
        { transform: "rotate(0deg) scaleX(1)", offset: 1 },
      ],
      600,
      2200,
      "linear",
    );
    el.querySelectorAll(".in-ch").forEach((c, i) =>
      A(c, [{ transform: "translateY(135%)" }, { transform: "none" }], 2500 + i * 60, 650, "cubic-bezier(0.2, 0.6, 0.3, 1)"),
    );
    A(q(".in-brand .tag"), [{ clipPath: "inset(0 100% 0 0)" }, { clipPath: "inset(0 0 0 0)" }], 3500, 700, SOFT);

    // 2. Tilt down to the street; the building is drawn.
    const bldg = q("#in-bldg");
    const hall = q("#in-hall");
    const off = q("#in-office");
    const lockup = q(".in-brand");
    A(lockup, [{ transform: "translate(-50%, -50%)" }, { transform: "translate(-50%, calc(-50% - 80vh))" }], 4600, 1400, SOFT);
    A(bldg, [{ transform: "translateY(85vh) scale(0.94)" }, { transform: "translateY(0px) scale(0.94)" }], 4600, 1400, SOFT);
    hide(lockup, 6000);
    const lines = bldg!.querySelector(".in-lines")!;
    const strokes = lines.querySelectorAll<SVGElement>("path, rect, circle");
    strokes.forEach((p, i) => {
      p.setAttribute("pathLength", "1");
      p.style.strokeDasharray = "1";
      A(p, [{ strokeDashoffset: 1 }, { strokeDashoffset: 0 }], 4900 + (i % 24) * 30, 1700, "cubic-bezier(0.35, 0, 0.25, 1)");
    });
    A(bldg!.querySelector(".in-fills"), [{ clipPath: "inset(100% -60% -60% -60%)" }, { clipPath: "inset(-60% -60% -60% -60%)" }], 6800, 1000, SOFT);
    A(bldg!.querySelector(".in-fills"), [{ transform: "none" }, { transform: "none" }], 7600, 1, "linear")?.finished.then(
      () => {
        lines.classList.remove("drawing");
        strokes.forEach((p) => (p.style.strokeDasharray = ""));
      },
      () => {},
    );

    // 3. Up to the doors.
    zoom(bldg, 0.94, 1.45, 7800, 1800, "forwards");
    el.querySelectorAll(".leaf-l, .leaf-r").forEach((l) =>
      A(l, [{ transform: "scaleX(1)" }, { transform: "scaleX(0.08)" }], 9000, 1000, SOFT),
    );

    // 4. Through the doors, and a stop at each pair in the corridor.
    const reach = (0.62 * vbC.W) / 2;
    const stops = [0.27, 0.5, 0.74].map((dm) => Math.max(0.45, Math.min(3, reach / hwAt(dm))));
    const sEnd = Math.max(stops[2] * 1.6, (0.34 * vbC.W) / 76);
    show(hall, 7800);
    zoom(bldg, 1.45, 15, 10000, 1400, "forwards", PASS);
    zoom(hall, 0.36, stops[0], 10000, 1400, "both", PASS);
    hide(bldg, 11400);
    let t = 11400;
    let from = stops[0];
    const OUT_L = "translateX(calc(-100% - 10vw - 48px))";
    const OUT_R = "translateX(calc(100% + 10vw + 48px))";
    stops.forEach((sAt, i) => {
      if (i > 0) {
        zoom(hall, from, sAt, t, 1000, "forwards", SOFT);
        t += 1000;
      }
      from = sAt;
      el.querySelectorAll(`.leaf-sd[data-pair="${i}"]`).forEach((l) =>
        A(l, [{ transform: "scaleX(1)" }, { transform: "scaleX(0.5)" }], t + 100, 800, SOFT),
      );
      const cl = q(`.in-cap.l[data-pair="${i}"]`);
      const cr = q(`.in-cap.r[data-pair="${i}"]`);
      A(cl, [{ transform: OUT_L }, { transform: "none" }], t + 200, 650, SOFT);
      A(cr, [{ transform: OUT_R }, { transform: "none" }], t + 200, 650, SOFT);
      A(cl, [{ transform: "none" }, { transform: OUT_L }], t + 1600, 500, "cubic-bezier(0.5, 0, 0.8, 0.6)", "forwards");
      A(cr, [{ transform: "none" }, { transform: OUT_R }], t + 1600, 500, "cubic-bezier(0.5, 0, 0.8, 0.6)", "forwards");
      t += 1700;
    });
    zoom(hall, from, sEnd, t, 1600, "forwards", SOFT);
    A(q(".leaf-e"), [{ transform: "scaleX(1)" }, { transform: "scaleX(0.06)" }], t + 1000, 900, SOFT);
    t += 1800;

    // 5. Into chambers.
    show(off, t - 900);
    zoom(hall, sEnd, Math.max(32, sEnd * 9), t, 1300, "forwards", PASS);
    zoom(off, 0.3, 1, t, 1300, "both", PASS);
    t += 1300;
    hide(hall, t);
    zoom(off, 1, 1.3, t, 1400, "forwards", "cubic-bezier(0.3, 0, 0.4, 1)");
    t += 1400;

    // 6. The booklet lifts until its leather fills the view.
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const onScreen = (x: number, y: number, k: number) => {
      const px = ((x - (800 - vbO.W / 2)) * vw) / vbO.W;
      const py = ((y - (500 - vbO.H / 2)) * vh) / vbO.H;
      return `${(vw / 2 + (px - vw / 2) * k).toFixed(1)}px ${(vh / 2 + (py - vh / 2) * k).toFixed(1)}px`;
    };
    const bookAt = `polygon(${[
      [752, 482],
      [848, 482],
      [856, 521],
      [744, 521],
    ]
      .map((c) => onScreen(c[0], c[1], 1.3))
      .join(", ")})`;
    const leather = q(".in-leather");
    show(leather, t);
    const lift = A(
      leather,
      [{ clipPath: bookAt }, { clipPath: `polygon(0px 0px, ${vw}px 0px, ${vw}px ${vh}px, 0px ${vh}px)` }],
      t,
      1100,
      "cubic-bezier(0.5, 0, 0.7, 0.8)",
    );
    zoom(off, 1.3, 1.9, t, 1100, "forwards", "cubic-bezier(0.5, 0, 0.7, 0.8)");
    t += 1100;
    hide(skipBtn.current, t);

    // 7. The gilt title is set on the leather, and the leather draws in onto the real cover.
    const coverStage = () => {
      if (!alive) return;
      (q(".in-cover") as HTMLElement).style.display = "none";
      const face = document.querySelector<HTMLElement>(".dk-leaf .dk-face.cover");
      const book = document.querySelector<HTMLElement>(".dk-book");
      if (!face || !book) {
        done.current(false);
        return;
      }
      const r = narrow ? book.getBoundingClientRect() : face.getBoundingClientRect();
      const edge = narrow ? 6 : 7;
      const round = narrow ? 22 : 18;
      const copy = document.createElement("div");
      copy.className = `in-cover-copy${narrow ? " narrow" : ""}`;
      copy.style.cssText = `left:${r.left}px;top:${r.top}px;width:${r.width}px;height:${r.height}px`;
      copy.innerHTML = `<div class="dk-cover">${COVER_MARK}<div class="nm">InventDB <em>Legal</em></div><div class="sub">Legal practice, modernised.</div><div class="foot">A guide to the firm</div></div>`;
      el.querySelector(".in-stage")!.appendChild(copy);
      const L = narrow ? r.left - edge : r.left;
      const T = r.top - edge;
      const R = vw - (r.right + edge);
      const B = vh - (r.bottom + edge);
      A(copy.querySelector(".dk-cover"), [{ clipPath: "inset(50% 50% 50% 50% round 10px)" }, { clipPath: "inset(0% 0% 0% 0% round 10px)" }], 0, 900, SOFT);
      A(
        leather,
        [
          { clipPath: "inset(0px 0px 0px 0px round 0px)" },
          { clipPath: `inset(${T.toFixed(1)}px ${R.toFixed(1)}px ${B.toFixed(1)}px ${L.toFixed(1)}px round ${round}px)` },
        ],
        1000,
        1200,
        SOFT,
        "forwards",
      )?.finished.then(
        () => alive && done.current(false),
        () => {},
      );
    };
    // The pull-back waits for the leather to fill the view, not for a clock that can run ahead of it.
    lift?.finished.then(coverStage, () => {});

    return () => {
      alive = false;
      anims.forEach((a) => a.cancel());
    };
  }, [narrow]);

  return (
    <div className="dk-intro" ref={host}>
      <div className="in-stage" aria-hidden="true" />
      <button type="button" className="in-skip" ref={skipBtn} onClick={() => done.current(true)}>
        Skip to sign in
      </button>
    </div>
  );
}
