# 0003: Automatyczny zapis zamiast przycisku „Zapisz”

## Kontekst

Utrata wpisanych danych (niezapisana zmiana, zamknięta karta, uszkodzony plik) jest anty-celem projektu. Przycisk „Zapisz” łatwo pominąć, a edycja ma być szybka.

## Decyzja

- Każda zmiana zapisuje się automatycznie. Pola tekstowe z debounce ok. 500 ms, operacje strukturalne natychmiast. Pasek górny pokazuje „Zapisywanie…”, „Zapisano” lub „Błąd zapisu” z ponowieniem.
- Zapisy idą jedną kolejką: najwyżej jeden naraz, zawsze najnowszy stan. Przed zamknięciem karty zmiany są wysyłane przez `fetch` z `keepalive`, a trwający zapis wywołuje ostrzeżenie `beforeunload`.
- Wtyczka Vite waliduje dane schematem Zod po stronie serwera, zapisuje atomowo (plik tymczasowy i rename z ponowieniami) i robi kopię do `.backups/` (maks. 20).
- Pole `revision` wykrywa zapis z drugiej karty (HTTP 409, komunikat „Dane zmieniły się w innej karcie, odśwież”).

## Konsekwencje

- Brak Ctrl+Z w aplikacji. Siatką bezpieczeństwa są `.backups/` i git w repozytorium danych.
- Więcej logiki po stronie zapisu (kolejka, rewizje, kopie), za to mniejsze ryzyko utraty danych.
