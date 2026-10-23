import type { Lang } from '../types'

export interface HelpItem {
  q: string
  a: string
}

export interface HelpSection {
  title: string
  items: HelpItem[]
}

export const helpContent: Record<Lang, HelpSection[]> = {
  CZ: [
    {
      title: '🚀 Rychlý start',
      items: [
        {
          q: 'Co je tahle appka?',
          a: 'Webová alternativa k excelové PM šabloně — Dashboard, Úkoly, Gantt, Milníky, Rozpočet a Rizika na jednom místě, včetně automaticky počítaného Health stavu úkolů. Běží přímo v prohlížeči, bez instalace.',
        },
        {
          q: 'Jak začnu svůj vlastní projekt?',
          a: 'Na stránce Portfolio klikni na + Nový projekt (lze převzít fáze a oblasti z aktuálního projektu). Appka se při prvním spuštění otevře s ukázkovým projektem, který můžeš archivovat nebo smazat. Na Dashboardu klikni u "Informace o projektu" na ✏️ Upravit a vyplň název projektu, ID, vlastníky, termíny a rozpočet. Pak v ⚙️ Nastavení uprav fáze a oblasti projektu a přepiš ukázkové úkoly, milníky, rozpočet a rizika svými.',
        },
        {
          q: 'Můžu mít víc projektů?',
          a: 'Ano. Stránka Portfolio ukazuje všechny projekty s RAG stavem (Red/Amber/Green podle Health úkolů, rozpočtu, milníků po termínu a vysokých rizik), postupem, dalším milníkem a čerpáním. Mezi projekty přepínáš vlevo nahoře; hotové projekty archivuj. Kalendář svátků a absence týmu jsou společné pro všechny projekty.',
        },
        {
          q: 'Kde změním název projektu a další základní údaje?',
          a: 'Dashboard → karta "Informace o projektu" → ✏️ Upravit. Název se pak zobrazuje i v hlavičce appky a použije se jako výchozí název pracovního souboru. Uložíš tlačítkem Uložit nebo klávesou Enter, Esc změny zahodí.',
        },
        {
          q: 'Jak appku dostanu ke kolegovi?',
          a: 'Pošli mu jeden .html soubor (mail, Teams, USB). Dvojklikem se otevře v prohlížeči — žádná instalace, žádná admin práva. Data má každý ve svém pracovním souboru; tvůj soubor mu můžeš nasdílet k prohlížení (Otevřít jen pro čtení).',
        },
      ],
    },
    {
      title: "💾 Ukládání, soubor a bezpečnost",
      items: [
        {
          q: "Kde jsou moje data?",
          a: "Primárně v pracovním souboru .pmw.json, který si jednou uložíš přes 💾 Soubor → Uložit do souboru… (ideálně na OneDrive nebo síťový disk – soubor pak zálohuje IT). Appka do něj od té doby ukládá automaticky pár sekund po každé změně. Prohlížeč drží jen pracovní kopii a zálohy. Nic se neposílá na internet – appka má zakázané veškeré síťové spojení.",
        },
        {
          q: "Co znamená stav v hlavičce (Uloženo / Neuloženo / Jen v prohlížeči…)?",
          a: "Uloženo = soubor je aktuální. Ukládám… / Neuloženo = změna čeká na automatické uložení. Jen v prohlížeči = ještě nemáš propojený soubor (žlutý pruh nabídne uložení). Konflikt = soubor mezitím změnil někdo jiný. Jen pro čtení = prohlížíš cizí soubor. Ctrl+S uloží hned.",
        },
        {
          q: "Co se stane, když spadne prohlížeč nebo se zavře aktualizací?",
          a: "Nic se neztratí: každá změna se okamžitě zapíše do pracovní kopie v prohlížeči a do pár sekund i do souboru. Po restartu prohlížeč z bezpečnostních důvodů může chtít jedno kliknutí „Povolit a pokračovat“, než appka znovu smí zapisovat do souboru.",
        },
        {
          q: "Jak sdílím projekt s kolegy? Můžeme pracovat společně?",
          a: "Do souboru zapisuje vždy jeden (vlastník), ostatní ho otevřou přes 💾 Soubor → Otevřít jen pro čtení… Když soubor uložil někdo jiný, než ty, appka tvoje změny nepřepíše přes jeho: ukáže konflikt a nabídne načíst verzi ze souboru, uložit tvoje změny jako kopii, nebo (vědomě) soubor přepsat. Živá spolupráce více lidí naráz bez serveru možná není.",
        },
        {
          q: "Co jsou Zálohy v prohlížeči?",
          a: "Appka si průběžně (max. 1× za 10 minut a vždy před riskantní akcí, např. otevřením jiného souboru nebo vyřešením konfliktu) ukládá snímky celého portfolia. Obnovíš je v 💾 Soubor → Zálohy v prohlížeči… Počet záloh nastavíš v ⚙️ Nastavení → Já a ukládání.",
        },
        {
          q: "Jde vrátit omylem provedená změna?",
          a: "Ano – tlačítka ↶ ↷ v hlavičce nebo Ctrl+Z / Ctrl+Y (mimo textová pole). Pamatuje se posledních 100 kroků od otevření appky.",
        },
        {
          q: "Mám starší export projektu (.json) z dřívější verze appky. Jde načíst?",
          a: "Ano: 💾 Soubor → Otevřít soubor… a vyber ho. Starší export jednoho projektu se přidá jako nový projekt do aktuálního portfolia (fáze, oblasti, svátky i absence se převezmou). Data ze starší verze uložená jen v prohlížeči appka převede automaticky při prvním spuštění.",
        },
        {
          q: "Firefox mi nenabízí ukládání do souboru",
          a: "Přímé ukládání do souboru (File System Access API) umí Edge a Chrome. Ve Firefoxu appka funguje, ale ukládá jen do prohlížeče – pravidelně používej 💾 Soubor → Stáhnout kopii a soubor pak otevři přes Otevřít soubor….",
        },
        {
          q: "Je appka bezpečná pro firemní prostředí?",
          a: "Je to jeden HTML soubor bez instalace a bez serveru. Content-Security-Policy zakazuje jakékoli síťové spojení, všechny knihovny jsou uvnitř souboru a mají permisivní licence (MIT/Apache-2.0). Seznam knihoven, licence a SBOM (CycloneDX) najdeš v ❓ → ℹ️ O aplikaci.",
        },
      ],
    },
    {
      title: '🩺 Health — co znamenají barvy',
      items: [
        {
          q: 'Jaký je rozdíl mezi Status a Health?',
          a: 'Status je, co si o úkolu myslíš ty (Not started / In progress / Done...). Health je, co appka vypočítá z termínů a procent dokončení — jestli to sedí s plánem. Úkol tak může být "In progress" a přitom Health = Red, pokud výrazně zaostává.',
        },
        {
          q: 'Green',
          a: 'V pořádku — hotovo bez problémů, nebo běží podle plánu, nebo ještě nezačal a není ve skluzu.',
        },
        {
          q: 'Orange',
          a: 'Varování — mírné zaostávání, blížící se termín, nebo progress o něco horší, než by měl být.',
        },
        {
          q: 'Red',
          a: 'Kritické — skluz po termínu, nebo skutečný progress výrazně zaostává za očekávaným.',
        },
        {
          q: 'Grey',
          a: 'Nehodnoceno — zrušeno, pozastaveno, nebo chybí data potřebná pro vyhodnocení (např. chybí datum).',
        },
        {
          q: 'Blue',
          a: 'Chyba dat — nekonzistence, se kterou si appka neví rady: konec před začátkem, "Done" s datem v budoucnu, rozběhnutý úkol s budoucím startem apod. Nejdřív oprav data v tabulce.',
        },
      ],
    },
    {
      title: '📋 Práce s listy appky',
      items: [
        {
          q: 'Jak přidám nový úkol?',
          a: 'Na stránce Úkoly klikni na "+ Přidat úkol" — přidá se nový prázdný řádek, který rovnou vyplníš.',
        },
        {
          q: 'Jak funguje Gantt a přepínač Week/Month/Quarter?',
          a: 'Pruhy se barví podle Health, přerušovaná čára ukazuje dnešní datum. Přepínač mění granularitu časové osy nahoře — Week pro detailní pohled na pár týdnů, Month/Quarter pro dlouhodobý přehled.',
        },
        {
          q: 'K čemu je navázání milníku na rozpočet?',
          a: 'Rozpočtová položka může odkazovat na konkrétní milník (sloupec "Navázaný milník") — užitečné, když je platba dodavateli vázaná na dosažení milníku v harmonogramu.',
        },
        {
          q: 'K čemu je stránka Tým?',
          a: 'Plán dovolených a pracovních cest (obdoba listu TEAM). U každé absence appka spočítá pracovní dny (bez víkendů a svátků) a upozorní ⚠️, pokud osoba má v tu dobu rozpracované úkoly, kde je vlastníkem. Absence se zobrazují i v kalendáři na Dashboardu (fialová tečka).',
        },
        {
          q: 'Jak se počítá částka u milníku?',
          a: 'Stejně jako v Excelu: schválený rozpočet projektu × platební spouštěč v %. Součet procent je dole v tabulce — pokud nedává 100 %, zvýrazní se oranžově.',
        },
        {
          q: 'Jak exportuju úkoly do CSV?',
          a: 'Na stránce Úkoly tlačítko "Export do CSV" — vyexportuje aktuálně vyfiltrovaný seznam úkolů (respektuje filtry Fáze/Stav).',
        },
      ],
    },
    {
      title: '⚙️ Nastavení appky',
      items: [
        {
          q: 'Jak přidám nebo přejmenuji fázi projektu?',
          a: 'Buď v ⚙️ Nastavení → Fáze projektu, nebo přímo v Úkolech: v rozbalovacím seznamu Fáze zvol "+ Nová fáze…" (fáze se vytvoří a rovnou přiřadí úkolu). Přejmenování v Nastavení se automaticky propíše do všech úkolů. Pořadí fází změníš šipkami ↑↓.',
        },
        {
          q: 'Co ještě jde v Nastavení upravit?',
          a: 'Oblasti projektu (u úkolů a rizik), kategorie rozpočtu, pracovní dny v týdnu, svátky a volné dny (zvýrazní se v kalendáři a nepočítají se do pracovních dnů absencí) a tolerance Health — o kolik % smí progress zaostat, než úkol zoranžoví/zčervená (výchozí 10 % a 25 %, stejně jako v Excelu). Fáze, oblasti a kategorie jsou pro každý projekt zvlášť, kalendář a tolerance společné. Jméno, autosave a počet záloh jsou v sekci Já a ukládání.',
        },
        {
          q: 'Jak přepnu jazyk CZ/EN?',
          a: 'Tlačítko "EN"/"CZ" vpravo nahoře v hlavičce.',
        },
        {
          q: 'Jak zapnu tmavý režim?',
          a: 'Ikona ☀️/🌙 vedle jazyka. Appka si při prvním spuštění odhadne preferenci podle nastavení systému, pak si pamatuje tvou volbu.',
        },
      ],
    },
    {
      title: '🛠️ Řešení problémů',
      items: [
        {
          q: 'Úkol je Blue',
          a: 'Nekonzistentní data (datumy, status vs. progress). Oprav data v tabulce Úkoly — Health se přepočítá automaticky.',
        },
        {
          q: 'Úkol je Red, ale status není "Delayed"',
          a: 'Health je výpočet podle termínů a progressu, ne jen podle statusu. Zkontroluj Aktuální konec a % dokončení oproti očekávanému průběhu.',
        },
        {
          q: 'Po otevření appky nevidím svá data (vidím ukázkový projekt "TMS program")',
          a: 'Buď otevíráš appku poprvé, nebo jinou kopii HTML souboru než obvykle (každá kopie má svou pracovní kopii v prohlížeči). Otevři svůj pracovní soubor přes 💾 Soubor → Otevřít soubor…',
        },
        {
          q: 'Prohlížeč mě při zavírání varuje, že mám neuložené změny',
          a: 'Máš změny, které ještě nejsou v souboru (nemáš propojený soubor, čeká se na autosave, nebo je konflikt). Ulož přes Ctrl+S / 💾 Soubor.',
        },
      ],
    },
    {
      title: '📎 Co appka (zatím) nedělá',
      items: [
        {
          q: 'Jde v appce pracovat víc lidí najednou na stejném projektu?',
          a: 'Živě ne — appka nemá server. Jeden zapisuje do sdíleného souboru, ostatní ho čtou; souběžné uložení appka pozná a nic nepřepíše.',
        },
        {
          q: 'Umí appka import z MS Project?',
          a: 'Připravuje se import MS Project XML (Uložit jako → XML), původní Excel šablony a CSV. Zatím je k dispozici CSV export úkolů.',
        },
      ],
    },
  ],
  EN: [
    {
      title: '🚀 Quick start',
      items: [
        {
          q: 'What is this app?',
          a: 'A web alternative to the Excel PM template — Dashboard, Tasks, Gantt, Milestones, Budget and Risks in one place, including an automatically computed task Health status. Runs entirely in the browser, no install needed.',
        },
        {
          q: 'How do I start my own project?',
          a: 'On the Portfolio page click + New project (phases and areas can be copied from the current project). On first start the app opens a sample project, which you can archive or delete.',
        },
        {
          q: 'Can I have several projects?',
          a: 'Yes. The Portfolio page shows all projects with a RAG status (Red/Amber/Green from task Health, budget, overdue milestones and high risks), progress, next milestone and budget use. Switch projects in the top-left; archive finished ones. The holiday calendar and team absences are shared by all projects.',
        },
        {
          q: 'Where do I change the project name and other basic details?',
          a: 'Dashboard → "Project Information" card → ✏️ Edit. The name also shows in the app header and is the default name of the working file. Save with the Save button or Enter; Esc discards changes.',
        },
        {
          q: 'How do I give this app to a colleague?',
          a: 'Send them the single .html file (email, Teams, USB). Double-clicking opens it in a browser — no install, no admin rights. Everyone keeps data in their own working file; you can share your file for viewing (Open read-only).',
        },
      ],
    },
    {
      title: "💾 Saving, the working file and security",
      items: [
        {
          q: "Where is my data?",
          a: "Primarily in a working file (.pmw.json) you save once via 💾 File → Save to file… (ideally on OneDrive or a network drive, so IT backs it up). From then on the app saves into it automatically a few seconds after each change. The browser only keeps a working copy and backups. Nothing is sent to the internet - all network access is blocked.",
        },
        {
          q: "What does the status in the header mean (Saved / Unsaved / Browser only…)?",
          a: "Saved = the file is up to date. Saving… / Unsaved = a change is waiting for autosave. Browser only = no file linked yet (the yellow bar offers to save). Conflict = someone else changed the file meanwhile. Read-only = you are viewing someone else's file. Ctrl+S saves immediately.",
        },
        {
          q: "What if the browser crashes or is closed by an update?",
          a: "Nothing is lost: each change is written to the browser working copy immediately and to the file within seconds. After a restart the browser may ask for one click on \"Allow and continue\" before the app may write to the file again.",
        },
        {
          q: "How do I share a project with colleagues? Can we work together?",
          a: "One person (the owner) writes to the file, others open it via 💾 File → Open read-only… If someone else saved the file, the app never overwrites their version with yours: it shows a conflict and offers to load the file version, save your changes as a copy, or (deliberately) overwrite. Real-time co-editing is not possible without a server.",
        },
        {
          q: "What are browser backups?",
          a: "The app keeps snapshots of the whole portfolio (at most every 10 minutes and always before risky actions, e.g. opening another file or resolving a conflict). Restore them via 💾 File → Browser backups… The number kept is set in ⚙️ Settings → Me & saving.",
        },
        {
          q: "Can I undo a mistake?",
          a: "Yes - the ↶ ↷ buttons in the header or Ctrl+Z / Ctrl+Y (outside text fields). The last 100 steps since opening the app are kept.",
        },
        {
          q: "I have an older project export (.json). Can I load it?",
          a: "Yes: 💾 File → Open file… and pick it. An older single-project export is added as a new project to the current portfolio (phases, areas, holidays and absences included). Data from the older version kept only in the browser is migrated automatically on first start.",
        },
        {
          q: "Firefox does not offer saving to a file",
          a: "Direct saving to a file (File System Access API) works in Edge and Chrome. In Firefox the app works but saves to the browser only - use 💾 File → Download a copy regularly and open it again via Open file….",
        },
        {
          q: "Is the app safe for a corporate environment?",
          a: "It is a single HTML file, no install, no server. The Content-Security-Policy blocks all network connections, all libraries are inside the file and use permissive licenses (MIT/Apache-2.0). The library list, licenses and SBOM (CycloneDX) are in ❓ → ℹ️ About.",
        },
      ],
    },
    {
      title: '🩺 Health - what the colors mean',
      items: [
        {
          q: "What's the difference between Status and Health?",
          a: 'Status is what you think about a task (Not started / In progress / Done...). Health is what the app computes from dates and percent complete - whether it matches the plan. A task can be "In progress" and still Health = Red if it is significantly behind.',
        },
        { q: 'Green', a: 'OK - either finished cleanly, on track, or not yet started and not behind schedule.' },
        { q: 'Orange', a: 'Warning - mild slippage, an approaching deadline, or progress slightly worse than expected.' },
        { q: 'Red', a: 'Critical - overdue, or actual progress is significantly behind the expected pace.' },
        { q: 'Grey', a: 'Not evaluated - cancelled, on hold, or missing data needed to evaluate it (e.g. no date).' },
        {
          q: 'Blue',
          a: 'Data issue - an inconsistency the app cannot resolve: finish before start, "Done" with a future date, a started task with a future start date, etc. Fix the data in the table first.',
        },
      ],
    },
    {
      title: '📋 Working with the app pages',
      items: [
        {
          q: 'How do I add a new task?',
          a: 'On the Tasks page, click "+ Add task" - a new empty row is added for you to fill in right away.',
        },
        {
          q: 'How does the Gantt and the Week/Month/Quarter switch work?',
          a: 'Bars are colored by Health, the dashed line marks today. The switch changes the timeline granularity above - Week for a detailed view of a few weeks, Month/Quarter for a longer-term overview.',
        },
        {
          q: 'What is linking a milestone to the budget for?',
          a: "A budget line can reference a specific milestone (the \"Linked milestone\" column) - useful when a supplier payment is tied to hitting a milestone in the schedule.",
        },
        {
          q: 'What is the Team page for?',
          a: 'A vacation & business trip plan (the TEAM sheet equivalent). For each absence the app counts workdays (excluding weekends and holidays) and flags ⚠️ when the person owns open tasks running during that time. Absences also show in the Dashboard calendar (violet dot).',
        },
        {
          q: 'How is a milestone amount calculated?',
          a: 'Same as in the Excel: approved project budget × payment trigger %. The percentage total is shown at the bottom of the table and turns amber if it is not 100 %.',
        },
        {
          q: 'How do I export tasks to CSV?',
          a: 'On the Tasks page, the "Export to CSV" button - exports the currently filtered task list (respects the Phase/Status filters).',
        },
      ],
    },
    {
      title: '⚙️ App settings',
      items: [
        {
          q: 'How do I add or rename a project phase?',
          a: 'Either in ⚙️ Settings → Project phases, or right in Tasks: pick "+ New phase…" in the Phase dropdown (the phase is created and assigned to the task at once). Renaming in Settings updates every task automatically. Reorder phases with the ↑↓ arrows.',
        },
        {
          q: 'What else can be changed in Settings?',
          a: 'Project areas (used by tasks and risks), budget categories, working days, holidays & days off (highlighted in the calendar and excluded from absence workday counts) and Health tolerances - how far progress may lag before a task turns amber/red (default 10 % and 25 %, same as the Excel). Phases, areas and categories are per project, the calendar and tolerances are shared. Your name, autosave and backups are under Me & saving.',
        },
        { q: 'How do I switch CZ/EN?', a: 'The "EN"/"CZ" button in the top-right of the header.' },
        {
          q: 'How do I turn on dark mode?',
          a: 'The ☀️/🌙 icon next to the language switch. The app guesses your preference from the system setting on first run, then remembers your choice.',
        },
      ],
    },
    {
      title: '🛠️ Troubleshooting',
      items: [
        {
          q: 'A task is Blue',
          a: 'Inconsistent data (dates, status vs. progress). Fix the data in the Tasks table - Health recalculates automatically.',
        },
        {
          q: 'A task is Red but Status is not "Delayed"',
          a: "Health is computed from dates and progress, not just status. Check Current Finish and Percent Complete against the expected pace.",
        },
        {
          q: 'After opening the app I don\'t see my data (I see the sample "TMS program" project)',
          a: 'Either this is the first start, or you opened a different copy of the HTML file than usual (each copy has its own browser working copy). Open your working file via 💾 File → Open file….',
        },
        {
          q: 'The browser warns me about unsaved changes when closing',
          a: 'Some changes are not in the file yet (no file linked, autosave pending, or a conflict). Save with Ctrl+S / 💾 File.',
        },
      ],
    },
    {
      title: '📎 What the app does not (yet) do',
      items: [
        {
          q: 'Can several people work on the same project at once?',
          a: 'Not live - there is no server. One person writes to the shared file, others read it; the app detects concurrent saves and never overwrites them.',
        },
        {
          q: 'Does it import from MS Project?',
          a: 'Import of MS Project XML (Save as → XML), the original Excel template and CSV is coming. For now a CSV export of tasks is available.',
        },
      ],
    },
  ],
}
