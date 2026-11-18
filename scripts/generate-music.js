/**
 * Musique d'ambiance du menu : boucle chaabi composée et synthétisée pour le jeu (libre de droits).
 * Darbouka (rythme maqsoum), bendir, basse, oud (Karplus-Strong) et violon en mode hijaz sur ré.
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
function dum() { // coup grave de darbouka
    const d = new Float32Array(Math.round(0.35 * SR));
    for (let i = 0; i < d.length; i++) {
        const t = i / SR;
        const f = 62 + 70 * Math.exp(-t / 0.03);
        d[i] = Math.sin(2 * Math.PI * f * t) * Math.exp(-t / 0.16) + 0.25 * noise() * Math.exp(-t / 0.006);
    }
    return d;
}
function tak(soft = false) { // coup sec sur le bord
    const d = new Float32Array(Math.round(0.09 * SR));
    for (let i = 0; i < d.length; i++) {
        const t = i / SR;
        d[i] = noise() * Math.exp(-t / (soft ? 0.012 : 0.02)) + 0.4 * Math.sin(2 * Math.PI * 520 * t) * Math.exp(-t / 0.02);
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
function clap() { // claquement de mains (trois mains qui ne tombent pas pile ensemble)
    const d = new Float32Array(Math.round(0.18 * SR));
    for (const off of [0, 0.011, 0.022]) {
        const s = Math.round(off * SR);
        for (let i = 0; i + s < d.length; i++) d[i + s] += noise() * Math.exp(-(i / SR) / 0.03);
    }
    return lowpass(highpass(d, 900), 4500);
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
function violin(n, dur) { // archet : dents de scie adoucies, vibrato qui arrive après l'attaque
    const d = new Float32Array(Math.round((dur + 0.15) * SR));
    const f0 = NOTE(n);
    let ph = 0;
    for (let i = 0; i < d.length; i++) {
        const t = i / SR;
        const vib = 1 + 0.006 * Math.sin(2 * Math.PI * 5.6 * t) * Math.min(1, Math.max(0, (t - 0.12) / 0.2));
        ph += (f0 * vib) / SR;
        let v = 0;
        for (let h = 1; h <= 8; h++) v += Math.sin(2 * Math.PI * h * ph) / h;
        const env = Math.min(1, t / 0.07) * (t > dur ? Math.exp(-(t - dur) / 0.06) : 1);
        d[i] = v * env;
    }
    return lowpass(d, 3000);
}

// ---------------- Partition ----------------
const at = (bar, beat) => bar * BAR + beat * BEAT;
const D3 = 50, Eb3 = 51, Fs3 = 54, G3 = 55, A3 = 57, Bb3 = 58, C3 = 48;
const D4 = 62, Eb4 = 63, Fs4 = 66, G4 = 67, A4 = 69, Bb4 = 70, C5 = 72, D5 = 74;

// Percussions : maqsoum (D T . T D . T .) en croches, petites notes fantômes, roulement en fin de phrase
for (let bar = 0; bar < BARS; bar++) {
    const fill = bar % 8 === 7;
    const pattern = fill ? 'DTTTDTTT' : 'DT.TD.T.';
    [...pattern].forEach((c, k) => {
        const t = at(bar, k / 2);
        if (c === 'D') add(dum(), t, -0.1, 0.9);
        if (c === 'T') add(tak(), t, 0.15, fill && k > 4 ? 0.55 : 0.45);
        if (c === '.' && rand() < 0.6) add(tak(true), t, 0.2, 0.18);
    });
    if (!fill) for (const k of [1, 3, 5, 7]) if (rand() < 0.35) add(tak(true), at(bar, k / 2 + 0.25), 0.25, 0.12);
    add(bendir(), at(bar, 0), -0.3, 0.6);
    add(bendir(), at(bar, 2), -0.3, 0.45);
    if (bar >= 8) { add(clap(), at(bar, 1), 0.35, 0.28); add(clap(), at(bar, 3), 0.35, 0.28); }
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
    riff.forEach((n, k) => { if (n !== null) add(oud(n, BEAT / 2), at(bar, k / 2), -0.45, 0.42); });
}

// Violon : la mélodie sur la deuxième moitié (mesures 9 à 16)
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
    bar.forEach(([n, len]) => { add(violin(n, len * BEAT * 0.97), at(8 + b, beat), 0.45, 0.3); beat += len; });
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
