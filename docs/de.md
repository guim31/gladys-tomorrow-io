# Tomorrow.io

Hyperlokales Wetter von [Tomorrow.io](https://www.tomorrow.io) in Gladys: aktuelle Bedingungen, der
Regen der nächsten Stunde Minute für Minute, die Vorhersage der nächsten Tage und, mit einem
kostenpflichtigen Tarif, Luftqualität und Pollen. Ein Gerät pro Ort, ein Szenen-Auslöser „Regen
erwartet“, eine Szenen-Aktion, die die Vorhersage liest, und zwei Dashboard-Widgets.

Diese Integration ist nicht mit Tomorrow.io verbunden und wurde ohne Tomorrow.io-Konto entwickelt,
nach der offiziellen Dokumentation und den veröffentlichten Antworten der Home-Assistant-Integration:
Rückmeldungen sind willkommen.

## Voraussetzungen

- Gladys 5.1.0 oder neuer.
- Ein Tomorrow.io-Konto (der kostenlose Tarif genügt) und sein API-Schlüssel: melde dich auf
  [app.tomorrow.io](https://app.tomorrow.io/development/keys) an, **Development → API keys**.
- Internetzugang für Gladys: die Integration ruft `api.tomorrow.io` auf.

## Konfiguration

### API-Schlüssel und Kontingent

Füge den Schlüssel unter **API-Schlüssel** ein und drücke **API-Schlüssel testen**: die Antwort
nennt die gemessene Temperatur, die Zahl der Orte und den Takt der Abfragen.

Der kostenlose Tarif erlaubt **500 Aufrufe pro Tag** (Zurücksetzen um Mitternacht UTC), **25 pro
Stunde** (Zurücksetzen zu jeder vollen Stunde) und 3 pro Sekunde. Jede Abfrage eines Orts kostet **2
Aufrufe** (aktuelle Bedingungen, dann die Vorhersage, die alle Zeitreihen auf einmal liefert), 3 mit
den Premium-Ebenen. Die Integration:

- fragt nur die Orte ab, deren Gerät zu Gladys hinzugefügt wurde;
- verlängert das **Abfrageintervall** (standardmäßig 15 Minuten), damit alle Orte in 90 % der
  Stunden- und Tageslimits passen: 1 oder 2 Orte alle 15 Minuten, 3 Orte alle 20 Minuten, 4 alle
  26 Minuten;
- zählt ihre Aufrufe, bewahrt die Zählung über Neustarts in `/data` auf und pausiert, wenn ein Limit
  erreicht ist.

Mit einem kostenpflichtigen Tarif stellst du **Erlaubte Aufrufe pro Tag** und **pro Stunde** auf
seine Limits.

### Orte

**Abzufragende Orte**: die Häuser von Gladys (Standard), die unten eingegebenen Koordinaten oder
beides. Ein Haus wird erst abgefragt, wenn sein Standort auf seiner Karte unter **Einstellungen →
Häuser** festgelegt ist. Koordinaten sind Dezimalgrad, mit Komma oder Punkt (`48,8566` und
`2,3522`); **Name des Orts** benennt dieses Gerät.

**Sprache** legt die Namen der Funktionen (beim Erstellen des Geräts) und die Texte der Integration
fest: das Wetter, die Zusammenfassung der Szenen-Aktion. Standardmäßig Französisch.

## Geräte

Öffne den Tab **Entdecken** und füge das Gerät jedes Orts hinzu. Seine Zustände kommen sofort, dann
bei jeder Abfrage. Alles ist nur lesbar.

### Funktionen

| Funktion                        | Einheit | Quelle                                                                 |
| ------------------------------- | ------- | ---------------------------------------------------------------------- |
| Temperatur, Gefühlte Temperatur | °C      | aktuelle Bedingungen                                                   |
| Luftfeuchtigkeit                | %       | aktuelle Bedingungen                                                   |
| Luftdruck                       | hPa     | auf Meereshöhe, sonst am Boden                                         |
| Windgeschwindigkeit, Windböen   | km/h    | aktuelle Bedingungen                                                   |
| Windrichtung                    | °       | woher der Wind kommt                                                   |
| Bewölkung                       | %       | aktuelle Bedingungen                                                   |
| Niederschlag aktuell            | mm/h    | Regen, Schnee, Schneeregen und gefrierender Regen zusammen             |
| Niederschlag nächste Stunde     | mm      | erwartet in den nächsten 60 Minuten (als mm/h angezeigt: gleiche Zahl) |
| Regen innerhalb einer Stunde    | 0/1     | mindestens eine Minute mit 0,1 mm/h oder mehr in den nächsten 60 Min.  |
| Regenwahrscheinlichkeit         | %       | die höchste der nächsten Stunde                                        |
| Wetter                          | Text    | Wettercode von Tomorrow.io, übersetzt                                  |
| Sichtweite                      | km      | aktuelle Bedingungen                                                   |
| UV-Index                        |         | aktuelle Bedingungen                                                   |

Die Minutenprognose wird genutzt, wenn der Tarif sie liefert; sonst die laufende Stunde der
Stundenprognose (Regen bei 0,1 mm/h oder mehr und einer Wahrscheinlichkeit ab 50 %).

### Premium-Ebenen: Luftqualität und Pollen

**Luftqualität und Pollen (kostenpflichtig)** fügt hinzu: EPA-Luftqualitätsindex, PM2,5, PM10, Ozon
(µg/m³, aus ppb umgerechnet), Baum-, Gräser- und Kräuterpollen (0 keine bis 5 sehr hoch) und den
Waldbrandindex. Diese Ebenen sind **nicht im kostenlosen Tarif**: mit einem Tarif, der sie ablehnt,
sagt die Integration das einmal in ihren Protokollen und fragt einen Tag später erneut; die anderen
Funktionen laufen weiter. Das Ein- oder Ausschalten der Option ändert die Struktur des Geräts: drücke
**Aktualisieren** im Tab Entdecken.

## Widgets

- **Tomorrow.io-Vorhersage**: das Wetter jetzt (Temperatur, gefühlte Temperatur, Wind und
  Regenwahrscheinlichkeit live), die nächsten sechs Tage (Temperaturen, Wetter,
  Regenwahrscheinlichkeit), der Regen der Stunde und, mit den Premium-Ebenen, Luftqualität und
  Pollen.
- **Regen nächste Stunde**: wann der Regen beginnt, ein Balkendiagramm der nächsten 60 Minuten, die
  maximale Intensität und die Regenwahrscheinlichkeit. Ohne Minutenprognose sagt es das und zeigt
  die stündliche Schätzung.

Wähle den Ort in den Einstellungen des Widgets. Keines der beiden ruft Tomorrow.io auf: sie zeigen
die letzte Abfrage.

## Szenen-Auslöser

**Regen bald erwartet (Tomorrow.io)** startet eine Szene, wenn der Regen an einem Ort **innerhalb von
15, 30 oder 60 Minuten** beginnt (oder gerade begonnen hat). Jedes Fenster löst einmal pro Schauer
aus: ein Schauer, der für in 50 Minuten angekündigt ist, löst „60“ aus, dann „30“ und „15“, wenn er
näher kommt. Erneut löst es erst aus, wenn die Vorhersage für dieses Fenster wieder trocken war.
Variablen: der Ort, die Minuten bis zum Regen, die maximale Intensität (mm/h), die
Regenwahrscheinlichkeit (%).

Ein Neustart der Integration während eines Schauers löst ihn nicht erneut aus. Ohne Minutenprognose
gibt es nur das 60-Minuten-Fenster.

## Szenen-Aktion

**Tomorrow.io-Vorhersage lesen** liefert für heute oder morgen an einem Ort: einen
Zusammenfassungssatz, das Wetter, die Tiefst- und Höchsttemperatur und die Regenwahrscheinlichkeit,
für die nächsten Aktionen der Szene. Grundlage ist die letzte Abfrage: kein Aufruf.

## Szenen-Beispiele

- **Wäsche reinholen**: Auslöser „Regen bald erwartet“, innerhalb von 30 Minuten → eine Nachricht
  senden „Regen in {{triggerEvent.data.minutes}} Min. in {{triggerEvent.data.place}}“.
- **Dachfenster schließen**: Auslöser „Regen bald erwartet“, innerhalb von 15 Minuten → das Gerät des
  Dachfensters (oder der Markise) schließen.
- **Morgenwetter**: jeden Tag um 7:00 → „Tomorrow.io-Vorhersage lesen“ (heute) → eine Nachricht mit
  der Zusammenfassung senden.
- **Pollen**: mit den Premium-Ebenen, ein Geräte-Auslöser „Baumpollen“ über 3 → die Allergiker im
  Haus benachrichtigen.

## Fehlerbehebung

- **„Tomorrow.io lehnt den API-Schlüssel ab“**: kopiere den Schlüssel erneut aus deinem Konto, ohne
  Leerzeichen. Ein neuer Schlüssel kann einige Minuten brauchen, bis er funktioniert.
- **„Tomorrow.io-Kontingent erreicht“**: eine andere Anwendung (Home Assistant…) nutzt vielleicht
  denselben Schlüssel. Die Abfragen laufen weiter, wenn Stunde oder Tag zurückgesetzt werden;
  verringere die Zahl der Orte oder lege einen Schlüssel für Gladys an.
- **Kein Gerät in Entdecken**: kein Haus hat einen Standort, und keine Koordinaten sind eingegeben.
  Lege den Standort des Hauses auf der Karte fest oder wechsle zu Koordinaten.
- **„Kein aktueller Wert“**: prüfe, ob das Gerät hinzugefügt wurde, und die Protokolle der
  Integration.
- Mehr Details in den Protokollen: setze `LOG_LEVEL=debug`. Der API-Schlüssel erscheint dort nie.

## Einschränkungen

- Ohne Tomorrow.io-Konto entwickelt: die Feldnamen folgen der offiziellen Dokumentation und den
  Fixtures von Home Assistant; die erste echte Nutzung kann Abweichungen zeigen.
- Nur metrische Einheiten (°C, km/h, hPa, mm, km).
- Ein Ort kostet 2 Aufrufe pro Abfrage: mit dem kostenlosen Tarif werden die Abfragen ab 4 Orten
  langsamer, um im Kontingent zu bleiben.
- Luftqualität, Pollen und Waldbrandindex brauchen einen kostenpflichtigen Tomorrow.io-Tarif.
- Die Namen der Funktionen werden beim Erstellen des Geräts festgelegt: ein späterer Sprachwechsel
  benennt sie nicht um.
- Keine Wetterwarnungen: der Wetterwarnungs-Auslöser von Gladys braucht eine Integration vom Typ
  Wetteranbieter.
