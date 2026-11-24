# Project Manager Web

Offline webová aplikace pro IT projektové manažery – nástupce excelové šablony
**Project_Manager_Template_VBA_v18.xlsm**. Celá appka je **jeden HTML soubor**: bez instalace,
bez serveru, bez admin práv a **bez jakéhokoli síťového spojení** (vynuceno Content-Security-Policy),
aby ji šlo bez schvalování používat ve firemním prostředí.

Zachovává klíčové koncepty originálu:

- **Tasks** jako jediný zdroj pravdy (fáze, oblast, status, vlastník, termíny, % dokončení).
- **Health** (Green/Orange/Red/Grey/Blue) – 1:1 port `LET()` vzorce z `TASKS!V`
  (`src/lib/health.ts`), s nastavitelnými tolerancemi.
- **Milníky** s platebními spouštěči, **Rozpočet** navázaný na milníky, **Rizika**, **Tým**
  (absence, kolize s úkoly), **Dashboard** s kalendářem svátků/absencí.
- CZ/EN, světlý/tmavý režim.

Nově (etapa E0 – základ):

- **Portfolio** – více projektů v jednom pracovním prostoru, přepínač projektů, přehled s RAG
  stavem, postupem, dalším milníkem, riziky a čerpáním (`src/pages/Portfolio.tsx`, `src/lib/portfolio.ts`).
- **Pracovní soubor + autosave** – data žijí v souboru `.pmw.json` (OneDrive / síťový disk),
  appka do něj ukládá automaticky přes File System Access API
  ([browser-fs-access](https://github.com/GoogleChromeLabs/browser-fs-access)); prohlížeč (IndexedDB)
  drží pracovní kopii a rotující zálohy (`src/lib/persistence/`).
- **Jeden zapisuje, ostatní čtou** – před každým zápisem kontrola, zda soubor mezitím neuložil
  někdo jiný (čas změny + revize + id); při konfliktu se nic nepřepíše a appka nabídne řešení.
  Režim „jen pro čtení“ pro kolegy.
- **Undo/redo** (Ctrl+Z / Ctrl+Y, [zundo](https://github.com/charkour/zundo)).
- **Migrace** starších dat: export v1/v2 (`.json`) i data z `localStorage` předchozí verze
  (`src/domain/workspace.ts`, validace přes zod).
- **Bezpečnost a licence** – CSP s hashi inline skriptů a `connect-src 'none'` (`scripts/csp.mjs`),
  kontrola licencí (jen MIT/Apache-2.0/BSD/ISC) a CycloneDX SBOM při každém buildu
  (`scripts/licenses.mjs`); seznam knihoven, licence a SBOM jsou v appce v ❓ → ℹ️ O aplikaci.

Etapa E1 – plánování (jako MS Project):

- **Hierarchie WBS** se souhrnnými úkoly (odsazení Alt+Shift+→/←, posun Alt+Shift+↑/↓).
- **Automatické plánování** v pracovních dnech (víkendy + svátky z Nastavení), vazby FS/SS/FF/SF
  s posunem, ručně plánované úkoly, omezení „nezačít dříve než“, **kritická cesta** a rezervy
  (`src/lib/schedule/`, vlastní CPM s unit testy).
- **Tabulka úkolů** na [TanStack Table](https://tanstack.com/table) – řazení, filtry, volba sloupců,
  uložené pohledy; **baseline** (více snímků, odchylka v pracovních dnech).
- **Interaktivní Gantt** ([frappe-gantt](https://github.com/frappe/gantt)) – tažení, změna délky a %,
  šipky vazeb, svátky, zvýraznění kritické cesty.
- **Kanban** ([dnd-kit](https://dndkit.com)) – změna stavu přetažením, i klávesnicí.

Etapa E2 – governance:

- **RAID log** – rizika, issues, předpoklady, závislosti a rozhodnutí v jednom registru, mapa rizik
  P×I (4×4 jako v Excelu), strategie odezvy, záložní plán, spouštěč.
- **Change requesty** – dopad na termín a rozpočet; schválení zapíše rozhodujícího, nabídne novou
  baseline a záznam do RAID; schválené změny navyšují aktuální rozpočet.
- **Historie (audit log)** – kdo, kdy, co a z jaké hodnoty na jakou, uložená v souboru projektu,
  export do CSV (`src/lib/audit.ts`).
- **Vlastní stavy úkolů a priority** – každý stav má pevný význam, takže vzorec Health zůstává 1:1.

Etapa E3 – reporting:

- **Status report** (záložka Report) předvyplněný z dat za období: RAG, KPI, shrnutí, eskalace,
  RoadMapa, milníky, hotovo/další kroky, rizika, změny, rozpočet; historie reportů a trend RAG.
- **PDF** přes tisk prohlížeče (A4 na šířku, tiskové CSS) a **PowerPoint** přes
  [pptxgenjs](https://github.com/gitbrent/PptxGenJS) (MIT) – 8 editovatelných slidů včetně nativní
  RoadMapy a grafu rozpočtu; branding (logo, barva, organizace) v Nastavení.
- **Manažerská RoadMapa** jako náhrada VBA `RoadMap.bas` (Export pro vedení + Mgmt order, řádky
  podle fáze/oblasti, barvy podle fáze/Health).
- **Portfolio** – tisk a PPTX pro vedení s trendem RAG.

Etapa E4 – import a export:

- **MS Project XML** (Uložit jako › XML): hierarchie, termíny, %, milníky, vazby FS/SS/FF/SF s posunem, baseline.
  Opakovaný import podle UID s náhledem změn; soubor určuje strukturu a termíny, údaje PM (fáze, oblast,
  priorita, poznámky) zůstávají; chybějící úkoly se nemažou samy. Jeden krok Zpět, záznam do Historie.
- **Excel (.xlsx) a CSV**: listy TASKS / MILESTONES / BUDGET / RISKS, české i anglické hlavičky, mapování
  s výpisem nepřečtených sloupců; **export do Excelu** (round-trip). `.xlsx` se čte a píše přes jszip +
  fast-xml-parser (`src/lib/import/xlsx.ts`) – ExcelJS jsem nepoužil, protože jeho závislosti mají nepermisivní/neznámé licence.

Vzhled: firemní vizuál **ORLEN Unipetrol** podle *Manuálu vizuálního stylu 2021* – světlý (výchozí) a tmavý
vzhled, firemní červená `#d81e04` a šedé `#676d6f` / `#aeafab`, doplňkové barvy jen pro grafy a stavy, písmo Arial
(Futura PT má jen desktopovou licenci), logo vyříznuté vektorově z manuálu (`src/lib/brand.ts`) s ochrannou zónou
a bílou negativní variantou na tmavém podkladu. Volba je per zařízení; tisk/PDF/PPTX jsou vždy ve světlé firemní podobě.

Všech pět plánovaných etap (základ, plánování, governance, reporting, import) je hotových. Důvody výběru
knihoven a návrhová rozhodnutí jsou v [`docs/research.md`](docs/research.md).

## Vývoj

```bash
npm install
npm run dev              # http://localhost:5173
npm test                 # Vitest (unit testy, TZ Europe/Prague)
npm run build            # licence/SBOM + typecheck + build do dist/ + CSP
npm run build:portable   # totéž, ale JEDEN self-contained dist-portable/index.html
npm run e2e              # Playwright: smoke, plánování, governance, reporting, import (file://) + autosave/konflikty
```

E2E testy potřebují Chromium (`npx playwright install chromium`, nebo `CHROMIUM_PATH=/cesta/k/chromium`).

## Ukládání dat

| Vrstva | Co obsahuje | Proč |
| --- | --- | --- |
| Pracovní soubor `.pmw.json` | celé portfolio (projekty, kalendář, absence), revize, kdo a kdy uložil | zdroj pravdy; leží na OneDrive/H: disku, zálohuje ho IT, dá se sdílet |
| IndexedDB (prohlížeč) | pracovní kopie + až N záloh + odkaz na soubor | přežije pád prohlížeče; obnova po chybě |
| localStorage | jazyk, téma, jméno uživatele, interval autosave | osobní nastavení, ne data projektu |

Prohlížeče sdílejí pro všechny `file://` stránky jeden storage origin, proto je IndexedDB
klíčovaná hashí cesty k HTML souboru (`src/lib/storage.ts`) – dvě kopie appky si data nepřepíšou.
Ve Firefoxu (bez File System Access API) funguje ruční „Stáhnout kopii“ / „Otevřít soubor“.

## Struktura

```
src/
  types.ts                 doménové typy (Workspace, Project, Task, …)
  domain/workspace.ts      schéma souboru (zod), migrace starších formátů, továrny
  store/workspaceStore.ts  zustand store + undo/redo, read-only pojistka
  store/prefsStore.ts      osobní nastavení
  lib/persistence/         soubor (autosave, konflikty), IndexedDB cache a zálohy, start appky
  lib/health.ts            Health – port Excel vzorce
  lib/portfolio.ts         RAG a souhrny projektů
  lib/dates.ts             pracovní dny, svátky, DST-bezpečná data
  data/settings.ts         výchozí číselníky, generátor českých svátků
  components/              FileMenu, SyncBanner, Nastavení, Nápověda, O aplikaci, …
  pages/                   Portfolio, Dashboard, Úkoly, Gantt, Milníky, Rozpočet, Rizika, Tým
scripts/                   csp.mjs, licenses.mjs (build kroky)
tests/e2e/                 Playwright scénáře
```

## Novinky ve verzi 0.9.0

- **Úkoly**: psaní do názvu / vlastníka už neztrácí fokus; šířku sloupců lze měnit tažením (dvojklik = výchozí);
  nástroje řádku (přesun, odsazení, ＋ úkol, ＋ podúkol) jsou na začátku řádku a zůstávají vidět při posunu;
  pořadí úkolů lze měnit tažením za ⠿ (včetně podúkolů, jeden krok Zpět).
- **Rozpočet**: typ nákladu **CAPEX / OPEX** – součty, filtr, Dashboard, report, PPTX, export i import.
- **Dashboard**: karta **Odkazy** (Clarity, SharePoint, vlastní); jen adresy http(s), otevírají se v novém okně.
- **Pracovní soubor ve více formátech**: `.pmw` (doporučeno pro SharePoint), `.xlsx` (čitelné listy + kompletní
  data ve skrytém listu `PM_DATA`), `.txt`, `.pmw.json`. Otevření pozná formát podle obsahu; automatické
  ukládání a hlídání kolizí funguje ve všech.
- **Import původní šablony Excel** (`.xlsm` / `.xlsx`): najde záhlaví i pod titulky, listy TASKS / MILESTONES /
  BUDGET / RISKS, údaje projektu z DASHBOARD a číselníky z CONFIG. Makra se nečtou ani nespouštějí.
- **Korporátní barvy**: palety Korporátní světlá / tmavá (červená `#d81e04`, šedé `#676d6f`, `#aeafab`);
  tlačítkem lze barvu palety použít i pro report a PPTX.
- **Nastavení v panelech** s levým menu a hledáním; tlačítka na stránkách otevírají rovnou svůj panel
  (Úkoly → Fáze projektu, Rozpočet → Kategorie rozpočtu).
- **Úkoly – doplnění**: při přetahování ukazuje čára, kam úkol dopadne (nad / pod řádek); tabulka má vlastní
  posuvníky a lepivé záhlaví, takže vodorovný posuvník je vždy po ruce; režim **☑ Vybrat** pro hromadné mazání
  (Shift+klik = rozsah, jeden krok Zpět).
- **Nástroje řádku jako menu**: v řádku zůstalo jen ⠿ (přetažení), ＋ (úkol pod) a **⋯** – menu s popisky a
  klávesovými zkratkami (podúkol, odsadit, předsadit, nahoru, dolů, smazat). Stejné menu otevře pravé tlačítko myši.

## Novinky ve verzi 0.10.0 – firemní vizuál ORLEN Unipetrol

- Celá aplikace podle *Manuálu vizuálního stylu 2021*: logo v hlavičce (barevné / bílé negativní, ochranná zóna,
  min. 50 px), firemní červená a šedé, Arial, grafický symbol O + U uříznutý okrajem plochy (report, portfolio).
- Zůstaly jen dvě palety: **ORLEN světlá** (výchozí) a **ORLEN tmavá**; dřívější volby se převedou automaticky.
- Grafy, Gantt, RoadMapa a Health stavy v doplňkových barvách manuálu; kontrast textů ≥ 4,5 : 1 (testováno).
- **PowerPoint** podle firemní šablony: červený titulní a závěrečný slide s bílým logem a symbolem, bílé obsahové
  slidy s červeným nadpisem, logem vlevo dole a symbolem vpravo dole, tabulky s červeným záhlavím.
- Report / PDF s logem a symbolem; export do Excelu s červeným záhlavím a písmem Arial.

## SharePoint a sdílení (v0.10.1)

- Pracovní soubor patří do knihovny SharePointu **synchronizované přes OneDrive** („Synchronizovat“ / „Přidat zástupce
  do Mých souborů“); aplikace pak ukládá do běžné složky a OneDrive soubor nahraje. Síťová jednotka (WebDAV) ani ruční
  nahrávání nejsou podporované.
- HTML je jen program: každý ho spouští ve svém prohlížeči. Společná data jsou jen ve společném pracovním souboru –
  jeden zapisující, ostatní „jen pro čtení“; kolize se pozná, ale neslučuje; nejsou práva po projektech.
- Report a PPTX používají vždy firemní červenou (volba barvy byla odebrána).
