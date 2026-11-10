// Les 5 scénarios proposés aux élèves (bouton « Scénarios »), null = emplacement libre.
// Chaque scénario : { nom, c } où c est le réglage au format compact (voir README) :
// milieu,portée,angle,distances,durées,v sonar,dir sonar ; puis un bloc d,a,v,dir par obstacle.
// Le professeur prépare ses emplacements en mode admin, les exporte (sonar-scenarios.json),
// puis ce fichier est mis à jour à partir de l'export et publié avec l'appli.
const SCENARIOS = [
  { nom: 'Obstacle simple', c: 'a,800,90,0,0,0,90;510,25.6,0,-115.6' },
  { nom: 'Obstacle double', c: 'e,6000,130,0,0,0,90;3420,-55.4,0,-115.6;4510,29.2,0,-119.2' },
  { nom: 'Obstacle en mouvement', c: 'e,6000,130,0,1,0,90;750,0,80,89.5' },
  null,
  null
];
