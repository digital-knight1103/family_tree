# CLAUDE.md

## Projekt

Drzewo Rodzinne: prywatna, lokalna aplikacja (Vue 3 + TypeScript) do budowania i przeglądania drzewa genealogicznego rodziny autora. Interfejs wyłącznie po polsku. Specyfikacja: [docs/specs/2026-11-04-mvp-design.md](docs/specs/2026-11-04-mvp-design.md), plany: [docs/plans/](docs/plans/), decyzje: [docs/decisions/](docs/decisions/). Stan prac: mapa planów w [docs/plans/2026-11-04-mvp-01-foundation.md](docs/plans/2026-11-04-mvp-01-foundation.md) i sekcja „Stan prac” na górze każdego planu (tam też kroki na wznowienie).

## Komendy

- `pnpm dev`: serwer deweloperski
- `pnpm test`: testy jednostkowe (Vitest); `pnpm test:watch` w trybie obserwacji
- `pnpm test:e2e`: testy Playwright (na tymczasowym folderze danych, nigdy na prawdziwych danych)
- `pnpm lint`, `pnpm format:check` (`pnpm format` naprawia), `pnpm typecheck`, `pnpm build`
- `pnpm validate:data`: walidacja `family.json` w folderze danych (`--seed`: danych demo)
- `pnpm check:leaks`: po `pnpm build` sprawdza, że repo nie śledzi danych rodziny ani zdjęć, a `dist/` zawiera wyłącznie dane demo (w CI z kanarkiem w `data/family/`)
- `pnpm verify:push`: to, co uruchamia hook `pre-push` (build, `check:leaks`, lint, typecheck, testy jednostkowe)

## Struktura

- `src/app/`: start aplikacji, router, główny komponent
- `src/domain/`: model, daty, relacje, układ drzewa (czysty TS, bez Vue)
- `src/domain/tree-layout/`: układ drzewa (pokolenia, graf, kolejność w rzędach, pozycje x w `placement.ts`; elkjs tylko prowadzi linie)
- `src/data/`: dostęp do danych (`repository.ts`; HTTP w dev, statyczny seed w buildzie) i kolejka zapisów
- `src/features/<x>/`: funkcje (drzewo, osoba, edytor, wyszukiwarka, do sprawdzenia)
- `src/features/tree/`: drzewo (płótno Vue Flow, węzeł osoby i jego rozmiar z pomiaru tekstu w `node-size.ts`, podświetlenie najbliższych w `highlight.ts`, nawigacja, przyciski „+”)
- `src/features/person/`: karta i edycja osoby, relacje, zdjęcie, usuwanie
- `src/features/editor/`: dodawanie krewnych, łączenie z istniejącą osobą
- `src/features/search/`: wyszukiwarka w pasku (`/`, `Ctrl+K`); `src/features/research/`: lista „Do sprawdzenia” (powody z `src/domain/review.ts`)
- `src/app/SidePanel.vue`: panel boczny (karta, edycja, dodawanie, lista „Do sprawdzenia”)
- `src/stores/`: store rodziny (Pinia); dane zmienia się wyłącznie przez `update(...)`
- `src/stores/selection.ts`: zaznaczona osoba i oczekujące wyśrodkowanie; `src/stores/panel.ts`: widok panelu (`openCard`, `openReview`, powrót do listy); `src/stores/photos.ts`: adresy, upload i usuwanie zdjęć
- `src/components/ui/` (shadcn-vue; CLI tu nie działa, komponenty dopisywane ręcznie we wzorze reka-nova), `src/shared/`, `src/styles/`
- `tests/e2e/`: testy Playwright; `tests/fixtures/`: dane i pomocniki testowe (alias `@tests/`)
- `data/seed/`: wymyślona rodzina demo; `data/family/`: prawdziwe dane (ignorowane)
- `vite-plugins/`: wtyczka danych tylko dla `pnpm dev` (endpointy `/__data`, zapis atomowy, kopie w `.backups/`, rewizje)
- `scripts/`, `docs/{specs,plans,decisions}/`

## Konwencje

- TypeScript `strict`, Vue Composition API z `<script setup lang="ts">`.
- Nazwy: komponenty `PascalCase.vue`, composables `useCamelCase.ts`, reszta `kebab-case`. Testy jednostkowe obok pliku (`*.spec.ts`).
- Importy w `src/` przez alias `@/`. Wyjątek: `src/domain/` (bez plików spec), `vite-plugins/` i `scripts/` importują względnie z rozszerzeniem `.ts`, bo ładują je narzędzia Node (tsx, config Vite). Wyjątek od wyjątku: `src/domain/tree-layout/` importuje resztę domeny przez `@/domain/...` (rodzeństwo przez `./x`), bo ładują go tylko Vite i Vitest. Zakaz `../` wychodzącego poza folder (ESLint). Feature eksportuje API przez `index.ts`, import `@/features/<x>/<wnętrze>` spoza feature'a jest zabroniony.
- Końce linii LF. Bez luźnych plików w korzeniu, martwego kodu i zakomentowanych bloków.
- Dane i pomocniki wyłącznie testowe trafiają do `tests/fixtures/`, nigdy do `src/`.
- Przed użyciem API biblioteki sprawdź je w Context7.
- TypeScript przypięty do `~6.0` (TS 7 psuje `vue-tsc`).
- Stałe teksty: konflikt „Dane zmieniły się w innej karcie, odśwież”; belka demo „To są dane przykładowe. Zmiany nie są zapisywane.” z przyciskiem „Rozpocznij własne drzewo”.

## Zasady danych

- Nigdy nie commituj `data/family/` ani zdjęć rodziny. Folder jest w `.gitignore`.
- Testy zapisu działają wyłącznie na folderach tymczasowych, nigdy na `data/family/`.
- Seed (`data/seed/demo-family.json`) zawiera wyłącznie wymyślone osoby.
- Build produkcyjny osadza tylko seed. Ścieżkę danych zmienia `FAMILY_DATA_DIR` (wzór w `.env.example`).

## Workflow

- Pracujemy wyłącznie na `main`: bez gałęzi feature i bez PR (od fazy 4; fazy 1–3 szły przez PR #1–#3).
- Tryb pracy od fazy 6 (plan 04 i dalej):
  - Zadania wykonuje sam wykonawca w tej sesji (superpowers:executing-plans), bez podagenta i bez recenzji po każdym zadaniu.
  - Po każdym zadaniu: `pnpm lint && pnpm typecheck && pnpm test`, potem commit bezpośrednio na `main` (Conventional Commits) i `git push`. Testy e2e (`pnpm test:e2e`) tylko na koniec fazy.
  - TDD zostaje dla logiki (`src/domain/`, zapis danych). Dla komponentów wyglądu testy tam, gdzie mają sens.
  - Zadanie, które dotyka zapisu danych (`src/data/`, `vite-plugins/`, `src/stores/family.ts`) albo `src/domain/`, idzie w pełnym trybie: podagent wykonawca i recenzja podagenta po zadaniu (superpowers:subagent-driven-development).
- Fazy 1–5: po każdym zadaniu, które przeszło recenzję podagenta i testy, commit bezpośrednio na `main` (Conventional Commits) i `git push`.
- Hook `pre-push` (simple-git-hooks, instalowany przez `prepare` przy `pnpm install`) uruchamia `pnpm verify:push`: build, `check:leaks`, lint, typecheck, testy jednostkowe. Push nie przechodzi, jeśli coś się nie zgadza. Nie omijaj go (`--no-verify`, `SKIP_SIMPLE_GIT_HOOKS`) bez zgody autora.
- Na koniec fazy: przegląd końcowy przez świeżego podagenta (nie przez wykonawcę) na różnicy od poprzedniego tagu (`git diff faza-<N-1>..HEAD`), istotne uwagi naprawione z testami, potem tag `faza-N` na `main`, `git push origin faza-N`, podsumowanie dla autora i czekanie na „dalej”.
- Tagi faz: `faza-1`, `faza-2`, `faza-3`, … (lekkie lub opisane, zawsze wypchnięte na `origin`).
- Nigdy nie pushuj niczego z `data/family/` ani plików `.env`.
- Przed ogłoszeniem ukończenia uruchom: `pnpm format:check && pnpm lint && pnpm typecheck && pnpm test && pnpm validate:data --seed && pnpm build && pnpm check:leaks && pnpm test:e2e`.
