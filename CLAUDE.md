# CLAUDE.md

## Projekt

Drzewo Rodzinne: prywatna, lokalna aplikacja (Vue 3 + TypeScript) do budowania i przeglądania drzewa genealogicznego rodziny autora. Interfejs wyłącznie po polsku. Specyfikacja: [docs/specs/2026-11-04-mvp-design.md](docs/specs/2026-11-04-mvp-design.md), plany: [docs/plans/](docs/plans/), decyzje: [docs/decisions/](docs/decisions/).

## Komendy

- `pnpm dev`: serwer deweloperski
- `pnpm test`: testy jednostkowe (Vitest); `pnpm test:watch` w trybie obserwacji
- `pnpm test:e2e`: testy Playwright (na tymczasowym folderze danych, nigdy na prawdziwych danych)
- `pnpm lint`, `pnpm format:check` (`pnpm format` naprawia), `pnpm typecheck`, `pnpm build`
- `pnpm validate:data`: walidacja `family.json` w folderze danych (`--seed`: danych demo)
- `pnpm check:leaks`: po `pnpm build` sprawdza, że repo nie śledzi danych rodziny ani zdjęć, a `dist/` zawiera wyłącznie dane demo (w CI z kanarkiem w `data/family/`)

## Struktura

- `src/app/`: start aplikacji, router, główny komponent
- `src/domain/`: model, daty, relacje, układ drzewa (czysty TS, bez Vue)
- `src/data/`: dostęp do danych (`repository.ts`; HTTP w dev, statyczny seed w buildzie) i kolejka zapisów
- `src/features/<x>/`: funkcje (drzewo, osoba, edytor, wyszukiwarka, do sprawdzenia)
- `src/stores/`: store rodziny (Pinia); dane zmienia się wyłącznie przez `update(...)`
- `src/components/ui/` (shadcn-vue), `src/shared/`, `src/styles/`
- `tests/e2e/`: testy Playwright; `tests/fixtures/`: dane i pomocniki testowe (alias `@tests/`)
- `data/seed/`: wymyślona rodzina demo; `data/family/`: prawdziwe dane (ignorowane)
- `vite-plugins/`: wtyczka danych tylko dla `pnpm dev` (endpointy `/__data`, zapis atomowy, kopie w `.backups/`, rewizje)
- `scripts/`, `docs/{specs,plans,decisions}/`

Folder `src/features/` powstaje w kolejnych planach.

## Konwencje

- TypeScript `strict`, Vue Composition API z `<script setup lang="ts">`.
- Nazwy: komponenty `PascalCase.vue`, composables `useCamelCase.ts`, reszta `kebab-case`. Testy jednostkowe obok pliku (`*.spec.ts`).
- Importy w `src/` przez alias `@/`. Wyjątek: `src/domain/` (bez plików spec), `vite-plugins/` i `scripts/` importują względnie z rozszerzeniem `.ts`, bo ładują je narzędzia Node (tsx, config Vite). Zakaz `../` wychodzącego poza folder (ESLint). Feature eksportuje API przez `index.ts`, import `@/features/<x>/<wnętrze>` spoza feature'a jest zabroniony.
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

- Pracujemy na gałęziach `feature/*`, nigdy bezpośrednio na `main`. Jedna gałąź i jeden PR do `main` na fazę: `feature/faza-N-<nazwa>`.
- Po każdym zadaniu, które przeszło recenzję i testy: commit (Conventional Commits) i push gałęzi na `origin`.
- Na koniec fazy, przed PR: przegląd końcowy całej gałęzi przez świeżego podagenta (nie przez wykonawcę), a jego istotne uwagi naprawione z testami.
- Na koniec fazy: PR do `main` przez `gh`, podsumowanie i czekanie na „dalej” od autora. Autor scala PR przez „Squash and merge”, więc po scaleniu lokalną gałąź fazy usuwa się przez `git branch -D` (po sprawdzeniu, że `main` ma tę samą zawartość).
- Nigdy nie pushuj niczego z `data/family/` ani plików `.env`.
- Przed ogłoszeniem ukończenia uruchom: `pnpm format:check && pnpm lint && pnpm typecheck && pnpm test && pnpm validate:data --seed && pnpm build && pnpm check:leaks && pnpm test:e2e`.
