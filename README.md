# Project Manager Web (MVP)

Webová alternativa k excelové šabloně **Project_Manager_Template_VBA_v18.xlsm**. Cílem
je nahradit VBA/vzorcovou logiku moderním, rychlým a snadno rozšiřitelným webem, který si
zachovává klíčové koncepty originálu:

- **Tasks** jako jediný zdroj pravdy (fáze, status, vlastník, termíny, % dokončení).
- **Health** (Green/Orange/Red/Grey/Blue) — počítaný signál kvality plánu/postupu,
  1:1 portovaný z původního `LET()` vzorce v `TASKS!V` (viz `src/lib/health.ts`).
- **Gantt** s přepínačem Week/Month/Quarter a barvením podle Health.
- **Milestones** s platebními spouštěči (% platby, částka, stav platby).
- **Budget** po položkách (planned/committed/actual/forecast/variance) navázaný na milníky.
- **Risks** registr (pravděpodobnost/dopad/vlastník/opatření).
- **Dashboard** — souhrn stavů, health, milníků, rozpočtu a top rizik.
- Přepínač jazyka **CZ/EN** (`src/i18n.ts`, obdoba listu `LANGUAGE`).

## Rozsah MVP vs. originál

Toto je funkční prototyp, ne 1:1 klon. Vědomě vynechané/zjednodušené části (viz i zpětná
vazba k Excelu, kterou dostal zadavatel v chatu):

- **Žádný backend / živé sdílení mezi uživateli.** Data se ukládají jen v `localStorage`
  prohlížeče (`src/lib/storage.ts`) — žádné souběžné víceuživatelské úpravy stejného
  projektu. Přenos projektu mezi PC/uživateli řeší tlačítka Export/Import (`.json` soubor,
  viz níže) — obdoba toho, jak se dřív kopíroval `.xlsm`, jen bez Excelu. Pro živé sdílení
  víc lidí nad stejnými daty by bylo potřeba API + databáze (viz Roadmap níže).
- **RoadMap (manažerská prezentační vrstva)** generovaná ve VBA pomocí shapes není
  portována — Gantt na stránce „Gantt“ pokrývá stejnou potřebu jednodušeji.
- **Import z MS Project** (`Import_MSProject_Export.bas`) není implementován; místo něj je
  k dispozici CSV export úkolů. Import lze doplnit jako další krok (parsování CSV/XML
  exportu z MS Project).
- **Tým / kalendář dovolených** (list TEAM) není součástí MVP.
- **ChangeLog / audit trail** není zatím implementován (v localStorage verzi nedává velký
  smysl — dává smysl až s backendem a víc uživateli).

## Vývoj

```bash
npm install
npm run dev             # http://localhost:5173
npm run build            # typecheck + produkční build do dist/ (normální hosting)
npm run build:portable    # typecheck + JEDEN self-contained index.html do dist-portable/
```

## Portable režim (`npm run build:portable`)

Pro firemní prostředí bez možnosti hostovat appku (SharePoint/intranet s omezeními, žádná
admin práva na instalaci čehokoli) existuje druhý build mód, který vyprodukuje **jediný
`index.html` soubor** se vším uvnitř (JS + CSS inlinované, žádné externí requesty za běhu –
ověřeno: po otevření přes `file://` proběhne jen jeden network request, a to na samotný
soubor). Tenhle soubor:

- se dá otevřít dvojklikem v libovolném prohlížeči na jakémkoli PC, i offline,
- nepotřebuje instalaci, admin práva ani Node.js (ten je potřeba jen jednou při buildu),
- dá se volně kopírovat/mailovat/sdílet přes Teams/USB jako obyčejný soubor.

Data se ukládají do `localStorage` prohlížeče na daném PC (přežije reload i zavření
prohlížeče, ale nepřenese se samo na jiný počítač nebo do jiného prohlížeče). Pro přenesení
rozpracovaného projektu mezi počítači slouží tlačítka **Export/Import projektu** v hlavičce
(`src/components/ProjectFileControls.tsx`, formát v `src/lib/projectFile.ts`) – uloží/načtou
celý stav (projectInfo, tasks, milestones, budget, risks) jako jeden `.json` soubor.

## Struktura

```
src/
  types.ts            doménové typy (Task, Milestone, BudgetItem, Risk, ...)
  data/config.ts       číselníky (statusy, fáze, priority, kategorie) - obdoba listu CONFIG
  data/seed.ts          ukázková data převzatá/upravená z originálního sešitu
  lib/health.ts          výpočet Health - port původního Excel LET() vzorce
  lib/storage.ts          localStorage perzistence
  lib/csv.ts               CSV export
  lib/projectFile.ts        formát a serializace Export/Import projektu (.json)
  i18n.ts                     CZ/EN slovník - obdoba listu LANGUAGE
  context/AppContext.tsx       globální stav + CRUD operace
  components/ProjectFileControls.tsx  UI pro Export/Import projektu
  pages/                         Dashboard, Tasks, Gantt, Milestones, Budget, Risks
```

## Možný další rozvoj (roadmap)

1. Backend (Node/Postgres nebo Supabase) pro sdílená data více uživatelů, práva a audit trail.
2. Import z MS Project / Excel (nahradit VBA import).
3. Skutečné závislosti mezi úkoly (predecessors) a automatický přepočet kritické cesty.
4. Notifikace/e-maily při změně Health na Red nebo blížícím se milníku.
5. Export reportu (PDF/PPTX) pro SteCo, obdoba listu ROADMAP.
