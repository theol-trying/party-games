/* =========================================================================
   FILET DE SÉCURITÉ AU DÉMARRAGE — script classique, PAS un module.

   Si un seul module du démarrage ne se charge pas (Wi-Fi qui saute pendant
   le chargement, fichier absent du cache hors-ligne…), le navigateur abandonne
   tout le graphe de modules : rien ne s'exécute et l'accueil reste vide, sans
   la moindre explication. Ce script, lui, ne dépend de rien : il s'exécute
   avant les modules et affiche un message avec un bouton « Recharger ».

   Fichier séparé et non script en ligne : la CSP (script-src 'self') interdit
   le JavaScript en ligne, y compris les attributs onclick.
   ========================================================================= */
(function () {
  var affiche = false;

  function secours() {
    var app = document.getElementById("app");
    // Le routeur a déjà monté un écran : tout va bien, on ne touche à rien.
    if (affiche || !app || app.children.length > 0) return;
    affiche = true;
    app.innerHTML =
      '<div class="screen"><div class="card center">' +
      "<h3>😵 Le chargement a échoué</h3>" +
      '<p class="screen__subtitle" style="margin:8px 0 16px">La connexion a sans doute sauté. Vérifie le Wi-Fi ou la 4G, puis recharge.</p>' +
      '<button class="btn btn--full" type="button">🔄 Recharger</button>' +
      "</div></div>";
    app.querySelector("button").addEventListener("click", function () {
      location.reload();
    });
  }

  // Un module d'entrée dont une dépendance échoue déclenche « error » sur sa
  // balise <script>. Cet événement ne remonte pas : on l'écoute en capture.
  window.addEventListener(
    "error",
    function (e) {
      var t = e.target;
      if (t && t.tagName === "SCRIPT" && t.type === "module") secours();
    },
    true
  );

  // Chargement qui ne se termine jamais (réseau figé) : même message. Si les
  // modules finissent par arriver, le routeur remplace ce message tout seul.
  setTimeout(secours, 15000);
})();
