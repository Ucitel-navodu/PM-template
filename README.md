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

Plán dalších etap (plánování s CPM a interaktivním Ganttem, RAID + change requesty + audit log,
reporting PDF/PPTX, import MS Project XML / Excel / CSV) a důvody výběru knihoven jsou v
[`docs/research.md`](docs/research.md).

## Vývoj

```bash
npm install
npm run dev              # http://localhost:5173
npm test                 # Vitest (unit testy, TZ Europe/Prague)
npm run build            # licence/SBOM + typecheck + build do dist/ + CSP
npm run build:portable   # totéž, ale JEDEN self-contained dist-portable/index.html
npm run e2e              # Playwright: smoke test portable buildu přes file:// + autosave/konflikty
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
