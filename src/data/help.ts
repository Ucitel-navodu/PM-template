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
          a: 'Appka se spouští s ukázkovými daty. Smaž/přepiš je přímo v tabulkách (Úkoly, Milníky, Rozpočet, Rizika), uprav Informace o projektu na Dashboardu — a je to tvůj projekt. Žádné speciální "nový projekt" tlačítko není potřeba, prostě přepiš data.',
        },
        {
          q: 'Jak appku dostanu ke kolegovi?',
          a: 'Pošli mu jeden .html soubor (mail, Teams, USB). Dvojklikem se otevře v prohlížeči — žádná instalace, žádná admin práva. Každý má svou vlastní nezávislou kopii s vlastními daty.',
        },
      ],
    },
    {
      title: '💾 Ukládání dat a bezpečnost',
      items: [
        {
          q: 'Kde appka ukládá moje data?',
          a: 'V prohlížeči na tomto počítači (tzv. localStorage), navázané na tenhle konkrétní soubor appky. Data se nikam neposílají na internet — appka po otevření nedělá žádné síťové požadavky.',
        },
        {
          q: 'Co se stane, když mi spadne nebo se násilně zavře prohlížeč?',
          a: 'Data se zapisují na disk okamžitě při každé změně, ne až při vypnutí — takže samotný pád nebo vynucené zavření (např. aktualizací) data nezničí.',
        },
        {
          q: 'Tak proč appka hlídá "neuložené změny" a nutí mě exportovat?',
          a: 'Protože existují jiná rizika, která localStorage opravdu smažou: ruční "Vymazat data prohlížení", soukromé/inkognito okno, nebo firemní politika mazající data při zavření prohlížeče. Proti tomu pomůže jen pravidelný export (.json soubor) jako záloha.',
        },
        {
          q: 'Co znamená barva/text "Export: ..." v hlavičce?',
          a: 'Šedá = žádné neuložené změny. Oranžová = máš neexportované změny, ale nedávno. Červená = déle než hodinu beze změn. Je to připomínka, ne blokace — appka navíc varuje i při zavírání záložky, pokud máš neexportováno.',
        },
        {
          q: 'Mám appku otevřenou ve dvou kopiích/souborech (dva projekty) — ovlivní se navzájem?',
          a: 'Ne. Appka si data klíčuje podle cesty/názvu konkrétního souboru, takže každá uložená nebo přejmenovaná kopie má svůj vlastní izolovaný prostor. Je to vyřešené i pro situaci, kdy dvě různé kopie otevřeš ve stejném prohlížeči.',
        },
        {
          q: 'Co přesně dělá Export/Import projektu?',
          a: 'Export uloží celý projekt (info, úkoly, milníky, rozpočet, rizika) do jednoho .json souboru — tím si "vezmeš projekt s sebou" na jiný počítač nebo pošleš kolegovi. Import ten soubor načte zpět a PŘEPÍŠE aktuální data v appce (appka se před tím vždy zeptá, aby ses nespletl).',
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
          q: 'Jak exportuju úkoly do CSV?',
          a: 'Na stránce Úkoly tlačítko "Export do CSV" — vyexportuje aktuálně vyfiltrovaný seznam úkolů (respektuje filtry Fáze/Stav).',
        },
      ],
    },
    {
      title: '⚙️ Nastavení appky',
      items: [
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
          a: 'Buď otevíráš appku poprvé (pak je to v pořádku, ukázková data přepiš svými), nebo otevíráš jinou/novou kopii souboru, než ve které jsi naposledy pracoval(a) — každá kopie má svá vlastní data. Zkus Import a načti svůj poslední exportovaný .json.',
        },
        {
          q: 'Prohlížeč mě při zavírání varuje, že mám neuložené změny',
          a: 'To je žádoucí chování — máš změny, které jsi ještě neexportoval(a). Klikni "Export projektu" a varování zmizí.',
        },
      ],
    },
    {
      title: '📎 Co appka (zatím) nedělá',
      items: [
        {
          q: 'Jde v appce pracovat víc lidí najednou na stejném projektu?',
          a: 'Ne — appka nemá backend, data jsou lokální v prohlížeči. Spolupráce funguje přes Export/Import souboru (podobně jako dřív kopírování .xlsm), ne jako živé sdílení.',
        },
        {
          q: 'Umí appka import z MS Project?',
          a: 'Zatím ne — je k dispozici aspoň CSV export úkolů.',
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
          a: 'The app starts with sample data. Clear/overwrite it directly in the tables (Tasks, Milestones, Budget, Risks), update Project Information on the Dashboard — and it is your project. There is no special "new project" button, just overwrite the data.',
        },
        {
          q: 'How do I give this app to a colleague?',
          a: 'Send them the single .html file (email, Teams, USB). Double-clicking opens it in a browser — no install, no admin rights. Everyone gets their own independent copy with their own data.',
        },
      ],
    },
    {
      title: '💾 Data storage and safety',
      items: [
        {
          q: 'Where does the app store my data?',
          a: 'In the browser on this computer (so-called localStorage), tied to this specific app file. Data is never sent anywhere - the app makes no network requests after opening.',
        },
        {
          q: 'What happens if my browser crashes or gets force-closed?',
          a: 'Data is written to disk immediately on every change, not only on a clean shutdown - so a crash or a forced close (e.g. by an update) does not by itself destroy data.',
        },
        {
          q: 'Then why does the app nag me about "unsaved changes" and exporting?',
          a: 'Because other things genuinely do wipe localStorage: manually clearing browsing data, a private/incognito window, or a corporate policy that clears data on browser close. A regular export (.json file) is the only real safeguard against those.',
        },
        {
          q: 'What does the "Exported: ..." color/text in the header mean?',
          a: 'Grey = no unsaved changes. Amber = you have unexported changes, but recently. Red = more than an hour without exporting. It is a reminder, not a block - the app also warns when closing the tab if you have unexported changes.',
        },
        {
          q: 'I have the app open in two copies/files (two projects) - do they affect each other?',
          a: "No. The app keys its data by this specific file's path/name, so every saved or renamed copy gets its own isolated storage slot - this is handled even when two different copies are opened in the same browser.",
        },
        {
          q: 'What exactly do Export/Import project do?',
          a: 'Export saves the whole project (info, tasks, milestones, budget, risks) into one .json file - that is how you "take the project with you" to another computer or send it to a colleague. Import loads that file back and OVERWRITES the current data in the app (it always asks for confirmation first).',
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
          q: 'How do I export tasks to CSV?',
          a: 'On the Tasks page, the "Export to CSV" button - exports the currently filtered task list (respects the Phase/Status filters).',
        },
      ],
    },
    {
      title: '⚙️ App settings',
      items: [
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
          a: "Either you're opening the app for the first time (that's expected - overwrite the sample data with yours), or you're opening a different/new copy of the file than the one you last worked in - each copy has its own data. Try Import and load your last exported .json.",
        },
        {
          q: 'The browser warns me about unsaved changes when closing',
          a: 'That is expected - you have changes you have not exported yet. Click "Export project" and the warning goes away.',
        },
      ],
    },
    {
      title: '📎 What the app does not (yet) do',
      items: [
        {
          q: 'Can several people work on the same project at once?',
          a: 'No - the app has no backend, data is local to the browser. Collaboration works via Export/Import of a file (similar to how .xlsm used to be copied around), not live sharing.',
        },
        {
          q: 'Does it import from MS Project?',
          a: 'Not yet - a CSV export of tasks is available instead.',
        },
      ],
    },
  ],
}
