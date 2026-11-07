/**
 * Génère les effets sonores du jeu (WAV mono 16 bits) par synthèse procédurale.
 * Usage : node scripts/generate-sfx.js
 * Sortie : assets/sfx/*.wav
 */
const fs = require('fs');
const path = require('path');

const SR = 22050;
const OUT_DIR = path.join(__dirname, '..', 'assets', 'sfx');

// Générateur pseudo-aléatoire déterministe (les fichiers sont reproductibles)
let seed = 1337;
const rand = () => {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    return seed / 4294967296;
};
const noise = () => rand() * 2 - 1;

const buf = (seconds) => new Float32Array(Math.ceil(seconds * SR));

function writeWav(name, data, gain = 0.9) {
    // Normalisation douce
    let peak = 0;
    for (const v of data) peak = Math.max(peak, Math.abs(v));
    const k = peak > 0 ? gain / peak : 1;

    // Micro fondu en sortie pour éviter les clics
    const fade = Math.min(200, data.length);
    for (let i = 0; i < fade; i++) data[data.length - 1 - i] *= i / fade;

    const bytes = Buffer.alloc(44 + data.length * 2);
    bytes.write('RIFF', 0);
    bytes.writeUInt32LE(36 + data.length * 2, 4);
    bytes.write('WAVE', 8);
    bytes.write('fmt ', 12);
    bytes.writeUInt32LE(16, 16);
    bytes.writeUInt16LE(1, 20);
    bytes.writeUInt16LE(1, 22);
    bytes.writeUInt32LE(SR, 24);
    bytes.writeUInt32LE(SR * 2, 28);
    bytes.writeUInt16LE(2, 32);
    bytes.writeUInt16LE(16, 34);
    bytes.write('data', 36);
    bytes.writeUInt32LE(data.length * 2, 40);
    for (let i = 0; i < data.length; i++) {
        const s = Math.max(-1, Math.min(1, data[i] * k));
        bytes.writeInt16LE(Math.round(s * 32767), 44 + i * 2);
    }
    fs.writeFileSync(path.join(OUT_DIR, `${name}.wav`), bytes);
    console.log(`  ✓ ${name}.wav (${(data.length / SR).toFixed(2)}s)`);
}

// --- Filtres simples ---
function lowpass(data, cutoff) {
    const getC = typeof cutoff === 'function' ? cutoff : () => cutoff;
    let y = 0;
    for (let i = 0; i < data.length; i++) {
        const a = 1 - Math.exp((-2 * Math.PI * getC(i / SR)) / SR);
        y += a * (data[i] - y);
        data[i] = y;
    }
    return data;
}
function highpass(data, cutoff) {
    const copy = Float32Array.from(data);
    lowpass(copy, cutoff);
    for (let i = 0; i < data.length; i++) data[i] -= copy[i];
    return data;
}
function mixInto(target, src, offsetSec = 0, gain = 1) {
    const off = Math.floor(offsetSec * SR);
    for (let i = 0; i < src.length && off + i < target.length; i++) target[off + i] += src[i] * gain;
    return target;
}

// Note "cloche" douce (sinus + harmoniques décroissantes)
function bell(freq, dur, decay = 0.35, bright = 0.5) {
    const d = buf(dur);
    for (let i = 0; i < d.length; i++) {
        const t = i / SR;
        const att = Math.min(1, t / 0.004);
        const env = att * Math.exp(-t / decay);
        d[i] = env * (
            Math.sin(2 * Math.PI * freq * t) +
            bright * 0.5 * Math.sin(2 * Math.PI * freq * 2 * t) * Math.exp(-t / (decay * 0.5)) +
            bright * 0.25 * Math.sin(2 * Math.PI * freq * 3.01 * t) * Math.exp(-t / (decay * 0.3))
        );
    }
    return d;
}

// Note "pluck" façon oud / guembri (Karplus-Strong)
function pluck(freq, dur, damping = 0.996) {
    const d = buf(dur);
    const period = Math.round(SR / freq);
    const ring = new Float32Array(period).map(() => noise());
    let idx = 0;
    for (let i = 0; i < d.length; i++) {
        const next = (idx + 1) % period;
        const v = damping * 0.5 * (ring[idx] + ring[next]);
        d[i] = ring[idx];
        ring[idx] = v;
        idx = next;
    }
    return d;
}

const NOTE = (n) => 440 * Math.pow(2, (n - 69) / 12); // MIDI → Hz

// ===================== SONS =====================
const sounds = {
    // Carte posée sur le tapis : claquement + petit "thump"
    card_play() {
        const d = buf(0.16);
        for (let i = 0; i < d.length; i++) {
            const t = i / SR;
            d[i] = noise() * Math.exp(-t / 0.018);
        }
        highpass(d, 700);
        lowpass(d, 5000);
        const thump = buf(0.16);
        for (let i = 0; i < thump.length; i++) {
            const t = i / SR;
            thump[i] = Math.sin(2 * Math.PI * (140 - 60 * t / 0.16) * t) * Math.exp(-t / 0.035);
        }
        return mixInto(d, thump, 0, 0.6);
    },

    // Carte piochée : glissement / swish
    card_draw() {
        const dur = 0.24;
        const d = buf(dur);
        for (let i = 0; i < d.length; i++) {
            const t = i / SR;
            const env = Math.sin(Math.PI * Math.min(1, t / dur)) ** 1.5;
            d[i] = noise() * env;
        }
        lowpass(d, (t) => 900 + 3500 * (t / dur));
        highpass(d, 300);
        return d;
    },

    // Distribution : petit "flick" sec
    card_deal() {
        const d = buf(0.07);
        for (let i = 0; i < d.length; i++) {
            const t = i / SR;
            d[i] = noise() * Math.exp(-t / 0.009);
        }
        highpass(d, 1800);
        return d;
    },

    // Clic d'interface boisé
    click() {
        const d = buf(0.06);
        for (let i = 0; i < d.length; i++) {
            const t = i / SR;
            d[i] = (Math.sin(2 * Math.PI * 1100 * t) * 0.7 + Math.sin(2 * Math.PI * 2300 * t) * 0.3) * Math.exp(-t / 0.012);
        }
        const n = buf(0.01).map(() => noise() * 0.3);
        return mixInto(d, n);
    },

    // C'est ton tour : deux notes de oud
    your_turn() {
        const d = buf(0.9);
        mixInto(d, pluck(NOTE(67), 0.8), 0, 0.9);   // G4
        mixInto(d, pluck(NOTE(74), 0.75), 0.13, 1); // D5
        mixInto(d, bell(NOTE(86), 0.6, 0.25, 0.2), 0.13, 0.12); // éclat
        return lowpass(d, 6000);
    },

    // Le 7 : changement de famille, arpège magique (mode hijaz)
    change_suit() {
        const d = buf(1.0);
        const scale = [62, 63, 66, 67, 69, 70, 74]; // D Eb F# G A Bb D
        scale.forEach((n, i) => mixInto(d, bell(NOTE(n + 12), 0.6, 0.3, 0.6), i * 0.045, 0.5));
        // shimmer
        const sh = buf(0.9);
        for (let i = 0; i < sh.length; i++) {
            const t = i / SR;
            sh[i] = noise() * Math.exp(-t / 0.25) * Math.min(1, t / 0.05);
        }
        highpass(sh, 6000);
        return mixInto(d, sh, 0.05, 0.15);
    },

    // Pénalité (+2 reçu / pioche forcée) : "bwomp" descendant
    penalty() {
        const dur = 0.45;
        const d = buf(dur);
        let phase = 0;
        for (let i = 0; i < d.length; i++) {
            const t = i / SR;
            const f = 320 * Math.pow(110 / 320, t / dur);
            phase += (2 * Math.PI * f) / SR;
            const env = Math.min(1, t / 0.01) * Math.exp(-t / 0.18);
            d[i] = env * (Math.sin(phase) + 0.4 * Math.sin(2 * phase) + 0.2 * Math.sin(3 * phase));
        }
        return lowpass(d, 1800);
    },

    // Bulle : réaction / message de chat
    pop() {
        const dur = 0.09;
        const d = buf(dur);
        let phase = 0;
        for (let i = 0; i < d.length; i++) {
            const t = i / SR;
            const f = 420 + 900 * (t / dur);
            phase += (2 * Math.PI * f) / SR;
            d[i] = Math.sin(phase) * Math.exp(-t / 0.03) * Math.min(1, t / 0.003);
        }
        return d;
    },

    // Whoosh : bannière / overlay
    whoosh() {
        const dur = 0.45;
        const d = buf(dur);
        for (let i = 0; i < d.length; i++) {
            const t = i / SR;
            const env = Math.sin(Math.PI * (t / dur)) ** 2;
            d[i] = noise() * env;
        }
        lowpass(d, (t) => 400 + 2600 * Math.sin(Math.PI * t / dur));
        return highpass(d, 200);
    },

    // Victoire : fanfare de cloches
    victory() {
        const d = buf(1.8);
        const notes = [60, 64, 67, 72];
        notes.forEach((n, i) => mixInto(d, bell(NOTE(n + 12), 0.7, 0.3, 0.6), i * 0.11, 0.6));
        [72, 76, 79, 84].forEach((n) => mixInto(d, bell(NOTE(n), 1.3, 0.6, 0.4), 0.48, 0.3));
        mixInto(d, pluck(NOTE(48), 1.2, 0.998), 0.48, 0.5);
        return d;
    },

    // Défaite : trois notes qui tombent
    defeat() {
        const d = buf(1.4);
        [[67, 0], [63, 0.22], [58, 0.44]].forEach(([n, t]) => mixInto(d, pluck(NOTE(n - 12), 0.9, 0.997), t, 0.9));
        mixInto(d, pluck(NOTE(46 - 12), 1.0, 0.998), 0.66, 1);
        return lowpass(d, 3000);
    },

    // XP / pièce gagnée
    coin() {
        const d = buf(0.5);
        mixInto(d, bell(NOTE(83), 0.15, 0.06, 0.3), 0, 0.7);
        mixInto(d, bell(NOTE(88), 0.45, 0.18, 0.3), 0.07, 0.8);
        return d;
    },

    // Un adversaire a vidé sa main
    player_out() {
        const d = buf(0.7);
        mixInto(d, bell(NOTE(76), 0.6, 0.25, 0.4), 0, 0.7);
        mixInto(d, bell(NOTE(81), 0.6, 0.25, 0.4), 0.09, 0.7);
        return d;
    },

    // --- Ronda / Kdoub / Sota ---

    // Darba : impact sec + petit éclat (on vole la carte de l'adversaire)
    darba() {
        const d = buf(0.6);
        const hit = buf(0.25);
        for (let i = 0; i < hit.length; i++) {
            const t = i / SR;
            hit[i] = Math.sin(2 * Math.PI * (180 - 120 * t / 0.25) * t) * Math.exp(-t / 0.06) + noise() * Math.exp(-t / 0.012) * 0.6;
        }
        mixInto(d, lowpass(hit, 3000), 0, 1);
        mixInto(d, bell(NOTE(79), 0.4, 0.15, 0.6), 0.04, 0.35);
        mixInto(d, bell(NOTE(84), 0.4, 0.15, 0.6), 0.1, 0.35);
        return d;
    },

    // Hbel : double impact plus lourd + accord tendu
    hbel() {
        const d = buf(1.0);
        [0, 0.14].forEach((off, k) => {
            const hit = buf(0.35);
            for (let i = 0; i < hit.length; i++) {
                const t = i / SR;
                hit[i] = Math.sin(2 * Math.PI * (110 - 50 * t / 0.35) * t) * Math.exp(-t / 0.1) + noise() * Math.exp(-t / 0.02) * 0.5;
            }
            mixInto(d, lowpass(hit, 2200), off, k ? 1 : 0.8);
        });
        [62, 65, 68, 71].forEach((n, i) => mixInto(d, pluck(NOTE(n), 0.8, 0.996), 0.3 + i * 0.05, 0.4));
        return d;
    },

    // B'achra : roulement + grande fanfare
    bachra() {
        const d = buf(2.0);
        for (let k = 0; k < 10; k++) {
            const hit = buf(0.12);
            for (let i = 0; i < hit.length; i++) {
                const t = i / SR;
                hit[i] = noise() * Math.exp(-t / 0.025) + Math.sin(2 * Math.PI * 150 * t) * Math.exp(-t / 0.04);
            }
            mixInto(d, lowpass(hit, 2500), k * 0.045, 0.3 + k * 0.05);
        }
        [60, 64, 67, 72, 76].forEach((n, i) => mixInto(d, bell(NOTE(n + 12), 1.3, 0.5, 0.6), 0.5 + i * 0.07, 0.45));
        mixInto(d, pluck(NOTE(36), 1.4, 0.998), 0.5, 0.7);
        return d;
    },

    // Missa : balayage de toute la table
    missa() {
        const dur = 0.7;
        const d = buf(dur + 0.4);
        const sweep = buf(dur);
        for (let i = 0; i < sweep.length; i++) {
            const t = i / SR;
            sweep[i] = noise() * Math.sin(Math.PI * t / dur) ** 2;
        }
        lowpass(sweep, (t) => 500 + 5000 * (t / dur));
        mixInto(d, highpass(sweep, 300), 0, 0.7);
        mixInto(d, bell(NOTE(88), 0.5, 0.2, 0.3), dur - 0.05, 0.5);
        return d;
    },

    // Annonce Ronda / Tringa : petit riff de oud
    announce() {
        const d = buf(1.0);
        [[62, 0], [65, 0.09], [69, 0.18], [74, 0.3]].forEach(([n, t]) => mixInto(d, pluck(NOTE(n), 0.7, 0.996), t, 0.8));
        return lowpass(d, 5000);
    },

    // Avertissement : double bip grave
    warning() {
        const d = buf(0.55);
        [0, 0.22].forEach((off) => {
            const b = buf(0.18);
            for (let i = 0; i < b.length; i++) {
                const t = i / SR;
                b[i] = (Math.sin(2 * Math.PI * 440 * t) + 0.5 * Math.sin(2 * Math.PI * 660 * t)) * Math.min(1, t / 0.005) * Math.exp(-t / 0.08);
            }
            mixInto(d, b, off, 1);
        });
        return lowpass(d, 2500);
    },

    // Révélation (accusation Kdoub, Sota finale) : montée de suspense puis impact
    reveal() {
        const d = buf(1.3);
        const riser = buf(0.8);
        let phase = 0;
        for (let i = 0; i < riser.length; i++) {
            const t = i / SR;
            phase += (2 * Math.PI * (200 + 600 * (t / 0.8) ** 2)) / SR;
            riser[i] = (Math.sin(phase) * 0.4 + noise() * 0.3) * (t / 0.8) ** 2;
        }
        mixInto(d, lowpass(riser, 3000), 0, 0.7);
        const hit = buf(0.5);
        for (let i = 0; i < hit.length; i++) {
            const t = i / SR;
            hit[i] = Math.sin(2 * Math.PI * 70 * t) * Math.exp(-t / 0.15) + noise() * Math.exp(-t / 0.03) * 0.5;
        }
        mixInto(d, lowpass(hit, 2000), 0.8, 1);
        return d;
    },

    // Action refusée
    error() {
        const d = buf(0.2);
        for (let i = 0; i < d.length; i++) {
            const t = i / SR;
            const env = Math.min(1, t / 0.005) * Math.exp(-t / 0.06);
            d[i] = env * (Math.sin(2 * Math.PI * 180 * t) + 0.5 * Math.sin(2 * Math.PI * 190 * t));
        }
        return lowpass(d, 1200);
    },
};

fs.mkdirSync(OUT_DIR, { recursive: true });
console.log('Génération des effets sonores →', OUT_DIR);
for (const [name, fn] of Object.entries(sounds)) {
    writeWav(name, fn());
}
console.log('Terminé.');
