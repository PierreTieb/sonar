// Interface : réglages, mode admin, chronomètre, historique, QR code, son, boucle d'animation
const App = (() => {
  const CLE = 'sonar-echo-config';
  const $ = id => document.getElementById(id);
  const versOrigine = a => { const r = a * Math.PI / 180; return Math.atan2(-Math.cos(r), -Math.sin(r)) * 180 / Math.PI; };

  const DEFAUT = {
    milieu: 'eau', portee: 3000, angle: 60, grad: false, duree: true,
    origine: { v: 0, dir: 90 },
    obstacles: [{ d: 1200, a: -8, v: 0, dir: versOrigine(-8) }, { d: 2250, a: 14, v: 0, dir: versOrigine(14) }]
  };

  // vue : indice de l'émission mise en avant dans le graphique (clic dans l'historique), ou null
  let cfg, admin = false, sel = null, vue = null, zoom = false, son = true, flashE = -1e9, flashR = -1e9, audio = null;

  // ---------- Configuration ----------
  const nb = (x, def, a, b) => { x = Number(x); return Number.isFinite(x) ? U.clamp(x, a, b) : def; };
  function valide(c) {
    c = c && typeof c === 'object' ? c : {};
    const portee = nb(c.portee, 3000, 10, 100000);
    const o = c.origine || {};
    return {
      milieu: c.milieu === 'air' ? 'air' : 'eau',
      portee, angle: nb(c.angle, 60, 10, 180), grad: !!c.grad, duree: c.duree !== false,
      origine: { v: nb(o.v, 0, 0, 100000), dir: nb(o.dir, 90, -360, 360) },
      obstacles: (Array.isArray(c.obstacles) ? c.obstacles : []).slice(0, 26).map(b => {
        const a = nb(b && b.a, 0, -90, 90);
        return { d: nb(b && b.d, portee / 2, 1, portee), a, v: nb(b && b.v, 0, 0, 100000), dir: nb(b && b.dir, versOrigine(a), -360, 360) };
      })
    };
  }

  // Lien compact : milieu,portée,angle,distances,durées,vitesse sonar,direction sonar ; puis un obstacle par bloc d,a,v,dir
  // (ex. #c=e,3000,60,0,1,0,90;1200,-8,0,-90;2250,14,0,-90) : un QR code moins dense, plus facile à scanner
  const r1 = x => Math.round(x * 10) / 10;
  function compacter(c) {
    return [[c.milieu === 'air' ? 'a' : 'e', c.portee, r1(c.angle), +c.grad, +c.duree, r1(c.origine.v), r1(c.origine.dir)].join(',')]
      .concat(c.obstacles.map(o => [r1(o.d), r1(o.a), r1(o.v), r1(o.dir)].join(','))).join(';');
  }
  function decompacter(s) {
    const [tete, ...obs] = s.split(';'), t = tete.split(',');
    return {
      milieu: t[0] === 'a' ? 'air' : 'eau', portee: t[1], angle: t[2], grad: t[3] === '1', duree: t[4] !== '0',
      origine: { v: t[5], dir: t[6] },
      obstacles: obs.filter(Boolean).map(b => { const [d, a, v, dir] = b.split(','); return { d, a, v, dir }; })
    };
  }

  function chargerInitial() {
    const c = location.hash.match(/^#c=([\w.,;-]+)/);
    if (c) { try { return valide(decompacter(c[1])); } catch (e) { /* lien abîmé : on ignore */ } }
    const m = location.hash.match(/^#s=([\w-]+)/);
    if (m) { try { return valide(U.decode(m[1])); } catch (e) { /* lien abîmé : on ignore */ } }
    const lu = U.lire(CLE);
    return valide(lu || JSON.parse(JSON.stringify(DEFAUT)));
  }

  function sauver() {
    U.ecrire(CLE, cfg);
    if (location.hash) history.replaceState(null, '', location.pathname + location.search);
  }

  function lienScenario() { return location.href.split('#')[0] + '#c=' + compacter(cfg); }

  // Toute modification remet la simulation à zéro
  function appliquer(enregistrer = true) {
    Sim.charger(cfg); vue = null; zoom = false;
    if (enregistrer) sauver();
    majEntete(); majHisto(); majBoutons();
  }

  // ---------- API utilisée par le sonar (mode admin) ----------
  function etatAdmin() { return admin ? { cfg, sel } : null; }
  function selectionner(s) { sel = s; majSel(); }
  function ajouter(d, a) {
    if (cfg.obstacles.length >= 26) { toast('26 obstacles au maximum'); return null; }
    const pas = cfg.portee >= 2000 ? 10 : cfg.portee >= 200 ? 5 : 1;
    d = U.clamp(Math.round(d / pas) * pas || pas, 1, cfg.portee);
    cfg.obstacles.push({ d, a: U.clamp(a, -90, 90), v: 0, dir: versOrigine(a) });
    appliquer(false); selectionner(cfg.obstacles.length - 1);
    return cfg.obstacles.length - 1;
  }
  function majObs(k, champs, enregistrer = true) { Object.assign(cfg.obstacles[k], champs); appliquer(enregistrer); }
  function majOrig(champs, enregistrer = true) { Object.assign(cfg.origine, champs); appliquer(enregistrer); }

  // ---------- Affichage ----------
  function majEntete() {
    document.body.dataset.milieu = cfg.milieu;
    $('i-milieu').textContent = (cfg.milieu === 'eau' ? 'Eau' : 'Air') + ' · ' + U.fmtNb(VITESSES[cfg.milieu], 0) + ' m/s';
    $('i-portee').textContent = 'Portée : ' + U.fmtM(cfg.portee);
    document.querySelectorAll('#a-milieu button').forEach(b => b.setAttribute('aria-pressed', b.dataset.m === cfg.milieu));
    $('a-portee').value = cfg.portee; $('a-angle').value = cfg.angle; $('a-grad').checked = cfg.grad; $('a-duree').checked = cfg.duree;
  }

  function majBoutons() {
    const ems = Sim.emissions(), n = Sim.actifs().length;
    const echos = ems.some(e => e.recus.length);
    $('b-zoom').disabled = !echos;
    if (!echos) zoom = false;
    $('b-zoom').textContent = zoom ? 'Toute la durée d\'écoute' : 'Zoom sur les échos';
    $('etat').textContent = n ? (n > 1 ? n + ' émissions à l\'écoute…' : 'Écoute en cours…') : ems.length ? 'Écoute terminée' : 'Prêt à émettre';
  }

  // Pour chaque écho, l'écho précédent du même obstacle et la durée de son déplacement entre les deux
  function lignesVitesse(i) {
    const ems = Sim.emissions(), e = ems[i], win = Sim.win(), out = [];
    for (const r of e.recus) {
      let j = i - 1, r1 = null;
      for (; j >= 0 && !r1; j--) r1 = ems[j].recus.find(q => q.k === r.k) || null;
      if (!r1) continue;
      const n1 = ems[j + 1].n, dt = Sim.dureeDeplacement(r.k, r1, r), t0 = Sim.departObs(r.k);
      const critere = t0 !== null && t0 > r1.th
        ? (t0 === r1.tr ? 'de la réception de l\'écho n°' + n1 + ' (l\'obstacle démarre)' : 'du départ de l\'obstacle')
          + ' jusqu\'au contact de l\'onde n°' + e.n
        : 'entre le contact de l\'onde n°' + n1 + ' et celui de l\'onde n°' + e.n;
      out.push('<div class="vitesse"><b>' + U.lettre(r.k) + '</b> : déplacement pendant <b>' + U.fmtT(dt, win) + '</b>'
        + '<span class="critere">' + critere + '</span></div>');
    }
    return out.join('');
  }

  function majHisto() {
    const ems = Sim.emissions(), ol = $('histo'), win = Sim.win();
    $('histo-aide').hidden = !(cfg.duree && ems.length > 1);
    if (!ems.length) { ol.innerHTML = '<li class="vide">Aucune émission pour l\'instant.</li>'; return; }
    ol.innerHTML = ems.map((e, i) => {
      const coul = couleurEmission(cfg.milieu, e.n);
      const puces = e.recus.length
        ? e.recus.map(r => '<span class="puce" style="--c:' + coul + '">' + U.lettre(r.k) + ' : ' + U.fmtT(r.delai, win) + '</span>').join('')
        : '<span class="vide">' + (e.fini ? 'aucun écho reçu' : 'écoute en cours…') + '</span>';
      return '<li><button class="ligne' + (i === vue ? ' active' : '') + '" data-i="' + i + '" style="--c:' + coul + '">'
        + '<span class="num">Émission n°' + e.n + '</span>'
        + '<span class="quand">' + (e.n === 1 ? 'départ du chronomètre général' : 'émise ' + U.fmtT(e.te, 1) + ' après la n°1') + '</span>'
        + '<span class="puces">' + puces + '</span>'
        + (cfg.duree ? lignesVitesse(i) : '') + '</button></li>';
    }).reverse().join('');
  }

  function majSel() {
    const z = $('a-sel');
    if (sel === 'o') {
      z.innerHTML = '<h3>Origine (sonar)</h3>'
        + '<label class="champ"><span>Vitesse (m/s)</span><input type="number" id="s-v" min="0" step="1" value="' + cfg.origine.v + '"></label>'
        + '<p class="aide">' + (cfg.origine.v > 0 ? 'Glisse la pointe de la flèche pour choisir sa direction. ' : '')
        + 'Le sonar se met en mouvement à la première réception d\'un écho.</p>';
      $('s-v').addEventListener('change', e => { majOrig({ v: nb(e.target.value, 0, 0, 100000) }); majSel(); });
    } else if (typeof sel === 'number' && cfg.obstacles[sel]) {
      const ob = cfg.obstacles[sel];
      z.innerHTML = '<h3>Obstacle ' + U.lettre(sel) + '</h3>'
        + '<label class="champ"><span>Distance au sonar (m)</span><input type="number" id="s-d" min="1" max="' + cfg.portee + '" step="1" value="' + ob.d + '"></label>'
        + '<label class="champ"><span>Vitesse (m/s)</span><input type="number" id="s-v" min="0" step="1" value="' + ob.v + '"></label>'
        + '<p class="aide">' + (ob.v > 0 ? 'Glisse la pointe de la flèche pour choisir sa direction. ' : '')
        + 'L\'obstacle se met en mouvement quand le sonar reçoit son premier écho.</p>'
        + '<button class="btn btn-mini btn-danger" id="s-suppr">Supprimer cet obstacle</button>';
      $('s-d').addEventListener('change', e => { majObs(sel, { d: Math.round(nb(e.target.value, ob.d, 1, cfg.portee)) }); majSel(); });
      $('s-v').addEventListener('change', e => { majObs(sel, { v: nb(e.target.value, 0, 0, 100000) }); majSel(); });
      $('s-suppr').addEventListener('click', () => { cfg.obstacles.splice(sel, 1); sel = null; appliquer(); majSel(); });
    } else {
      const n = cfg.obstacles.length;
      z.innerHTML = '<p class="aide">Clique sur un obstacle ou sur le sonar pour régler sa distance ou sa vitesse. '
        + (n ? n + ' obstacle' + (n > 1 ? 's' : '') + ' placé' + (n > 1 ? 's' : '') + '.' : 'Aucun obstacle placé.') + '</p>';
    }
  }

  function basculerAdmin(b) {
    admin = b;
    $('b-admin').setAttribute('aria-pressed', admin);
    // en mode admin, le panneau de réglages remplace le graphique et l'historique
    $('p-admin').hidden = !admin; $('p-histo').hidden = admin; $('p-graphe').hidden = admin; $('badge-admin').hidden = !admin;
    document.querySelector('.scene').classList.toggle('admin', admin);
    if (!admin) sel = null;
    majSel();
  }

  let minuteur;
  function toast(txt) { const t = $('toast'); t.textContent = txt; t.classList.add('vu'); clearTimeout(minuteur); minuteur = setTimeout(() => t.classList.remove('vu'), 2200); }

  // ---------- QR code du scénario ----------
  function afficherQR() {
    const url = lienScenario(), cv = $('qr'), ctx = cv.getContext('2d');
    const qr = qrcode(0, 'M'); qr.addData(url); qr.make();
    const n = qr.getModuleCount(), marge = 4, cote = Math.min(560, Math.floor(Math.min(innerWidth, innerHeight) * 0.62));
    const t = Math.max(2, Math.floor(cote / (n + 2 * marge))), px = t * (n + 2 * marge);
    cv.width = px; cv.height = px; cv.style.width = cv.style.height = px + 'px';
    ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, px, px); ctx.fillStyle = '#000';
    for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) if (qr.isDark(r, c)) ctx.fillRect((c + marge) * t, (r + marge) * t, t, t);
    $('qr-url').textContent = url;
    $('qr-alerte').hidden = /^https?:/.test(location.protocol);
    $('qr-voile').hidden = false;
  }

  // ---------- Son ----------
  function ping(f, duree, vol) {
    if (!son) return;
    try {
      audio = audio || new (window.AudioContext || window.webkitAudioContext)();
      const t = audio.currentTime, osc = audio.createOscillator(), gain = audio.createGain();
      osc.type = 'sine'; osc.frequency.value = f;
      gain.gain.setValueAtTime(0.0001, t); gain.gain.exponentialRampToValueAtTime(vol, t + 0.01); gain.gain.exponentialRampToValueAtTime(0.0001, t + duree);
      osc.connect(gain).connect(audio.destination); osc.start(t); osc.stop(t + duree + 0.05);
    } catch (e) { /* pas de son disponible */ }
  }
  const ICONE_SON = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 5 6 9H2v6h4l5 4z"/><path d="M15.5 8.5a5 5 0 0 1 0 7"/><path d="M19 5a10 10 0 0 1 0 14"/></svg>';
  const ICONE_MUET = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 5 6 9H2v6h4l5 4z"/><path d="m22 9-6 6"/><path d="m16 9 6 6"/></svg>';
  function majSon() { $('b-son').innerHTML = son ? ICONE_SON : ICONE_MUET; $('b-son').title = son ? 'Couper le son' : 'Activer le son'; }

  // ---------- Actions ----------
  function emettre() {
    Sim.emettre();
    flashE = performance.now();
    ping(cfg.milieu === 'eau' ? 1300 : 1900, cfg.milieu === 'eau' ? 0.7 : 0.25, 0.3);
    majHisto(); majBoutons();
  }

  function brancher() {
    $('b-emettre').addEventListener('click', emettre);
    $('b-reset').addEventListener('click', () => { Sim.reinit(); vue = null; zoom = false; majHisto(); majBoutons(); });
    $('b-admin').addEventListener('click', () => basculerAdmin(!admin));
    $('a-fermer').addEventListener('click', () => basculerAdmin(false));
    $('b-son').addEventListener('click', () => { son = !son; majSon(); });
    $('b-zoom').addEventListener('click', () => { zoom = !zoom; majBoutons(); });
    $('histo').addEventListener('click', e => {
      const b = e.target.closest('.ligne'); if (!b) return;
      const i = +b.dataset.i; vue = vue === i ? null : i;   // un 2e clic remet toutes les émissions au même plan
      majHisto();
    });
    document.querySelectorAll('#a-milieu button').forEach(b => b.addEventListener('click', () => { cfg.milieu = b.dataset.m; appliquer(); }));
    $('a-portee').addEventListener('change', e => {
      cfg.portee = Math.round(nb(e.target.value, cfg.portee, 10, 100000));
      cfg.obstacles.forEach(o => { o.d = Math.min(o.d, cfg.portee); });
      appliquer(); majSel();
    });
    $('a-angle').addEventListener('change', e => { cfg.angle = nb(e.target.value, cfg.angle, 10, 180); appliquer(); });
    $('a-grad').addEventListener('change', e => { cfg.grad = e.target.checked; sauver(); });
    $('a-duree').addEventListener('change', e => { cfg.duree = e.target.checked; sauver(); majHisto(); });
    $('a-vider').addEventListener('click', () => {
      if (!cfg.obstacles.length || !confirm('Supprimer tous les obstacles ?')) return;
      cfg.obstacles = []; sel = null; appliquer(); majSel();
    });
    $('a-lien').addEventListener('click', () => {
      const url = lienScenario(), ok = () => toast('Lien du scénario copié');
      if (navigator.clipboard && window.isSecureContext) navigator.clipboard.writeText(url).then(ok, () => prompt('Copie ce lien :', url));
      else prompt('Copie ce lien :', url);
    });
    $('a-qr').addEventListener('click', afficherQR);
    $('qr-fermer').addEventListener('click', () => { $('qr-voile').hidden = true; });
    $('qr-voile').addEventListener('click', e => { if (e.target === $('qr-voile')) $('qr-voile').hidden = true; });
    document.addEventListener('keydown', e => {
      if (e.target.closest('input')) return;
      if (e.code === 'Space') { e.preventDefault(); emettre(); }
      if (e.key === 'Escape') { if (!$('qr-voile').hidden) $('qr-voile').hidden = true; else if (admin) basculerAdmin(false); }
    });
  }

  // ---------- Boucle ----------
  let avant = performance.now();
  function boucle(now) {
    const dt = Math.min(0.1, Math.max(0, (now - avant) / 1000)); avant = now;
    for (const ev of Sim.avancer(dt)) {
      if (ev.type === 'echo') { flashR = now; ping(cfg.milieu === 'eau' ? 1300 : 1900, 0.35, 0.12); majHisto(); majBoutons(); }
      if (ev.type === 'fin') { majHisto(); majBoutons(); }
    }
    // chronomètre : temps écoulé depuis la dernière émission, arrêté à la fin de son écoute
    const ems = Sim.emissions(), win = Sim.win(), T = Sim.T(), der = ems[ems.length - 1];
    const tc = der ? Math.min(T - der.te, win) : 0;
    $('chrono').textContent = U.fmtT(tc, win);
    $('prog').style.width = (der ? tc / win * 100 : 0) + '%';

    Sonar.dessiner({ cfg, admin, sel, now, flashE, flashR });
    Graphe.dessiner({ ems, T, win, zoom, milieu: cfg.milieu, focus: vue });
    requestAnimationFrame(boucle);
  }

  function demarrer() {
    cfg = chargerInitial();
    Sonar.init($('c-sonar')); Graphe.init($('c-graphe'));
    brancher(); majSon();
    Sim.charger(cfg); majEntete(); majHisto(); majBoutons(); majSel();
    requestAnimationFrame(t => { avant = t; boucle(t); });
  }

  return { demarrer, etatAdmin, selectionner, ajouter, majObs, majOrig, sauver: () => sauver() };
})();

App.demarrer();
