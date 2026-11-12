// Enregistre le service worker : appli installable et démarrage rapide (fichiers en cache)
if ('serviceWorker' in navigator && (location.protocol === 'https:' || location.hostname === 'localhost')) {
  window.addEventListener('load', function () {
    navigator.serviceWorker.register('/sw.js').catch(function () { /* pas bloquant */ });
  });
}

// Android / Chrome : on garde la proposition d'installation pour le bouton « Installer l'appli »
window.addEventListener('beforeinstallprompt', function (e) {
  e.preventDefault();
  window.__installPrompt = e;
  window.dispatchEvent(new Event('jg3-installable'));
});
window.addEventListener('appinstalled', function () {
  window.__installPrompt = null;
  window.dispatchEvent(new Event('jg3-installed'));
});
