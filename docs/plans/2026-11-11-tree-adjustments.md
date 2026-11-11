# Poprawki drzewa po testach na prawdziwych danych

> **For agentic workers:** Task 1–2 dotykają `src/domain/tree-layout/`, więc idą w pełnym trybie (podagent wykonawca i recenzja podagenta, TDD). Task 3–5 wykonuje sam wykonawca w sesji (superpowers:executing-plans).

**Goal:** Cztery uwagi autora po obejrzeniu drzewa na własnych danych (2026-11-11): stała strona partnera w parze, rodzice wyśrodkowani nad dziećmi, pełniejszy węzeł osoby bez obcinania tekstu, podświetlenie najbliższych po zaznaczeniu.

**Spec:** `docs/specs/2026-11-04-mvp-design.md` §6.3, §6.4 (zmienione 2026-11-11).

## Stan prac (2026-11-11)

W toku.

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
