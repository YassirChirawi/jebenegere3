// Enregistre le service worker : appli installable et démarrage rapide (fichiers en cache)
// (pas dans Discord : le jeu y est servi par discordsays.com, sans mise en cache hors ligne)
if ('serviceWorker' in navigator && (location.protocol === 'https:' || location.hostname === 'localhost') && !/\.discordsays\.com$/i.test(location.hostname)) {
  window.addEventListener('load', function () {
    navigator.serviceWorker.register('/sw.js').catch(function () { /* pas bloquant */ });
    // Première visite : le code a été chargé avant que le service worker soit actif ;
    // on le met en cache tout de suite pour que l'appli s'ouvre aussi hors ligne.
    navigator.serviceWorker.ready.then(function () {
      if (!window.caches) return;
      var urls = Array.prototype.slice.call(document.scripts)
        .map(function (s) { return s.src; })
        .filter(function (u) { return u && u.indexOf(location.origin + '/_expo/static/') === 0; });
      if (urls.length) caches.open('jg3-v1-static').then(function (c) { return c.addAll(urls); }).catch(function () {});
    });
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
