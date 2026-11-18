/**
 * Musique d'ambiance du menu : boucle chaabi composée et synthétisée pour le jeu (libre de droits).
 * Darbouka sur 4 temps (« pa · pam pam » : coup sec, silence, deux coups graves), bendir, basse
 * et oud (Karplus-Strong) en mode hijaz sur ré : riff, puis mélodie à l'oud sur la seconde moitié. Pas de flûte ni de violon.
 * 16 mesures à 118 battements par minute (≈ 32,5 s), la fin s'enchaîne sans coupure avec le début.
 *
 *   node scripts/generate-music.js
 *
 * Sortie : assets/music/chaabi.mp3 (stéréo, 96 kbit/s, environ 400 Ko), encodée avec le ffmpeg
 * de @ffmpeg-installer/ffmpeg (dépendance de développement).
 */
const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync } = require('child_process');

const SR = 32000;
const BPM = 118;
const BEAT = 60 / BPM;
const BAR = 4 * BEAT;
const BARS = 16;
const LEN = Math.round(BARS * BAR * SR);

// Générateur pseudo-aléatoire déterministe : le fichier est reproductible
let seed = 2026;
const rand = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
const noise = () => rand() * 2 - 1;
const NOTE = (n) => 440 * Math.pow(2, (n - 69) / 12);

// Deux pistes (gauche / droite) ; tout ce qui dépasse la fin repart au début (boucle)
const L = new Float32Array(LEN);
const R = new Float32Array(LEN);
function add(buf, at, pan = 0, gain = 1) {
    const start = Math.round(at * SR);
    const gl = gain * Math.cos((pan + 1) * Math.PI / 4) * Math.SQRT2;
    const gr = gain * Math.sin((pan + 1) * Math.PI / 4) * Math.SQRT2;
    for (let i = 0; i < buf.length; i++) {
        const k = (start + i) % LEN;
        L[k] += buf[i] * gl;
        R[k] += buf[i] * gr;
    }
}

function lowpass(d, fc) {
    const a = 1 - Math.exp((-2 * Math.PI * fc) / SR);
    let y = 0;
    for (let i = 0; i < d.length; i++) { y += a * (d[i] - y); d[i] = y; }
    return d;
}
function highpass(d, fc) {
    const c = Float32Array.from(d);
    lowpass(c, fc);
    for (let i = 0; i < d.length; i++) d[i] -= c[i];
    return d;
}

// ---------------- Instruments ----------------
function dum() { // « pam » : coup grave de darbouka
    const d = new Float32Array(Math.round(0.35 * SR));
    for (let i = 0; i < d.length; i++) {
        const t = i / SR;
        const f = 62 + 70 * Math.exp(-t / 0.03);
        d[i] = Math.sin(2 * Math.PI * f * t) * Math.exp(-t / 0.16) + 0.25 * noise() * Math.exp(-t / 0.006);
    }
    return d;
}
function tak() { // « pa » : coup sec sur le bord
    const d = new Float32Array(Math.round(0.09 * SR));
    for (let i = 0; i < d.length; i++) {
        const t = i / SR;
        d[i] = noise() * Math.exp(-t / 0.02) + 0.4 * Math.sin(2 * Math.PI * 520 * t) * Math.exp(-t / 0.02);
    }
    return lowpass(highpass(d, 1500), 9000);
}
function bendir() { // tambour sur cadre : grave sourd avec la peau qui frise
    const d = new Float32Array(Math.round(0.3 * SR));
    for (let i = 0; i < d.length; i++) {
        const t = i / SR;
        d[i] = Math.sin(2 * Math.PI * 78 * t) * Math.exp(-t / 0.12) + 0.3 * noise() * Math.exp(-t / 0.08);
    }
    return lowpass(d, 1800);
}
function bass(n, dur) {
    const d = new Float32Array(Math.round(dur * SR));
    const f = NOTE(n);
    for (let i = 0; i < d.length; i++) {
        const t = i / SR;
        const env = Math.min(1, t / 0.01) * Math.exp(-t / (dur * 0.7));
        d[i] = env * (Math.sin(2 * Math.PI * f * t) + 0.35 * Math.sin(4 * Math.PI * f * t));
    }
    return lowpass(d, 600);
}
function oud(n, dur) { // corde pincée (Karplus-Strong), un peu de bruit de plectre
    const d = new Float32Array(Math.round((dur + 0.6) * SR));
    const period = Math.max(2, Math.round(SR / NOTE(n)));
    const ring = new Float32Array(period).map(() => noise());
    let idx = 0;
    for (let i = 0; i < d.length; i++) {
        const next = (idx + 1) % period;
        const v = 0.996 * 0.5 * (ring[idx] + ring[next]);
        d[i] = ring[idx];
        ring[idx] = v;
        idx = next;
    }
    for (let i = 0; i < d.length; i++) d[i] *= Math.min(1, i / (0.002 * SR)) * (i / SR > dur ? Math.exp(-(i / SR - dur) / 0.12) : 1);
    return lowpass(d, 3200);
}
// ---------------- Partition ----------------
const at = (bar, beat) => bar * BAR + beat * BEAT;
const D3 = 50, Eb3 = 51, Fs3 = 54, G3 = 55, A3 = 57, Bb3 = 58, C3 = 48;
const D4 = 62, Eb4 = 63, Fs4 = 66, G4 = 67, A4 = 69, Bb4 = 70, C5 = 72, D5 = 74;

// Darbouka sur 4 temps : « pa » (coup sec) sur le 1, silence sur le 2, « pam pam » (coups graves) sur le 3 et le 4.
// Bendir doux sur le 1. Petit roulement « pa-pa-pa » en fin de phrase (mesures 8 et 16), pour relancer.
for (let bar = 0; bar < BARS; bar++) {
    add(tak(), at(bar, 0), 0.1, 0.6);   // pa
    add(dum(), at(bar, 2), -0.1, 0.9);  // pam
    add(dum(), at(bar, 3), -0.1, 0.85); // pam
    add(bendir(), at(bar, 0), -0.3, 0.45);
    if (bar % 8 === 7) for (const b of [1, 1.5]) add(tak(), at(bar, b), 0.15, 0.4);
}

// Basse : la tonique (ré) et sa quinte (la), qui suit le riff
for (let bar = 0; bar < BARS; bar++) {
    const low = bar % 4 === 3 ? [38, 45, 38, 36] : [38, 38, 45, 38];
    low.forEach((n, k) => add(bass(n, BEAT * 0.9), at(bar, k), 0, 0.55));
}

// Oud : riff en croches (2 mesures), variante sur les mesures 5 à 8 de chaque phrase
const RIFF_A = [D3, Eb3, Fs3, G3, A3, G3, Fs3, Eb3, D3, null, D3, Fs3, Eb3, D3, C3, D3];
const RIFF_B = [A3, Bb3, A3, G3, Fs3, G3, A3, null, G3, Fs3, Eb3, D3, Eb3, Fs3, D3, null];
for (let bar = 0; bar < BARS; bar += 2) {
    const riff = bar % 8 >= 4 ? RIFF_B : RIFF_A;
    riff.forEach((n, k) => { if (n !== null) add(oud(n, BEAT / 2), at(bar, k / 2), -0.45, bar >= 8 ? 0.3 : 0.42); });
}

// Mélodie à l'oud sur la deuxième moitié (mesures 9 à 16) : une octave au-dessus du riff ;
// les notes longues sont jouées en trémolo (la corde repincée en doubles croches), comme au oud
const MELODY = [ // [note, durée en temps]
    [[A4, 2], [Bb4, 1], [A4, 1]],
    [[G4, 1], [Fs4, 1], [G4, 2]],
    [[A4, 1], [C5, 1], [Bb4, 1], [A4, 1]],
    [[G4, 3], [Fs4, 1]],
    [[D5, 2], [C5, 1], [Bb4, 1]],
    [[A4, 1], [Bb4, 1], [A4, 1], [G4, 1]],
    [[Fs4, 1], [G4, 1], [Eb4, 1], [Fs4, 1]],
    [[D4, 4]],
];
MELODY.forEach((bar, b) => {
    let beat = 0;
    bar.forEach(([n, len]) => {
        const strokes = len >= 2 ? len * 4 : 1; // trémolo sur les notes de 2 temps et plus
        for (let k = 0; k < strokes; k++) {
            const step = len / strokes;
            add(oud(n, step * BEAT), at(8 + b, beat + k * step), 0.4, k === 0 ? 0.5 : 0.32);
        }
        beat += len;
    });
});

// ---------------- Réverbération (bouclée : on la fait tourner deux fois, on garde le second passage) ----------------
function reverb(x) {
    const combs = [1557, 1617, 1491, 1422].map((n) => Math.round(n * SR / 44100));
    const out = new Float32Array(LEN);
    for (const n of combs) {
        const buf = new Float32Array(n);
        let k = 0, lp = 0;
        for (let pass = 0; pass < 2; pass++) {
            for (let i = 0; i < LEN; i++) {
                const y = buf[k];
                lp = y * 0.7 + lp * 0.3;
                buf[k] = x[i] + lp * 0.78;
                k = (k + 1) % n;
                if (pass === 1) out[i] += y;
            }
        }
    }
    return out;
}
const rl = reverb(L), rr = reverb(R);
let peak = 0;
for (let i = 0; i < LEN; i++) {
    L[i] += rl[i] * 0.06;
    R[i] += rr[i] * 0.06;
    peak = Math.max(peak, Math.abs(L[i]), Math.abs(R[i]));
}

// ---------------- WAV temporaire, puis MP3 ----------------
const gain = 0.89 / peak;
const bytes = Buffer.alloc(44 + LEN * 4);
bytes.write('RIFF', 0); bytes.writeUInt32LE(36 + LEN * 4, 4); bytes.write('WAVE', 8);
bytes.write('fmt ', 12); bytes.writeUInt32LE(16, 16); bytes.writeUInt16LE(1, 20); bytes.writeUInt16LE(2, 22);
bytes.writeUInt32LE(SR, 24); bytes.writeUInt32LE(SR * 4, 28); bytes.writeUInt16LE(4, 32); bytes.writeUInt16LE(16, 34);
bytes.write('data', 36); bytes.writeUInt32LE(LEN * 4, 40);
for (let i = 0; i < LEN; i++) {
    bytes.writeInt16LE(Math.round(Math.max(-1, Math.min(1, L[i] * gain)) * 32767), 44 + i * 4);
    bytes.writeInt16LE(Math.round(Math.max(-1, Math.min(1, R[i] * gain)) * 32767), 46 + i * 4);
}
const wav = path.join(os.tmpdir(), 'lcarta-chaabi.wav');
fs.writeFileSync(wav, bytes);
const outDir = path.join(__dirname, '..', 'assets', 'music');
fs.mkdirSync(outDir, { recursive: true });
const out = path.join(outDir, 'chaabi.mp3');
const ffmpeg = require('@ffmpeg-installer/ffmpeg').path;
execFileSync(ffmpeg, ['-y', '-loglevel', 'error', '-i', wav, '-codec:a', 'libmp3lame', '-b:a', '96k', out]);
fs.unlinkSync(wav);
console.log(`assets/music/chaabi.mp3 : ${(LEN / SR).toFixed(1)} s, ${Math.round(fs.statSync(out).size / 1024)} Ko`);
