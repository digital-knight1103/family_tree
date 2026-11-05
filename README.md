# Drzewo Rodzinne

Prywatna, lokalna aplikacja do budowania i przeglądania drzewa genealogicznego rodziny. Pozwala szybko dodawać osoby i relacje, zapisywać niepewne fakty, notatki i poszlaki oraz sprawdzać, co jeszcze trzeba potwierdzić. Interfejs jest po polsku.

Zrzut ekranu zostanie dodany po etapie drzewa.

## Wymagania

- Node.js `^22.18.0` lub `>=24.12.0`
- pnpm 12 (wersja wskazana w `package.json`)

## Uruchomienie

```bash
pnpm install
pnpm dev
```

Bez własnych danych aplikacja pokazuje dane przykładowe w trybie tylko do odczytu (dostępne od fazy 3). Inne komendy: `pnpm test`, `pnpm test:e2e`, `pnpm lint`, `pnpm typecheck`, `pnpm build`.

## Struktura folderów

- `src/`: kod aplikacji (`app`, `shared`, `styles`, a w kolejnych etapach `domain`, `data`, `features`, `stores`)
- `tests/e2e/`: testy Playwright; `tests/fixtures/`: dane i pomocniki testowe
- `data/seed/`: wymyślona rodzina demo; `data/family/`: Twoje dane (poza repozytorium kodu)
- `docs/`: specyfikacja, plany i decyzje (ADR)

## Twoje dane

Prawdziwe dane leżą w folderze `data/family/`, który jest ignorowany przez git, więc nie trafią do tego publicznego repozytorium. Ścieżkę można zmienić zmienną `FAMILY_DATA_DIR` (wzór w `.env.example`).

Zalecane jest osobne, prywatne repozytorium na dane, np. `family_tree-data`, które daje kopię zapasową i historię zmian:

1. Załóż prywatne repozytorium `family_tree-data` na GitHubie.
2. Sklonuj je do folderu danych:

   ```bash
   git clone <url> data/family
   ```

3. Commity w repozytorium danych robisz ręcznie.

Wzór `.gitignore` dla repozytorium danych:

```gitignore
.backups/
*.tmp
```

Aplikacja zapisuje kopie poprzednich wersji `family.json` w `.backups/` (maksymalnie 20), więc nie ma potrzeby ich wersjonować. Pliki `*.tmp` to pozostałości po przerwanym zapisie atomowym.

## Edycja danych

Zmiany zapisują się automatycznie w `data/family/family.json`. Szczegółowy opis edycji pojawi się wraz z edytorem.
