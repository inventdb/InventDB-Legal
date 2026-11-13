/**
 * The opening: a first visit to the sign-in page begins with the firm's mark.
 *
 *   1. The scales draw up in the middle of the page, swing and come to rest;
 *      the name is set beside them, letter by letter, and the line beneath.
 *   2. The lockup glides up into its place in the page's own heading.
 *   3. The booklet is set down on the page: its cover slides up into place,
 *      its gilt frame is drawn and the mark and title are set on it. It lies
 *      exactly where the real booklet does, so `onDone` hands over and the
 *      booklet opens with its own page turn.
 *
 * Everything moves or is drawn; nothing fades. "Skip to sign in" is there
 * throughout. It plays once per device (Login decides), never with reduced
 * motion, and it is hidden from assistive technology: it says nothing the
 * page does not.
 */
import { useEffect, useRef } from "react";

const esc = (t: string) =>
  t.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c] as string);
const letters = (t: string) =>
  t
    .split("")
    .map((c) => `<span class="in-ch">${esc(c)}</span>`)
    .join("");

/** The Counsel mark, as BrandMark draws it, split so the beam can swing on the post. */
const MARK =
  '<svg viewBox="0 0 128 128" width="46" height="46" style="display:block;flex-shrink:0">' +
  '<g class="m-post"><circle cx="64" cy="28" r="13.5" fill="currentColor"/><path d="M55 41 C57 60 60 86 64 117 C68 86 71 60 73 41 Z" fill="currentColor"/></g>' +
  '<g class="m-beam"><path d="M64 46 C50 44 34 40 22 34 L22 41.5 C36 48.5 52 54 64 57 Z" fill="currentColor"/><path d="M64 46 C78 44 94 40 106 34 L106 41.5 C92 48.5 76 54 64 57 Z" fill="currentColor"/>' +
  '<path d="M22 35 L8 67 L36 67 Z" fill="none" stroke="var(--mark-tone, currentColor)" stroke-width="5.5" stroke-linejoin="round"/><path d="M8 67 A14 14 0 0 0 36 67 Z" fill="currentColor"/>' +
  '<path d="M106 35 L92 67 L120 67 Z" fill="none" stroke="var(--mark-tone, currentColor)" stroke-width="5.5" stroke-linejoin="round"/><path d="M92 67 A14 14 0 0 0 120 67 Z" fill="currentColor"/></g></svg>';
const COVER_MARK = MARK.replace(' width="46" height="46" style="display:block;flex-shrink:0"', "").replace(/var\(--mark-tone, currentColor\)/g, "currentColor");

export function DeskIntro({ narrow, onDone }: { narrow: boolean; onDone: (skipped: boolean) => void }) {
  const host = useRef<HTMLDivElement>(null);
  const done = useRef(onDone);
  done.current = onDone;
  const skipBtn = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const el = host.current;
    const head = document.querySelector<HTMLElement>(".dk-top .brand-lockup");
    if (!el || !head) {
      done.current(false);
      return;
    }
    // The real heading waits until the opening lockup has landed on it.
    head.style.visibility = "hidden";
    const at = head.getBoundingClientRect();
    const stage = el.querySelector(".in-stage")!;
    stage.innerHTML =
      '<div class="in-ground"></div>' +
      `<div class="dk-top in-top" style="left:${at.left}px;top:${at.top}px"><div class="brand-lockup">${MARK}` +
      `<span class="brand-lockup-text"><span class="brand-lockup-name">${letters("InventDB")}<span class="brand-lockup-suffix">${letters("Legal")}</span></span>` +
      '<span class="brand-lockup-tag">Legal practice management</span></span></div></div>';

    const anims: Animation[] = [];
    let alive = true;
    const A = (
      node: Element | null,
      frames: Keyframe[],
      delay: number,
      dur: number,
      easing = "cubic-bezier(0.42, 0, 0.3, 1)",
      fill: FillMode = "both",
    ) => {
      if (!node) return null;
      const a = node.animate(frames, { delay, duration: dur, easing, fill });
      anims.push(a);
      return a;
    };
    const q = (sel: string) => stage.querySelector(sel);
    const vw = window.innerWidth;
    const vh = window.innerHeight;

    // 1. Large in the middle: the scales, then the name.
    const top = q(".in-top") as HTMLElement;
    const r = top.getBoundingClientRect();
    const scale = Math.min(narrow ? 1.45 : 1.9, (vw * 0.82) / r.width);
    const dx = vw / 2 - (r.left + r.width / 2);
    const dy = vh * 0.46 - (r.top + r.height / 2);
    // While it is alone, the mark itself sits in the middle; as the name is set
    // the lockup slides across so the two are centred together.
    const m = top.querySelector("svg")!.getBoundingClientRect();
    const alone = (r.left + r.width / 2 - (m.left + m.width / 2)) * scale;
    const at0 = (x: number) => `translate(${(dx + x).toFixed(1)}px, ${dy.toFixed(1)}px) scale(${scale.toFixed(3)})`;
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
    stage.querySelectorAll(".in-ch").forEach((c, i) =>
      A(c, [{ transform: "translateY(135%)" }, { transform: "none" }], 2400 + i * 60, 650, "cubic-bezier(0.2, 0.6, 0.3, 1)"),
    );
    A(q(".brand-lockup-tag"), [{ clipPath: "inset(0 100% 0 0)" }, { clipPath: "inset(0 0 0 0)" }], 3400, 700);

    // 2. Up into its place in the heading. One timeline for the lockup's moves,
    // so no later move fills back over an earlier one.
    A(
      top,
      [
        { transform: at0(alone), offset: 0 },
        { transform: at0(alone), offset: 2300 / 6200, easing: "cubic-bezier(0.42, 0, 0.3, 1)" },
        { transform: at0(0), offset: 3200 / 6200 },
        { transform: at0(0), offset: 4700 / 6200, easing: "cubic-bezier(0.45, 0, 0.2, 1)" },
        { transform: "none", offset: 1 },
      ],
      0,
      6200,
      "linear",
    );

    // 3. The booklet is set down on the page: its cover slides up into place,
    // the gilt frame is drawn round it, and the mark and title are set on it.
    // Measured as it is set down, once the page beneath has settled.
    const setDown = () => {
      if (!alive) return;
      const face = document.querySelector<HTMLElement>(narrow ? ".dk-book" : ".dk-leaf .dk-face.cover");
      if (!face) {
        done.current(false);
        return;
      }
      const fr = face.getBoundingClientRect();
      const edge = narrow ? 6 : 7;
      const copy = document.createElement("div");
      copy.className = `in-book${narrow ? " narrow" : ""}`;
      // The leather as the closed booklet shows it: the cover and the board's edge round it.
      copy.style.cssText = `left:${fr.left - (narrow ? edge : 0)}px;top:${fr.top - edge}px;width:${fr.width + (narrow ? 2 : 1) * edge}px;height:${fr.height + 2 * edge}px;border-radius:${narrow ? 22 : 18}px`;
      copy.innerHTML =
        `<div class="in-face" style="left:${narrow ? edge : 0}px;top:${edge}px;width:${fr.width}px;height:${fr.height}px">` +
        `<svg class="in-frame" preserveAspectRatio="none"><rect pathLength="1" x="0.5" y="0.5" rx="10"/></svg>` +
        `<div class="dk-cover">${COVER_MARK}<div class="nm">${letters("InventDB")} <em>${letters("Legal")}</em></div><div class="sub">Legal practice, modernised.</div><div class="foot">A guide to the firm</div></div></div>`;
      stage.appendChild(copy);
      // The frame is drawn as the cover's own inset rule; size it to match.
      const cov = copy.querySelector<HTMLElement>(".dk-cover")!;
      const frame = copy.querySelector<SVGSVGElement>(".in-frame")!;
      const cr = cov.getBoundingClientRect();
      const ir = copy.querySelector<HTMLElement>(".in-face")!.getBoundingClientRect();
      frame.style.cssText = `left:${cr.left - ir.left}px;top:${cr.top - ir.top}px;width:${cr.width}px;height:${cr.height}px`;
      const rect = frame.querySelector("rect")!;
      rect.setAttribute("width", String(cr.width - 1));
      rect.setAttribute("height", String(cr.height - 1));

      const T = 0;
      A(
        copy,
        [
          { transform: "translateY(56px)", clipPath: "inset(100% 0 0 0 round 18px)" },
          { transform: "none", clipPath: "inset(0 0 0 0 round 18px)" },
        ],
        T,
        1100,
        "cubic-bezier(0.2, 0.7, 0.2, 1)",
      );
      A(rect, [{ strokeDashoffset: 1 }, { strokeDashoffset: 0 }], T + 700, 1300, "cubic-bezier(0.45, 0, 0.25, 1)");
      A(cov.querySelector("svg"), [{ clipPath: "inset(100% 0 0 0)" }, { clipPath: "inset(0 0 0 0)" }], T + 1100, 700);
      cov.querySelectorAll(".in-ch").forEach((c, i) =>
        A(c, [{ transform: "translateY(135%)" }, { transform: "none" }], T + 1400 + i * 45, 600, "cubic-bezier(0.2, 0.6, 0.3, 1)"),
      );
      A(cov.querySelector(".sub"), [{ clipPath: "inset(0 100% 0 0)" }, { clipPath: "inset(0 0 0 0)" }], T + 2000, 700);
      A(cov.querySelector(".foot"), [{ clipPath: "inset(0 50% 0 50%)" }, { clipPath: "inset(0 0 0 0)" }], T + 2300, 600);
      // 4. Hand over: the real booklet lies exactly where this one is, and opens.
      const handover = A(stage, [{ transform: "none" }, { transform: "none" }], T + 3200, 1, "linear");
      handover?.finished.then(
        () => alive && done.current(false),
        () => {},
      );
    };
    A(stage, [{ transform: "none" }, { transform: "none" }], 6300, 1, "linear")?.finished.then(setDown, () => {});

    return () => {
      alive = false;
      anims.forEach((a) => a.cancel());
      head.style.visibility = "";
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
