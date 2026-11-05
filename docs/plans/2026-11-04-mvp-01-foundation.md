# MVP 01 — Fundament: szkielet, CI, model domenowy, zapis danych

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Działająca aplikacja Vue, która bezpiecznie wczytuje i zapisuje `family.json` z prywatnego folderu danych (z rewizjami, kolejką zapisów i kopiami), obsługuje dane demo i uszkodzony plik, a całość pilnuje CI.

**Architecture:** Czysta logika domenowa w `src/domain/` (daty, schemat Zod, reguły relacji) jest używana zarówno w przeglądarce, jak i w Node (wtyczka Vite, skrypty). Logika plikowa wtyczki (`vite-plugins/data-store.ts`) jest oddzielona od warstwy HTTP (`vite-plugins/dev-data-api.ts`), żeby dało się ją testować na folderze tymczasowym. Aplikacja ma dostęp do danych wyłącznie przez `src/data/repository.ts`, a zapisy przechodzą przez kolejkę `src/data/save-queue.ts` sterowaną ze store'a Pinia.

**Tech Stack:** Node 24, pnpm, Vue 3 + Vite + TypeScript strict, Vue Router (hash), Pinia, VueUse, Tailwind CSS v4 (`@tailwindcss/vite`), shadcn-vue, Zod 4, sharp, Vitest + Vue Test Utils, Playwright, ESLint (flat config) + Prettier, GitHub Actions.

**Spec:** `docs/specs/2026-11-04-mvp-design.md`

## Stan prac (2026-11-05)

Faza 1 scalona do `main` (PR #1, squash). Faza 2 na gałęzi **`feature/faza-2-model-domenowy`**, PR #2 otwarty, CI zielone, czeka na scalenie przez autora.

| Zadanie | Stan |
|---|---|
| 1–5. Szkielet i CI | ✅ scalone (PR #1) |
| 6. Parsowanie dat | ✅ |
| 7. Formatowanie i sortowanie dat | ✅ (poprawka odmiany miesięcy po „przed”/„po” z przeglądu końcowego) |
| 8. Schemat Zod | ✅ |
| 9. Zapytania o relacje | ✅ |
| 10. Reguły relacji i walidacja | ✅ |
| 11. Dane demo i `validate:data` | ✅ |

**Decyzje fazy 2:** moduły `src/domain/` importują się nawzajem przez `./` (`tsx` i config Vite nie rozwiązują `@/`); `tsconfig.node.json` obejmuje `src/domain/**` i alias `@tests/*`.

**Uwaga z fazy 1 dla zadania 18:** rodzaje `seed-copy`, `corrupt` i `zero-bytes` dopisuje się w `tests/e2e/fixtures/data-dir.ts`, a domyślny reset zmienia się w `tests/e2e/global-setup.ts`. Seed już istnieje, więc `seed-copy` można dodać w zadaniu 13 lub 18.

**Dalej:** po „dalej” od autora faza 3 (zadania 12–20) na gałęzi `feature/faza-3-zapis-danych` z `main`.

## Mapa planów MVP

Ten plan obejmuje fazy 1–3 z sekcji 11 specyfikacji. Kolejne plany powstaną po zakończeniu poprzedniego, bo zależą od jego wyniku (szczególnie od punktu kontrolnego układu drzewa):

| Plan | Zakres (spec §11) |
|------|-------------------|
| **01 (ten)** | 1. szkielet i CI · 2. model domenowy · 3. wtyczka zapisu i repozytorium danych |
| 02 | 4. drzewo: prototyp układu → **punkt kontrolny z autorem** → pełna wizualizacja |
| 03 | 5. edytor i karta osoby (w tym zdjęcia w UI) |
| 04 | 6. wyszukiwarka i „Do sprawdzenia” |
| 05 | 7. wygląd: glassmorphism, motywy, ekran powitalny |

## Global Constraints

- Node `^22.18.0 || >=24.12.0`, pnpm. Wersje bibliotek: aktualne stabilne w chwili instalacji. Przed użyciem API biblioteki sprawdź je w Context7.
- TypeScript `strict: true`, Vue Composition API z `<script setup lang="ts">`.
- Interfejs wyłącznie po polsku. Komunikaty błędów dla użytkownika również po polsku.
- Nazewnictwo: komponenty `PascalCase.vue`, composables `useCamelCase.ts`, pozostałe pliki i foldery `kebab-case`. Testy jednostkowe obok pliku (`*.spec.ts`), e2e w `tests/e2e/`.
- Importy w `src/` przez alias `@/`. Zakaz `../` przekraczającego folder (reguła ESLint). Feature'y eksportują publiczne API przez `index.ts`, a importy `@/features/<x>/<wnętrze>` spoza feature'a są zabronione.
- Końce linii LF. Brak luźnych plików w korzeniu, martwego kodu i zakomentowanych bloków.
- Prawdziwe dane: `FAMILY_DATA_DIR` (domyślnie `data/family/`), zawsze w `.gitignore`. Build produkcyjny osadza wyłącznie `data/seed/demo-family.json`.
- Komunikat konfliktu dokładnie: **„Dane zmieniły się w innej karcie, odśwież”**.
- Belka demo dokładnie: **„To są dane przykładowe. Zmiany nie są zapisywane.”**, przycisk: **„Rozpocznij własne drzewo”**.
- Kopie: `data/family/.backups/family-YYYY-MM-DD_HH-mm-ss-SSS.json`, maks. **20**. Rename: do **5** prób z rosnącym odstępem (50, 100, 200, 300, 350 ms), dla `EPERM`/`EBUSY`/`EACCES`.
- Dane i pomocniki wyłącznie testowe leżą w `tests/fixtures/` (alias `@tests/`), nigdy w `src/`.
- Conventional Commits. Jedna gałąź i jeden PR do `main` na fazę: `chore/skeleton-ci` (Task 1–5), `feat/domain-model` (Task 6–11), `feat/data-persistence` (Task 12–20). Gałąź fazy powstaje z `main`, jeśli PR poprzedniej fazy jest już scalony, a w przeciwnym razie z gałęzi poprzedniej fazy (wtedy bazą PR jest ta gałąź). **Po każdej fazie praca się zatrzymuje:** podsumowanie (co zrobione, wynik weryfikacji, co dalej) i czekanie na „dalej” od autora. Każdy commit kończy się linią `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.

## Review Focus

1. **Ścieżki z polskimi znakami i spacjami na Windows** (projekt leży w `Claude Code Project`): `FAMILY_DATA_DIR` względny i absolutny ze spacjami musi działać. Test w Task 13.
2. **Plik zapisany w Notatniku z BOM UTF-8** albo z CRLF: odczyt ma się udać, nie pokazywać ekranu błędu. Test w Task 13.
3. **Ręczna edycja `family.json` przy otwartej aplikacji** (bez zmiany `revision`): autozapis nie może jej po cichu nadpisać. Wtyczka porównuje skrót (hash) pliku z ostatnio odczytanym lub zapisanym i odrzuca zapis jako konflikt. Test w Task 13.
4. **Pusty plik (0 bajtów) lub ucięty JSON** po awarii: ekran błędu, nie dane demo i nie nadpisanie. Test w Task 13 i e2e w Task 18.
5. **Daty brzegowe:** `29.02.1900` (nieprzestępny), `00.1921`, `ok.1890` bez spacji, `  przed   1939 `, rok 3-cyfrowy `987`. Pierwsze dwie dają błąd, pozostałe się parsują. Test w Task 6.

---

## Faza 1: szkielet i CI

### Task 1: Higiena repozytorium i normalizacja końców linii

**Files:**
- Create: `.gitattributes`, `.editorconfig`, `.gitignore`

- [x] **Step 1: Utwórz gałąź**

Run: `git checkout docs/mvp-spec && git checkout -b chore/skeleton-ci`
Expected: `Switched to a new branch 'chore/skeleton-ci'`. Gałąź zawiera commity ze specyfikacją i planem, więc trafią do `main` razem z PR fazy 1.

- [x] **Step 2: Utwórz `.gitattributes`**

```
* text=auto eol=lf
*.png binary
*.jpg binary
*.jpeg binary
*.webp binary
*.ico binary
```

- [x] **Step 3: Utwórz `.editorconfig`**

`root = true`, dla `[*]`: `charset = utf-8`, `end_of_line = lf`, `indent_style = space`, `indent_size = 2`, `insert_final_newline = true`, `trim_trailing_whitespace = true`. Dla `[*.md]`: `trim_trailing_whitespace = false`.

- [x] **Step 4: Utwórz `.gitignore`**

Musi zawierać: `node_modules/`, `dist/`, `coverage/`, `test-results/`, `playwright-report/`, `.env`, `.env.*` z wyjątkiem `!.env.example`, `data/family/`, `.superpowers/`, `*.log`, `.DS_Store`, `Thumbs.db`.

- [x] **Step 5: Commit**

```bash
git add .gitattributes .editorconfig .gitignore
git commit -m "chore: add gitattributes, editorconfig and gitignore"
```

- [x] **Step 6: Renormalizacja w osobnym commicie**

Run: `git add --renormalize . && git status --short`
Expected: lista zmienionych plików (np. `docs/specs/...md`) albo pusto. Jeśli coś się zmieniło:

```bash
git commit -m "chore: renormalize line endings to LF"
```

Jeśli nic się nie zmieniło, zanotuj to w opisie PR („renormalizacja bez zmian”) i nie twórz pustego commita.

### Task 2: Szkielet Vite + Vue + TypeScript + Tailwind + shadcn-vue

**Files:**
- Create: `package.json`, `index.html`, `vite.config.ts`, `vitest.config.ts`, `tsconfig.json`, `tsconfig.app.json`, `tsconfig.node.json`, `env.d.ts`, `components.json`
- Create: `src/app/main.ts`, `src/app/App.vue`, `src/app/router/index.ts`, `src/styles/globals.css`, `src/shared/utils/cn.ts`
- Foldery `src/features/*` powstają dopiero w planach, które je wypełniają (bez pustych `.gitkeep`).
- Test: `src/app/App.spec.ts`

**Interfaces:**
- Produces: alias `@/` → `src/`, alias `@seed/` → `data/seed/` (używany tylko przez `StaticFamilyRepository`, Task 15), alias `@tests/` → `tests/` (tylko w plikach `*.spec.ts`; `tsconfig.app.json` obejmuje `tests/fixtures/**`, a ESLint zabrania importu `@tests/` w plikach innych niż `*.spec.ts`), skrypty pnpm: `dev`, `build`, `preview`, `test` (vitest run), `test:watch`, `typecheck` (`vue-tsc --build --force`), `lint`, `format`, `test:e2e`, `validate:data`, `check:leaks` (dwa ostatnie dodają Task 11 i Task 19).

- [x] **Step 1: Zainstaluj zależności**

Run:
```bash
pnpm init
pnpm add vue vue-router pinia @vueuse/core zod
pnpm add -D vite @vitejs/plugin-vue typescript vue-tsc @types/node @vue/tsconfig tailwindcss @tailwindcss/vite vitest @vue/test-utils jsdom tsx
```
Expected: `package.json` z zależnościami, `pnpm-lock.yaml`. W `package.json` ustaw `"private": true`, `"type": "module"`, `"engines": { "node": "^22.18.0 || >=24.12.0" }`, `"packageManager"` z aktualną wersją pnpm.

- [x] **Step 2: Napisz test, który nie przejdzie**

`src/app/App.spec.ts`: `it('renderuje powłokę aplikacji')`. Montuje `App` z routerem (`createRouter` z `createMemoryHistory`) i Pinia, a potem sprawdza, że `wrapper.find('[data-testid="app-shell"]').exists()` jest `true`.

- [x] **Step 3: Uruchom test**

Run: `pnpm test`
Expected: FAIL (brak `App.vue` lub brak konfiguracji).

- [x] **Step 4: Utwórz konfigurację i powłokę**

- `vite.config.ts`: pluginy `vue()`, `tailwindcss()`, aliasy `@` i `@seed` (przez `fileURLToPath(new URL(...))`), `base: './'`.
- `vitest.config.ts`: `mergeConfig` z konfiguracją Vite, `environment: 'jsdom'`, `include: ['src/**/*.spec.ts', 'scripts/**/*.spec.ts', 'vite-plugins/**/*.spec.ts']`. Testy w `vite-plugins/` i `scripts/` dostają `// @vitest-environment node` w nagłówku pliku.
- `tsconfig.app.json` rozszerza `@vue/tsconfig/tsconfig.dom.json` (strict, `paths` dla `@/*` i `@seed/*`, `noUncheckedIndexedAccess: true`). `tsconfig.node.json` obejmuje `vite.config.ts`, `vitest.config.ts`, `playwright.config.ts`, `vite-plugins/**`, `scripts/**`, `tests/**` i mapuje `@/*` dla importów domeny.
- `index.html`: `lang="pl"`, `<title>Drzewo Rodzinne</title>`, skrypt `/src/app/main.ts`.
- `src/app/router/index.ts`: `createWebHashHistory`, jedna trasa `/` na widok główny (na razie sam `App`).
- `src/app/App.vue`: korzeń `<div data-testid="app-shell">` z `<RouterView />`.
- `src/styles/globals.css`: `@import "tailwindcss";` (tokeny shadcn dopisze `init`).

- [x] **Step 5: Zainicjalizuj shadcn-vue**

Run: `pnpm dlx shadcn-vue@latest init` (Vite, kolor bazowy `neutral`, ikony `lucide`, zmienne CSS). Potem popraw `components.json`, żeby trzymać się struktury: `tailwind.css: "src/styles/globals.css"`, `aliases.components: "@/components"`, `aliases.ui: "@/components/ui"`, `aliases.utils: "@/shared/utils/cn"`, `aliases.lib: "@/shared/utils"`, `aliases.composables: "@/shared/composables"`. Jeśli `init` utworzył `src/lib/utils.ts`, przenieś jego zawartość do `src/shared/utils/cn.ts`, a `src/lib/` usuń.
Expected: zainstalowane `lucide-vue-next`, `clsx`, `tailwind-merge`, `class-variance-authority`, `reka-ui` (lub to, co aktualnie instaluje `init`).

- [x] **Step 6: Uruchom testy i build**

Run: `pnpm test && pnpm typecheck && pnpm build`
Expected: test PASS, brak błędów typów, `dist/` utworzony.

- [x] **Step 7: Commit**

```bash
git add -A
git commit -m "chore: scaffold Vue 3 + Vite + TypeScript app with Tailwind and shadcn-vue"
```

### Task 3: ESLint, Prettier, granice importów i VS Code

**Files:**
- Create: `eslint.config.ts`, `.prettierrc.json`, `.prettierignore`, `.vscode/extensions.json`, `.vscode/settings.json`
- Test: regułę granic importów sprawdza Step 4 (ręcznie, bez pliku testowego).

- [x] **Step 1: Zainstaluj**

Run: `pnpm add -D eslint @eslint/js eslint-plugin-vue @vue/eslint-config-typescript @vue/eslint-config-prettier prettier jiti`

- [x] **Step 2: Skonfiguruj**

- `eslint.config.ts`: `defineConfigWithVueTs` z `pluginVue.configs['flat/recommended']`, `vueTsConfigs.recommendedTypeChecked` (sprawdź aktualne nazwy w Context7), `skipFormatting`. Ignoruj `dist`, `coverage`, `src/components/ui/**` (kod generowany przez shadcn). Reguła `no-restricted-imports` dla `src/**` z wzorcami:
  - `group: ['../*', '../../*']`, komunikat „Użyj aliasu @/”,
  - `group: ['@/features/*/*']`, komunikat „Importuj feature przez jego index.ts”. Wyjątek: pliki wewnątrz tego samego feature'a importują swoje wnętrza względnie (`./`).
- `.prettierrc.json`: `{ "semi": false, "singleQuote": true, "printWidth": 100, "trailingComma": "all", "endOfLine": "lf" }`.
- `.vscode/extensions.json`: `Vue.volar`, `dbaeumer.vscode-eslint`, `esbenp.prettier-vscode`, `bradlc.vscode-tailwindcss`, `editorconfig.editorconfig`, `ms-playwright.playwright`, `vitest.explorer`.
- `.vscode/settings.json`: `editor.formatOnSave: true`, `editor.defaultFormatter: esbenp.prettier-vscode`, `editor.codeActionsOnSave: { "source.fixAll.eslint": "explicit" }`, `files.eol: "\n"`.
- Skrypty: `"lint": "eslint . --max-warnings 0"`, `"format": "prettier --write ."`, `"format:check": "prettier --check ."`.

- [x] **Step 3: Uruchom**

Run: `pnpm format && pnpm lint`
Expected: 0 błędów, 0 ostrzeżeń.

- [x] **Step 4: Sprawdź regułę granic**

Utwórz tymczasowo `src/app/tmp-check.ts` z `import x from '@/features/tree/components/X'`.
Run: `pnpm lint`
Expected: FAIL z komunikatem „Importuj feature przez jego index.ts”. Usuń plik i uruchom `pnpm lint` ponownie (PASS).

- [x] **Step 5: Commit**

```bash
git add -A
git commit -m "chore: configure ESLint, Prettier, import boundaries and VS Code settings"
```

### Task 4: Playwright

**Files:**
- Create: `playwright.config.ts`, `tests/e2e/smoke.spec.ts`, `tests/e2e/fixtures/data-dir.ts`

**Interfaces:**
- Produces: `tests/e2e/fixtures/data-dir.ts`:
  - `export const E2E_DATA_DIR = path.join(os.tmpdir(), 'family tree e2e')` (stała ścieżka ze spacją, celowo),
  - `export function resetDataDir(kind: 'seed-copy' | 'empty' | 'corrupt' | 'zero-bytes'): void`: synchronicznie czyści folder i wypełnia go odpowiednią zawartością (`empty` = folder bez `family.json`, `corrupt` = seed z dodanym cyklem w `parentChild`).

  `playwright.config.ts` przy wczytaniu wywołuje `resetDataDir('seed-copy')` i startuje serwer dev z `FAMILY_DATA_DIR=E2E_DATA_DIR`. Testy wymagające innego stanu wywołują `resetDataDir(kind)` przed `page.goto`. Wtyczka czyta plik przy każdym żądaniu, więc restart serwera nie jest potrzebny. Testy e2e działają sekwencyjnie (`workers: 1`), bo dzielą folder.

- [x] **Step 1: Zainstaluj**

Run: `pnpm add -D @playwright/test && pnpm exec playwright install chromium`

- [x] **Step 2: Napisz test**

`tests/e2e/smoke.spec.ts`: `test('strona startowa się ładuje')`. Robi `page.goto('/')`, a potem `expect(page.getByTestId('app-shell')).toBeVisible()` i `expect(page).toHaveTitle('Drzewo Rodzinne')`.

- [x] **Step 3: Skonfiguruj**

`playwright.config.ts`: tylko `chromium`, `testDir: 'tests/e2e'`, `workers: 1`, `webServer: { command: 'pnpm dev --port 5179 --strictPort', url: 'http://localhost:5179', env: { FAMILY_DATA_DIR: E2E_DATA_DIR }, reuseExistingServer: false }`, `use.baseURL: 'http://localhost:5179'`. Zawsze własny serwer, żeby e2e nigdy nie trafiły na serwer dev z prawdziwymi danymi. Skrypt `"test:e2e": "playwright test"`.

- [x] **Step 4: Uruchom**

Run: `pnpm test:e2e`
Expected: 1 passed.

- [x] **Step 5: Commit**

```bash
git add -A
git commit -m "test: set up Playwright with smoke test and temp data dir fixture"
```

### Task 5: CI, CLAUDE.md, README, ADR, .env.example

**Files:**
- Create: `.github/workflows/ci.yml`, `CLAUDE.md`, `.env.example`, `docs/decisions/0001-family-data-outside-code-repo.md`, `docs/decisions/0002-publishing-deferred.md`, `docs/decisions/0003-autosave.md`
- Modify: `README.md`

- [ ] **Step 1: `ci.yml`**

Wyzwalacze: `pull_request`, `push` do `main`. Jeden job `ubuntu-latest`: checkout, `pnpm/action-setup`, `actions/setup-node` (Node 24, cache pnpm), `pnpm install --frozen-lockfile`, `pnpm format:check`, `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm build`, `pnpm exec playwright install --with-deps chromium`, `pnpm test:e2e`. Kroki `validate:data` i `check:leaks` dochodzą w Task 11 i Task 19.

- [ ] **Step 2: `.env.example`**

```
# Folder z prawdziwymi danymi rodziny (family.json + photos/). Domyślnie data/family
FAMILY_DATA_DIR=data/family
```

- [ ] **Step 3: ADR**

Każdy w formacie: Kontekst, Decyzja, Konsekwencje (po polsku, maks. ok. 20 linii). Treść z §4.1, §8 i §4.3 specyfikacji.

- [ ] **Step 4: `CLAUDE.md`**

Sekcje: opis projektu (2–3 zdania + link do specu i planów), komendy (`pnpm dev`, `test`, `test:e2e`, `lint`, `typecheck`, `build`, `validate:data`, `check:leaks`), struktura folderów (w tym `tests/e2e/` na testy Playwright i `tests/fixtures/` na dane i pomocniki testowe), konwencje z Global Constraints, zasady danych („nigdy nie commituj `data/family/`”, seed tylko wymyślony), workflow (gałęzie feature, Conventional Commits, weryfikacja przed ogłoszeniem ukończenia).

- [ ] **Step 5: `README.md`**

Po polsku: opis, wymagania (Node, pnpm), uruchomienie, struktura folderów, sekcja „Twoje dane” (założenie prywatnego repo `family_tree-data`, `git clone <url> data/family`, wzór `.gitignore` repo danych z `.backups/`), sekcja „Edycja danych” (krótko, rozbudowa w planie 03). Miejsce na zrzut ekranu: opis „Zrzut ekranu zostanie dodany po etapie drzewa”, bez pustego obrazka.

- [ ] **Step 6: Zweryfikuj lokalnie**

Run: `pnpm format:check && pnpm lint && pnpm typecheck && pnpm test && pnpm build`
Expected: wszystko PASS.

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "ci: add CI workflow; docs: add CLAUDE.md, README, ADRs and env example"
```

- [ ] **Step 8: Koniec fazy 1: weryfikacja, PR, zatrzymanie**

Run: `pnpm format:check && pnpm lint && pnpm typecheck && pnpm test && pnpm build && pnpm test:e2e`
Expected: wszystko PASS. Potem `git push -u origin chore/skeleton-ci` i `gh pr create --base main` (opis kończy się linią `🤖 Generated with [Claude Code](https://claude.com/claude-code)`). Sprawdź, że CI na PR przechodzi (`gh pr checks --watch`). **Zatrzymaj się:** podsumowanie dla autora i czekanie na „dalej”.

---

## Faza 2: model domenowy

### Task 6: Parsowanie dat genealogicznych

**Files:**
- Create: `src/domain/dates.ts`
- Test: `src/domain/dates.spec.ts`

**Interfaces:**
- Produces:
  ```ts
  export type DateQualifier = 'about' | 'before' | 'after'
  export interface GenDate { year: number; month?: number; day?: number; qualifier?: DateQualifier }
  export type ParseResult = { ok: true; value: GenDate } | { ok: false; error: string }
  export function parseGenDate(input: string): ParseResult
  export function isValidGenDate(d: GenDate): boolean
  ```

- [ ] **Step 1: Napisz testy, które nie przejdą**

Tabela `it.each` dla `parseGenDate`:

| wejście | oczekiwane `value` |
|---|---|
| `'1890'` | `{ year: 1890 }` |
| `'987'` | `{ year: 987 }` |
| `'03.1921'` / `'3.1921'` / `'1921-03'` | `{ year: 1921, month: 3 }` |
| `'12.03.1921'` / `'1921-03-12'` | `{ year: 1921, month: 3, day: 12 }` |
| `'ok. 1890'` / `'ok.1890'` / `'około 1890'` / `'OK 1890'` | `{ year: 1890, qualifier: 'about' }` |
| `'  przed   1939 '` / `'przed. 1939'` | `{ year: 1939, qualifier: 'before' }` |
| `'po 1945'` | `{ year: 1945, qualifier: 'after' }` |
| `'ok. 03.1921'` | `{ year: 1921, month: 3, qualifier: 'about' }` |

Błędy (`ok: false`, `error` niepusty, po polsku): `''`, `'abc'`, `'29.02.1900'`, `'31.04.2000'`, `'00.1921'`, `'13.1921'`, `'1921-13'`, `'po'`, `'12.1921.5'`. Poprawne: `'29.02.2000'`.
`isValidGenDate`: `{ year: 1921, day: 5 }` daje `false` (dzień bez miesiąca), `{ year: 0 }` daje `false` (rok musi być ≥ 1).

- [ ] **Step 2: Uruchom**

Run: `pnpm vitest run src/domain/dates.spec.ts`
Expected: FAIL (brak modułu).

- [ ] **Step 3: Zaimplementuj `parseGenDate` i `isValidGenDate`**

Podejście: najpierw normalizacja (trim, małe litery, zwinięcie spacji), potem zdjęcie prefiksu kwalifikatora regexem `^(ok\.?|około|przed\.?|po)\s*`, a na końcu dopasowanie jednego z trzech wzorców dla DD.MM.RRRR, MM.RRRR i RRRR oraz ich wariantów ISO. Poprawność dnia sprawdzana przez `new Date(Date.UTC(y, m-1, d))` z porównaniem składowych (dla lat < 100 użyj `setUTCFullYear`).

- [ ] **Step 4: Uruchom**

Run: `pnpm vitest run src/domain/dates.spec.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/domain/dates.ts src/domain/dates.spec.ts
git commit -m "feat(domain): parse genealogical dates with qualifiers"
```

### Task 7: Formatowanie i sortowanie dat

**Files:**
- Modify: `src/domain/dates.ts`
- Test: `src/domain/dates.spec.ts`

**Interfaces:**
- Produces:
  ```ts
  export function formatGenDate(d: GenDate): string            // pełny opis po polsku
  export function formatGenDateInput(d: GenDate): string       // postać do pola edycji, round-trip z parseGenDate
  export function formatLifeSpan(birth?: GenDate, death?: GenDate, deceased?: boolean): string  // do węzła drzewa
  export function genDateSortKey(d: GenDate | undefined): number            // undefined → Number.POSITIVE_INFINITY
  ```

- [ ] **Step 1: Napisz testy**

`formatGenDate`:
- `{1921,3,12}` → `'12 marca 1921'`, `{1921,3}` → `'marzec 1921'`, `{1921}` → `'1921'`,
- `{1890, about}` → `'ok. 1890'`, `{1939, before}` → `'przed 1939'`, `{1945, after}` → `'po 1945'`,
- `{1921,3, about}` → `'ok. marca 1921'`, `{1921,3,12, before}` → `'przed 12 marca 1921'`.

Komplet nazw miesięcy w dopełniaczu (`stycznia`…`grudnia`) i mianowniku (`styczeń`…`grudzień`) sprawdzany pętlą dla wszystkich 12.

`formatLifeSpan`:
- `({1890,about}, {1958})` → `'ok. 1890 – 1958'`,
- `({1939,before}, undefined)` → `'przed 1939'`,
- `(undefined, {1958})` → `'? – 1958'`,
- `(undefined, undefined)` → `''`.

Wariant „przed 1939 – ?” ze specu dotyczy osoby zmarłej bez daty śmierci (trzeci parametr; wywołujący przekazuje `!person.living && !person.death?.date`): `({1939,before}, undefined, true)` → `'przed 1939 – ?'`. W węźle rok pokazywany jest z kwalifikatorem, bez dnia i miesiąca.

Round-trip: dla każdego poprawnego wejścia z Task 6 zachodzi `parseGenDate(formatGenDateInput(v)).value` toEqual `v`.

`genDateSortKey`:
- `{1921}` < `{1921,3}` < `{1921,3,12}`,
- `{1921,12,31}` < `{1922}`,
- `{1920, before}` sortuje się jak `{1920}`,
- `undefined` jest największy.

- [ ] **Step 2: Uruchom**

Run: `pnpm vitest run src/domain/dates.spec.ts`
Expected: FAIL.

- [ ] **Step 3: Zaimplementuj**

Klucz sortowania to najwcześniejszy możliwy dzień: `year*10000 + (month ?? 1)*100 + (day ?? 1)`. Kwalifikator nie zmienia klucza.

- [ ] **Step 4: Uruchom**

Run: `pnpm vitest run src/domain/dates.spec.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/domain/dates.ts src/domain/dates.spec.ts
git commit -m "feat(domain): format genealogical dates in Polish and sort key"
```

### Task 8: Schemat danych Zod

**Files:**
- Create: `src/domain/schema.ts`
- Test: `src/domain/schema.spec.ts`

**Interfaces:**
- Consumes: `GenDate`, `isValidGenDate` z Task 6.
- Produces:
  ```ts
  export const SCHEMA_VERSION = 1
  export const genDateSchema, factSchema, endFactSchema, personSchema, parentChildSchema, unionSchema, familyDataSchema
  export type Fact = { date?: GenDate; place?: string; unconfirmed?: boolean }
  export type EndFact = { date?: GenDate }
  export type Sex = 'male' | 'female' | 'unknown'
  export type Person = { id: string; givenNames: string; surname: string; maidenName?: string; sex: Sex;
    birth?: Fact; death?: Fact; bio?: string; researchNotes?: string; photo?: string; living: boolean }
  export type ParentChild = { parentId: string; childId: string; type: 'biological' | 'adoptive' }
  export type Union = { id: string; partnerIds: [string, string]; type: 'marriage' | 'partnership'; start?: Fact; end?: EndFact }
  export type FamilyData = { version: 1; revision: number; settings: { selfPersonId?: string };
    persons: Person[]; parentChild: ParentChild[]; unions: Union[] }
  export function emptyFamilyData(): FamilyData   // revision 0, puste tablice
  ```
  Typy wyprowadzane przez `z.infer`. Obiekty `z.strictObject` (nieznane klucze = błąd, żeby literówki w ręcznej edycji były wykrywane).

- [ ] **Step 1: Napisz testy**

- `emptyFamilyData()` przechodzi `familyDataSchema.safeParse`.
- Minimalna osoba `{ id:'p_1', givenNames:'', surname:'', sex:'unknown', living:false }` przechodzi.
- Odrzucane, ze sprawdzeniem `issues[0].path`: `sex:'x'` → `['persons',0,'sex']`; `birth.date: {year:1921, day:5}` → ścieżka zawiera `'date'`; nieznany klucz `nazwisko`; `version: 2`; `revision: -1`; `partnerIds` o długości 1; id osoby niezgodne z `/^p_[A-Za-z0-9_-]+$/`; id związku niezgodne z `/^u_[A-Za-z0-9_-]+$/`; `photo` ze ścieżką (`'../x.webp'`), czyli dozwolone tylko `/^[A-Za-z0-9_-]+\.webp$/`.

- [ ] **Step 2: Uruchom**

Run: `pnpm vitest run src/domain/schema.spec.ts`
Expected: FAIL.

- [ ] **Step 3: Zaimplementuj `src/domain/schema.ts`**

`genDateSchema` używa `.refine(isValidGenDate, 'Niepoprawna data')`. Komunikaty walidacji po polsku tam, gdzie definiujemy je sami.

- [ ] **Step 4: Uruchom**

Run: `pnpm vitest run src/domain/schema.spec.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/domain/schema.ts src/domain/schema.spec.ts
git commit -m "feat(domain): add Zod schema for family data"
```

### Task 9: Zapytania o relacje

**Files:**
- Create: `src/domain/relations.ts`
- Test: `src/domain/relations.spec.ts`
- Create: `tests/fixtures/build-family.ts` (budowniczy danych testowych, importowany przez `@tests/fixtures/build-family`)

**Interfaces:**
- Consumes: `FamilyData`, `Person`, `Union` z Task 8.
- Produces:
  ```ts
  export function parentsOf(data: FamilyData, personId: string): Person[]
  export function childrenOf(data: FamilyData, personId: string): Person[]      // posortowane genDateSortKey(birth), potem id
  export function unionsOf(data: FamilyData, personId: string): Union[]
  export function partnersOf(data: FamilyData, personId: string): Person[]
  export function siblingsOf(data: FamilyData, personId: string): Person[]      // wspólny ≥1 rodzic, bez samej osoby, posortowane jak dzieci
  export function ancestorIds(data: FamilyData, personId: string): Set<string>
  export function descendantIds(data: FamilyData, personId: string): Set<string>
  export function isUnknownPerson(p: Person): boolean                          // givenNames i surname puste po trim
  ```
  `tests/fixtures/build-family.ts`: `buildFamily(spec: { persons: Array<Partial<Person> & { id: string }>; parentChild?: Array<[parent: string, child: string, type?: ParentChild['type']]>; unions?: Array<[a: string, b: string]> }): FamilyData`.

- [ ] **Step 1: Napisz testy**

Rodzina: dziadkowie A+B → dzieci C (ur. 1965) i D (ur. ok. 1969); C+E → F; G (bez relacji).
- `parentsOf(C)` = {A,B}, `childrenOf(A)` = [C,D] w tej kolejności, `siblingsOf(C)` = [D], `partnersOf(C)` = [E],
- `ancestorIds(F)` = {C,E,A,B}, `descendantIds(A)` = {C,D,F},
- `parentsOf(G)` = [], `siblingsOf(G)` = [],
- `isUnknownPerson({givenNames:' ', surname:''})` = true.

- [ ] **Step 2: Uruchom** — `pnpm vitest run src/domain/relations.spec.ts`, Expected: FAIL.

- [ ] **Step 3: Zaimplementuj.** BFS dla przodków i potomków (odporny na cykle przez zbiór odwiedzonych).

- [ ] **Step 4: Uruchom** — Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/domain/relations.ts src/domain/relations.spec.ts tests/fixtures/build-family.ts
git commit -m "feat(domain): add relation queries"
```

### Task 10: Reguły relacji i pełna walidacja danych

**Files:**
- Create: `src/domain/relation-rules.ts`, `src/domain/validate.ts`
- Test: `src/domain/relation-rules.spec.ts`, `src/domain/validate.spec.ts`

**Interfaces:**
- Consumes: Task 8, Task 9.
- Produces:
  ```ts
  // relation-rules.ts
  export interface RuleViolation { path: string; message: string }   // path np. 'parentChild[3]'
  export function checkRelationRules(data: FamilyData): RuleViolation[]
  export type CanResult = { ok: true } | { ok: false; reason: string }
  export function canAddParent(data: FamilyData, childId: string, parentId: string, type: ParentChild['type']): CanResult
  export function canAddUnion(data: FamilyData, aId: string, bId: string): CanResult
  // validate.ts
  export interface ValidationError { path: string; message: string }
  export type ValidationResult = { ok: true; data: FamilyData } | { ok: false; errors: ValidationError[] }
  export function validateFamilyData(input: unknown): ValidationResult   // Zod, a po sukcesie checkRelationRules
  export function parseFamilyJson(text: string): ValidationResult        // zdejmuje BOM, pusty tekst / zły JSON → błąd z path ''
  ```
  `path` z Zod sklejane jako `persons[3].birth.date.month`.

- [ ] **Step 1: Napisz testy** (komunikaty po polsku, sprawdzaj `path` i to, że `message` jest niepusty)

`checkRelationRules`:
- cykl bezpośredni A→B, B→A daje naruszenie,
- cykl pośredni A→B→C→A daje naruszenie,
- osoba jest swoim rodzicem (A→A) daje naruszenie,
- 3 rodziców biologicznych daje naruszenie, a 2 biologicznych + 1 adopcyjny nie,
- zduplikowana relacja rodzic–dziecko daje naruszenie,
- dwa związki między tą samą parą (także w odwrotnej kolejności) dają naruszenie,
- związek z samym sobą daje naruszenie,
- `parentId` / `partnerIds` / `settings.selfPersonId` wskazujące nieistniejącą osobę dają naruszenie,
- zduplikowane `id` osób lub związków dają naruszenie,
- rodzina z Task 9 daje `[]`.

`canAddParent`:
- dodanie potomka jako rodzica daje `ok:false` (komunikat zawiera „przodkiem”),
- trzeci rodzic biologiczny daje `ok:false`,
- poprawny przypadek daje `ok:true`.

`canAddUnion`: duplikat lub ta sama osoba dają `ok:false`.

`parseFamilyJson`:
- `''` → `ok:false`, `path:''`, komunikat zawiera „pusty”,
- `'{"version":1'` → `ok:false` (niepoprawny JSON),
- `'\uFEFF' + JSON.stringify(emptyFamilyData())` → `ok:true`,
- treść z `\r\n` → `ok:true`,
- naruszenie reguły → `ok:false` z `path` z reguły.

- [ ] **Step 2: Uruchom** — `pnpm vitest run src/domain/relation-rules.spec.ts src/domain/validate.spec.ts`, Expected: FAIL.

- [ ] **Step 3: Zaimplementuj.** Cykle wykrywane DFS z kolorowaniem po grafie `parentChild`.

- [ ] **Step 4: Uruchom** — Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/domain/relation-rules.ts src/domain/relation-rules.spec.ts src/domain/validate.ts src/domain/validate.spec.ts
git commit -m "feat(domain): enforce relation rules and full data validation"
```

### Task 11: Dane demo i skrypt walidacji

**Files:**
- Create: `data/seed/demo-family.json`, `scripts/validate-data.ts`, `scripts/resolve-data-dir.ts`
- Test: `scripts/validate-data.spec.ts`, `scripts/resolve-data-dir.spec.ts`
- Modify: `package.json` (skrypt), `.github/workflows/ci.yml` (krok po `pnpm test`)

**Interfaces:**
- Consumes: `parseFamilyJson` z Task 10.
- Produces:
  ```ts
  // scripts/resolve-data-dir.ts (używany też przez wtyczkę, Task 14)
  export function resolveDataDir(env: { FAMILY_DATA_DIR?: string }, projectRoot: string): string  // absolutna ścieżka
  // scripts/validate-data.ts
  export function validateFile(filePath: string): { ok: true } | { ok: false; report: string }
  ```
  CLI: `pnpm validate:data` waliduje `<dataDir>/family.json` (a jeśli go nie ma, wypisuje „Brak family.json w <ścieżka>, nic do walidacji” i kończy kodem 0). `pnpm validate:data --seed` waliduje `data/seed/demo-family.json`. Kod wyjścia 1 przy błędach, raport z listą `path: message`.

- [ ] **Step 1: Napisz testy**

- `resolveDataDir({}, root)` → `path.join(root, 'data', 'family')`,
- `resolveDataDir({FAMILY_DATA_DIR:'C:\\Moje Dane\\Rodzina Łódź'}, root)` → ta sama ścieżka (absolutna bez zmian),
- `resolveDataDir({FAMILY_DATA_DIR:'dane/rodzina'}, root)` → `path.resolve(root,'dane/rodzina')`,
- `validateFile` na `data/seed/demo-family.json` → `ok:true`,
- `validateFile` na tymczasowym pliku z cyklem → `ok:false`, `report` zawiera `parentChild`,
- test seed: co najmniej 15 osób, 4 pokolenia (najdłuższy łańcuch przodków ≥ 3), ≥ 1 osoba nieznana, ≥ 1 data z kwalifikatorem, ≥ 1 fakt `unconfirmed`, `settings.selfPersonId` ustawione.

- [ ] **Step 2: Uruchom** — Expected: FAIL.

- [ ] **Step 3: Utwórz seed i skrypty**

Seed to wymyślona rodzina „Kowalczyków” o ok. 20 osobach. Imiona i nazwiska fikcyjne, bez zdjęć, `revision: 0`. Skrypt CLI uruchamiany przez `tsx`: `"validate:data": "tsx scripts/validate-data.ts"`.

- [ ] **Step 4: Uruchom**

Run: `pnpm vitest run scripts && pnpm validate:data --seed`
Expected: PASS i wypisane „OK: data/seed/demo-family.json”.

- [ ] **Step 5: Dodaj krok CI** `pnpm validate:data --seed` po `pnpm test`.

- [ ] **Step 6: Commit**

```bash
git add data/seed scripts package.json .github/workflows/ci.yml
git commit -m "feat(data): add demo family seed and data validation script"
```

- [ ] **Step 7: Koniec fazy 2: weryfikacja, PR, zatrzymanie**

Run: `pnpm format:check && pnpm lint && pnpm typecheck && pnpm test && pnpm validate:data --seed && pnpm build && pnpm test:e2e`
Expected: wszystko PASS. Potem push gałęzi `feat/domain-model`, `gh pr create` (baza według reguły z Global Constraints), CI zielone. **Zatrzymaj się:** podsumowanie dla autora i czekanie na „dalej”.

---

## Faza 3: wtyczka zapisu i repozytorium danych

### Task 12: Zapis atomowy z ponowieniami i kopie zapasowe

**Files:**
- Create: `vite-plugins/file-io.ts`
- Test: `vite-plugins/file-io.spec.ts`

**Interfaces:**
- Produces:
  ```ts
  export interface FsLike { rename(a: string, b: string): Promise<void> }  // do wstrzykiwania awarii w testach
  export async function writeFileAtomic(target: string, content: string, fsImpl?: FsLike,
    delaysMs?: number[] /* domyślnie [50,100,200,300,350] */): Promise<void>
  export async function backupFile(source: string, backupsDir: string, now: Date, keep?: number /* 20 */): Promise<string | null>
  export function backupFileName(now: Date): string   // family-YYYY-MM-DD_HH-mm-ss-SSS.json, czas lokalny
  ```

- [ ] **Step 1: Napisz testy** (folder z `fs.mkdtemp`)

- `writeFileAtomic` zapisuje treść i nie zostawia pliku tymczasowego,
- przy `fsImpl.rename` rzucającym `EPERM` 2 razy, a potem działającym, zapis się udaje (3 wywołania),
- przy `EPERM` za każdym razem po 6 wywołaniach (1 + 5 ponowień) leci błąd, plik docelowy jest niezmieniony, a tymczasowy usunięty,
- błąd `ENOENT` nie jest ponawiany,
- `backupFileName(new Date(2026,10,4,9,5,7,42))` → `'family-2026-11-04_09-05-07-042.json'`,
- `backupFile` przy braku źródła → `null`,
- 25 kolejnych kopii z rosnącym czasem zostawia dokładnie 20 najnowszych.

Testy podają `delaysMs: [0,0,0,0,0]`.

- [ ] **Step 2: Uruchom** — `pnpm vitest run vite-plugins/file-io.spec.ts`, Expected: FAIL.

- [ ] **Step 3: Zaimplementuj.** Plik tymczasowy w tym samym folderze (`<target>.<pid>.<random>.tmp`), ponowienia tylko dla `EPERM`/`EBUSY`/`EACCES`. Rotacja kopii sortuje po nazwie (format jest leksykograficznie chronologiczny).

- [ ] **Step 4: Uruchom** — Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add vite-plugins/file-io.ts vite-plugins/file-io.spec.ts
git commit -m "feat(dev-api): atomic write with Windows retry and backup rotation"
```

### Task 13: Magazyn danych (odczyt, zapis z rewizją, wykrywanie zmian zewnętrznych)

**Files:**
- Create: `vite-plugins/data-store.ts`
- Test: `vite-plugins/data-store.spec.ts`

**Interfaces:**
- Consumes: Task 10 (`parseFamilyJson`, `validateFamilyData`), Task 12.
- Produces:
  ```ts
  export type ReadResult =
    | { kind: 'missing'; filePath: string }
    | { kind: 'invalid'; filePath: string; errors: ValidationError[] }
    | { kind: 'ok'; filePath: string; data: FamilyData }
  export type WriteResult =
    | { kind: 'ok'; revision: number }
    | { kind: 'conflict' }                                   // starsza rewizja lub zmiana zewnętrzna
    | { kind: 'invalid'; errors: ValidationError[] }         // przesłane dane niepoprawne
    | { kind: 'blocked'; errors: ValidationError[] }         // plik na dysku uszkodzony, zapis zablokowany
    | { kind: 'missing' }                                    // brak pliku (zapis tylko przez createNew)
  export function createDataStore(dataDir: string, deps?: { now?: () => Date; fsImpl?: FsLike }): {
    read(): Promise<ReadResult>
    write(next: FamilyData, baseRevision: number): Promise<WriteResult>
    createNew(): Promise<{ kind: 'ok'; data: FamilyData } | { kind: 'exists' }>
  }
  ```
  Zachowanie `write`:
  1. wczytaj plik; uszkodzony → `blocked`, brak → `missing`;
  2. jeśli `sha256(treść)` ≠ ostatnio znany skrót (z ostatniego `read`/`write` tego procesu) albo `baseRevision` ≠ `revision` z pliku → `conflict`;
  3. waliduj `next` → `invalid`;
  4. backup;
  5. zapisz `{...next, revision: plik.revision + 1}` przez `writeFileAtomic` jako `JSON.stringify(…, null, 2) + '\n'` z kluczami w kolejności schematu;
  6. zapamiętaj skrót i zwróć `ok`.

  Gdy znany skrót jeszcze nie istnieje (pierwszy zapis po starcie serwera), punkt 2 sprawdza tylko rewizję.

- [ ] **Step 1: Napisz testy** (folder tymczasowy, którego nazwa zawiera spację i „ł”, np. `dane rodziny ł`)

- brak pliku → `read` daje `missing`,
- plik 0 bajtów → `invalid`, a `write` → `blocked`, plik nadal ma 0 bajtów,
- ucięty JSON → `invalid`,
- plik z BOM i CRLF → `ok`,
- `write` z poprawną rewizją → `ok`, `revision` w pliku +1, w `.backups/` 1 kopia z poprzednią treścią,
- `write` z `baseRevision` starszym → `conflict`, plik bez zmian, brak nowej kopii,
- ręczna zmiana pliku po `read` bez zmiany `revision` (np. dopisanie spacji w nazwisku) → `write` daje `conflict`,
- `write` z cyklem → `invalid`, plik bez zmian,
- `createNew` przy braku pliku → `ok` i plik z `emptyFamilyData()`, przy istniejącym → `exists`,
- zapisany plik kończy się `\n` i ma wcięcia 2 spacji.

- [ ] **Step 2: Uruchom** — `pnpm vitest run vite-plugins/data-store.spec.ts`, Expected: FAIL.

- [ ] **Step 3: Zaimplementuj** (`node:crypto` do skrótu, kolejność kluczy przez przebudowę obiektu według kolejności pól schematu).

- [ ] **Step 4: Uruchom** — Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add vite-plugins/data-store.ts vite-plugins/data-store.spec.ts
git commit -m "feat(dev-api): data store with revisions, conflict detection and corrupt-file blocking"
```

### Task 14: Wtyczka Vite — endpointy HTTP i zdjęcia

**Files:**
- Create: `vite-plugins/dev-data-api.ts`, `vite-plugins/photos.ts`
- Test: `vite-plugins/dev-data-api.spec.ts`, `vite-plugins/photos.spec.ts`
- Modify: `vite.config.ts`

**Interfaces:**
- Consumes: Task 11 (`resolveDataDir`), Task 13.
- Produces (HTTP, tylko `apply: 'serve'`, prefiks `/__data`; odpowiedzi JSON):

  | Metoda i ścieżka | Odpowiedź |
  |---|---|
  | `GET /__data/family` | 200 `{kind:'ok', data, filePath}` · 200 `{kind:'missing', filePath}` · 200 `{kind:'invalid', filePath, errors}` |
  | `PUT /__data/family` body `{data, baseRevision}` | 200 `{revision}` · 409 `{error:'conflict'}` · 422 `{errors}` · 423 `{errors}` (blocked) · 404 (missing) |
  | `POST /__data/family/new` | 201 `{data}` · 409 `{error:'exists'}` |
  | `PUT /__data/photos/:personId` body: surowy obraz, `Content-Type: image/*` | 200 `{photo:'<personId>.webp'}` · 400 · 413 (> 15 MB) |
  | `DELETE /__data/photos/:personId` | 204 |
  | `GET /__data/photos/:file` | plik webp, 404 |

  `export function devDataApi(options?: { dataDir?: string }): Plugin`
  `photos.ts`: `export async function toWebp(input: Buffer): Promise<Buffer>` (dłuższy bok maks. **800 px**, bez powiększania, `rotate()` wg EXIF, jakość 82).
  `personId` i `file` walidowane regexami ze schematu (Task 8), co blokuje path traversal.

- [ ] **Step 1: Napisz testy**

`photos.spec.ts`: obraz 2000×1000 wygenerowany przez sharp daje WebP 800×400, a 300×200 zostaje 300×200.

`dev-data-api.spec.ts`: serwer Vite w trybie middleware (`createServer({ configFile:false, plugins:[devDataApi({dataDir: tmp})], server:{ middlewareMode:true } })` + `http.createServer(vite.middlewares)` na losowym porcie), `fetch`:
- `GET` bez pliku → `kind:'missing'`,
- `POST new` → 201, a potem `GET` → `ok`,
- `PUT` z `baseRevision:0` → 200 `{revision:1}`, a ponownie z `baseRevision:0` → 409,
- `PUT` z cyklem → 422,
- plik uszkodzony → `GET` `invalid`, `PUT` → 423,
- `PUT photos/p_1` → 200 i plik `photos/p_1.webp` istnieje, `GET photos/p_1.webp` → 200 `image/webp`,
- `GET photos/..%2Ffamily.json` → 404 (lub 400),
- `PUT photos/zly id` → 400.

- [ ] **Step 2: Uruchom** — `pnpm add -D sharp && pnpm vitest run vite-plugins`, Expected: FAIL.

- [ ] **Step 3: Zaimplementuj** (middleware przez `configureServer`, `loadEnv` dla `FAMILY_DATA_DIR`). Dodaj `devDataApi()` do `vite.config.ts`. Wtyczka nie robi nic w `vite build`.

- [ ] **Step 4: Uruchom** — Expected: PASS. Dodatkowo `pnpm build`: PASS.

- [ ] **Step 5: Commit**

```bash
git add vite-plugins vite.config.ts package.json pnpm-lock.yaml
git commit -m "feat(dev-api): Vite plugin with family and photo endpoints (dev only)"
```

### Task 15: Repozytorium danych w aplikacji

**Files:**
- Create: `src/data/repository.ts`, `src/data/http-repository.ts`, `src/data/static-repository.ts`, `src/data/index.ts`
- Test: `src/data/http-repository.spec.ts`, `src/data/static-repository.spec.ts`

**Interfaces:**
- Consumes: typy z Task 8 i Task 10, kontrakt HTTP z Task 14.
- Produces:
  ```ts
  export type LoadResult =
    | { kind: 'ok'; data: FamilyData; source: 'user' | 'demo'; readOnly: boolean; filePath?: string }
    | { kind: 'invalid'; filePath: string; errors: ValidationError[] }
  export type SaveResult =
    | { kind: 'ok'; revision: number }
    | { kind: 'conflict' }
    | { kind: 'error'; message: string }                     // 422/423/404/sieć — komunikat po polsku
  export interface FamilyRepository {
    load(): Promise<LoadResult>
    save(data: FamilyData, baseRevision: number, opts?: { keepalive?: boolean }): Promise<SaveResult>
    createNew(): Promise<LoadResult>
    uploadPhoto(personId: string, file: Blob): Promise<string>
    deletePhoto(personId: string): Promise<void>
    photoUrl(photo: string): string
  }
  export function getRepository(): FamilyRepository  // import.meta.env.DEV ? http : static
  ```
  `HttpFamilyRepository.load`: przy `missing` ładuje seed (dynamiczny import `@seed/demo-family.json`) i zwraca `{kind:'ok', source:'demo', readOnly:true}`. `StaticFamilyRepository`: zawsze seed, `readOnly:true`, `save`/`createNew`/zdjęcia rzucają „Edycja niedostępna w wersji tylko do odczytu”.

- [ ] **Step 1: Napisz testy** (`fetch` mockowany przez `vi.stubGlobal`)

- `missing` → `source:'demo'`, `readOnly:true`, `data.persons.length ≥ 15`,
- `invalid` → `kind:'invalid'` z `filePath` i `errors`,
- `ok` → `source:'user'`, `readOnly:false`,
- `save` 409 → `{kind:'conflict'}`, a 500 / brak sieci → `{kind:'error'}` z niepustym komunikatem,
- `save` z `keepalive:true` przekazuje `keepalive:true` do `fetch`,
- static `save` rzuca błąd.

- [ ] **Step 2–4:** uruchom (FAIL), zaimplementuj, uruchom (PASS) — `pnpm vitest run src/data`.

- [ ] **Step 5: Commit**

```bash
git add src/data
git commit -m "feat(data): family repository with HTTP (dev) and static (build) implementations"
```

### Task 16: Kolejka zapisów

**Files:**
- Create: `src/data/save-queue.ts`
- Test: `src/data/save-queue.spec.ts`
- Modify: `src/data/index.ts` (eksport)

**Interfaces:**
- Consumes: `SaveResult`, `FamilyData` z Task 15.
- Produces:
  ```ts
  export type SaveStatus = 'idle' | 'pending' | 'saving' | 'saved' | 'error' | 'conflict'
  export interface SaveQueue {
    schedule(data: FamilyData, opts?: { immediate?: boolean }): void   // debounce 500 ms, immediate = od razu
    flushOnUnload(): void          // wysyła najnowszy niezapisany stan z keepalive, bez czekania
    retry(): void
    hasUnsaved(): boolean          // pending || saving
    readonly status: Ref<SaveStatus>
    readonly lastError: Ref<string | null>
  }
  export function createSaveQueue(save: FamilyRepository['save'], initialRevision: number,
    opts?: { debounceMs?: number }): SaveQueue
  ```
  Reguły:
  - najwyżej jeden zapis naraz;
  - stan zmieniony w trakcie zapisu zastępuje oczekujący i wysyła się raz po zakończeniu bieżącego;
  - po `ok` `baseRevision` = zwrócona rewizja;
  - po `conflict` status `conflict` i każde kolejne `schedule` jest ignorowane (zapis wstrzymany do odświeżenia);
  - po `error` status `error`, a `retry()` wysyła najnowszy stan.

- [ ] **Step 1: Napisz testy** (`vi.useFakeTimers`, `save` jako kontrolowany mock z ręcznie rozwiązywanymi obietnicami)

- 3× `schedule` w 200 ms → po 500 ms 1 wywołanie z ostatnim stanem,
- `immediate` → wywołanie bez czekania,
- `schedule` w trakcie zapisu → brak drugiego równoległego wywołania, a po rozwiązaniu pierwszego dokładnie 1 kolejne z najnowszym stanem i `baseRevision` z pierwszej odpowiedzi,
- 2 zmiany w trakcie zapisu → nadal tylko 1 kolejne wywołanie (z ostatnią zmianą),
- `conflict` → `status` = `'conflict'`, a późniejsze `schedule` nie wywołuje `save`,
- `error` → `status` = `'error'`, `retry()` wywołuje `save` z najnowszym stanem,
- `flushOnUnload()` przy oczekującym debounce → `save` od razu z `{keepalive:true}`, a bez zmian → brak wywołania,
- `hasUnsaved()` jest true w `pending` i `saving`, false w `saved`.

- [ ] **Step 2–4:** uruchom (FAIL), zaimplementuj (`ref` z Vue dla statusu), uruchom (PASS) — `pnpm vitest run src/data/save-queue.spec.ts`.

- [ ] **Step 5: Commit**

```bash
git add src/data
git commit -m "feat(data): single-flight save queue with coalescing, conflict and unload flush"
```

### Task 17: Store rodziny i ochrona przed zamknięciem karty

**Files:**
- Create: `src/stores/family.ts`, `src/shared/composables/useUnsavedGuard.ts`
- Test: `src/stores/family.spec.ts`, `src/shared/composables/useUnsavedGuard.spec.ts`

**Interfaces:**
- Consumes: Task 15, Task 16.
- Produces:
  ```ts
  // useFamilyStore (Pinia, setup store)
  state: status: Ref<'loading' | 'ready' | 'invalid' | 'load-error'>, data: Ref<FamilyData | null>,
         source: Ref<'user' | 'demo' | null>, readOnly: Ref<boolean>, invalid: Ref<{ filePath: string; errors: ValidationError[] } | null>,
         saveStatus: Ref<SaveStatus>, saveError: Ref<string | null>
  actions: load(): Promise<void>
           startOwnTree(): Promise<void>                   // createNew, potem stan 'ready', source 'user'
           update(mutator: (draft: FamilyData) => void, opts?: { immediate?: boolean }): void
             // rzuca, gdy readOnly lub status ≠ 'ready'; mutuje kopię (structuredClone), waliduje validateFamilyData;
             // przy błędzie walidacji nie zmienia stanu i rzuca Error z komunikatem pierwszego błędu; inaczej podmienia data i schedule
           retrySave(): void
  // useUnsavedGuard(store) — rejestruje 'beforeunload' (useEventListener z VueUse):
  //   zawsze wywołuje queue.flushOnUnload(); jeśli hasUnsaved() → event.preventDefault() (standardowe ostrzeżenie przeglądarki)
  ```
  Kolejne plany modyfikują dane wyłącznie przez `update(...)`.

- [ ] **Step 1: Napisz testy** (repozytorium mockowane)

- `load` z `invalid` → `status:'invalid'`, `invalid.filePath` ustawione, `data` = null, `save` nigdy niewywołane,
- `load` z demo → `readOnly:true`, a `update` rzuca,
- `update` na danych użytkownika zmienia `data` i po 500 ms wywołuje `save`,
- `update` tworzący cykl rzuca, `data` bez zmian, brak `save`,
- `startOwnTree` → `source:'user'`, `persons` puste,
- `useUnsavedGuard`: przy `hasUnsaved` zdarzenie `beforeunload` ma `defaultPrevented`, a bez zmian nie ma.

- [ ] **Step 2–4:** uruchom (FAIL), zaimplementuj, uruchom (PASS) — `pnpm vitest run src/stores src/shared`.

- [ ] **Step 5: Commit**

```bash
git add src/stores src/shared
git commit -m "feat(stores): family store with validated updates and unsaved-changes guard"
```

### Task 18: Powłoka aplikacji — stany ładowania, błędu, demo i zapisu

**Files:**
- Create: `src/app/views/HomeView.vue`, `src/shared/components/InvalidDataScreen.vue`, `src/shared/components/DemoBanner.vue`, `src/shared/components/SaveStatusIndicator.vue`, `src/shared/components/EmptyTreeState.vue`
- Modify: `src/app/router/index.ts`, `src/app/App.vue`
- Test: `src/shared/components/InvalidDataScreen.spec.ts`, `src/shared/components/SaveStatusIndicator.spec.ts`, `tests/e2e/data-states.spec.ts`

**Interfaces:**
- Consumes: `useFamilyStore`, `useUnsavedGuard` (Task 17).
- Produces: `HomeView` renderuje według `store.status`:
  - `loading`: spinner,
  - `invalid`: `InvalidDataScreen` (`data-testid="invalid-data"`): nagłówek „Nie można wczytać danych drzewa”, `filePath`, lista `path — message` (pusta ścieżka jako „cały plik”), wskazówka „Poprzednie wersje znajdziesz w folderze .backups obok pliku oraz w historii repozytorium danych.”, przycisk „Spróbuj ponownie” → `store.load()`,
  - `ready` + demo: `DemoBanner` (`data-testid="demo-banner"`) z dokładnym tekstem z Global Constraints i przyciskiem „Rozpocznij własne drzewo” → `store.startOwnTree()`,
  - `ready`: miejsce na drzewo (`data-testid="tree-placeholder"`, tekst „Liczba osób: N”), które plan 02 zastąpi. Przy 0 osobach `EmptyTreeState` z tekstem „Twoje drzewo jest puste” (przycisk dodania pierwszej osoby dojdzie w planie 03),
  - `SaveStatusIndicator` (`data-testid="save-status"`): `pending`/`saving` → „Zapisywanie…”, `saved` → „Zapisano”, `error` → „Błąd zapisu” + przycisk „Ponów”, `conflict` → „Dane zmieniły się w innej karcie, odśwież” + przycisk „Odśwież” (`location.reload()`).

  Komponenty z `src/components/ui` dodawane przez `pnpm dlx shadcn-vue@latest add button alert` w miarę potrzeby.

- [ ] **Step 1: Napisz testy jednostkowe**

- `InvalidDataScreen` z `errors:[{path:'persons[3].birth.date.month', message:'Niepoprawna data'}]` pokazuje ścieżkę pliku, tę linię i przycisk „Spróbuj ponownie”,
- `SaveStatusIndicator` dla każdego statusu pokazuje dokładny tekst powyżej.

- [ ] **Step 2: Napisz testy e2e** (`tests/e2e/data-states.spec.ts`, z `resetDataDir` z Task 4)

- `zero-bytes` → widoczne `invalid-data` ze ścieżką pliku, brak `demo-banner`. Po 2 s plik ma nadal 0 bajtów i nie istnieje `.backups/`,
- `corrupt` (cykl w relacjach) → `invalid-data`, a tekst zawiera `parentChild`,
- `empty` (brak pliku) → `demo-banner`. Kliknięcie „Rozpocznij własne drzewo” daje „Twoje drzewo jest puste”, a `family.json` istnieje w folderze danych,
- `seed-copy` → `tree-placeholder` z „Liczba osób:”.

- [ ] **Step 3: Uruchom** — `pnpm test && pnpm test:e2e`, Expected: FAIL.

- [ ] **Step 4: Zaimplementuj** komponenty i podłącz `useUnsavedGuard` w `App.vue`.

- [ ] **Step 5: Uruchom** — Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "feat(app): app shell states for loading, invalid data, demo and save status"
```

### Task 19: Ochrona przed wyciekiem danych

**Files:**
- Create: `scripts/check-no-leaks.ts`
- Test: `scripts/check-no-leaks.spec.ts`
- Modify: `package.json`, `.github/workflows/ci.yml`

**Interfaces:**
- Produces:
  ```ts
  export function checkTrackedFiles(trackedPaths: string[]): string[]     // naruszenia: data/family/**, *.webp|*.jpg|*.jpeg|*.png poza public/ i src/assets/
  export function checkDistForCanary(distDir: string, canary: string): string[]   // pliki w dist zawierające canary
  export function checkDistHasNoDataFiles(distDir: string): string[]      // family.json, .backups, photos/ w dist
  ```
  CLI `pnpm check:leaks` (uruchamiany po buildzie, oczekuje kanarka):
  1. `git ls-files` → `checkTrackedFiles`,
  2. `checkDistForCanary(dist, 'CANARY_LEAK_TEST_7f3a')`,
  3. `checkDistHasNoDataFiles`,
  4. sprawdza, że `dist` zawiera nazwisko z seed („Kowalczyk”), czyli dane demo są faktycznie osadzone.

  Kod 1 i lista naruszeń przy jakimkolwiek problemie.

- [ ] **Step 1: Napisz testy**

- `checkTrackedFiles(['data/family/family.json','src/a.ts'])` → 1 naruszenie,
- `checkTrackedFiles(['data/seed/demo-family.json'])` → `[]`,
- `checkDistForCanary` na tymczasowym folderze z plikiem zawierającym kanarka → 1 naruszenie.

- [ ] **Step 2–4:** uruchom (FAIL), zaimplementuj, uruchom (PASS).

- [ ] **Step 5: Krok CI**

Przed `pnpm build` krok „Przygotuj kanarek danych”: tworzy `data/family/family.json` (poprawne dane z osobą o nazwisku `CANARY_LEAK_TEST_7f3a`) i `data/family/photos/p_canary.webp`. Po `pnpm build` krok `pnpm check:leaks`. To dowodzi, że build ignoruje prawdziwy folder danych, nawet gdy on istnieje.

- [ ] **Step 6: Sprawdź lokalnie, że test łapie wyciek**

Tymczasowo zmień `StaticFamilyRepository`, żeby importował `data/family/family.json` z kanarkiem.
Run: `pnpm build && pnpm check:leaks`
Expected: FAIL z nazwą pliku w `dist`. Cofnij zmianę, potem `pnpm build && pnpm check:leaks` → PASS.

- [ ] **Step 7: Commit**

```bash
git add scripts package.json .github/workflows/ci.yml
git commit -m "ci: add data leak protection check with canary"
```

### Task 20: Weryfikacja końcowa i PR

- [ ] **Step 1: Pełna weryfikacja**

Run: `pnpm format:check && pnpm lint && pnpm typecheck && pnpm test && pnpm validate:data --seed && pnpm build && pnpm check:leaks && pnpm test:e2e`
Expected: wszystko PASS. `check:leaks` nie wymaga obecności kanarka, tylko zgłasza go, jeśli trafi do `dist`, więc lokalnie działa także z Twoim prawdziwym folderem danych.

- [ ] **Step 2: Sprawdź ręcznie**

`pnpm dev`:
- bez `data/family/` widać belkę demo,
- po „Rozpocznij własne drzewo” jest plik w `data/family/`,
- `git status` w repo kodu nie pokazuje folderu danych.

- [ ] **Step 3: Zaktualizuj `CLAUDE.md`**, jeśli komendy lub struktura się zmieniły. Commit `docs: update CLAUDE.md`.

- [ ] **Step 4: Koniec fazy 3: push, PR, zatrzymanie**

```bash
git push -u origin feat/data-persistence
gh pr create --title "feat: safe data persistence with revisions, backups and leak protection" --body "<opis + checklista weryfikacji>"
```
Baza PR według reguły z Global Constraints. Opis kończy się linią `🤖 Generated with [Claude Code](https://claude.com/claude-code)`. CI zielone. **Zatrzymaj się:** podsumowanie dla autora i czekanie na „dalej” (następny krok: plan 02).
