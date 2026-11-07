import { Audio } from 'expo-av';
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * Service audio central : effets sonores préchargés + musique d'ambiance.
 *
 * - Les effets sont chargés une seule fois puis rejoués (pas de latence).
 * - Chaque effet a un petit pool d'instances pour pouvoir se superposer (distribution).
 * - `muted` coupe TOUT (effets + musique). `musicOn` ne concerne que la musique.
 * - Sur le web, la musique démarre au premier geste de l'utilisateur (politique autoplay).
 */

const SFX = {
    // Sons synthétisés (scripts/generate-sfx.js)
    card_play:   { src: require('../../assets/sfx/card_play.wav'),   volume: 0.9, pool: 2 },
    card_draw:   { src: require('../../assets/sfx/card_draw.wav'),   volume: 0.7, pool: 3 },
    card_deal:   { src: require('../../assets/sfx/card_deal.wav'),   volume: 0.6, pool: 4 },
    click:       { src: require('../../assets/sfx/click.wav'),       volume: 0.45, pool: 2 },
    your_turn:   { src: require('../../assets/sfx/your_turn.wav'),   volume: 0.75 },
    change_suit: { src: require('../../assets/sfx/change_suit.wav'), volume: 0.7 },
    penalty:     { src: require('../../assets/sfx/penalty.wav'),     volume: 0.7 },
    pop:         { src: require('../../assets/sfx/pop.wav'),         volume: 0.6, pool: 2 },
    whoosh:      { src: require('../../assets/sfx/whoosh.wav'),      volume: 0.5 },
    victory:     { src: require('../../assets/sfx/victory.wav'),     volume: 0.8 },
    defeat:      { src: require('../../assets/sfx/defeat.wav'),      volume: 0.8 },
    coin:        { src: require('../../assets/sfx/coin.wav'),        volume: 0.6 },
    player_out:  { src: require('../../assets/sfx/player_out.wav'),  volume: 0.6 },
    error:       { src: require('../../assets/sfx/error.wav'),       volume: 0.5 },
    // Ronda / Kdoub / Sota
    darba:       { src: require('../../assets/sfx/darba.wav'),       volume: 0.85 },
    hbel:        { src: require('../../assets/sfx/hbel.wav'),        volume: 0.9 },
    bachra:      { src: require('../../assets/sfx/bachra.wav'),      volume: 0.9 },
    missa:       { src: require('../../assets/sfx/missa.wav'),       volume: 0.75 },
    announce:    { src: require('../../assets/sfx/announce.wav'),    volume: 0.75 },
    warning:     { src: require('../../assets/sfx/warning.wav'),     volume: 0.6 },
    reveal:      { src: require('../../assets/sfx/reveal.wav'),      volume: 0.8 },
    // Sons "culturels" existants
    plus_two:    { src: require('../../assets/plus_two.mp3'),        volume: 1.0 },
    skip:        { src: require('../../assets/alexis_gaming_cam-vinyl-stop-342938.mp3'), volume: 0.8 },
    laugh:       { src: require('../../assets/universfield-very-infectious-laughter-117727.mp3'), volume: 0.7 },
    game_over:   { src: require('../../assets/freesound_community-080205_life-lost-game-over-89697.mp3'), volume: 0.7 },
};

// Alias pour compatibilité avec l'ancien code
const ALIASES = { turn: 'card_play', win: 'victory', lose: 'defeat' };

const MUSIC_SRC = require('../../assets/FREE DYSTINCT X TIF X CHAABI TYPE BEAT - ZINA (1).mp3');
const MUSIC_VOLUME = { menu: 0.1, game: 0.035 }; // discrète : fond sonore qui ne couvre pas les effets
const TICK_SRC = require('../../assets/freesound_community-tic-tac-27828.mp3');

class AudioService {
    constructor() {
        this.muted = false;
        this.musicOn = true;
        this.pools = {};          // name -> { sounds: Sound[], next: number }
        this.loading = null;
        this.music = null;
        this.musicMode = 'menu';
        this.musicWanted = false;
        this.tick = null;
        this.tickTockPlaying = false;
        this.listeners = new Set();

        this.ready = this.init();
    }

    // ---------- Initialisation ----------
    async init() {
        try {
            await Audio.setAudioModeAsync({
                playsInSilentModeIOS: true,
                staysActiveInBackground: false,
                shouldDuckAndroid: true,
            });
        } catch (e) { /* web / non supporté */ }

        try {
            const [m, music] = await Promise.all([
                AsyncStorage.getItem('audioMuted'),
                AsyncStorage.getItem('musicOn'),
            ]);
            this.muted = m === 'true';
            this.musicOn = music !== 'false';
        } catch (e) { /* ignore */ }

        this.installWebUnlock();
        this.preload();
        this.emit();
    }

    preload() {
        if (this.loading) return this.loading;
        this.loading = Promise.all(
            Object.entries(SFX).map(async ([name, def]) => {
                const count = def.pool || 1;
                const sounds = [];
                for (let i = 0; i < count; i++) {
                    try {
                        const { sound } = await Audio.Sound.createAsync(def.src, { volume: def.volume, shouldPlay: false });
                        sounds.push(sound);
                    } catch (e) {
                        console.warn(`[audio] ${name} non chargé :`, e?.message);
                    }
                }
                this.pools[name] = { sounds, next: 0 };
            })
        );
        return this.loading;
    }

    // Sur le web, le navigateur bloque l'audio tant que l'utilisateur n'a pas interagi.
    installWebUnlock() {
        if (Platform.OS !== 'web' || typeof document === 'undefined') return;
        const unlock = () => {
            if (this.musicWanted) this.startMusic(this.musicMode);
            document.removeEventListener('pointerdown', unlock, true);
            document.removeEventListener('keydown', unlock, true);
        };
        document.addEventListener('pointerdown', unlock, true);
        document.addEventListener('keydown', unlock, true);
    }

    // ---------- Abonnement (pour synchroniser les boutons mute entre écrans) ----------
    subscribe(fn) {
        this.listeners.add(fn);
        return () => this.listeners.delete(fn);
    }
    emit() {
        this.listeners.forEach((fn) => fn({ muted: this.muted, musicOn: this.musicOn }));
    }

    // ---------- Réglages ----------
    async toggleMute() {
        this.muted = !this.muted;
        try { await AsyncStorage.setItem('audioMuted', this.muted ? 'true' : 'false'); } catch (e) { /* ignore */ }
        if (this.muted) {
            this.stopTickTock();
            this.pauseMusic();
        } else if (this.musicWanted) {
            this.startMusic(this.musicMode);
        }
        this.emit();
        return this.muted;
    }

    async toggleMusic() {
        this.musicOn = !this.musicOn;
        try { await AsyncStorage.setItem('musicOn', this.musicOn ? 'true' : 'false'); } catch (e) { /* ignore */ }
        if (this.musicOn) this.startMusic(this.musicMode);
        else this.pauseMusic();
        this.emit();
        return this.musicOn;
    }

    // ---------- Effets ----------
    async playSound(name, { volume, rate } = {}) {
        if (this.muted) return;
        const key = ALIASES[name] || name;
        if (!SFX[key]) return;
        await this.loading;
        const pool = this.pools[key];
        if (!pool || pool.sounds.length === 0) return;

        const sound = pool.sounds[pool.next];
        pool.next = (pool.next + 1) % pool.sounds.length;
        try {
            const status = { positionMillis: 0, shouldPlay: true, volume: volume ?? SFX[key].volume };
            if (rate) {
                status.rate = rate;
                status.shouldCorrectPitch = false;
            }
            await sound.setStatusAsync(status);
        } catch (e) {
            // Une interruption pendant la lecture n'est pas grave
        }
    }

    // Distribution : une rafale de "flick" de cartes
    playDeal(count = 6, interval = 110) {
        if (this.muted) return;
        for (let i = 0; i < count; i++) {
            setTimeout(() => this.playSound('card_deal', { rate: 0.9 + (i % 3) * 0.08 }), i * interval);
        }
    }

    // Compatibilité avec l'ancien appel
    playEndRound() { /* géré par victory / defeat */ }

    // ---------- Musique ----------
    async startMusic(mode = 'menu') {
        this.musicMode = mode;
        this.musicWanted = true;
        if (this.muted || !this.musicOn) return;
        try {
            if (!this.music) {
                const { sound } = await Audio.Sound.createAsync(MUSIC_SRC, {
                    isLooping: true,
                    volume: 0,
                    shouldPlay: false,
                });
                this.music = sound;
            }
            const status = await this.music.getStatusAsync();
            if (!status.isPlaying) await this.music.playAsync();
            this.fadeMusicTo(MUSIC_VOLUME[mode] ?? MUSIC_VOLUME.menu);
        } catch (e) {
            // Autoplay bloqué sur le web : on réessaiera au premier geste
        }
    }

    setMusicMode(mode) {
        this.musicMode = mode;
        if (this.music && !this.muted && this.musicOn) {
            this.fadeMusicTo(MUSIC_VOLUME[mode] ?? MUSIC_VOLUME.menu);
        }
    }

    async pauseMusic() {
        if (!this.music) return;
        try { await this.music.pauseAsync(); } catch (e) { /* ignore */ }
    }

    async resumeMusic() {
        if (this.musicWanted) this.startMusic(this.musicMode);
    }

    fadeMusicTo(target, duration = 800) {
        if (!this.music) return;
        clearInterval(this.fadeTimer);
        const steps = 16;
        let step = 0;
        const sound = this.music;
        sound.getStatusAsync().then((s) => {
            const from = s.volume ?? 0;
            this.fadeTimer = setInterval(() => {
                step++;
                const v = from + (target - from) * (step / steps);
                sound.setVolumeAsync(Math.max(0, Math.min(1, v))).catch(() => {});
                if (step >= steps) clearInterval(this.fadeTimer);
            }, duration / steps);
        }).catch(() => {});
    }

    // ---------- Tic-tac du chrono ----------
    async startTickTock() {
        if (this.tickTockPlaying || this.muted) return;
        this.tickTockPlaying = true;
        try {
            if (!this.tick) {
                const { sound } = await Audio.Sound.createAsync(TICK_SRC, { isLooping: true, volume: 0.55 });
                this.tick = sound;
            }
            if (!this.tickTockPlaying) return; // arrêté entre-temps
            await this.tick.setPositionAsync(0);
            await this.tick.playAsync();
        } catch (e) {
            this.tickTockPlaying = false;
        }
    }

    async stopTickTock() {
        if (!this.tickTockPlaying) return;
        this.tickTockPlaying = false;
        if (this.tick) {
            try { await this.tick.stopAsync(); } catch (e) { /* ignore */ }
        }
    }
}

export default new AudioService();
