# MVP 04: Wyszukiwarka i „Do sprawdzenia”

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans (Task 2–4 w sesji) i superpowers:subagent-driven-development (Task 1, domena). Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Pole wyszukiwania w pasku górnym (skrót `/` i `Ctrl+K`) i przycisk „Do sprawdzenia · N” otwierający w panelu bocznym listę osób z niepotwierdzonymi faktami albo nieznanych; wybór osoby zaznacza ją, centruje widok i otwiera kartę.

**Architecture:** Czysta domena: `src/domain/review.ts` zwraca osoby do sprawdzenia z powodami w postaci struktur (bez tekstów UI), `comparePersonsByName` w `src/domain/person-search.ts` ustala kolejność na obu listach. Feature `src/features/search/` (wyniki i `SearchBox.vue` w pasku) i `src/features/research/` (tekst powodów, `ReviewButton.vue`, `ReviewList.vue`, zgodnie ze spec §10.2). Panel boczny dostaje widok `review` w `src/stores/panel.ts` i jedno wejście `openCard(personId, { fromReview })`, z którego korzystają oba feature'y.

**Tech Stack:** jak w planach 01–03 (Vue 3, Pinia, Vitest, Playwright, shadcn-vue `input`, `button`).

**Spec:** `docs/specs/2026-11-04-mvp-design.md` (§6.2 pasek górny, §6.7, §6.8, §9 pkt 6, §10.2)

## Stan prac (2026-11-11)

Plan napisany, wykonanie od Task 1.

## Global Constraints

- Jak w planach 01–03 (TS strict, polski UI, alias `@/`, LF, `tests/fixtures/`, praca na `main`, hook `pre-push` bez omijania). Tryb pracy z CLAUDE.md od fazy 6: Task 1 przez podagenta z recenzją, reszta w sesji; po każdym zadaniu `pnpm lint && pnpm typecheck && pnpm test`, commit i push; e2e tylko w Task 4.
- `src/domain/` importuje względnie z `.ts`, bez Vue.
- Wyszukiwanie: `matchesQuery` bez zmian (początki słów, bez wielkości liter i polskich znaków). Najwyżej **10** wyników.
- Teksty dokładnie: przycisk „Do sprawdzenia · N”; pole `aria-label` „Szukaj osoby”, placeholder „Szukaj osoby… (/)”; brak wyników „Brak wyników”; nagłówek listy „Do sprawdzenia”; pusta lista „Nic do sprawdzenia.”; powrót z karty „Wróć do listy”.
- Powody (Task 3): nieznana osoba „brak imienia i nazwiska”; fakt urodzenia: data i miejsce „data i miejsce urodzenia do potwierdzenia”, sama data „data urodzenia do potwierdzenia”, samo miejsce „miejsce urodzenia do potwierdzenia”, ani data, ani miejsce „urodzenie do potwierdzenia”; śmierć analogicznie („…śmierci…”, „śmierć do potwierdzenia”); związek „małżeństwo do potwierdzenia (Imię Nazwisko)” / „związek do potwierdzenia (Imię Nazwisko)”, partner nieznany z etykietą nieznanego („Nieznana”).
- Wyszukiwarka i lista działają też w demo i w buildzie (tylko odczyt).

## Review Focus

1. **`/` wpisane w polu tekstowym** (biografia, imię, pole wyszukiwania) jest zwykłym znakiem, nie skokiem do wyszukiwarki. Test w Task 2.
2. **Kliknięcie na liście osoby, która już jest zaznaczona**, przełącza panel z listy na kartę (zaznaczenie się nie zmienia, więc `watch` nie zadziała). Test w Task 3.
3. **Lista na żywo:** odznaczenie „do potwierdzenia” albo wpisanie imienia osobie nieznanej usuwa ją z listy i zmniejsza licznik; usunięcie osoby nie psuje listy. Test w Task 3.
4. **Zapytanie z samych spacji albo znaków bez liter** („ - ”) nic nie znajduje i nie rzuca; „Wiśniewska”, „wisniewska” i „WIŚNIEWSKA” dają ten sam wynik; „ł” w zapytaniu i w nazwisku. Test w Task 2.
5. **Wybór wyniku wyszukiwania, gdy panel pokazuje listę albo formularz edycji** innej osoby: otwiera się karta wybranej osoby, bez przycisku „Wróć do listy”. Test w Task 2.

---

### Task 1: Osoby do sprawdzenia i kolejność po nazwisku (domena, podagent)

**Files:**
- Create: `src/domain/review.ts`, `src/domain/review.spec.ts`
- Modify: `src/domain/person-search.ts`, `src/domain/person-search.spec.ts`

**Interfaces:**
- Produces:
  ```ts
  // review.ts
  export type ReviewReason =
    | { kind: 'unknown' }
    | { kind: 'fact'; fact: 'birth' | 'death'; hasDate: boolean; hasPlace: boolean }
    | { kind: 'union'; unionId: string; partnerId: string; unionType: Union['type'] }
  export interface ReviewEntry { personId: string; reasons: ReviewReason[] }
  export function reviewEntries(data: FamilyData): ReviewEntry[]
  // person-search.ts
  export function comparePersonsByName(a: Person, b: Person): number
  ```
- `reviewEntries`: osoby w kolejności `data.persons`, tylko z co najmniej jednym powodem. Powody w kolejności: `unknown` (`isUnknownPerson`), `birth`, `death` (gdy `unconfirmed === true`; `hasPlace` po `trim()`), potem związki w kolejności `data.unions`, w których osoba jest partnerem i `start.unconfirmed === true` (ten sam związek u obu partnerów). Związek z partnerem, którego nie ma w `persons`, jest pomijany.
- `comparePersonsByName`: nieznane osoby na końcu; potem `surname`, potem `givenNames` przez `localeCompare(…, 'pl', { sensitivity: 'base' })` po `trim()`; remis po `id`.

- [ ] **Step 1: Testy `review.spec.ts`** (dane z `buildFamily`):
  - `it('osoba bez imion i nazwiska ma powód unknown')`: `[{ kind: 'unknown' }]`.
  - `it('niepotwierdzone urodzenie podaje, czy jest data i miejsce')`: `birth: { date: { year: 1890 }, place: '  ', unconfirmed: true }` → `{ kind: 'fact', fact: 'birth', hasDate: true, hasPlace: false }`; drugi przypadek z samym miejscem.
  - `it('niepotwierdzony początek związku trafia do obu partnerów')`: obie osoby mają `{ kind: 'union', unionId: 'u_1', partnerId: <drugi>, unionType: 'marriage' }`.
  - `it('unconfirmed false i brak flagi nie trafiają na listę')`: wynik `[]`.
  - `it('kolejność osób jak w danych, powodów: unknown, birth, death, związki')`.
  - `it('pomija związek z nieistniejącym partnerem')`.
- [ ] **Step 2: Testy `comparePersonsByName`**: `['Lis', 'Łukasik', 'Mazur']` po nazwisku (ł po l); to samo nazwisko → po imionach; wielkość liter bez znaczenia; nieznana osoba po wszystkich; remis po `id`.
- [ ] **Step 3: Uruchom** `pnpm test src/domain`, Expected: FAIL (brak funkcji).
- [ ] **Step 4: Implementacja** według Interfaces.
- [ ] **Step 5: Uruchom** `pnpm lint && pnpm typecheck && pnpm test`, Expected: PASS.
- [ ] **Step 6: Recenzja podagenta**, poprawki, potem commit i push `feat(domain): review entries and name ordering`.

### Task 2: Wyszukiwarka w pasku górnym (sesja)

**Files:**
- Create: `src/features/search/search-results.ts` (+ spec), `src/features/search/SearchBox.vue` (+ spec), `src/features/search/index.ts`
- Modify: `src/stores/panel.ts` (+ spec), `src/app/App.vue`

**Interfaces:**
- Consumes: `matchesQuery`, `comparePersonsByName` (Task 1), `personNodeView` z `@/features/tree`.
- Produces:
  - `searchResults(data: FamilyData, query: string, limit = 10): PersonLinkResult[]`, `interface PersonLinkResult { personId: string; displayName: string; lifeSpan: string }`; filtr `matchesQuery`, kolejność `comparePersonsByName`.
  - `usePanelStore()`: dotychczasowe + `openCard(personId: string, opts?: { fromReview?: boolean }): void` (wywołuje `selection.focus`, potem jawnie zeruje tryb, bo przy tej samej osobie `watch` nie zadziała, i ustawia `returnToReview = opts?.fromReview ?? false`), `openReview(): void`, `close(): void` (zeruje tryb i flagę, `selection.select(null)`), `canReturnToReview: ComputedRef<boolean>` (flaga i `view.kind === 'card'`). `PanelView` dostaje `{ kind: 'review' }`; tryb `review` wygrywa z zaznaczeniem. Zmiana zaznaczenia (np. klik węzła) zeruje tryb i flagę jak dotąd.
  - `SearchBox.vue` (bez propsów): `role="combobox"`, lista `role="listbox"` z `role="option"` (imię i nazwisko, obok lata); strzałki, `Enter`, klik; `Escape` czyści i zamyka. Wybór: `panel.openCard(id)`, pole czyszczone. Globalny `keydown`: `Ctrl+K` / `Meta+K` (z `preventDefault`) zawsze, `/` tylko gdy cel nie jest `input`, `textarea`, `select` ani `contenteditable`.
  - `App.vue`: `SearchBox` w pasku, gdy `store.data` ma osoby; „Zamknij” w `SidePanel.vue` woła `panel.close()`.

- [ ] **Step 1: Testy `search-results.spec.ts`**: `'wisniewska'`, `'Wiśniewska'` i `'WIŚNIEWSKA'` znajdują „Ewa Wiśniewska”; `'lukasik'` znajduje „Łukasik”; `'   '` i `' - '` → `[]`; wyniki po nazwisku; `limit` 10 przy 12 pasujących.
- [ ] **Step 2: Testy `panel.spec.ts`**: `openReview` daje `{ kind: 'review' }` także bez zaznaczenia; `openCard` z widoku `review` dla osoby już zaznaczonej daje `card`; `openCard(id, { fromReview: true })` ustawia `canReturnToReview`, `openEdit` i `showCard` go nie zdejmują, klik innej osoby (`selection.select`) zdejmuje; `close` zamyka panel.
- [ ] **Step 3: Testy `SearchBox.spec.ts`**: wpisanie pokazuje opcje z latami; `ArrowDown` + `Enter` → zaznaczona osoba i `panel.view.kind === 'card'`, pole puste; „Brak wyników”; `Escape` zamyka listę; `/` na `document.body` ustawia fokus w polu, `/` w zamontowanym `textarea` nie; `Ctrl+K` ustawia fokus; wybór wyniku, gdy panel jest w `review` albo `edit` innej osoby → `card` wybranej, `canReturnToReview === false`.
- [ ] **Step 4: Uruchom** `pnpm test src/features/search src/stores`, Expected: FAIL.
- [ ] **Step 5: Implementacja** według Interfaces (kontrolka `Input` z `@/components/ui/input`, lista pozycjonowana `absolute` pod polem).
- [ ] **Step 6: Uruchom** `pnpm lint && pnpm typecheck && pnpm test`, Expected: PASS.
- [ ] **Step 7: Commit i push** `feat(search): person search in the top bar`.

### Task 3: Lista „Do sprawdzenia” w panelu bocznym (sesja)

**Files:**
- Create: `src/features/research/review-view.ts` (+ spec), `src/features/research/ReviewButton.vue`, `src/features/research/ReviewList.vue` (+ spec), `src/features/research/index.ts`
- Modify: `src/app/App.vue`, `src/app/SidePanel.vue`

**Interfaces:**
- Consumes: `reviewEntries`, `comparePersonsByName` (Task 1), `usePanelStore().openReview / openCard / canReturnToReview` (Task 2), `personNodeView`.
- Produces:
  - `reviewView(data: FamilyData): ReviewItemView[]`, `interface ReviewItemView { personId: string; displayName: string; lifeSpan: string; reasons: string[]; note: string }`; teksty powodów jak w Global Constraints; `note` to pierwsza niepusta linia `researchNotes` po `trim()` (albo `''`); kolejność `comparePersonsByName`.
  - `ReviewButton.vue`: „Do sprawdzenia · N” (N = długość `reviewView`), klik `panel.openReview()`; w pasku obok wyszukiwarki, gdy `store.data` ma osoby.
  - `ReviewList.vue`: nagłówek, pozycje jako przyciski (`data-testid="review-item"`): nazwa i lata, powody, notatka wyszarzona; klik `panel.openCard(id, { fromReview: true })`; pusta lista „Nic do sprawdzenia.”.
  - `SidePanel.vue`: widok `review` renderuje `ReviewList`; w karcie przy `canReturnToReview` przycisk „Wróć do listy” (`panel.openReview()`).

- [ ] **Step 1: Testy `review-view.spec.ts`**: każdy tekst powodu z Global Constraints (cztery warianty urodzenia, jeden śmierci, małżeństwo, związek, partner nieznany „Nieznana”, nieznana osoba); `note` z `'\n  Sprawdzić księgi.\nDruga linia'` → `'Sprawdzić księgi.'`; kolejność po nazwisku, nieznani na końcu.
- [ ] **Step 2: Testy `ReviewList.spec.ts`** (Pinia z danymi): pozycje z powodami; klik pozycji osoby już zaznaczonej przełącza panel na `card` z `canReturnToReview`; po `family.update` zdejmującym `unconfirmed` pozycja znika, a licznik `ReviewButton` spada o 1; po usunięciu osoby lista się renderuje bez niej; pusta lista pokazuje „Nic do sprawdzenia.”.
- [ ] **Step 3: Uruchom** `pnpm test src/features/research`, Expected: FAIL.
- [ ] **Step 4: Implementacja** według Interfaces.
- [ ] **Step 5: Uruchom** `pnpm lint && pnpm typecheck && pnpm test`, Expected: PASS.
- [ ] **Step 6: Commit i push** `feat(research): review list in the side panel`.

### Task 4: E2e, dokumentacja i koniec fazy 6

**Files:**
- Create: `tests/e2e/search-review.spec.ts`
- Modify: `CLAUDE.md` („Struktura”: `src/features/search/`, `src/features/research/`, widok `review` w `panel.ts`), `docs/plans/2026-11-04-mvp-01-foundation.md` (mapa planów: 04 zakończony), „Stan prac” tego planu i planu 03a

- [ ] **Step 1: Testy e2e** (dane seed przez `resetDataDir('seed-copy')`):
  - `test('wyszukiwarka zaznacza, centruje i otwiera kartę')`: `/`, „zielinska” → dwie opcje (Barbara, Marta Zielińska), `Enter` na drugiej, węzeł `data-selected="true"` blisko środka płótna (jak w `editor.spec.ts`), panel z kartą.
  - `test('Do sprawdzenia: licznik, powody, przejście do karty i powrót')`: „Do sprawdzenia · 5”; pozycja Stefana Lisa z „data i miejsce urodzenia do potwierdzenia” i „Miejsce urodzenia znane tylko z rodzinnych opowieści. Sprawdzić księgi parafialne.”; „brak imienia i nazwiska”; klik → karta i zaznaczony węzeł; „Wróć do listy” wraca do listy.
  - `test('demo: wyszukiwarka i lista działają')`: `resetDataDir('empty')` (demo z belką), `Ctrl+K` i wybór wyniku działają.
- [ ] **Step 2: Uruchom** `pnpm test:e2e`, Expected: PASS.
- [ ] **Step 3: Dokumentacja** (pliki z listy) i pełna weryfikacja z CLAUDE.md, Expected: wszystko PASS.
- [ ] **Step 4: Commit i push** `test(search): e2e for search and review list` (+ `docs:`).
- [ ] **Step 5: Przegląd końcowy** świeżym podagentem na `git diff faza-5..HEAD` (obejmuje też plan 03a); istotne uwagi naprawione z testami (domena przez podagenta z recenzją).
- [ ] **Step 6: Tag** `git tag -a faza-6 -m "Faza 6: wyszukiwarka i Do sprawdzenia"` i `git push origin faza-6`. **Zatrzymaj się:** krótkie podsumowanie dla autora i czekanie na „dalej”.

**Dług techniczny** (z planów 01, 03, 03a) zostaje na później; nie wchodzi w zakres tego planu.
