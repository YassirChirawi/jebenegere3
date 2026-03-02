const { execSync } = require('child_process');
const path = require('path');

const ffmpegPath = require('@ffmpeg-installer/ffmpeg').path;

const inputFile = path.join(__dirname, 'assets', 'خالد العوني زيد جوج يا مول الروج زيد جوج.mp3');
const outputFile = path.join(__dirname, 'assets', 'plus_two.mp3');

// Extraire de 1:03 à 1:06 (durée 3 secondes)
const cmd = `"${ffmpegPath}" -ss 00:01:03 -t 3 -i "${inputFile}" -acodec libmp3lame -y "${outputFile}"`;

console.log('Extraction en cours...');
try {
    execSync(cmd, { stdio: 'inherit' });
    console.log('✅ plus_two.mp3 créé avec succès dans assets/');
} catch (e) {
    console.error('❌ Erreur:', e.message);
}
