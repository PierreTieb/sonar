// Graphique du signal reçu en fonction du temps écoulé depuis l'émission.
// Toutes les émissions sont superposées (une couleur chacune), chacune mesurée depuis son propre départ.
// L'axe des temps s'arrête à la durée d'écoute : aller-retour à la portée maximale (2 × portée / v).
const Graphe = (() => {
  let cv, ctx, W = 0, H = 0, dpr = 1;
  const POLICE = 'Figtree, system-ui, sans-serif';

  function init(canvas) {
    cv = canvas; ctx = cv.getContext('2d');
    new ResizeObserver(taille).observe(cv); taille();
  }
  function taille() {
    const r = cv.getBoundingClientRect();
    dpr = Math.min(2, window.devicePixelRatio || 1);
    W = r.width; H = r.height;
    cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr);
  }

  const bruit = (i, s) => { const x = Math.sin(i * 12.9898 + s * 78.233) * 43758.5453; return x - Math.floor(x); };

  function etendue(ems, win, zoom) {
    if (!zoom) return win;
    let max = 0;
    for (const e of ems) for (const r of e.recus) max = Math.max(max, r.delai);
    return max > 0 ? Math.min(win, max * 1.2) : win;
  }

  function pill(txt, x, y, coul, fondPill) {
    ctx.font = '800 12px ' + POLICE;
    const w = ctx.measureText(txt).width + 12, x0 = U.clamp(x - w / 2, 2, W - w - 2);
    ctx.fillStyle = fondPill; ctx.beginPath(); ctx.roundRect(x0, y - 10, w, 20, 10); ctx.fill();
    ctx.strokeStyle = coul; ctx.lineWidth = 1.2; ctx.stroke();
    ctx.fillStyle = coul; ctx.textAlign = 'left'; ctx.textBaseline = 'middle'; ctx.fillText(txt, x0 + 6, y + 0.5);
  }

  // o : { ems, T, win, zoom, milieu, focus }  (focus : indice d'une émission mise en avant, ou null)
  function dessiner(o) {
    if (!W || !H) return;
    const th = THEMES[o.milieu], ems = o.ems;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.clearRect(0, 0, W, H);
    const m = { g: 14, d: 14, h: 32, b: 24 }, w = W - m.g - m.d, h = H - m.h - m.b;
    const X = etendue(ems, o.win, o.zoom);
    const px = t => m.g + t / X * w, py = a => m.h + h - a * h;

    // grille et graduations
    const pas = U.pasJoli(X, 5), dec = Math.max(0, Math.ceil(-Math.log10(pas) - 1e-9));
    ctx.font = '600 11px ' + POLICE; ctx.textBaseline = 'top'; ctx.textAlign = 'center';
    for (let i = 0; i * pas <= X * 1.0001; i++) {
      const t = i * pas, x = px(t);
      ctx.strokeStyle = th.grille; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(x, m.h); ctx.lineTo(x, m.h + h); ctx.stroke();
      if (x < W - 10) { ctx.fillStyle = th.txt; ctx.fillText(U.fmtNb(t, dec), x, m.h + h + 6); }
    }
    ctx.strokeStyle = th.txt; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(m.g, py(0)); ctx.lineTo(m.g + w, py(0)); ctx.stroke();
    ctx.textAlign = 'right'; ctx.fillStyle = th.txt;
    const titreAxe = 't après l\'émission (s)';
    ctx.fillText(titreAxe, W - 8, 6);
    const finLegende = W - 16 - ctx.measureText(titreAxe).width;

    // repère d'émission (commun à toutes : chacune est mesurée depuis son départ)
    ctx.strokeStyle = th.onde; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(px(0), m.h - 4); ctx.lineTo(px(0), m.h + h); ctx.stroke();

    if (!ems.length) {
      ctx.textAlign = 'left'; ctx.fillStyle = th.onde; ctx.fillText('émission', px(0) + 5, 6);
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillStyle = th.txt; ctx.font = '700 13px ' + POLICE;
      ctx.fillText('Appuie sur « Émettre » pour lancer une onde.', m.g + w / 2, m.h + h / 2);
      return;
    }

    // légende : une couleur par émission (les plus récentes si elles sont nombreuses)
    ctx.font = '800 11px ' + POLICE; ctx.textAlign = 'left';
    let lx = px(0) + 5;
    for (let i = Math.max(0, ems.length - 8); i < ems.length; i++) {
      const e = ems[i], txt = 'n°' + e.n, wt = ctx.measureText(txt).width;
      if (lx + wt + 14 > finLegende) break;
      ctx.globalAlpha = o.focus === null || o.focus === i ? 1 : 0.35;
      ctx.fillStyle = couleurEmission(o.milieu, e.n);
      ctx.beginPath(); ctx.arc(lx + 4, 11.5, 4, 0, 7); ctx.fill();
      ctx.fillText(txt, lx + 11, 6); lx += wt + 22;
    }
    ctx.globalAlpha = 1;

    const sigma = X / 170;
    const signal = (t, recus) => recus.reduce((s, r) => s + r.amp * Math.exp(-0.5 * ((t - r.delai) / sigma) ** 2), 0);

    // traces : les anciennes d'abord, celle mise en avant (ou la plus récente) par-dessus
    const ordre = ems.map((e, i) => i);
    if (o.focus !== null) { ordre.splice(o.focus, 1); ordre.push(o.focus); }
    for (const i of ordre) {
      const e = ems[i], coul = couleurEmission(o.milieu, e.n), tau = Math.min(o.T - e.te, o.win), lim = Math.min(tau, X);
      const enAvant = o.focus === null || o.focus === i;
      ctx.save(); ctx.strokeStyle = coul; ctx.lineWidth = enAvant ? 2 : 1.4; ctx.lineJoin = 'round';
      ctx.globalAlpha = enAvant ? 1 : 0.25;
      if (th.glow && enAvant) { ctx.shadowColor = coul; ctx.shadowBlur = 6; }
      ctx.beginPath();
      for (let j = 0; j <= w; j++) {
        const t = j / w * X; if (t > lim) break;
        const a = U.clamp(signal(t, e.recus) + 0.025 + (bruit(j, e.n) - 0.5) * 0.035, 0, 1);
        j ? ctx.lineTo(m.g + j, py(a)) : ctx.moveTo(m.g + j, py(a));
      }
      ctx.stroke(); ctx.restore();
      // curseur des émissions encore à l'écoute
      if (!e.fini && lim < X) {
        ctx.save(); ctx.setLineDash([3, 4]); ctx.strokeStyle = coul; ctx.lineWidth = 1.5; ctx.globalAlpha = enAvant ? 0.9 : 0.3;
        ctx.beginPath(); ctx.moveTo(px(lim), m.h); ctx.lineTo(px(lim), m.h + h); ctx.stroke(); ctx.restore();
      }
    }

    // temps de chaque écho reçu (lettre de l'obstacle + temps)
    const pics = [];
    ems.forEach((e, i) => {
      if (o.focus !== null && o.focus !== i) return;
      for (const r of e.recus) pics.push({ r, coul: couleurEmission(o.milieu, e.n) });
    });
    pics.sort((a, b) => a.r.delai - b.r.delai);
    const places = [];
    for (const { r, coul } of pics) {
      const x = px(r.delai); if (x > m.g + w + 1) continue;
      ctx.fillStyle = coul; ctx.beginPath(); ctx.arc(x, py(r.amp), 3.5, 0, 7); ctx.fill();
      // place libre : au-dessus du pic, sinon plus haut, sinon sous le sommet du pic
      const y0 = py(r.amp) - 16, haut = m.h + 10, bas = py(0) - 14, essais = [];
      for (let y = y0; y >= haut; y -= 22) essais.push(y);
      if (y0 < haut) essais.push(haut);
      for (let y = y0 + 22; y <= bas; y += 22) essais.push(y);
      // place la moins encombrée (la première libre si possible), utile sur les petits écrans
      const gene = y => places.filter(p => Math.abs(p.x - x) < 86 && Math.abs(p.y - y) < 21).length;
      let y = Math.max(haut, y0), min = Infinity;
      for (const e of essais) { const n = gene(e); if (n < min) { min = n; y = e; } if (!n) break; }
      places.push({ x, y });
      pill(U.lettre(r.k) + ' · ' + U.fmtT(r.delai, o.win), x, y, coul, th.pill);
    }
  }

  return { init, dessiner, etendue };
})();
