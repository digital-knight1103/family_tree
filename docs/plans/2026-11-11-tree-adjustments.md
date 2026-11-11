# Poprawki drzewa po testach na prawdziwych danych

> **For agentic workers:** Task 1–2 dotykają `src/domain/tree-layout/`, więc idą w pełnym trybie (podagent wykonawca i recenzja podagenta, TDD). Task 3–5 wykonuje sam wykonawca w sesji (superpowers:executing-plans).

**Goal:** Cztery uwagi autora po obejrzeniu drzewa na własnych danych (2026-11-11): stała strona partnera w parze, rodzice wyśrodkowani nad dziećmi, pełniejszy węzeł osoby bez obcinania tekstu, podświetlenie najbliższych po zaznaczeniu.

**Spec:** `docs/specs/2026-11-04-mvp-design.md` §6.3, §6.4 (zmienione 2026-11-11).

## Stan prac (2026-11-11)

**Plan zakończony, drzewo przyjęte przez autora (2026-11-11).** Task 1–4 i 6–8 na `main` i wypchnięte; zmiany w `src/domain/tree-layout/` (Task 1–2, 6, odstęp z Task 8) przez podagenta z recenzją („Approved”), reszta w sesji. Pełna weryfikacja z CLAUDE.md zielona. Bez osobnego tagu: zmiany wchodzą w przegląd końcowy fazy 6 (`git diff faza-5..HEAD`).

**Rozwiązanie:** pozycje x liczy własny `placement.ts` (minimalizacja kwadratu odchylenia punktu związku od środka dzieci, partnerzy jako sztywna para; odstęp 40 px w parze, 104 px między pozostałymi sąsiadami; deterministycznie); ELK z `nodePlacement INTERACTIVE` tylko prowadzi linie. Kolory podświetlenia: rodzice fiolet, rodzeństwo zieleń, partnerzy bursztyn, dzieci turkus.

**Kompromis wyśrodkowania (do pokazania autorowi):** gdy obie osoby z pary mają rodziców w drzewie, dwie pary rodziców potrzebują więcej miejsca niż para dzieci; każda strona przesuwa się wtedy na zewnątrz po równo (np. 152 px przy dwóch jedynakach i odstępie 104 px). Tak samo przy szerszych sąsiednich gałęziach. Osoba z dwoma partnerami: linia do dzieci z pierwszego związku zawsze przecina niższą linię do drugiego związku. Osoba z dwoma partnerami i dzieckiem z każdym związkiem: przy odstępach 40 i 104 px punkty związków odchylają się o 16 px od dzieci (przerwa między dwoma partnerami jest dokładnie 104 px, a przyrodnie rodzeństwo potrzebuje więcej).

**Kroki na start planu 04 (faza 6: wyszukiwarka i „Do sprawdzenia”)**, po „dalej” od autora:

1. Przeczytać CLAUDE.md, spec §6.7 i §6.8 oraz „Stan prac” planów 03 i tego planu.
2. Napisać plan `docs/plans/<data>-mvp-04-search-review.md` (superpowers:writing-plans) wprost ze specyfikacji, bez rundy pytań; commit i push.
3. Wykonywać w trybie z CLAUDE.md od fazy 6: zadania w sesji, po każdym `pnpm lint && pnpm typecheck && pnpm test`, commit i push na `main`; zadania w `src/domain/`, `src/data/`, `vite-plugins/`, `src/stores/family.ts` przez podagenta z recenzją; e2e tylko na koniec fazy.
4. Koniec fazy: pełna weryfikacja z CLAUDE.md, przegląd końcowy świeżym podagentem na `git diff faza-5..HEAD` (obejmuje też poprawki drzewa z tego planu), poprawki, tag `faza-6` i `git push origin faza-6`, krótkie podsumowanie, czekanie na „dalej”.
5. Dług techniczny do rozważenia przy okazji: plan 03 („Dług techniczny”, `family-edits.ts`), ten plan (niżej), plan 01 („Odłożone na kolejne plany”).

**Dług techniczny** (drobne uwagi z recenzji, `src/domain/tree-layout/`, pełny tryb):

1. `placement.ts`: skrajne dzieci rodziny wybierane po indeksie w rzędzie także wtedy, gdy dzieci są w różnych rzędach (np. ciotka i siostrzeniec jako para); porównywać tylko w najbliższym rzędzie.
2. Dwa węzły ELK zaplanowane w tym samym x (np. zdublowany związek tej samej pary) ELK rozsuwa o 8 px; wyśrodkowanie przesuwa się o kilka pikseli. Ewentualnie test utrwalający zachowanie.
3. `placement.ts`: słabe przyciąganie łączy też sąsiednie osobne grupy w rzędzie (efekt < 1 px); pomijać pary z różnych grup.
4. Współrzędne niecałkowite (np. `227.9999977905`); zaokrąglać do 0,01 px.
5. `layout.ts`: `sizeOf` typuje parametr jako `LayoutOptions['personWidth']`, choć służy też wysokości; scalić dwa komentarze o wysokości rzędu.
6. `placement.ts`: brak testów dla kolejności X, A, Y (dwie przerwy 40 px) i dla partnera partnera; gdy X i Y też są parą, punkty związków A–Y i X–Y mają to samo x (rzadkie). Przy różnicy szerokości partnerów powyżej 80 px środek pary wypada pod szerszym partnerem (kosmetyka).

## Global Constraints

- Jak w planach 01–03 (TS strict, polski UI, alias `@/`, LF, praca na `main`, hook `pre-push` bez omijania).
- Układ zostaje deterministyczny. Wszystkie dotychczasowe testy układu przechodzą albo zmieniają się świadomie, z opisem w commicie.
- Dane testowe są wymyślone (`buildFamily`), nigdy z `data/family/`.

### Task 1: Osoba z rodziny po lewej, partner po prawej (domena, podagent)

**Files:** `src/domain/tree-layout/row-order.ts`, `row-order.spec.ts` (i `layout.spec.ts`, jeśli trzeba).

- W bloku partnerów osoba, która ma rodziców w drzewie, stoi po lewej, a partner bez rodziców po prawej. Osoba z kilkoma partnerami: wszyscy partnerzy po prawej, w kolejności związków (deterministycznie).
- Gdy rodziców mają oboje albo żadne z pary, kolejność wynika z reszty układu (jak dotąd), ale zawsze deterministycznie.
- Zastępuje to dotychczasowe zachowanie, w którym partner trafiał na zewnętrzną stronę skrajnego rodzeństwa.
- Testy: rodzeństwo A, B (rodzice wspólni), A + X i B + Y bez rodziców: rząd `A X B Y`; para, w której rodziców ma kobieta, i para, w której rodziców ma mężczyzna; osoba z dwoma partnerami.

### Task 2: Rodzice wyśrodkowani nad dziećmi i szerokość węzła (domena, podagent)

**Files:** `src/domain/tree-layout/layout.ts`, `layout.spec.ts`, `index.ts`.

- Punkt związku (albo samotny rodzic) stoi nad środkiem grupy swoich dzieci: środek między `centerX` skrajnego lewego i skrajnego prawego dziecka (same dzieci, bez ich partnerów).
- Gdy pełne wyśrodkowanie jest niemożliwe (szersze gałęzie, nakładanie), kompromis: najmniejsze odchylenie bez nakładania węzłów i bez zmiany kolejności w rzędzie. Raport podagenta opisuje, kiedy kompromis występuje, żeby wykonawca pokazał go autorowi.
- Szerokość węzła osoby zależy od treści: `layoutTree(graph, options?: { personWidth?: (personId: string) => number })`; brak opcji albo wartość mniejsza niż `PERSON_NODE.width` daje `PERSON_NODE.width`. Każdy `PositionedNode` ma swoją `width`. `PERSON_NODE = { width: 200, height: 72 }` (trzy linie tekstu).
- Testy: rodzeństwo z partnerami (przypadek z Task 1) ma punkt rodziców nad środkiem między rodzeństwem; para z dwójką dzieci ma punkt związku między dziećmi; samotny rodzic nad środkiem dzieci; tolerancja 1 px tam, gdzie wyśrodkowanie jest możliwe; brak nakładania węzłów przy różnych szerokościach.

### Task 3: Węzeł osoby w trzech liniach (sesja)

**Files:** `src/features/tree/person-node-view.ts`, `PersonNode.vue`, `useTreeLayout.ts`, `useTreeNavigation.ts`, specy obok.

- Linie: imiona; nazwisko z „z d. …”; daty krótko (`formatGenDateInput`): „12.03.1990 – 05.11.2020”, „ok. 1890”, „03.1921”, „? – 1950”, „1890 – ?”.
- Bez `truncate`. Szerokość z pomiaru tekstu (canvas `measureText` z czcionką węzła, w testach przybliżenie z liczby znaków), przekazana do `layoutTree` przez `personWidth`. Węzeł i centrowanie używają szerokości z układu.

### Task 4: Podświetlenie najbliższych (sesja)

**Files:** `src/features/tree/` (węzeł, `to-flow.ts` albo `TreeCanvas.vue`), specy obok.

- Po zaznaczeniu osoby: rodzice, rodzeństwo, partnerzy i dzieci dostają delikatne tło, każda grupa w swoim odcieniu (także w trybie ciemnym). Pozostałe węzły i krawędzie lekko przygasają. Bez zaznaczenia wygląd jak dotąd.

### Task 5: Weryfikacja i pokaz

- Pełna weryfikacja z CLAUDE.md (z e2e), aktualizacja „Stan prac”, serwer dev dla autora i opis kompromisu wyśrodkowania, jeśli wystąpił.

### Task 6: Miejscowość urodzenia i odstęp w rzędzie (domena, podagent)

Uwagi autora po obejrzeniu Task 1–4 (2026-11-11).

**Files:** `src/domain/tree-layout/layout.ts`, `placement.ts`, specy obok, `index.ts`.

- `layoutTree(graph, { personWidth?, personHeight? })`: wysokość węzła osoby z treści; brak albo mniej niż `PERSON_NODE.height` daje `PERSON_NODE.height`. Każdy `PositionedNode` ma swoją `height`; rzędy się nie nakładają, linie wychodzą z dolnej krawędzi węzła i kończą się na górnej krawędzi dziecka.
- Odstęp między węzłami w rzędzie 104 px (przycisk „+ rodzeństwo” ma 91 px, „+ partner” 68 px, oba 4 px od węzła), także między partnerami.

### Task 7: Linia z miejscowością urodzenia (sesja)

**Files:** `src/features/tree/person-node-view.ts`, `node-width.ts`, `PersonNode.vue`, `useTreeLayout.ts`, specy obok.

- Czwarta linia: ikona `MapPin` (`@lucide/vue`) i `birth.place`, mniejsza czcionka; brak miejscowości: brak linii. Szerokość liczona jak dotąd z trzech linii; miejscowość zawija się po słowach, a wysokość (z pomiaru zawinięcia) idzie do `layoutTree` przez `personHeight`.

### Task 8: Para bliżej i przyciski „+” nad i pod węzłem

Uwagi autora (2026-11-11). Odstęp między partnerami 40 px (domena, podagent; pozostałe sąsiednie węzły 104 px). Przyciski „+” w sesji: nad węzłem „rodzeństwo” i „rodzic”, pod węzłem „dziecko” i „partner”, nigdy z boków.
