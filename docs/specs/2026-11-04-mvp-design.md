# Drzewo Rodzinne — specyfikacja MVP

- **Data:** 2026-11-04
- **Status:** do akceptacji
- **Autor:** Paweł Bokszczanin (decyzje produktowe), Claude (propozycje oznaczone jako „decyzja wykonawcy”)

## 1. Cel i kontekst

Prywatna, lokalna aplikacja do budowania i przeglądania drzewa genealogicznego rodziny autora. Jedynym użytkownikiem jest autor, który pracuje przy biurku (Windows, przeglądarka desktopowa). Na start wprowadza kilkadziesiąt osób z pamięci i z rozmów z rodziną, więc informacje są często niepełne i niepewne. Aplikacja ma być przede wszystkim **wygodnym warsztatem badawczym**: szybkie dodawanie osób, zapis niepewnych faktów, notatki i poszlaki, a także szybki przegląd tego, co jeszcze trzeba sprawdzić.

Publikacja drzewa w internecie jest planowana później i nie należy do MVP. Architektura nie może jej jednak blokować.

## 2. Cele, nie-cele, anty-cele

### Cele MVP
1. Dodawanie osób i relacji bezpośrednio z poziomu drzewa (rodzic, partner, dziecko, rodzeństwo).
2. Czytelna wizualizacja z auto-layoutem: pokolenia w rzędach, partnerzy obok siebie, linie do dzieci ze środka pary, połączenia ortogonalne, zoom, przesuwanie, minimapa, wyśrodkowanie na osobie.
3. Karta osoby w panelu bocznym, z podglądem i edycją.
4. Niepełne daty genealogiczne i znacznik „do potwierdzenia” przy faktach.
5. Notatki badawcze przy osobie i lista „Do sprawdzenia”.
6. Wyszukiwarka osób.
7. Jedno zdjęcie (portret) na osobę.
8. Ekran powitalny.
9. Dwa motywy (jasny i ciemny) w stylu glassmorphism z przełącznikiem.
10. Prawdziwe dane rodziny nigdy nie trafiają do publicznego repozytorium.

### Nie-cele (poza MVP, możliwe później)
- Publikacja strony (GitHub Pages / Cloudflare Pages + Access) i filtr ukrywania żyjących osób.
- Galeria zdjęć i skany dokumentów.
- Import i eksport GEDCOM, oś czasu, wydruk do PDF, edycja przez wiele osób.
- Cofanie zmian (Ctrl+Z) w aplikacji. Rolę siatki bezpieczeństwa pełni git w repozytorium danych.
- Słownik miejscowości i mapy, bo miejsce to zwykły tekst.
- Specjalna prezentacja złożonych układów rodzinnych (wiele małżeństw, przyrodnie rodzeństwo, adopcje). Model danych je dopuszcza, ale układ drzewa jest dopracowany pod przypadek podstawowy.
- Kwalifikator zakresu dat („między X a Y”).
- Widok mobilny.

### Anty-cele (porażka, nawet jeśli „działa”)
- Dane rodziny (daty żyjących, zdjęcia, notatki) widoczne w publicznym repozytorium lub jego historii.
- Utrata wpisanych danych, np. przez niezapisaną zmianę, uszkodzony plik albo zapis niepoprawnych danych.
- Dodanie osoby wymagające przechodzenia przez rozbudowane ekrany lub wypełniania wielu pól.
- Nieczytelne drzewo: przecinające się linie, partnerzy rozrzuceni po ekranie, dzieci podpięte nie do tej pary.

## 3. Ograniczenia

- Windows + Git Bash + VS Code. Końce linii normalizowane do LF (`.gitattributes`), `.editorconfig` spójny z Prettierem.
- Stack: Vue 3 (Composition API, `<script setup>`), Vite, TypeScript strict, pnpm, Vue Router (hash), Pinia, VueUse, Tailwind CSS + shadcn-vue, lucide-vue-next, Vue Flow (`@vue-flow/core`, minimap, controls) + elkjs, Zod, Vitest + Vue Test Utils, Playwright, ESLint + Prettier, GitHub Actions. Przed użyciem każdej biblioteki trzeba sprawdzić jej aktualne API w Context7.
- Interfejs w całości po polsku.
- Struktura folderów i konwencje według briefu (sekcja 10), z odstępstwami wymienionymi w 10.2.
- Repozytorium kodu `github.com/digital-knight1103/family_tree` jest publiczne.

## 4. Dane i bezpieczeństwo

### 4.1 Rozdzielenie kodu i danych
- Prawdziwe dane leżą w **folderze danych**, domyślnie `data/family/`, który jest w `.gitignore` repozytorium kodu. Ścieżkę można zmienić zmienną `FAMILY_DATA_DIR` w `.env` (wzór w `.env.example`).
- Zawartość folderu danych:
  ```
  data/family/
  ├─ family.json
  └─ photos/
     └─ <personId>.webp
  ```
- Autor zakłada osobne **prywatne** repozytorium na GitHubie (np. `family_tree-data`) i klonuje je do `data/family/`. Daje to kopię zapasową i historię zmian. Commity w repozytorium danych autor robi ręcznie. Instrukcja trafia do README.
- W repozytorium kodu leży tylko `data/seed/demo-family.json`: wymyślona rodzina (ok. 15–25 osób, 4 pokolenia, przynajmniej jedna osoba nieznana, kilka niepewnych dat, jeden fakt „do potwierdzenia”). Używają jej testy, CI, build i zrzut ekranu w README. Zdjęcia demo, jeśli będą, muszą być wygenerowane lub na wolnej licencji. Decyzja wykonawcy: wystarczą inicjały zamiast zdjęć.

### 4.2 Zachowanie przy braku danych
- Jeśli w folderze danych nie ma `family.json`, aplikacja w trybie dev pokazuje dane demo w trybie tylko do odczytu, z belką „To są dane przykładowe. Zmiany nie są zapisywane.” i przyciskiem **„Rozpocznij własne drzewo”**. Przycisk tworzy pusty `family.json` w folderze danych i otwiera formularz pierwszej osoby. Plik seed nigdy nie jest nadpisywany.

### 4.3 Zapis
- Każda zmiana zapisuje się automatycznie, bez przycisku „Zapisz”. Pasek górny pokazuje stan: „Zapisywanie…”, „Zapisano” albo „Błąd zapisu” z możliwością ponowienia.
- Wtyczka Vite (`vite-plugins/dev-data-api.ts`) działa wyłącznie w `pnpm dev` i udostępnia:
  - odczyt `family.json`,
  - zapis całego `family.json`: walidacja schematem Zod **po stronie serwera** przed zapisem, zapis atomowy (plik tymczasowy, potem rename), sformatowany JSON (2 spacje, stabilna kolejność kluczy, żeby diffy w gicie były czytelne),
  - upload zdjęcia: konwersja przez sharp do WebP (dłuższy bok maks. 800 px), zapis jako `photos/<personId>.webp` (nadpisuje poprzednie),
  - usunięcie zdjęcia,
  - serwowanie plików z `photos/`.
- Decyzja wykonawcy: zapis z debounce ok. 500 ms dla pól tekstowych. Operacje strukturalne (dodanie lub usunięcie osoby czy relacji) zapisują się natychmiast.
- Cały dostęp do danych w aplikacji idzie przez `src/data/repository.ts` (interfejs + implementacja HTTP dla dev). W buildzie produkcyjnym repozytorium ładuje dane statycznie i jest tylko do odczytu, a edytor jest wyłączony. Build w CI używa danych seed.

## 5. Model danych

Schemat Zod w `src/domain/schema.ts`. Typy TS wyprowadzane z niego (`z.infer`).

```jsonc
{
  "version": 1,
  "settings": {
    "selfPersonId": "p_..."          // osoba „Ja” dla przycisku „Wyśrodkuj na mnie”; opcjonalne
  },
  "persons": [
    {
      "id": "p_...",                  // stabilny, generowany (np. nanoid z prefiksem)
      "givenNames": "Józef Marian",   // może być puste (osoba nieznana)
      "surname": "Nowak",             // może być puste
      "maidenName": "",               // nazwisko rodowe, opcjonalne
      "sex": "male",                  // "male" | "female" | "unknown"
      "birth": { "date": GenDate?, "place": "okolice Lwowa", "unconfirmed": true },
      "death": { "date": GenDate?, "place": "", "unconfirmed": false },
      "bio": "markdown",
      "researchNotes": "zwykły tekst / markdown",
      "photo": "p_....webp",          // nazwa pliku w photos/ lub brak
      "living": false                  // na przyszłość (filtr publikacji); edytowalne w formularzu
    }
  ],
  "parentChild": [
    { "parentId": "p_...", "childId": "p_...", "type": "biological" }   // "biological" | "adoptive"
  ],
  "unions": [
    {
      "id": "u_...",
      "partnerIds": ["p_...", "p_..."],
      "type": "marriage",              // "marriage" | "partnership"
      "start": { "date": GenDate?, "place": "", "unconfirmed": false },
      "end":   { "date": GenDate? }     // opcjonalne
    }
  ]
}
```

Wszystkie pola faktów (`birth`, `death`, `start`, `end`) i ich podpola są opcjonalne.

### 5.1 Daty genealogiczne (`GenDate`)
```ts
{ year: number; month?: number; day?: number; qualifier?: "about" | "before" | "after" }
```
- Precyzja wynika z obecności pól: sam rok, rok i miesiąc albo pełna data. Dzień bez miesiąca jest niedozwolony, a data musi być poprawna w kalendarzu.
- **Wpisywanie jako tekst** z podglądem na żywo. Moduł `src/domain/dates.ts` parsuje formaty:
  - `1890`, `03.1921`, `3.1921`, `12.03.1921`, `1921-03`, `1921-03-12`,
  - prefiksy: `ok.` / `około` / `ok` → about, `przed` / `przed.` → before, `po` → after (bez rozróżniania wielkości liter, tolerancja spacji),
  - błędny tekst daje komunikat pod polem, a nie zapis.
- **Formatowanie po polsku:** `12 marca 1921`, `marzec 1921`, `1921`, `ok. 1890`, `przed 1939`, `po 1945`, `ok. marca 1921`. W węźle drzewa pokazywane są lata: `ok. 1890 – 1958`, `przed 1939 – ?`, `1965` (osoba żyjąca lub bez daty śmierci).
- Funkcja klucza sortowania (np. do kolejności rodzeństwa): data niepełna sortuje się według najwcześniejszego możliwego dnia, osoby bez daty trafiają na koniec.

### 5.2 Reguły relacji (`src/domain/relations.ts`)
Reguły blokujące, walidowane w UI przed zmianą oraz w schemacie i wtyczce przy zapisie:
- nikt nie jest swoim przodkiem (brak cykli w `parentChild`), także pośrednio,
- osoba ma najwyżej 2 rodziców biologicznych (rodzice adopcyjni są poza tym limitem),
- brak duplikatów relacji rodzic–dziecko i związków między tą samą parą,
- `partnerIds` to dwie różne, istniejące osoby; wszystkie identyfikatory w relacjach wskazują na istniejące osoby.

Funkcje pochodne: rodzice, dzieci, partnerzy, rodzeństwo (wspólny co najmniej jeden rodzic; przyrodnie nie są w MVP osobno oznaczane), przodkowie, potomkowie.

Ostrzeżenia nieblokujące (np. śmierć przed urodzeniem) nie wchodzą do MVP.

## 6. Interfejs

### 6.1 Ekran powitalny
- Wariant „Spokojny nastrój”: ciemne, ciepłe tło (głęboka zieleń przechodząca w czerń) z sylwetką drzewa, które delikatnie „oddycha”. Tytuł **„Drzewo Rodzinne”** i cytat **„Kto nie zna swojej przeszłości, nie zrozumie teraźniejszości”** pojawiają się płynnie, a po ok. 3,5 s ekran gaśnie i wchodzi aplikacja. Tekst jest w pliku konfiguracyjnym aplikacji, nie w danych.
- Ekran jest ciemny niezależnie od wybranego motywu.
- Decyzje wykonawcy:
  - ekran pokazuje się raz na sesję przeglądarki (sessionStorage), więc nie przy odświeżeniu w tej samej karcie;
  - kliknięcie, Enter lub Esc pomijają go;
  - przy `prefers-reduced-motion` ekran jest nieruchomy i krótszy;
  - ekran nie blokuje ładowania danych, które idzie równolegle.

### 6.2 Główny ekran
Układ według zaakceptowanego szkicu:
- **Pasek górny:** nazwa aplikacji, wyszukiwarka, przycisk „Do sprawdzenia · N”, „Wyśrodkuj na mnie” (wyłączony, dopóki nie wskazano osoby „Ja”), wskaźnik zapisu, przełącznik motywu.
- **Płótno drzewa** (Vue Flow) zajmuje resztę ekranu: zoom, przesuwanie, kontrolki zoomu i minimapa w dolnych rogach.
- **Panel boczny z prawej:** karta wybranej osoby. Bez zaznaczenia panel jest zwinięty.
- Przy pierwszym wejściu widok jest wyśrodkowany na osobie „Ja”, a jeśli jej nie ma, dopasowany do całego drzewa.

### 6.3 Węzeł osoby
- Okrągła miniatura zdjęcia (bez zdjęcia: inicjały), imię i nazwisko, druga linia z latami życia i ewentualnie „z d. <nazwisko rodowe>”.
- Kolorowy akcent oznacza płeć (np. pasek z lewej). Plakietka „?” pojawia się, gdy którykolwiek fakt osoby ma `unconfirmed`.
- Osoba nieznana (brak imion i nazwiska): przerywana ramka, wyszarzenie, etykieta „Nieznany” / „Nieznana” / „Osoba nieznana” zależnie od płci.
- Zaznaczona osoba ma wyraźny obrys. Wokół niej pojawiają się przyciski „+” z etykietami: **rodzic** (nad), **partner** (z boku), **dziecko** (pod), **rodzeństwo** (z boku, po drugiej stronie niż partner).

### 6.4 Układ drzewa (auto-layout)
Wymagane właściwości wizualne:
- pokolenia w poziomych rzędach (przodkowie wyżej),
- partnerzy obok siebie w tym samym rzędzie,
- linia do dzieci wychodzi ze środka linii łączącej parę, a dziecko z jednym znanym rodzicem łączy się bezpośrednio z tym rodzicem,
- połączenia ortogonalne, z jak najmniejszą liczbą przecięć,
- rodzeństwo uporządkowane według daty urodzenia (klucz z 5.1),
- układ jest deterministyczny: te same dane dają ten sam obraz, a dodanie osoby nie przetasowuje całego drzewa bez potrzeby.

Przekształcenie danych na węzły i krawędzie (`src/domain/tree-layout/`) jest czystą funkcją TS bez Vue, z testami jednostkowymi. Sposób modelowania par dla elkjs (np. węzeł pomocniczy związku) zostaje wykonawcy.

Osoby niepołączone z resztą drzewa wyświetlają się jako osobne grupy obok, a nie znikają.

### 6.5 Dodawanie osób
- Kliknięcie „+” otwiera w panelu bocznym **krótki formularz**: imiona, nazwisko, płeć oraz nazwisko rodowe (rozwinięte domyślnie dla kobiet, decyzja wykonawcy). „Dodaj” tworzy osobę i relację, zaznacza nową osobę i przewija do niej widok. Wszystkie pola mogą zostać puste, co daje osobę nieznaną.
- **Dziecko:** jeśli zaznaczona osoba ma dokładnie jeden związek, dziecko dostaje oboje partnerów jako rodziców. Przy kilku związkach formularz pyta „z kim?” (lista partnerów + „nieznany drugi rodzic”). Bez związku dziecko ma jednego rodzica.
- **Rodzic:** blokowany, gdy osoba ma już 2 rodziców biologicznych. Gdy dodawany jest drugi rodzic, a pierwszy nie ma jeszcze partnera, aplikacja automatycznie tworzy między nimi związek typu „małżeństwo” (decyzja wykonawcy; typ można zmienić w edycji).
- **Partner:** tworzy osobę i związek (domyślnie „małżeństwo”).
- **Rodzeństwo:** tworzy osobę z tymi samymi rodzicami co zaznaczona. Jeśli zaznaczona osoba nie ma rodziców, aplikacja najpierw tworzy jednego nieznanego rodzica (płeć „nieznana”) wspólnego dla obojga (decyzja wykonawcy).

### 6.6 Karta osoby (panel boczny)
- **Podgląd:** zdjęcie, pełne imię i nazwisko, „z d.”, urodzenie i śmierć (data + miejsce + znacznik „do potwierdzenia”), relacje jako klikalne nazwiska (rodzice, partnerzy z typem i datami związku, dzieci, rodzeństwo), biografia wyrenderowana z markdown (bezpiecznie, bez surowego HTML), notatki badawcze w wyróżnionym polu.
- Kliknięcie osoby w relacjach zaznacza ją i centruje widok.
- **Edycja** (przycisk „Edytuj”): wszystkie pola osoby z modelu, w tym daty jako tekst z podglądem, znaczniki „do potwierdzenia”, flaga „żyje”, biografia i notatki (pole tekstowe; podgląd markdown dla biografii to decyzja wykonawcy), upload i usunięcie zdjęcia, edycja związków (typ, początek, koniec) i typu relacji rodzic–dziecko, usuwanie relacji, akcja „To jestem ja” (ustawia `settings.selfPersonId`). Walidacja formularza przez Zod.
- **Usuwanie osoby:** okno potwierdzenia z nazwiskiem i liczbą relacji do usunięcia. Usuwa osobę, jej relacje, związki i plik zdjęcia.

### 6.7 Wyszukiwarka
- Pole w pasku górnym, skrót klawiszowy `/` lub `Ctrl+K` (decyzja wykonawcy).
- Szuka po imionach, nazwisku i nazwisku rodowym, bez rozróżniania wielkości liter i polskich znaków („wisniewska” znajdzie „Wiśniewska”), dopasowując początki słów.
- Lista wyników pokazuje imię i nazwisko oraz lata życia. Wybór zaznacza osobę, centruje widok i otwiera kartę.

### 6.8 Lista „Do sprawdzenia”
- Przycisk w pasku górnym z licznikiem otwiera listę w panelu bocznym.
- Na liście są osoby, które mają którykolwiek fakt z `unconfirmed: true` (w tym fakty ich związków) albo są nieznane (brak imion i nazwiska). Każda pozycja pokazuje osobę, powód (np. „data urodzenia do potwierdzenia”, „brak imienia”) i pierwszą linię notatek badawczych.
- Kliknięcie pozycji zaznacza osobę i centruje widok.

### 6.9 Wygląd
- **Glassmorphism:** półprzezroczyste kafle z rozmyciem tła, cienką jasną krawędzią i miękkim cieniem na tle z dużych, rozmytych plam koloru.
  - **Jasny:** pastelowe plamy (zieleń, piasek, błękit) pod mlecznym szkłem.
  - **Ciemny:** głęboka zieleń z ciepłym złotem, spójnie z ekranem powitalnym.
- Przełącznik motywu: domyślnie według systemu (`prefers-color-scheme`), wybór zapamiętywany w localStorage.
- Kolory jako tokeny CSS (zmienne), spójne z motywem shadcn-vue.
- Wydajność: jeśli rozmycie pod każdym węzłem spowalnia płótno przy ok. 300 osobach, węzły dostają półprzezroczyste tło bez `backdrop-filter`, a pełne rozmycie zostaje na pasku i panelu.
- Kontrast tekstu co najmniej WCAG AA w obu motywach.

## 7. Jakość i CI

- TDD dla logiki domenowej. Testy obowiązkowe: parsowanie i formatowanie dat (wszystkie formaty i kwalifikatory, błędne wejścia, klucz sortowania), reguły relacji (cykle bezpośrednie i pośrednie, limit rodziców, duplikaty, osierocone identyfikatory), przekształcenie danych na węzły i krawędzie (para, dziecko z jednym rodzicem, kilka związków, osoby niepołączone, determinizm), wyszukiwanie (polskie znaki), wyliczanie listy „Do sprawdzenia”, walidacja zapisu we wtyczce (odrzucenie niepoprawnych danych).
- Testy e2e (Playwright) na danych seed: start → ekran powitalny → drzewo; wyszukanie osoby i otwarcie karty; dodanie dziecka przez „+” i jego pojawienie się w drzewie; edycja daty z kwalifikatorem; przełączenie motywu. Testy e2e uruchamiają serwer dev (z wtyczką zapisu) na tymczasowym folderze danych (`FAMILY_DATA_DIR`) z kopią seed, nigdy na samym seed.
- `scripts/validate-data.ts` waliduje plik schematem i regułami relacji. Uruchamiany w CI na seed, a lokalnie (`pnpm validate:data`) na folderze danych.
- `scripts/optimize-photos.ts` jednorazowo konwertuje do WebP zdjęcia wrzucone do `photos/` ręcznie (te same parametry co upload).
- **GitHub Actions `ci.yml`:** pnpm install, lint, typecheck, testy jednostkowe, walidacja seed, build, e2e. Uruchamiany na PR i push do main.
- Praca na gałęziach feature, Conventional Commits, PR do main. Przed ogłoszeniem ukończenia uruchamiane są lint, typecheck, testy i build.

## 8. Przygotowanie pod przyszłą publikację (bez implementacji w MVP)
- Pole `living` jest w modelu i formularzu.
- Repozytorium danych za interfejsem (`repository.ts`), więc build produkcyjny umie już ładować dane statycznie i działać tylko do odczytu.
- Folder danych jest poza `public/`, więc nic nie trafi do buildu przypadkiem.
- Później: `deploy.yml` jako osobny workflow, filtr prywatności w buildzie (zmienna środowiskowa), wybór hostingu (Cloudflare Pages + Access przy prywatnych danych). Decyzję trzeba będzie podjąć osobno, bo dane muszą trafić do CI z prywatnego repo.

## 9. Kryteria akceptacji MVP
1. Świeży klon + `pnpm install` + `pnpm dev` uruchamia aplikację na danych demo z belką i przyciskiem „Rozpocznij własne drzewo”.
2. Po rozpoczęciu własnego drzewa można bez zaglądania do pliku zbudować 3 pokolenia: dodać osoby przez „+”, uzupełnić daty z kwalifikatorami, dodać zdjęcie, notatki i znacznik „do potwierdzenia”.
3. Każda zmiana jest w `data/family/family.json` w ciągu ok. 1 s, a plik przechodzi `pnpm validate:data`.
4. `git status` w repozytorium kodu nie pokazuje żadnych plików z folderu danych.
5. Drzewo spełnia właściwości z 6.4 na danych seed.
6. Wyszukiwarka, lista „Do sprawdzenia”, „Wyśrodkuj na mnie” i przełącznik motywu działają.
7. Próba utworzenia cyklu lub trzeciego rodzica biologicznego jest blokowana z komunikatem.
8. CI przechodzi na PR. README (po polsku) opisuje uruchomienie, strukturę, edycję danych i założenie prywatnego repozytorium danych, ze zrzutem ekranu na danych demo.

## 10. Struktura projektu

### 10.1 Według briefu
Jak w briefie: `.github/workflows/`, `.vscode/`, `data/`, `docs/{specs,plans,decisions}/`, `scripts/`, `vite-plugins/`, `src/{app,domain,data,features/{tree,person,editor,search},stores,components/ui,shared,styles}/`, `tests/e2e/`, pliki konfiguracyjne w korzeniu, `CLAUDE.md`, README po polsku. Konwencje nazewnictwa, alias `@/`, `index.ts` jako publiczne API feature'a, testy jednostkowe obok plików.

### 10.2 Odstępstwa (zaakceptowane w rozmowie)
- **Zdjęcia w `data/family/photos/` zamiast `public/photos/`**, żeby nie trafiły do buildu i nie zostały przypadkiem opublikowane.
- **`data/family/` to osobne, prywatne repozytorium**, ignorowane w repozytorium kodu. `data/family.json` z briefu zamienia się w `data/family/family.json`.
- **Brak `deploy.yml` w MVP.**
- Decyzja wykonawcy (do potwierdzenia przy planie): lista „Do sprawdzenia” jako osobny feature `src/features/research/`, a ekran powitalny w `src/app/` (np. `src/app/splash/`).

### 10.3 ADR do zapisania w `docs/decisions/`
- 0001: dane rodziny poza repozytorium kodu (prywatne repo danych),
- 0002: publikacja odłożona poza MVP,
- 0003: automatyczny zapis zamiast przycisku „Zapisz”.

## 11. Pozostawione wykonawcy
- Konfiguracja elkjs i sposób modelowania par i związków w grafie.
- Dokładna paleta kolorów, typografia, ikony i animacje w ramach opisanego stylu.
- Podział na komponenty, store'y i composables w ramach struktury.
- Generowanie identyfikatorów, format nazw plików tymczasowych, szczegóły endpointów wtyczki.
- Wersje bibliotek (aktualne stabilne, sprawdzone w Context7) i konfiguracja narzędzi.
- Treść danych demo w ramach wymagań z 4.1.
