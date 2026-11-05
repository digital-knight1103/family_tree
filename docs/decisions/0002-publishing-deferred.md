# 0002: Publikacja drzewa odłożona poza MVP

## Kontekst

Publikacja drzewa w internecie jest planowana, ale wymaga decyzji, które nie należą do MVP: wybór hostingu, ukrywanie żyjących osób i dostarczenie prywatnych danych do CI.

## Decyzja

- MVP jest prywatną, lokalną aplikacją. Nie ma `deploy.yml` ani filtra prywatności.
- Architektura nie blokuje publikacji:
  - pole `living` jest w modelu i formularzu,
  - dane są za interfejsem `repository.ts`, a build produkcyjny ładuje dane statycznie i działa tylko do odczytu,
  - folder danych jest poza `public/`.
- Później: osobny workflow `deploy.yml`, filtr prywatności w buildzie (zmienna środowiskowa) i hosting (np. Cloudflare Pages z Access przy prywatnych danych).

## Konsekwencje

- MVP jest prostsze i bezpieczniejsze: build produkcyjny osadza wyłącznie dane seed.
- Publikacja wymaga osobnej decyzji, w tym sposobu przekazania danych z prywatnego repozytorium do CI.
