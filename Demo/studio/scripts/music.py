"""Background score for the InventDB Legal demo films, synthesised from code.

Calm, warm and unhurried, to match the app's oxblood-and-parchment look. It sits
under subtitles, so it stays out of the way: no drums, nothing high or sharp,
long string pads, a soft felt piano and a low sine bass.

    python scripts/music.py 180 public/music-3min.wav
    python scripts/music.py 300 public/music-5min.wav

The first argument is the length in seconds. The piece is built in 2-bar
chords at 72 BPM; the last chord rings out and the track fades to silence
exactly at that length, so the music ends with the film rather than being cut.
"""

from __future__ import annotations

import sys
import wave

import numpy as np
from scipy.signal import butter, fftconvolve, sosfilt

SR = 44100
BPM = 72
BEAT = 60 / BPM
BAR = 4 * BEAT
CHORD = 2 * BAR  # one chord every two bars

rng = np.random.default_rng(7)


def hz(midi: float) -> float:
    return 440.0 * 2 ** ((midi - 69) / 12)


# Note names to MIDI numbers, for readable voicings.
_NAMES = {"C": 0, "C#": 1, "D": 2, "D#": 3, "E": 4, "F": 5, "F#": 6, "G": 7, "G#": 8, "A": 9, "A#": 10, "B": 11}


def m(name: str) -> int:
    pitch, octave = name[:-1], int(name[-1])
    return 12 * (octave + 1) + _NAMES[pitch]


# D major. I - vi - IV - Vsus, then a gentler turn ii - IV - I/3 - Vsus.
PROG_A = [
    ("D2", ["A3", "D4", "F#4", "C#5"], ["D4", "F#4", "A4", "C#5", "E5"]),   # Dmaj7
    ("B1", ["F#3", "B3", "D4", "A4"], ["B3", "D4", "F#4", "A4", "D5"]),     # Bm7
    ("G1", ["G3", "B3", "D4", "F#4"], ["G3", "B3", "D4", "F#4", "A4"]),     # Gmaj7
    ("A1", ["E3", "A3", "D4", "E4"], ["A3", "D4", "E4", "A4", "D5"]),       # Asus4
]
PROG_B = [
    ("E2", ["G3", "B3", "D4", "F#4"], ["E4", "G4", "B4", "D5", "F#5"]),     # Em9
    ("G1", ["G3", "B3", "D4", "A4"], ["G4", "B4", "D5", "A4", "F#5"]),      # Gadd9
    ("F#1", ["F#3", "A3", "D4", "A4"], ["F#4", "A4", "D5", "A4", "E5"]),    # D/F#
    ("A1", ["E3", "A3", "C#4", "E4"], ["A3", "C#4", "E4", "A4", "C#5"]),    # A
]
FINAL = ("D2", ["A3", "D4", "F#4", "A4"], ["D4", "F#4", "A4", "D5"])


def envelope(n: int, attack: float, release: float) -> np.ndarray:
    env = np.ones(n)
    a = min(n, int(attack * SR))
    r = min(n - a, int(release * SR))
    if a:
        env[:a] = np.sin(np.linspace(0, np.pi / 2, a)) ** 2
    if r:
        env[n - r:] *= np.cos(np.linspace(0, np.pi / 2, r)) ** 2
    return env


def pad_tone(freq: float, n: int) -> np.ndarray:
    """A soft string-like tone: detuned voices of a few rolled-off harmonics."""
    t = np.arange(n) / SR
    out = np.zeros(n)
    for detune in (-0.0035, 0.0, 0.0041):
        f = freq * (1 + detune)
        phase = rng.uniform(0, 2 * np.pi)
        for h in range(1, 7):
            out += np.sin(2 * np.pi * f * h * t + phase * h) / (h ** 1.8)
    # A slow, shallow swell keeps it alive without sounding like tremolo.
    out *= 1 + 0.06 * np.sin(2 * np.pi * 0.11 * t + rng.uniform(0, 6))
    return out


def piano_note(freq: float, dur: float, vel: float) -> np.ndarray:
    """A felt-piano note: slightly inharmonic partials, highs dying first."""
    n = int(dur * SR)
    t = np.arange(n) / SR
    out = np.zeros(n)
    for h in range(1, 9):
        f = freq * h * np.sqrt(1 + 0.00025 * h * h)
        if f > 7000:
            break
        decay = 1.4 + 0.9 * h
        out += np.sin(2 * np.pi * f * t) * np.exp(-decay * t) / (h ** 1.6)
    hammer = np.minimum(1.0, t / 0.006)
    out *= hammer * vel
    tail = int(0.08 * SR)
    out[-tail:] *= np.linspace(1, 0, tail)
    return out


def add(buf: np.ndarray, sig: np.ndarray, start: float) -> None:
    i = int(start * SR)
    if i >= len(buf):
        return
    j = min(len(buf), i + len(sig))
    buf[i:j] += sig[: j - i]


def lowpass(sig: np.ndarray, cutoff: float) -> np.ndarray:
    return sosfilt(butter(2, cutoff, fs=SR, output="sos"), sig)


def reverb(sig: np.ndarray, seconds: float = 3.2) -> np.ndarray:
    n = int(seconds * SR)
    t = np.arange(n) / SR
    ir = rng.standard_normal(n) * np.exp(-t * 6.9 / seconds)
    ir = lowpass(ir, 4200)
    ir /= np.sqrt(np.sum(ir ** 2))
    return fftconvolve(sig, ir)[: len(sig)]


def build(length: float) -> np.ndarray:
    total = int(length * SR)
    pads = np.zeros(total)
    keys = np.zeros(total)
    bass = np.zeros(total)

    # Leave room for the final chord to ring for ~7 s before the end.
    chords = max(4, int((length - 7.5) // CHORD))
    sequence = []
    for i in range(chords):
        block = (i // 4) % 4
        prog = PROG_B if block == 2 else PROG_A
        sequence.append(prog[i % 4])
    sequence.append(FINAL)

    for i, (root, voicing, arp) in enumerate(sequence):
        start = i * CHORD
        last = i == len(sequence) - 1
        dur = (length - start) if last else CHORD + 1.2
        n = int(dur * SR)
        if n <= 0:
            continue

        # Strings: always there, long attack, overlapping the next chord.
        chord = sum(pad_tone(hz(m(v)), n) for v in voicing) / len(voicing)
        add(pads, chord * envelope(n, 1.6, 2.4 if last else 1.4), start)

        # Bass: a low sine on the root, enters after the opening phrase.
        if i >= 2:
            f = hz(m(root))
            t = np.arange(n) / SR
            b = np.sin(2 * np.pi * f * t) + 0.25 * np.sin(2 * np.pi * 2 * f * t)
            add(bass, b * envelope(n, 0.5, 1.8 if last else 1.0), start)

        # Piano: silent for the first phrase, then a sparse arpeggio that
        # thins out every fourth phrase so the texture breathes.
        if 4 <= i and not last:
            phrase = i // 4
            sparse = phrase % 4 == 3
            steps = [0, 3, 6, 8, 11, 14] if not sparse else [0, 6, 11]
            for bar_half in range(2):
                for k, s in enumerate(steps):
                    pos = start + bar_half * BAR + s * BEAT / 4  # steps are 16ths
                    note = arp[(k + bar_half * 2 + i) % len(arp)]
                    vel = 0.55 + 0.25 * rng.random() - (0.15 if k % 2 else 0)
                    pos += rng.normal(0, 0.008)
                    add(keys, piano_note(hz(m(note)), 3.6, vel), pos)
        if last:
            for k, note in enumerate(arp):
                add(keys, piano_note(hz(m(note)), 7.0, 0.6), start + k * 0.18)

    pads = lowpass(pads, 2600) * 0.55
    keys = lowpass(keys, 5200) * 0.42
    bass = lowpass(bass, 220) * 0.30

    dry = pads + keys + bass
    wet = reverb(pads * 0.6 + keys)
    mix = dry * 0.78 + wet * 0.42

    # Fade in over 2.5 s, out over the last 5 s, landing on silence at the end.
    fade_in = int(2.5 * SR)
    fade_out = int(5.0 * SR)
    mix[:fade_in] *= np.linspace(0, 1, fade_in) ** 2
    mix[-fade_out:] *= np.cos(np.linspace(0, np.pi / 2, fade_out)) ** 2

    # Gentle soft-clip and normalise to a modest peak; the film sets the level.
    mix = np.tanh(mix * 1.2)
    mix /= np.max(np.abs(mix)) + 1e-9
    return mix * 0.89


def stereo(mono: np.ndarray) -> np.ndarray:
    """A little width: a short Haas offset on one side, mixed in lightly."""
    d = int(0.011 * SR)
    right = mono.copy()
    right[d:] = 0.82 * mono[d:] + 0.18 * mono[:-d]
    left = mono.copy()
    left[d:] = 0.86 * mono[d:] + 0.14 * lowpass(mono, 1800)[:-d]
    return np.stack([left, right], axis=1)


def write(path: str, audio: np.ndarray) -> None:
    pcm = (np.clip(audio, -1, 1) * 32767).astype("<i2")
    with wave.open(path, "wb") as w:
        w.setnchannels(2)
        w.setsampwidth(2)
        w.setframerate(SR)
        w.writeframes(pcm.tobytes())


if __name__ == "__main__":
    seconds = float(sys.argv[1])
    out = sys.argv[2]
    write(out, stereo(build(seconds)))
    print(f"wrote {out} ({seconds:.1f}s)")
