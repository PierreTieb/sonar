// Dessin du sonar (décor, cône, ondes, origine) et placement des obstacles en mode admin.
// La vue suit l'origine : le sonar reste en bas au centre, le décor défile s'il se déplace.
const Sonar = (() => {
  let cv, ctx, W = 0, H = 0, dpr = 1;
  const g = { ox: 0, oy: 0, s: 1, half: 0, R: 1 };
  let glisse = null;
  const FLECHE = 48;

  const neige = Array.from({ length: 150 }, () => ({ x: Math.random(), y: Math.random(), r: 0.5 + Math.random() * 1.6, a: 0.12 + Math.random() * 0.4, p: Math.random() * 6.28 }));
  const nuages = Array.from({ length: 5 }, () => ({ x: Math.random(), y: Math.random(), w: 0.07 + Math.random() * 0.1 }));

  function init(canvas) {
    cv = canvas; ctx = cv.getContext('2d');
    new ResizeObserver(taille).observe(cv); taille();
    cv.addEventListener('pointerdown', appui);
    cv.addEventListener('pointermove', deplace);
    cv.addEventListener('pointerup', lache);
    cv.addEventListener('pointercancel', lache);
  }

  function taille() {
    const r = cv.getBoundingClientRect();
    dpr = Math.min(2, window.devicePixelRatio || 1);
    W = r.width; H = r.height;
    cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr);
  }

  // Échelle : la portée tient dans l'écran, origine en bas au centre
  function geometrie(cfg) {
    g.half = cfg.angle / 2 * Math.PI / 180; g.R = cfg.portee;
    const haut = 34, bas = H - 46, lat = 20;
    const demiLarg = g.half >= Math.PI / 2 ? g.R : Math.max(g.R * Math.sin(g.half), g.R * 0.3);
    g.s = Math.max(1e-6, Math.min((bas - haut) / g.R, (W / 2 - lat) / demiLarg));
    g.ox = W / 2; g.oy = bas;
  }

  const ecran = (p, cam) => ({ x: g.ox + (p.x - cam.x) * g.s, y: g.oy - (p.y - cam.y) * g.s });
  const monde = p => ({ x: (p.x - g.ox) / g.s, y: (g.oy - p.y) / g.s });   // vue au repos (caméra en 0,0)
  const angles = () => [-Math.PI / 2 - g.half, -Math.PI / 2 + g.half];
  const bout = (c, dir) => ({ x: c.x + FLECHE * Math.cos(dir * Math.PI / 180), y: c.y - FLECHE * Math.sin(dir * Math.PI / 180) });

  function dessiner(o) {
    if (!W || !H) return;
    const cfg = o.cfg, th = THEMES[cfg.milieu], T = Sim.T(), v = Sim.v(), cam = Sim.posOrig(T);
    geometrie(cfg);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const E = p => ecran(p, cam), Oc = { x: g.ox, y: g.oy };
    fond(cfg, th, cam, o.now / 1000);
    cone(cfg, th);
    if (o.admin) zoneAdmin(th);
    for (const e of Sim.actifs()) { ondeAller(e, E, T, v, th); ondesRetour(e, E, T, v, th, Oc); }
    flashs(o, Oc, th);
    if (o.admin) obstacles(o, E, T, th);
    origine(o, Oc, th);
  }

  // ---------- Décors ----------
  function fond(cfg, th, cam, t) {
    const dx = cam.x * g.s, dy = cam.y * g.s;
    if (cfg.milieu === 'eau') {
      let gr = ctx.createLinearGradient(0, 0, 0, H);
      gr.addColorStop(0, '#06222f'); gr.addColorStop(1, '#010a10');
      ctx.fillStyle = gr; ctx.fillRect(0, 0, W, H);
      gr = ctx.createRadialGradient(g.ox, g.oy, 0, g.ox, g.oy, Math.max(W, H) * 0.85);
      gr.addColorStop(0, 'rgba(20,130,130,.22)'); gr.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = gr; ctx.fillRect(0, 0, W, H);
      // neige marine qui dérive (et défile si le sous-marin avance)
      for (const p of neige) {
        const x = ((p.x * W - dx * 0.7 + Math.sin(t * 0.3 + p.p) * 6) % W + W) % W;
        const y = ((p.y * H + dy * 0.7 + t * p.r * 3) % H + H) % H;
        ctx.fillStyle = 'rgba(170,230,220,' + p.a + ')';
        ctx.beginPath(); ctx.arc(x, y, p.r, 0, 7); ctx.fill();
      }
      // lignes de balayage d'écran
      ctx.fillStyle = 'rgba(0,0,0,.14)';
      for (let y = 0; y < H; y += 3) ctx.fillRect(0, y, W, 1);
    } else {
      const gr = ctx.createLinearGradient(0, 0, 0, H);
      gr.addColorStop(0, '#f8fbfd'); gr.addColorStop(1, '#e2eaf1');
      ctx.fillStyle = gr; ctx.fillRect(0, 0, W, H);
      // quadrillage de points de la carte
      const pas = 30, ox = ((-dx) % pas + pas) % pas, oy = ((dy) % pas + pas) % pas;
      ctx.fillStyle = 'rgba(31,111,224,.16)';
      for (let x = ox; x < W; x += pas) for (let y = oy; y < H; y += pas) ctx.fillRect(x - 1, y - 1, 2, 2);
      // nuages
      const LW = W + 300, LH = H + 200;
      for (const c of nuages) {
        const x = ((c.x * LW - dx + t * 5) % LW + LW) % LW - 150, y = ((c.y * LH + dy) % LH + LH) % LH - 100, w = c.w * W;
        ctx.fillStyle = 'rgba(255,255,255,.55)';
        ctx.beginPath(); ctx.ellipse(x, y, w, w * 0.32, 0, 0, 7); ctx.fill();
        ctx.beginPath(); ctx.ellipse(x - w * 0.35, y + w * 0.08, w * 0.5, w * 0.22, 0, 0, 7); ctx.fill();
      }
    }
  }

  function etiquette(txt, x, y, coul, fondPill, align) {
    ctx.font = '700 12px Figtree, system-ui, sans-serif';
    const w = ctx.measureText(txt).width + 12;
    let x0 = align === 'g' ? x : x - w / 2;
    x0 = U.clamp(x0, 4, W - w - 4);
    ctx.fillStyle = fondPill; ctx.beginPath(); ctx.roundRect(x0, y - 10, w, 20, 10); ctx.fill();
    ctx.fillStyle = coul; ctx.textAlign = 'left'; ctx.textBaseline = 'middle'; ctx.fillText(txt, x0 + 6, y + 0.5);
  }

  function cone(cfg, th) {
    const { ox, oy, s, R } = g, rr = R * s, [a0, a1] = angles();
    ctx.save();
    ctx.beginPath(); ctx.moveTo(ox, oy); ctx.arc(ox, oy, rr, a0, a1); ctx.closePath();
    const gr = ctx.createRadialGradient(ox, oy, 0, ox, oy, rr);
    gr.addColorStop(0, 'rgba(' + th.c + ',.17)'); gr.addColorStop(1, 'rgba(' + th.c + ',.04)');
    ctx.fillStyle = gr; ctx.fill();
    ctx.strokeStyle = 'rgba(' + th.c + ',.4)'; ctx.lineWidth = 1.5; ctx.stroke();
    // cercles de distance (sans valeur, sauf si l'admin les affiche)
    const pas = U.pasJoli(R, 4);
    ctx.setLineDash([4, 6]); ctx.strokeStyle = 'rgba(' + th.c + ',.22)'; ctx.lineWidth = 1;
    for (let r = pas; r < R - pas * 0.3; r += pas) { ctx.beginPath(); ctx.arc(ox, oy, r * s, a0, a1); ctx.stroke(); }
    ctx.setLineDash([]);
    ctx.strokeStyle = 'rgba(' + th.c + ',.8)'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(ox, oy, rr, a0, a1); ctx.stroke();
    if (cfg.grad) {
      for (let r = pas; r < R - pas * 0.3; r += pas) etiquette(U.fmtM(r), ox, oy - r * s, th.onde, th.pill);
      etiquette('portée ' + U.fmtM(R), ox, oy - rr - 2, th.onde, th.pill);
    }
    ctx.restore();
  }

  // Zone où l'on peut placer un obstacle (demi-disque de rayon la portée)
  function zoneAdmin(th) {
    ctx.save(); ctx.setLineDash([3, 7]); ctx.strokeStyle = 'rgba(' + th.c + ',.35)'; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.arc(g.ox, g.oy, g.R * g.s, Math.PI, 2 * Math.PI); ctx.stroke(); ctx.restore();
  }

  // ---------- Ondes ----------
  function ondeAller(e, E, T, v, th) {
    const r = v * (T - e.te) * g.s, rr = g.R * g.s;
    if (r <= 0 || r > rr * 1.04) return;
    const c = E(e.S), [a0, a1] = angles();
    const fin = r > rr * 0.94 ? Math.max(0, 1 - (r - rr * 0.94) / (rr * 0.1)) : 1;
    ctx.save();
    if (th.glow) { ctx.shadowColor = th.onde; ctx.shadowBlur = 14; }
    ctx.strokeStyle = th.onde;
    for (let i = 3; i >= 0; i--) {
      const ri = r - i * 7; if (ri <= 0) continue;
      ctx.globalAlpha = fin * (i ? 0.36 - i * 0.08 : 1); ctx.lineWidth = i ? 2 : 3.5;
      ctx.beginPath(); ctx.arc(c.x, c.y, ri, a0, a1); ctx.stroke();
    }
    ctx.restore();
  }

  function ondesRetour(e, E, T, v, th, Oc) {
    for (const h of e.echos) {
      let al = 1;
      if (h.etat === 'recu') { const d = T - h.tr; if (d > 0.3) continue; al = 1 - d / 0.3; }
      else if (h.etat !== 'retour') continue;
      const rho = v * (T - h.th) * g.s; if (rho <= 0) continue;
      const c = E(h.O), phi = Math.atan2(Oc.y - c.y, Oc.x - c.x);
      ctx.save();
      if (th.glow) { ctx.shadowColor = th.echo; ctx.shadowBlur = 12; }
      ctx.strokeStyle = th.echo; ctx.lineCap = 'butt';
      // arc large (environ 140°), plus intense face au sonar et estompé vers ses extrémités
      const SP = 1.22, N = 28;
      for (let i = 2; i >= 0; i--) {
        const ri = rho - i * 6; if (ri <= 0) continue;
        const base = al * (i ? 0.4 - i * 0.12 : 1);
        ctx.lineWidth = i ? 1.8 : 3;
        for (let j = 0; j < N; j++) {
          const u0 = -SP + 2 * SP * j / N, u1 = -SP + 2 * SP * (j + 1) / N, um = (u0 + u1) / 2;
          ctx.globalAlpha = base * Math.pow(Math.cos(um / SP * Math.PI / 2), 1.6);
          ctx.beginPath(); ctx.arc(c.x, c.y, ri, phi + u0, phi + u1 + 0.004); ctx.stroke();
        }
      }
      ctx.restore();
    }
  }

  // Anneaux lumineux à l'émission et à chaque réception (visibles même si l'écho est très rapide)
  function flashs(o, Oc, th) {
    for (const [t0, coul, max] of [[o.flashE, th.onde, 70], [o.flashR, th.echo, 50]]) {
      const k = (o.now - t0) / 600;
      if (k < 0 || k > 1) continue;
      ctx.save(); ctx.globalAlpha = 1 - k; ctx.strokeStyle = coul; ctx.lineWidth = 3;
      if (th.glow) { ctx.shadowColor = coul; ctx.shadowBlur = 12; }
      ctx.beginPath(); ctx.arc(Oc.x, Oc.y, 12 + max * k, 0, 7); ctx.stroke(); ctx.restore();
    }
  }

  // ---------- Objets ----------
  function fleche(c, dir, coul, txt, th) {
    const b = bout(c, dir), a = Math.atan2(b.y - c.y, b.x - c.x);
    ctx.save(); ctx.strokeStyle = coul; ctx.fillStyle = coul; ctx.lineWidth = 3; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(c.x, c.y); ctx.lineTo(b.x - 6 * Math.cos(a), b.y - 6 * Math.sin(a)); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(b.x + 4 * Math.cos(a), b.y + 4 * Math.sin(a));
    ctx.lineTo(b.x - 10 * Math.cos(a - 0.45), b.y - 10 * Math.sin(a - 0.45));
    ctx.lineTo(b.x - 10 * Math.cos(a + 0.45), b.y - 10 * Math.sin(a + 0.45)); ctx.closePath(); ctx.fill();
    ctx.restore();
    etiquette(txt, b.x + 14 * Math.cos(a), b.y + 14 * Math.sin(a) + (Math.sin(a) > 0 ? 6 : -6), coul, th.pill);
  }

  function obstacles(o, E, T, th) {
    o.cfg.obstacles.forEach((ob, k) => {
      const p = E(Sim.posObs(k, T));
      if (ob.v > 0) fleche(p, ob.dir, th.obst, U.fmtNb(ob.v, 0) + ' m/s', th);
      ctx.save();
      if (o.sel === k) { ctx.strokeStyle = th.obst; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(p.x, p.y, 15, 0, 7); ctx.stroke(); }
      ctx.fillStyle = th.obst; ctx.strokeStyle = th.contour; ctx.lineWidth = 2.5;
      ctx.beginPath(); ctx.arc(p.x, p.y, 8, 0, 7); ctx.fill(); ctx.stroke();
      ctx.restore();
      etiquette(U.lettre(k) + ' · ' + U.fmtNb(ob.d, 0) + ' m', p.x, p.y - 26, th.obst, th.pill);
    });
  }

  function origine(o, Oc, th) {
    const { x, y } = Oc, cfg = o.cfg;
    if (o.admin && cfg.origine.v > 0) fleche(Oc, cfg.origine.dir, th.onde, U.fmtNb(cfg.origine.v, 0) + ' m/s', th);
    ctx.save();
    if (cfg.milieu === 'eau') {
      // sous-marin vu de dessus, le nez (l'émetteur) à l'origine
      ctx.fillStyle = '#0b2732'; ctx.strokeStyle = th.onde; ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.ellipse(x, y + 26, 10, 27, 0, 0, 7); ctx.fill(); ctx.stroke();
      ctx.fillStyle = 'rgba(61,245,196,.45)'; ctx.beginPath(); ctx.ellipse(x, y + 24, 4, 8, 0, 0, 7); ctx.fill();
    } else {
      // antenne radar : mât, socle et parabole tournée vers l'avant
      ctx.strokeStyle = '#14283c'; ctx.lineWidth = 2.5;
      ctx.beginPath(); ctx.moveTo(x, y + 4); ctx.lineTo(x, y + 22); ctx.stroke();
      ctx.fillStyle = '#ffffff'; ctx.strokeStyle = '#14283c'; ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.roundRect(x - 13, y + 22, 26, 14, 4); ctx.fill(); ctx.stroke();
      ctx.fillStyle = '#ffffff'; ctx.strokeStyle = th.onde; ctx.lineWidth = 2.5;
      ctx.beginPath(); ctx.arc(x, y - 6, 15, 0.25, Math.PI - 0.25); ctx.closePath(); ctx.fill(); ctx.stroke();
    }
    ctx.fillStyle = th.onde; ctx.beginPath(); ctx.arc(x, y, 3.5, 0, 7); ctx.fill();
    if (o.admin && o.sel === 'o') { ctx.strokeStyle = th.onde; ctx.lineWidth = 2; ctx.setLineDash([4, 4]); ctx.beginPath(); ctx.arc(x, y + 10, 26, 0, 7); ctx.stroke(); }
    ctx.restore();
  }

  // ---------- Mode admin : placer, sélectionner, glisser ----------
  function point(ev) { const r = cv.getBoundingClientRect(); return { x: ev.clientX - r.left, y: ev.clientY - r.top }; }
  const d2 = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);

  function appui(ev) {
    const o = App.etatAdmin(); if (!o) return;
    const p = point(ev), T = Sim.T(), cam = Sim.posOrig(T), E = q => ecran(q, cam), cfg = o.cfg, Oc = { x: g.ox, y: g.oy };
    let cible = null;
    // 1. pointes de flèche (pour orienter la vitesse)
    if (cfg.origine.v > 0 && d2(p, bout(Oc, cfg.origine.dir)) < 16) cible = { type: 'flecheO' };
    if (!cible) cfg.obstacles.forEach((ob, k) => { if (!cible && ob.v > 0 && d2(p, bout(E(Sim.posObs(k, T)), ob.dir)) < 16) cible = { type: 'fleche', k }; });
    // 2. obstacles
    if (!cible) {
      let best = 18;
      cfg.obstacles.forEach((ob, k) => { const d = d2(p, E(Sim.posObs(k, T))); if (d < best) { best = d; cible = { type: 'obs', k }; } });
    }
    // 3. origine
    if (!cible && (d2(p, Oc) < 22 || (Math.abs(p.x - Oc.x) < 14 && p.y > Oc.y && p.y < Oc.y + 52))) cible = { type: 'origine' };

    // Une simple sélection ne réinitialise rien : seule une vraie modification le fait.
    if (cible) {
      App.selectionner(cible.type === 'origine' || cible.type === 'flecheO' ? 'o' : cible.k);
      if (cible.type !== 'origine') glisse = Object.assign(cible, { depart: p, actif: false });
    } else {
      const w = monde(p), d = Math.hypot(w.x, w.y);
      if (d <= g.R && w.y >= -1 && d > 0) {
        const k = App.ajouter(d, Math.atan2(w.x, w.y) * 180 / Math.PI);
        if (k !== null) glisse = { type: 'obs', k, depart: p, actif: true };
      } else App.selectionner(null);
    }
    if (glisse) { cv.setPointerCapture(ev.pointerId); ev.preventDefault(); }
  }

  function deplace(ev) {
    if (!glisse) return;
    const o = App.etatAdmin(); if (!o) { glisse = null; return; }
    const p = point(ev), w = monde(p);
    if (!glisse.actif) { if (d2(p, glisse.depart) < 5) return; glisse.actif = true; }
    if (glisse.type === 'obs') {
      App.majObs(glisse.k, { a: U.clamp(Math.atan2(w.x, w.y) * 180 / Math.PI, -90, 90) }, false);
    } else {
      const c = glisse.type === 'flecheO' ? { x: g.ox, y: g.oy } : ecran(Sim.posObs(glisse.k, 0), { x: 0, y: 0 });
      const dir = Math.atan2(-(p.y - c.y), p.x - c.x) * 180 / Math.PI;
      if (glisse.type === 'flecheO') App.majOrig({ dir }, false); else App.majObs(glisse.k, { dir }, false);
    }
  }

  function lache() { if (glisse) { glisse = null; App.sauver(); } }

  return { init, dessiner };
})();
