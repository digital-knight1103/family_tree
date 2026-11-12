# Kryteria akceptacji MVP

Mapa kryteriów z [specyfikacji §9](specs/2026-11-04-mvp-design.md) na dowody. E2e: `tests/e2e/`, uruchamiane przez `pnpm test:e2e` na tymczasowym folderze danych.

| § | Kryterium | Dowód |
|---|-----------|-------|
| 1 | Świeży klon, `pnpm install`, `pnpm dev`: dane demo z belką i przyciskiem „Rozpocznij własne drzewo” | e2e `data-states.spec.ts` („brak pliku pokazuje demo…”), `tree.spec.ts` („tryb demo też pokazuje drzewo”); CI robi `pnpm install --frozen-lockfile` na czystym klonie. **Ręcznie:** świeży klon w nowym folderze. |
| 2 | Trzy pokolenia bez zaglądania do pliku: „+”, daty z kwalifikatorami, zdjęcie, notatki, „do potwierdzenia” | e2e `editor.spec.ts`: „trzy pokolenia od zera…”, „edycja: data urodzenia z podglądem…”, „zdjęcie: dodanie, zapis jako WebP i usunięcie”, „dodanie dziecka z drzewa…” |
| 3 | Zmiana w `family.json` w ciągu ok. 1 s, plik przechodzi walidację | e2e `acceptance.spec.ts` („§9.3…”); `pnpm validate:data` (`scripts/validate-data.ts`) |
| 4 | `git status` nie pokazuje plików z folderu danych | `.gitignore` (`data/family/`); `pnpm check:leaks` (`checkTrackedFiles`), w CI z kanarkiem w `data/family/`. **Ręcznie:** `git status` po pracy na własnych danych. |
| 5 | Drzewo spełnia właściwości z §6.4 na danych seed | `src/domain/tree-layout/layout.spec.ts`, `row-order.spec.ts`, `placement.spec.ts` (w tym reguły bloków rodzeństwa na seed i dużej rodzinie); e2e `tree.spec.ts` |
| 6 | Wyszukiwarka, „Do sprawdzenia”, „Wyśrodkuj na mnie”, przełącznik motywu | e2e `search-review.spec.ts`, `tree.spec.ts` („Wyśrodkuj na mnie…”), `look.spec.ts` („motyw…”) |
| 7 | Cykl albo trzeci rodzic biologiczny blokowany z komunikatem | e2e `editor.spec.ts` („potomek jako rodzic jest wyłączony…”, „trzeci rodzic biologiczny jest blokowany…”); `src/domain/relation-rules.spec.ts` |
| 8 | Uszkodzony `family.json`: ekran błędu z opisem i ścieżką, bez zapisu i bez demo | e2e `data-states.spec.ts` („pusty plik (0 bajtów)…”, „cykl w relacjach…”) |
| 9 | Zapis z drugiej karty na starszej rewizji odrzucony z komunikatem; najwyżej 20 kopii | e2e `acceptance.spec.ts` („§9.9…”); `vite-plugins/file-io.spec.ts` („zostawia dokładnie 20 najnowszych kopii…”) |
| 10 | CI przechodzi z testem ochrony przed wyciekiem; README po polsku ze zrzutem | `.github/workflows/ci.yml`; `README.md`, `docs/screenshot.png`. **Ręcznie:** zielony przebieg CI dla ostatniego commita. |
