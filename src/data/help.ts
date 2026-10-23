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
      title: "🗓️ Plánování (harmonogram)",
      items: [
        {
          q: "Jak funguje automatické plánování?",
          a: "Jako v MS Projectu: u automaticky plánovaného úkolu (⚙) zadáš dobu trvání v pracovních dnech a předchůdce, termíny dopočítá appka. Počítá jen s pracovními dny a svátky z ⚙️ Nastavení. Když se předchůdce posune, posunou se i následníci. Ručně plánovaný úkol (✋) drží data, která zadáš, ale následníky posouvá. Úkoly převedené ze starší verze jsou ruční, aby se nic samo nepřeplánovalo – tlačítkem „Všechny úkoly plánovat automaticky“ je převedeš.",
        },
        {
          q: "Jak zadám předchůdce?",
          a: "Do sloupce Předchůdci napiš čísla úkolů ze sloupce # oddělená středníkem. Výchozí vazba je FS (konec–začátek). Další typy: SS (začátek–začátek), FF (konec–konec), SF (začátek–konec). Posun v pracovních dnech: +2d = počkat 2 dny, -1d = začít o den dřív. Příklad: 3; 5SS+2d; 7FF-1d. Neplatný zápis se zvýrazní červeně.",
        },
        {
          q: "Co je kritická cesta a rezerva?",
          a: "Rezerva říká, o kolik pracovních dnů se úkol může zpozdit, aniž by se posunul konec projektu. Úkoly s nulovou rezervou tvoří kritickou cestu – v tabulce mají červený proužek, v Ganttu červený obrys, na Kanbanu štítek CP. Hotové úkoly kritické nejsou. Filtr „Jen kritická cesta“ ukáže jen je.",
        },
        {
          q: "Proč se u úkolu objevil 📌?",
          a: "Ručně jsi posunul začátek automatického úkolu (v tabulce nebo tažením v Ganttu). Appka si to pamatuje jako omezení „nezačít dříve než“, stejně jako MS Project. Kliknutím na 📌 omezení zrušíš a úkol se vrátí za předchůdce.",
        },
        {
          q: "Jak vytvořím souhrnný úkol (fázi, balík prací)?",
          a: "Úkoly pod ním odsaď tlačítkem ⇥ nebo klávesami Alt+Shift+→ (⇤ / Alt+Shift+← předsadí zpět, Alt+Shift+↑/↓ posune). Souhrnný úkol bere termíny a % dokončení ze svých podúkolů a vazba na něj platí pro všechny jeho podúkoly. WBS čísla (1, 1.1, …) se počítají sama.",
        },
        {
          q: "Co je baseline a jak sleduji zpoždění?",
          a: "Baseline je uložený snímek termínů (📏 Baseline… v Úkolech). Hlavní baseline se zapíše do sloupců Baseline start/konec a používá ji Health. Sloupec Odchylka ukazuje posun konce proti baseline v pracovních dnech (+ = zpoždění). Uložit můžeš víc baseline (např. po schválení změny) a kteroukoli nastavit jako hlavní.",
        },
        {
          q: "Jak pracuji s Ganttem?",
          a: "Tažením pruhu posuneš úkol, tažením okraje změníš délku, spodním úchytem nastavíš % dokončení. Klik ukáže detail. Přepínač Den/Týden/Měsíc/Rok mění měřítko, Dnes posune na dnešek. Šipky ukazují vazby (typ vazby je v detailu úkolu). Barva pruhu = Health, tmavé pruhy jsou souhrnné úkoly, fialové milníky.",
        },
        {
          q: "K čemu je Kanban?",
          a: "Rychlá změna stavu úkolů přetažením karty do jiného sloupce – myší, nebo klávesnicí (Tab na kartu, Mezerník, šipky, Mezerník). Při přesunu do „Not started“ se % vynuluje a do „Done“ nastaví na 100 %, aby nevznikla chyba dat (Blue).",
        },
        {
          q: "Můžu si uložit vlastní pohled na tabulku?",
          a: "Ano: nastav filtry, řazení (klik na záhlaví) a sloupce (Sloupce ▾) a dej „Uložit pohled…“. Pohledy se ukládají do projektu, takže je uvidí i kolegové, kteří soubor otevřou.",
        },
      ],
    },
    {
      title: "🏛️ Řízení projektu (RAID, změny, historie)",
      items: [
        {
          q: "Co je RAID log?",
          a: "Jeden registr pro Rizika (co se může stát), Issues (co se už děje), Předpoklady (co bereme jako fakt – je potřeba je ověřit), Závislosti (na čem projekt závisí mimo vlastní rozsah) a Rozhodnutí (co, kdo a proč rozhodl). Záložky nahoře filtrují typ; u rizik vyplň strategii (Avoid/Mitigate/Transfer/Accept), opatření, záložní plán a spouštěč.",
        },
        {
          q: "Jak číst mapu rizik?",
          a: "Mapa ukazuje otevřená rizika a issues podle pravděpodobnosti (řádky) a dopadu (sloupce) – stejná matice 4×4 jako v Excelu. Skóre P×I od 9 je červené, od 4 oranžové. Kliknutím na buňku vyfiltruješ tabulku.",
        },
        {
          q: "Jak funguje change request?",
          a: "V záložce Změny založ CR, popiš ho a zapiš dopad v pracovních dnech a penězích. Tlačítko Schválit zapíše tebe jako rozhodujícího a datum, nabídne uložit novou baseline (další zpoždění se pak měří od schváleného plánu) a zapsat rozhodnutí do RAID. Schválené CR navyšují aktuální rozpočet na Rozpočtu, Dashboardu i v Portfoliu.",
        },
        {
          q: "Co je v Historii?",
          a: "Každá změna v projektu: kdo (jméno z ⚙️ Nastavení → Já a ukládání), kdy, co a z jaké hodnoty na jakou. Psaní do jednoho pole do 2 minut je jeden záznam. Termíny, které appka přepočítala sama (automatické plánování), se nezapisují – zapíše se jen tvoje změna, která přepočet vyvolala. Historie je uložená v souboru projektu a jde exportovat do CSV.",
        },
        {
          q: "Proč mi Ctrl+Z smaže i záznam v Historii?",
          a: "Historie odpovídá skutečnému stavu dat: vrácená změna se nikdy nestala, takže v historii nezůstane.",
        },
        {
          q: "Můžu si přejmenovat stavy úkolů?",
          a: "Ano, v ⚙️ Nastavení → Stavy úkolů. Každý stav má pevný význam (Not started, In progress, On hold, Delayed, Cancelled, Done), podle kterého se počítá Health a plánování, takže si můžeš udělat např. „Analýza“ a „Testování“ (oba In progress) a vzorec Health se nemění. Pořadí stavů určuje sloupce Kanbanu. Stav, který používají úkoly, nejde smazat. Stejně tak lze upravit seznam priorit.",
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
          q: 'Co znamenají barvy v Ganttu?',
          a: 'Barva pruhu odpovídá Health úkolu (plná část = hotové %), tmavé pruhy jsou souhrnné úkoly, fialové milníky, červený obrys kritická cesta. Růžové sloupce jsou svátky, šedé víkendy.',
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
      title: "🗓️ Scheduling",
      items: [
        {
          q: "How does automatic scheduling work?",
          a: "Like MS Project: for an auto-scheduled task (⚙) you enter the duration in working days and its predecessors; the app calculates the dates. It counts working days only, using the holidays from ⚙️ Settings. When a predecessor moves, its successors move too. A manually scheduled task (✋) keeps the dates you enter but still moves its successors. Tasks migrated from the older version are manual so nothing gets rescheduled by itself - use \"Auto-schedule all tasks\" to switch them.",
        },
        {
          q: "How do I enter predecessors?",
          a: "In the Predecessors column type task numbers from the # column separated by semicolons. The default link is FS (finish-to-start). Other types: SS, FF, SF. Lag in working days: +2d = wait 2 days, -1d = start one day earlier. Example: 3; 5SS+2d; 7FF-1d. Invalid input is highlighted in red.",
        },
        {
          q: "What are the critical path and slack?",
          a: "Slack is how many working days a task can slip without moving the project finish. Tasks with zero slack form the critical path - a red stripe in the table, a red outline in the Gantt, a CP tag on the board. Finished tasks are never critical. The \"Critical path only\" filter shows just them.",
        },
        {
          q: "Why does a task show 📌?",
          a: "You moved the start of an auto-scheduled task by hand (in the table or by dragging in the Gantt). The app keeps it as a \"start no earlier than\" constraint, like MS Project. Click 📌 to remove it and the task goes back right after its predecessors.",
        },
        {
          q: "How do I create a summary task (phase, work package)?",
          a: "Indent the tasks below it with ⇥ or Alt+Shift+→ (⇤ / Alt+Shift+← outdents, Alt+Shift+↑/↓ moves). A summary takes its dates and % complete from its subtasks, and a link to it applies to all its subtasks. WBS numbers (1, 1.1, …) are calculated automatically.",
        },
        {
          q: "What is a baseline and how do I track slippage?",
          a: "A baseline is a saved snapshot of the dates (📏 Baselines… on Tasks). The primary baseline fills the Baseline start/finish columns and is used by Health. The Variance column shows the finish slip in working days (+ = late). You can keep several baselines (e.g. after an approved change) and make any of them primary.",
        },
        {
          q: "How do I work with the Gantt?",
          a: "Drag a bar to move a task, drag its edge to change the duration, drag the bottom handle to set % complete. Click for details. Day/Week/Month/Year changes the scale, Today jumps to today. Arrows show the links (the link type is in the task detail). Bar colour = Health, dark bars are summaries, purple ones milestones.",
        },
        {
          q: "What is the board for?",
          a: "Changing task status quickly by dragging a card to another column - with the mouse, or the keyboard (Tab to a card, Space, arrows, Space). Moving to \"Not started\" resets % to 0 and \"Done\" sets 100 %, so no data issue (Blue) appears.",
        },
        {
          q: "Can I save my own table view?",
          a: "Yes: set filters, sorting (click a header) and columns (Columns ▾) and choose \"Save view…\". Views are stored in the project, so colleagues opening the file see them too.",
        },
      ],
    },
    {
      title: "🏛️ Governance (RAID, changes, history)",
      items: [
        {
          q: "What is the RAID log?",
          a: "One register for Risks (may happen), Issues (happening now), Assumptions (taken as true - validate them), Dependencies (outside the project) and Decisions (what, who and why). The tabs filter by type; for risks fill in the response (Avoid/Mitigate/Transfer/Accept), mitigation, contingency and trigger.",
        },
        {
          q: "How do I read the risk map?",
          a: "It shows open risks and issues by probability (rows) and impact (columns) - the same 4×4 matrix as the Excel. A P×I score of 9+ is red, 4+ amber. Click a cell to filter the table.",
        },
        {
          q: "How does a change request work?",
          a: "On the Changes tab create a CR, describe it and enter the impact in working days and money. Approve records you as the decision maker and the date, offers to save a new baseline (further slippage is then measured against the approved plan) and to log the decision in RAID. Approved CRs raise the current budget on Budget, Dashboard and Portfolio.",
        },
        {
          q: "What is in the History?",
          a: "Every change in the project: who (name from ⚙️ Settings → Me & saving), when, what and from which value to which. Typing into one field within 2 minutes is one entry. Dates recalculated by the app (auto scheduling) are not logged - only your edit that caused them. The history is stored in the project file and can be exported to CSV.",
        },
        {
          q: "Why does Ctrl+Z also remove the History entry?",
          a: "The history matches the real state of the data: an undone change never happened, so it does not stay in the history.",
        },
        {
          q: "Can I rename task statuses?",
          a: "Yes, in ⚙️ Settings → Task statuses. Each status has a fixed meaning (Not started, In progress, On hold, Delayed, Cancelled, Done) used by Health and scheduling, so you can have e.g. \"Analysis\" and \"Testing\" (both In progress) without changing the Health formula. The order defines the board columns. A status used by tasks cannot be deleted. The priority list can be edited the same way.",
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
          q: 'What do the Gantt colours mean?',
          a: 'Bar colour is the task Health (the solid part = % complete), dark bars are summaries, purple ones milestones, a red outline marks the critical path. Pink columns are holidays, grey ones weekends.',
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
