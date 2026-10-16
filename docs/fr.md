# Tomorrow.io

La météo hyperlocale de [Tomorrow.io](https://www.tomorrow.io) dans Gladys : conditions actuelles,
pluie de l'heure à venir minute par minute, prévisions des jours suivants et, avec une offre
payante, qualité de l'air et pollens. Un appareil par lieu, un déclencheur de scène « pluie
attendue », une action de scène qui lit la prévision et deux widgets de tableau de bord.

Cette intégration n'est pas affiliée à Tomorrow.io. Elle a été développée sans compte Tomorrow.io,
d'après la documentation officielle et les réponses publiées par l'intégration Home Assistant : vos
retours sont les bienvenus.

## Prérequis

- Gladys 5.1.0 ou plus récent.
- Un compte Tomorrow.io (l'offre gratuite suffit) et sa clé d'API : connectez-vous sur
  [app.tomorrow.io](https://app.tomorrow.io/development/keys), **Development → API keys**.
- Un accès à Internet depuis Gladys : l'intégration appelle `api.tomorrow.io`.

## Configuration

### Clé d'API et quota

Collez la clé dans **Clé d'API**, puis appuyez sur **Tester la clé d'API** : la réponse donne la
température relevée, le nombre de lieux et le rythme des relevés.

L'offre gratuite permet **500 appels par jour** (remis à zéro à minuit UTC), **25 par heure** (remis
à zéro à chaque heure pile) et 3 par seconde. Chaque relevé d'un lieu coûte **2 appels** (conditions
actuelles, puis prévision, qui apporte toutes les échelles de temps d'un coup), 3 avec les couches
premium. L'intégration :

- ne relève que les lieux dont l'appareil a été ajouté à Gladys ;
- allonge l'**intervalle de relève** (15 minutes par défaut) pour que tous les lieux tiennent dans
  90 % des limites horaire et journalière : 1 ou 2 lieux toutes les 15 minutes, 3 lieux toutes les
  20 minutes, 4 toutes les 26 minutes ;
- compte ses appels, garde ce compte dans `/data` d'un redémarrage à l'autre, et se met en pause
  quand une limite est atteinte.

Avec une offre payante, réglez **Appels permis par jour** et **par heure** sur ses limites.

### Lieux

**Lieux à relever** : les maisons de Gladys (par défaut), les coordonnées saisies plus bas, ou les
deux. Une maison n'est relevée qu'une fois placée sur sa carte dans **Paramètres → Maisons**. Les
coordonnées sont en degrés décimaux, avec une virgule ou un point (`48,8566` et `2,3522`) ; **Nom
du lieu** nomme cet appareil.

**Langue** fixe les noms des fonctionnalités (à la création de l'appareil) et les textes écrits par
l'intégration : le temps, le résumé de l'action de scène. Français par défaut.

## Appareils

Ouvrez l'onglet **Découverte** et ajoutez l'appareil de chaque lieu. Ses états arrivent aussitôt,
puis à chaque relevé. Tout est en lecture seule.

### Fonctionnalités

| Fonctionnalité              | Unité | Source                                                                 |
| --------------------------- | ----- | ---------------------------------------------------------------------- |
| Température, Ressenti       | °C    | conditions actuelles                                                   |
| Humidité                    | %     | conditions actuelles                                                   |
| Pression                    | hPa   | au niveau de la mer, sinon au sol                                      |
| Vitesse du vent, Rafales    | km/h  | conditions actuelles                                                   |
| Direction du vent           | °     | d'où vient le vent                                                     |
| Nébulosité                  | %     | conditions actuelles                                                   |
| Précipitations actuelles    | mm/h  | pluie, neige, grésil et pluie verglaçante ensemble                     |
| Précipitations dans l'heure | mm    | attendues sur les 60 minutes à venir (affichées en mm/h : même nombre) |
| Pluie dans l'heure          | 0/1   | au moins une minute à 0,1 mm/h ou plus dans les 60 minutes             |
| Probabilité de pluie        | %     | la plus forte de l'heure à venir                                       |
| Temps                       | texte | code de temps Tomorrow.io, traduit                                     |
| Visibilité                  | km    | conditions actuelles                                                   |
| Indice UV                   |       | conditions actuelles                                                   |

La prévision minute par minute est utilisée quand l'offre la donne ; sinon, l'heure en cours de la
prévision horaire (pluie si 0,1 mm/h ou plus avec une probabilité d'au moins 50 %).

### Couches premium : qualité de l'air et pollens

**Qualité de l'air et pollens (offre payante)** ajoute : indice de qualité de l'air EPA, PM2,5,
PM10, ozone (µg/m³, converti depuis les ppb), pollens des arbres, des graminées et des herbacées (de
0 aucun à 5 très élevé), et l'indice d'incendie. Ces couches **ne sont pas dans l'offre gratuite** :
avec une offre qui les refuse, l'intégration le dit une fois dans ses journaux et redemande un jour
plus tard ; les autres fonctionnalités continuent. Activer ou désactiver l'option change la structure
de l'appareil : appuyez sur **Mettre à jour** dans l'onglet Découverte.

## Widgets

- **Prévisions Tomorrow.io** : le temps actuel (température, ressenti, vent et probabilité de pluie
  en direct), les six jours suivants (températures, temps, probabilité de pluie), la pluie de l'heure
  et, avec les couches premium, la qualité de l'air et les pollens.
- **Pluie dans l'heure** : quand la pluie commence, un graphique en barres des 60 minutes à venir,
  l'intensité maximale et la probabilité de pluie. Sans prévision minute par minute, il le dit et
  donne l'estimation horaire.

Choisissez le lieu dans les réglages du widget. Aucun des deux n'appelle Tomorrow.io : ils affichent
le dernier relevé.

## Déclencheur de scène

**Pluie attendue bientôt (Tomorrow.io)** lance une scène quand la pluie va commencer **d'ici 15, 30
ou 60 minutes** sur un lieu (ou vient de commencer). Chaque fenêtre se déclenche une fois par
averse : une averse annoncée à 50 minutes déclenche « 60 », puis « 30 » et « 15 » en approchant. Elle
ne se déclenche de nouveau qu'après une prévision redevenue sèche pour cette fenêtre. Variables : le
lieu, les minutes avant la pluie, l'intensité maximale (mm/h), la probabilité de pluie (%).

Un redémarrage de l'intégration pendant une averse ne la redéclenche pas. Sans prévision minute par
minute, seule la fenêtre de 60 minutes existe.

## Action de scène

**Lire la prévision Tomorrow.io** donne, pour aujourd'hui ou demain sur un lieu : une phrase de
résumé, le temps, les températures minimale et maximale et la probabilité de pluie, pour les
actions suivantes de la scène. Elle utilise le dernier relevé : aucun appel.

## Exemples de scènes

- **Rentrer le linge** : déclencheur « Pluie attendue bientôt », d'ici 30 minutes → envoyer le
  message « Pluie dans {{triggerEvent.data.minutes}} min à {{triggerEvent.data.place}} ».
- **Fermer le velux** : déclencheur « Pluie attendue bientôt », d'ici 15 minutes → fermer l'appareil
  du velux (ou du store).
- **Météo du matin** : chaque jour à 7 h → « Lire la prévision Tomorrow.io » (aujourd'hui) → envoyer
  un message avec le résumé.
- **Pollens** : avec les couches premium, un déclencheur d'appareil « Pollens des arbres » au-dessus
  de 3 → prévenir les allergiques de la maison.

## Dépannage

- **« Tomorrow.io refuse la clé d'API »** : recopiez la clé depuis votre compte, sans espace. Une
  nouvelle clé peut mettre quelques minutes à fonctionner.
- **« Quota Tomorrow.io atteint »** : une autre application (Home Assistant…) utilise peut-être la
  même clé. Les relevés reprennent à la remise à zéro de l'heure ou du jour ; réduisez le nombre de
  lieux ou créez une clé pour Gladys.
- **Aucun appareil dans Découverte** : aucune maison n'est placée sur la carte et aucune coordonnée
  n'est saisie. Placez la maison sur la carte, ou passez aux coordonnées.
- **« Pas de valeur récente »** : vérifiez que l'appareil a bien été ajouté, et les journaux de
  l'intégration.
- Plus de détails dans les journaux : réglez `LOG_LEVEL=debug`. La clé d'API n'y apparaît jamais.

## Limites

- Développée sans compte Tomorrow.io : les noms des champs suivent la documentation officielle et les
  fixtures de Home Assistant ; le premier usage réel peut révéler des écarts.
- Unités métriques seulement (°C, km/h, hPa, mm, km).
- Un lieu coûte 2 appels par relevé : avec l'offre gratuite, au-delà de 4 lieux les relevés
  ralentissent pour tenir dans le quota.
- Qualité de l'air, pollens et indice d'incendie demandent une offre Tomorrow.io payante.
- Les noms des fonctionnalités sont fixés à la création de l'appareil : changer la langue ensuite ne
  les renomme pas.
- Pas d'alertes météo : le déclencheur d'alerte météo de Gladys demande une intégration de type
  fournisseur météo.
