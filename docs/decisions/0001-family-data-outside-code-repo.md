# 0001: Dane rodziny poza repozytorium kodu

## Kontekst

Repozytorium kodu jest publiczne, a drzewo zawiera dane osobowe (daty żyjących osób, zdjęcia, notatki). Wyciek tych danych do repozytorium lub jego historii jest anty-celem projektu. Dane potrzebują jednak kopii zapasowej i historii zmian.

## Decyzja

- Prawdziwe dane leżą w folderze danych (domyślnie `data/family/`, zmiana przez `FAMILY_DATA_DIR`), który jest w `.gitignore`.
- Folder zawiera `family.json` i `photos/`. Jest poza `public/`, więc nic nie trafi do buildu przypadkiem.
- Autor zakłada osobne prywatne repozytorium (np. `family_tree-data`) i klonuje je do `data/family/`. Commity w nim robi ręcznie. `.backups/` jest ignorowane.
- W repozytorium kodu jest tylko wymyślona rodzina `data/seed/demo-family.json` (testy, CI, build, zrzut ekranu).
- Test w CI sprawdza, że nic z `data/family/` nie jest śledzone i że `dist/` zawiera wyłącznie dane seed.

## Konsekwencje

- Kopia zapasowa i historia zmian danych są w prywatnym repozytorium, bez ryzyka wycieku.
- Autor musi pamiętać o ręcznych commitach w repozytorium danych.
- Świeży klon bez danych działa na danych demo w trybie tylko do odczytu.
