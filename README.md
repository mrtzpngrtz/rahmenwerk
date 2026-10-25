# Rahmenwerk – Bilderrahmen-Generator

Lokaler Generator für vier L-förmige Bilderrahmen-Ecken. Eine innere Nut nimmt zwei Acrylplatten mit Foto auf; die äußere U-Nut führt die umlaufende Spannschnur. Die vorhandene Datei `2mmscheiben_seite.stl` bleibt unverändert.

Die Oberfläche verwendet einen monochromen Darkmode mit reduziertem Raster und direkter Eingabe aller Maße in Millimetern.

## Öffnen

Mit laufendem XAMPP: [Generator öffnen](http://localhost/2026_09_bilderrahmen_generator/).

Alternativ `index.html` direkt im Browser öffnen. Alle benötigten Bibliotheken sind in `app.bundle.js` enthalten. Für die Benutzung sind weder Installation noch Internetzugang nötig. Die 3D-Ansicht benötigt WebGL; der Querschnitt und die Exporte funktionieren auch ohne WebGL.

## Einstellen und drucken

- **Form:** zwei unabhängige Schenkellängen bis 1.000 mm und Leistenbreite bis 200 mm. **25 cm = 250 mm**. Die Vorlage „250 mm / mit Abstand“ stellt beide Schenkel auf 250 mm, die Leistenbreite auf 25 mm und den zusätzlichen Plattenabstand auf 5 mm. Alle Werte lassen sich danach ändern.
- **Acryl:** Dicke jeder Platte (0,5–250 mm), Fotoeinlage, zusätzlicher Plattenabstand (0–250 mm), Spiel und Einstecktiefe. Aufnahme gesamt = vordere Platte + hintere Platte + Einlage + zusätzlicher Abstand + Spiel. Bei Abstand 0 bleibt der gemeinsame Schlitz erhalten. Bei Abstand größer 0 entstehen **zwei getrennte Plattennuten mit einem integrierten Abstandssteg**; jede Nut erhält die Hälfte des Passungsspiels. Der Steg und der nominelle Abstand zwischen den anliegenden Platten sind Fotoeinlage + zusätzlicher Abstand, mindestens 0,8 mm. Für exakt 5 mm ohne Fotoeinlage: Einlage 0 und Abstand 5. Negatives Spiel bedeutet Übermaß der Platten. Bei Abstand ein Foto bei Bedarf an einer Platte befestigen.
- **Profil:** getrennte Deckwandstärken, Rundung am Schlitzgrund und Fase an den Längskanten. Die nominelle Einstecktiefe wird bis zum tiefsten Punkt der Rundung gemessen. Eine rechtwinklige Plattenkante sitzt an deren Tangente, also um den Rundungsradius weniger tief.
- **Schnur:** abschaltbare äußere Nut, Nutbreite/Schnurdurchmesser und Nuttiefe jeweils bis **100 mm (10 cm)**. Die Nutbreite sollte zur tatsächlichen Schnur plus gewünschtem Spiel passen. Die Nuttiefe muss mindestens dem halben Durchmesser entsprechen (bei 100 mm also mindestens 50 mm); Leistenbreite und Bauteildicke müssen ausreichend Platz bieten. Die Nut liegt mittig in der gesamten Bauteildicke.
- **Rahmen:** Außenmaß der Acrylplatten. Beeinflusst nur die Montageansicht, nicht die STL.
- **Export:** 1–16 gleiche Ecken, Abstand, flache oder hochkante Ausrichtung und Rundungsauflösung. Vorschaufarbe wird nicht ins STL übernommen.

STL enthält ausschließlich die Ecken, ohne Acryl, Schnur oder Hilfsgeometrie. Jede Ecke ist ein durchgehender geschlossener Körper; mehrere Kopien liegen getrennt in einem Raster auf Z = 0. Im Slicer Millimeter verwenden. STL selbst speichert keine verbindliche Einheit.

**Zuerst „Passprobe“ verwenden:** Ein kurzer Winkel mit identischem Querschnitt prüft die Passung. Seine Schenkel sind möglichst 18 mm lang; bei breiten Leisten entsprechend länger. Anschließend mit den echten Acrylplatten und der Schnur testen. Tatsächliche Passung und Belastbarkeit hängen von Drucker, Material und Slicer-Einstellungen ab. Druckorientierung, Überhänge und Stützen im Slicer prüfen. Die Volumenanzeige ist das reine CAD-Vollkörpervolumen, ohne Infill- oder Stützberechnung.

Einstellungen werden in diesem Browser automatisch gespeichert. Über die Symbole am Ende der Einstellungsleiste lassen sie sich als JSON herunterladen und wieder laden. Ältere Dateien ohne Plattenabstand werden mit Abstand 0 übernommen, ihre Maße bleiben erhalten.

## Bezug zur Originaldatei

Die binäre STL enthält vier gleichartige Ecken, angeordnet hochkant. Gemessene Abmessungen je Ecke: etwa **53 × 53 × 7 mm**, Leistenbreite etwa **10,51 mm**. Gemeinsamer innerer Schlitz etwa **2,4 mm**, äußere Nut etwa **2,2 mm** breit und **3,6 mm** tief. Die Vorlagendatei hat teilweise offene bzw. überlappende Dreiecksverbindungen. Sie wird deshalb nicht nur skaliert, sondern als geschlossener parametrischer Körper neu aufgebaut.

„Original-STL“ nähert ihre Hauptmaße an (2,4-mm-Gesamtschlitz). Die Anzeige mit zwei 1-mm-Platten plus 0,4 mm Spiel ist eine rechnerische Zuordnung, keine aus dem STL beweisbare Plattenstückliste. Die Rekonstruktion ist keine identische Reproduktion aller Rundungen.

Der Standard **2 × 2 mm Acryl** verwendet einen 4,4-mm-Schlitz: 4 mm Acryl + 0,2 mm Foto + 0,2 mm Spiel. Bei 2,3 mm Deckwand je Seite ergibt das 9 mm Bauteildicke.

## Weiterentwickeln

Node.js und npm werden nur für Quellcodeänderungen benötigt:

```text
npm install
npm run build
npm test
```

`src/geometry.js` erzeugt das geschlossene Netz und binäre STL, `src/preview.js` die 3D- und Schnittansicht, `src/app.js` die Bedienoberfläche. `npm run build` aktualisiert die direkt nutzbare Datei `app.bundle.js`. Lizenzhinweise für die eingebundene Three.js-Bibliothek stehen in `THIRD_PARTY_LICENSES.txt`.

Die Geometrie wird als geschlossener Querschnitt entlang zweier auf Gehrung verbundener Schenkel aufgebaut. Die Tests prüfen unter anderem gemeinsame Kanten, Flächenorientierung, degenerierte Dreiecke, Außenmaße, Grenzfälle, verschiedene Parameterkombinationen sowie die Druckanordnung.
