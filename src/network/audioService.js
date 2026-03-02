import { Audio } from 'expo-av';
import AsyncStorage from '@react-native-async-storage/async-storage';

class AudioService {
    constructor() {
        this.sounds = {};
        this.tickTockPlaying = false;
        this.muted = false;

        // Initializer la configuration audio
        this.initAudio();
    }

    async initAudio() {
        try {
            await Audio.setAudioModeAsync({
                playsInSilentModeIOS: true,
                staysActiveInBackground: true,
                shouldDuckAndroid: true,
            });

            const savedMuted = await AsyncStorage.getItem('audioMuted');
            if (savedMuted === 'true') {
                this.muted = true;
            }
        } catch (e) {
            console.log("Erreur initialisation AudioMode", e);
        }
    }

    async toggleMute() {
        this.muted = !this.muted;
        try {
            await AsyncStorage.setItem('audioMuted', this.muted ? 'true' : 'false');
            if (this.muted) {
                this.stopTickTock();
            }
        } catch (e) {
            console.error("Erreur sauvegarde mute", e);
        }
        return this.muted;
    }

    async playSound(soundName) {
        if (this.muted) return;

        try {
            let soundModule;
            switch (soundName) {
                case 'turn':
                case 'change_suit':
                    soundModule = require('../../assets/freesound_community-flipcard-91468.mp3');
                    break;
                case 'plus_two':
                    soundModule = require('../../assets/plus_two.mp3');
                    break;
                case 'skip':
                    soundModule = require('../../assets/alexis_gaming_cam-vinyl-stop-342938.mp3');
                    break;
                case 'win':
                    soundModule = require('../../assets/universfield-very-infectious-laughter-117727.mp3');
                    break;
                case 'lose':
                    soundModule = require('../../assets/freesound_community-080205_life-lost-game-over-89697.mp3');
                    break;
                default:
                    return;
            }

            const { sound } = await Audio.Sound.createAsync(soundModule);
            await sound.playAsync();

            // Nettoyage après lecture
            sound.setOnPlaybackStatusUpdate((status) => {
                if (status.didJustFinish) {
                    sound.unloadAsync();
                }
            });
        } catch (error) {
            // Fichier potentiellement manquant, on ignore silencieusement
            console.warn(`Le son ${soundName} n'a pas pu être joué (fichier manquant ?):`, error.message);
        }
    }

    // Gestion asynchrone spécifique pour le tick-tock de la bombe/chrono (qui peut boucler)
    async startTickTock() {
        if (this.tickTockPlaying || this.muted) return;

        try {
            if (!this.sounds['ticktock']) {
                const { sound } = await Audio.Sound.createAsync(
                    require('../../assets/freesound_community-tic-tac-27828.mp3'),
                    { isLooping: true }
                );
                this.sounds['ticktock'] = sound;
            }
            await this.sounds['ticktock'].playAsync();
            this.tickTockPlaying = true;
        } catch (e) {
            console.warn("Ticktock non joué:", e.message);
        }
    }

    async stopTickTock() {
        if (this.sounds['ticktock'] && this.tickTockPlaying) {
            await this.sounds['ticktock'].stopAsync();
            this.tickTockPlaying = false;
        }
    }
}

export default new AudioService();
