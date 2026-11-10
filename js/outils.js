// Outils communs : formats français, graduations, stockage, lien de scénario, couleurs des décors
const U = {
  fmtNb(x, dec) { return x.toLocaleString('fr-FR', { minimumFractionDigits: dec, maximumFractionDigits: dec }); },
  // Portée : en km au-delà de 1 000 m
  fmtM(m) {
    if (m < 1000) return U.fmtNb(Math.round(m), 0) + ' m';
    const km = m / 1000;
    return U.fmtNb(km, km % 1 === 0 ? 0 : (Math.round(km * 10) === km * 10 ? 1 : 2)) + ' km';
  },
  // Nombre de décimales des temps : 4 si toute l'écoute dure moins de 0,1 s
  decT(win) { return win < 0.1 ? 4 : 3; },
  fmtT(t, win) { return U.fmtNb(t, U.decT(win)) + ' s'; },
  pasJoli(etendue, n) {
    const brut = etendue / n, p = Math.pow(10, Math.floor(Math.log10(brut))), f = brut / p;
    return (f < 1.5 ? 1 : f < 3.5 ? 2 : f < 7.5 ? 5 : 10) * p;
  },
  clamp(x, a, b) { return Math.max(a, Math.min(b, x)); },
  lettre(k) { return String.fromCharCode(65 + k); },   // obstacles A, B, C…
  // Racine de f entre a et b, avec f(a) > 0 et f(b) <= 0
  bisect(f, a, b) {
    for (let i = 0; i < 50; i++) { const m = (a + b) / 2; if (f(m) > 0) a = m; else b = m; }
    return b;
  },
  encode(o) {
    return btoa(unescape(encodeURIComponent(JSON.stringify(o)))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  },
  decode(s) {
    s = s.replace(/-/g, '+').replace(/_/g, '/');
    while (s.length % 4) s += '=';
    return JSON.parse(decodeURIComponent(escape(atob(s))));
  },
  lire(k) { try { return JSON.parse(localStorage.getItem(k)); } catch (e) { return null; } },
  ecrire(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* stockage indisponible */ } }
};

const VITESSES = { air: 340, eau: 1500 };

// Une couleur par émission (graphique et historique), en boucle
const COULEURS_EMISSIONS = {
  eau: ['#3df5c4', '#ffd166', '#ff7aa8', '#7cc4ff', '#c3a6ff', '#ffa36b'],
  air: ['#1f6fe0', '#e8590c', '#c2255c', '#2b8a3e', '#7048e8', '#0b7285']
};
const couleurEmission = (milieu, n) => COULEURS_EMISSIONS[milieu][(n - 1) % 6];

const THEMES = {
  eau: { c: '61,245,196', onde: '#3df5c4', echo: '#ffd166', obst: '#ff7aa8', contour: '#021219', glow: true,
         txt: 'rgba(200,240,232,.7)', grille: 'rgba(61,245,196,.1)', trace: '#3df5c4', prec: 'rgba(255,209,102,.45)', pill: 'rgba(2,16,22,.88)' },
  air: { c: '31,111,224', onde: '#1f6fe0', echo: '#e8590c', obst: '#c2255c', contour: '#ffffff', glow: false,
         txt: 'rgba(20,40,60,.65)', grille: 'rgba(20,40,60,.08)', trace: '#1f6fe0', prec: 'rgba(232,89,12,.45)', pill: 'rgba(255,255,255,.94)' }
};
