# Sonar et écho

Animation d'un sonar pour travailler l'écho : une onde part de l'origine (en bas) dans un cône, rebondit sur des obstacles invisibles et revient. Un chronomètre démarre à l'émission ; le graphique affiche un pic, avec son temps, à chaque écho reçu.

- `index.html` : page unique
- `css/style.css` : deux décors (eau : sous-marin sombre ; air : centre radar éclairé)
- `js/` : `outils` (formats, couleurs), `simulation` (physique en temps réel, émissions simultanées), `sonar` (dessin + placement des obstacles), `graphe`, `app` (interface, admin, historique, QR code, son)
- `js/lib/qrcode.min.js` : qrcode-generator 1.4.4 (Kazuhiko Arase, licence MIT), embarqué pour fonctionner hors ligne

On peut émettre à tout moment ; toutes les émissions se superposent sur le graphique (une couleur chacune). L'historique donne, pour deux échos d'un même obstacle (lettre A, B…), la durée de son déplacement entre les deux instants où l'onde le touche.

Modes : **mode libre** (par défaut), où la roue dentée est accessible à tous ; **scénario** (choisi avec le bouton « Scénarios »), sans roue dentée, obstacles cachés ; **mode professeur** (5 clics rapides sur le titre, autant pour en sortir, valable jusqu'à la fermeture de l'onglet), qui rend la roue dentée accessible dans un scénario et affiche les 5 emplacements. Le mode libre garde ses propres réglages, séparés des scénarios.

Réglages (roue dentée) : milieu (air 340 m/s, eau 1 500 m/s), portée, ouverture du cône, obstacles (clic pour placer, distance modifiable, glisser sur l'arc, vitesse et direction), vitesse du sonar, durées affichées ou non, QR code de l'appli. Format compact d'un réglage : `milieu,portée,angle,distances,durées,v sonar,dir sonar;d,a,v,dir;…` (encore lu dans une adresse `#c=…`). Les réglages sont enregistrés dans le navigateur.

Scénarios : le bouton « Scénarios » propose aux élèves les 5 scénarios de `js/scenarios.js` (`{ nom, c }`, `c` au format compact ci-dessus). En mode professeur, il enregistre et charge ses 5 emplacements (gardés dans son navigateur, ils remplacent ceux de l'appli sur son PC tant que `js/scenarios.js` n'a pas changé depuis), puis « Exporter » crée `sonar-scenarios.json` dans Téléchargements : son contenu (`emplacements`) est recopié dans `js/scenarios.js` avant publication.
