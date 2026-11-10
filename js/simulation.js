// Simulation physique, en temps réel (aucun ralenti).
// Repère du milieu : origine du sonar en (0, 0) au départ, x vers la droite, y vers l'avant (haut de l'écran), en mètres.
// L'onde se propage dans le milieu : cercle centré sur la position du sonar à l'émission.
// Un obstacle touché dans le cône renvoie une onde centrée sur sa position au moment du contact.
// Plusieurs émissions peuvent être en cours en même temps (on peut émettre quand on veut).
// Mouvements : chaque obstacle part à la réception de son premier écho, l'origine à la première réception.
// Ce qui n'a rien renvoyé lors de la 1re émission part à la fin de cette émission.
const Sim = (() => {
  let cfg, v = 340, R = 1000, win = 1, T = 0, obs = [], orig = null, emissions = [], actifs = [];

  const rad = d => d * Math.PI / 180;
  const vec = (dir, vit) => ({ x: vit * Math.cos(rad(dir)), y: vit * Math.sin(rad(dir)) });
  const polaire = (d, a) => ({ x: d * Math.sin(rad(a)), y: d * Math.cos(rad(a)) });
  const dist = (p, q) => Math.hypot(p.x - q.x, p.y - q.y);

  function charger(c) { cfg = c; v = VITESSES[c.milieu]; R = c.portee; win = 2 * R / v; reinit(); }

  function reinit() {
    T = 0; emissions = []; actifs = [];
    obs = cfg.obstacles.map(o => ({ p0: polaire(o.d, o.a), vel: vec(o.dir, o.v), t0: null }));
    orig = { p0: { x: 0, y: 0 }, vel: vec(cfg.origine.dir, cfg.origine.v), t0: null };
  }

  function pos(m, t) {
    if (m.t0 === null || t <= m.t0) return m.p0;
    const dt = t - m.t0;
    return { x: m.p0.x + m.vel.x * dt, y: m.p0.y + m.vel.y * dt };
  }

  function emettre() {
    const e = { n: emissions.length + 1, te: T, S: pos(orig, T), echos: obs.map((o, k) => ({ k, etat: 'aller' })), recus: [], fini: false };
    emissions.push(e); actifs.push(e);
    return e;
  }

  function traiter(e, t1, t2, ev) {
    const tFin = e.te + win, tb = Math.min(t2, tFin);
    if (tb > t1) for (const h of e.echos) {
      if (h.etat === 'aller') {
        // le front aller atteint-il l'obstacle ?
        const f = t => dist(pos(obs[h.k], t), e.S) - v * (t - e.te);
        if (f(tb) <= 0) {
          h.th = U.bisect(f, Math.max(t1, e.te), tb);
          h.O = pos(obs[h.k], h.th);
          const ang = Math.atan2(h.O.x - e.S.x, h.O.y - e.S.y) * 180 / Math.PI;
          h.etat = Math.abs(ang) <= cfg.angle / 2 ? 'retour' : 'perdu';   // hors du cône : pas d'écho
        }
      }
      if (h.etat === 'retour') {
        // l'onde réfléchie revient-elle au sonar ?
        const g = t => dist(pos(orig, t), h.O) - v * (t - h.th);
        if (g(tb) <= 0) {
          h.tr = U.bisect(g, Math.max(t1, h.th), tb);
          h.etat = 'recu';
          const delai = h.tr - e.te, dAller = v * delai / 2;
          e.recus.push({ k: h.k, delai, th: h.th, tr: h.tr, amp: U.clamp(0.95 - 0.6 * dAller / R, 0.3, 0.95) });
          e.recus.sort((a, b) => a.delai - b.delai);
          if (obs[h.k].t0 === null) obs[h.k].t0 = h.tr;
          if (orig.t0 === null) orig.t0 = h.tr;
          ev.push({ type: 'echo', e, delai });
        }
      }
    }
    if (t2 >= tFin) {
      e.fini = true;
      if (e.n === 1) {
        obs.forEach(o => { if (o.t0 === null) o.t0 = tFin; });
        if (orig.t0 === null) orig.t0 = tFin;
      }
      ev.push({ type: 'fin', e });
    }
  }

  // Fait avancer le temps de dt secondes ; renvoie les événements (échos reçus, fins d'écoute)
  function avancer(dt) {
    const ev = [];
    if (!emissions.length) return ev;      // rien ne bouge avant la première émission
    const t1 = T, t2 = T + dt;
    for (const e of actifs) traiter(e, t1, t2, ev);
    actifs = actifs.filter(e => !e.fini);
    T = t2;
    return ev;
  }

  // Durée réelle du déplacement d'un obstacle entre deux échos (instants où l'onde le touche),
  // sachant qu'il est immobile jusqu'à la réception de son premier écho.
  function dureeDeplacement(k, r1, r2) {
    const t0 = obs[k].t0 === null ? Infinity : obs[k].t0;
    return Math.max(0, r2.th - Math.max(r1.th, t0));
  }

  return {
    charger, reinit, emettre, avancer, dureeDeplacement,
    T: () => T, v: () => v, win: () => win,
    emissions: () => emissions, actifs: () => actifs,
    departObs: k => obs[k].t0,
    posObs: (k, t) => pos(obs[k], t), posOrig: t => pos(orig, t)
  };
})();
