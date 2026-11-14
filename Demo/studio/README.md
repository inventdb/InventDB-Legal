# InventDB Legal — demo films

Two demo films for LinkedIn and X, made entirely from code:

| File | Length |
| --- | --- |
| `../InventDB-Legal-Demo-3min.mp4` + `.srt` | 3:00 |
| `../InventDB-Legal-Demo-5min.mp4` + `.srt` | 5:00 |

1920×1080, 30 fps, H.264 + AAC. Subtitles are burned in (for muted autoplay)
and also shipped as `.srt` files, generated from the same script.

The films are made for law firms, in the order a firm weighs practice
management software: **deadlines and statutes of limitation** (the rule,
trigger and computation behind each deadline; the court calendar; the
docket report and the morning docket email), **client trust money** (each
matter's ledger and replenish threshold, the monthly reconciliation and its
client-ledger check, settlement statements with liens), **billing** (UTBMS
time, unbilled work, invoices paid partly from trust, aged receivables),
then Analyze, **intake and conflict checks**, the matter file, confidentiality
and devices, and the architecture. Every figure quoted is true of the demo
dataset as of 19 Aug 2026.

## How they are made

1. **Data** — `scripts/build_data.py` reads the repo's synthetic dataset
   (`CA_Litigation_Practice_Dataset.xlsx`, the fictional firm Alvarado & Sung
   LLP) and computes the dashboard and report figures the way
   `backend/app/routers/dashboard.py` does, as of the dataset's own date
   (19 Aug 2026). No real data and no live InventDB instance are involved.
2. **Footage** — `capture/*.capture.ts` (`law.capture.ts` holds the records a firm checks) drive the real React app with
   Playwright against the E2E suite's mocked API, loaded with that dataset.
   `capture/legal-content.ts` swaps the mock's property-management fixtures
   (workflows, inbox, reports, files) for legal ones drawn from the dataset.
   The sign-in opening is recorded frame by frame at a tenth of its speed
   through the DevTools protocol, then replayed at true speed.
3. **Score** — `scripts/music.py` synthesises a calm piano-and-strings bed
   (D major, 72 BPM, no percussion) to the exact length of each film.
4. **Film** — Remotion (`src/`). `src/timeline.ts` is the whole script: every
   shot, camera move and subtitle for both cuts. `scripts/subtitles.ts`
   writes the `.srt` files from it and refuses captions faster than
   17 characters a second.

Roles are never named on screen, and nothing fades or pulses: shots slide,
the window moves, outlines are drawn.

## Rebuild

```bash
npm install
```

```bash
npm run build
```

`npm run build` needs Python with `openpyxl`, `numpy` and `scipy`, and the
frontend's own `npm install` (Playwright starts its dev server on 5174).
Run `npm run studio` to scrub the films while editing `src/timeline.ts`.

## Posting

LinkedIn takes either film. On X, accounts without Premium have been limited
to 2 minutes 20 seconds per video, so check the account's limit before posting
the 3- or 5-minute cut there.
