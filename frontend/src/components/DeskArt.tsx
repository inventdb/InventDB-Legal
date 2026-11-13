/**
 * The six illustrations in the desk booklet, one for each part of the practice:
 * an engagement letter being signed, a case file opening, the desk calendar
 * turning to a due date, a notice stamped FILED, a pocket watch running off
 * billable time, and the trust ledger balancing.
 *
 * Each moves once, when the page that carries it comes into view (`on`), and
 * rests in its finished state otherwise. Styles are in styles/desk.css.
 */
const COUNSEL_PEN = (
  <svg viewBox="0 0 150 22" aria-hidden>
    <path d="M0,11 L14,7 L14,15 Z" fill="#c9a65e" />
    <path d="M5,11 L14,10 L14,12 Z" fill="#7a5c22" />
    <rect x="14" y="5" width="22" height="12" rx="2" fill="#2a2523" />
    <rect x="34" y="4" width="4" height="14" fill="#c9a65e" />
    <rect x="38" y="4" width="98" height="14" rx="7" fill="#5b1a24" />
    <rect x="62" y="2" width="56" height="3" rx="1.5" fill="#c9a65e" />
    <rect x="132" y="5" width="6" height="12" rx="2" fill="#c9a65e" />
  </svg>
);

/** The fountain pen on its own, for the desk around the booklet. */
export function DeskPen() {
  return COUNSEL_PEN;
}

const SIGNATURE =
  "M6,36 C14,8 26,8 22,30 S32,46 40,24 S54,6 56,30 S66,42 74,22 S88,14 92,30 S106,40 114,24 S128,16 134,32 S146,34 156,20";

const line = (w: number, k: number) => <i key={k} className="dk-ln" style={{ width: `${w}%` }} />;

export function DeskArt({ idea, on }: { idea: number; on: boolean }) {
  const cls = (name: string) => `dk-art dk-art--${name}${on ? " is-on" : ""}`;
  switch (idea) {
    case 0:
      return (
        <div className={cls("letter")} aria-hidden>
          <div className="dk-letter">
            <div className="t">Engagement Letter</div>
            <div className="s">Pineda · Personal injury</div>
            {[92, 84, 96, 70, 88].map(line)}
            <div className="dk-sigline" />
            <div className="dk-sigcap">Client</div>
            <div className="dk-sigbox">
              <svg viewBox="0 0 160 50">
                <path className="dk-sig" pathLength={1} d={SIGNATURE} />
              </svg>
              <div className="dk-nib">{COUNSEL_PEN}</div>
            </div>
          </div>
        </div>
      );
    case 1:
      return (
        <div className={cls("folder")} aria-hidden>
          <div className="dk-folder">
            <div className="inside">
              <div className="sheet">
                <b>Pineda v. Bright Path</b>
                <small>MT-2018 · 24STCV18842 · Dept. 32</small>
                {[86, 70, 80].map(line)}
                <div className="dk-track">
                  <i className="d" />
                  <i className="d" />
                  <i className="d" />
                  <i className="n" />
                  <i />
                  <i />
                </div>
              </div>
            </div>
            <div className="cover">
              <div className="lbl">
                <b>Pineda v. Bright Path</b>MT-2018
              </div>
            </div>
          </div>
        </div>
      );
    case 2:
      return (
        <div className={cls("cal")} aria-hidden>
          <div className="dk-cal">
            <div className="rings" />
            <div className="pg">
              <small>NOVEMBER</small>
              <b>
                18
                <svg className="ring" viewBox="0 0 96 76">
                  <ellipse pathLength={1} cx="48" cy="38" rx="44" ry="33" transform="rotate(-8 48 38)" />
                </svg>
              </b>
              <span>Responses due</span>
              <em>CCP §2030.260</em>
            </div>
            <div className="pg top">
              <small>NOVEMBER</small>
              <b>12</b>
              <span>Thursday</span>
            </div>
          </div>
        </div>
      );
    case 3:
      return (
        <div className={cls("stamp")} aria-hidden>
          <div className="dk-stampset">
            <div className="dk-notice">
              <b>Notice of Motion</b>
              {[90, 76, 86, 60].map(line)}
              <div className="dk-imprint">
                FILED
                <small>12 NOV 2026</small>
              </div>
            </div>
            <div className="dk-pad" />
            <div className="dk-stamp" />
          </div>
        </div>
      );
    case 4:
      return (
        <div className={cls("watch")} aria-hidden>
          <div className="dk-timeset">
            <div className="dk-pocket">
              <i className="ticks" />
              <i className="h hr" />
              <i className="h mn" />
              <i className="pin" />
            </div>
            <div className="dk-chit">
              <small>TIME ENTRY</small>
              <b>2.4 h</b>
              <span>Drafted responses</span>
              <em>$1,140.00</em>
            </div>
          </div>
        </div>
      );
    default:
      return (
        <div className={cls("ledger")} aria-hidden>
          <div className="dk-ledger">
            <div className="pg">
              <small>CLIENT TRUST ACCOUNT</small>
              <span className="acc">Pineda v. Bright Path</span>
              <span className="dk-row">
                <span>12 Nov</span>
              </span>
              <span className="dk-row">
                <span>15 Nov</span>
              </span>
              <span className="dk-row">
                <span>18 Nov</span>
              </span>
            </div>
            <div className="pg">
              <small>IN · OUT</small>
              <span className="acc">&nbsp;</span>
              <span className="dk-row">
                <span>Retainer</span>
                <span className="in">12,500.00</span>
              </span>
              <span className="dk-row">
                <span>Filing fee</span>
                <span className="out">435.00</span>
              </span>
              <span className="dk-row">
                <span>Records</span>
                <span className="out">186.50</span>
              </span>
              <div className="dk-bal">
                <span>Balance</span>
                <b>11,878.50</b>
              </div>
              <span className="dk-ok">RECONCILED</span>
            </div>
          </div>
        </div>
      );
  }
}
