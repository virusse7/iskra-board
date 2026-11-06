# Iskra — kontrola przed publiczną publikacją

Stan: 6 listopada 2026. Kod przygotowany do jednej istniejącej tablicy i GitHub Pages.
Samo przygotowanie nie zmienia widoczności repozytorium ani nie publikuje strony.

## Zmiana po poprzednim audycie

Blokadę nieograniczonego tworzenia tablic usunięto migracją
`supabase/migrations/20261106_single_board.sql`, wdrożoną po wyraźnej zgodzie właściciela.
RPC nie tworzy już rekordów `iskra_rooms`. Chroniona tabela `iskra_active_board` wskazuje
jeden istniejący rekord; inne klucze, także należące do starych tablic, są odrzucane.
Nie skasowano żadnych tablic ani rekordów.

W produkcyjnej transakcji porównano liczbę rekordów oraz skrót obejmujący zawartość
wszystkich tablic i ich daty aktualizacji przed i po migracji — identyczne. W tej samej
transakcji wywołanie RPC nieznanym kluczem zostało odrzucone i nie zwiększyło liczby rekordów.
Nie wykonywano testu obciążeniowego.

## Sekrety i historia

Gitleaks 8.30.1 objął aktualne pliki repozytorium (w tym przygotowane zmiany) i całą
lokalnie dostępną historię wszystkich gałęzi oraz reflogów. Jedynym dopasowaniem był
publiczny klucz Supabase publishable w konfiguracji. Nie znaleziono prywatnych sekretów.
Poprzedni pełny przegląd objął 6 dostępnych commitów, 42 bloby, także obiekty spoza
bieżącego drzewa. Nie znaleziono historycznych plików .env ani prywatnych poświadczeń.
Skanowanie wzorców nie stanowi gwarancji wykrycia każdego możliwego sekretu.

Nie zapisano klucza tablicy w kodzie, konfiguracji, workflow, raporcie ani migracji.
Wybór produkcyjnej tablicy odbył się przez sesyjny parametr ze skrótem klucza,
przekazanym wyłącznie do panelu administracyjnego. Jawny klucz pozostał w prywatnym
linku i pamięci przeglądarki. Nie kopiuj takiego linku do publicznych zgłoszeń lub logów.

## Testy

- `npm test`: 22 testy pozytywne, w tym rzeczywisty PostgreSQL PGlite z wykonaniem
  migracji, zachowaniem danych, kontrolą liczby rekordów, uprawnieniami anon,
  dozwolonym zapisem głównej tablicy i odrzuceniem klucza innej istniejącej tablicy.
- `npm run test:integration`: działający Supabase odrzuca odczyt/zapis nieznanym kluczem;
  bezpośrednie GET/POST/PATCH/DELETE do obu chronionych tabel są niedozwolone.
  Test nie tworzy rekordów i nie zmienia zapisanych pomysłów.
- Dwie sesje przeglądarki odczytały cztery istniejące pomysły i połączyły się z Realtime.
  Nie edytowano pomysłów produkcyjnych w celu testu.
- Sprawdzono widok 390 × 844 i desktop; zachowano eksport również na telefonie.
  Nie wykonano fizycznego testu na drugim komputerze i prawdziwym telefonie.
- `git diff --check`: bez błędów.

## Pozostałe właściwości dostępu

Posiadanie prywatnego linku pozwala czytać i edytować jedyną tablicę. Nie ma kont,
indywidualnego cofania dostępu ani identyfikacji autorów. Publikacja frontendu nie
publikuje danych tablicy; sam publiczny adres pokazuje ekran dostępu.

Realtime wysyła tylko puste powiadomienia. Dane nadal są odczytywane przez RPC
weryfikujące klucz. Zapasowy polling działa co 5 s. Usunięcie tworzenia rekordów nie
zastępuje zabezpieczeń infrastruktury przed przeciążeniem lub nadużyciem już ujawnionego klucza.

Starsze migracje zachowano jako historię; nie uruchamiaj ich ponownie na produkcji,
ponieważ przywróciłyby dawną funkcję tworzącą rekordy.

## Publikacja

Workflow Pages jest ręczny, ma ograniczone uprawnienia i pakuje wyłącznie jawnie
wskazane pliki aplikacji. Nie pakuje lokalnych konfiguracji, node_modules, testów
ani outputs. Zasoby są względne względem /iskra-board/.

Przed publiczną publikacją należy scalić właściwą gałąź, potwierdzić ustawienia
repozytorium i Pages, uruchomić workflow, a następnie zweryfikować działający adres
z prywatnym kluczem na obu urządzeniach. Właściciel ma instrukcje w README.

## Aktualizacja mobilna, checklisty i zoom — 6 listopada 2026

Migrację `20261106_checklists.sql` wdrożono po wyraźnym zatwierdzeniu właściciela.
Zastępuje wyłącznie RPC. Transakcyjna kontrola liczby rekordów oraz skrótu zawartości
potwierdziła brak zmian w istniejących danych. Nie zmieniono RLS, tabel ani ograniczenia
do jednej głównej tablicy; funkcja nadal nie tworzy rekordów iskra_rooms.

Punkty checklist mają walidowane pola i osobne identyfikatory. Zmiany text/done są
zapisywane niezależnie, a znaczniki usunięcia chronią przed przywróceniem punktu przez
spóźnioną edycję lub ponowienie starego żądania. Operacja utworzenia jest idempotentna.
Zapis długich checklist dzielony jest na paczki uwzględniające rozmiar UTF-8.
Wartości trafiają do elementów input/textarea, a nie do HTML generowanego z treści użytkownika.

Wykonano 34 testy pozytywne, w tym rzeczywiste operacje PostgreSQL: migracja bez utraty
danych, scalanie niezależnych zmian punktów, usunięcia, walidacja oraz odmowa obcego klucza.
Test działającego Supabase potwierdził dalszą blokadę nieznanych kluczy i bezpośredniego
GET/POST/PATCH/DELETE do obu tabel. Skan Gitleaks historii i aktualnych plików nie znalazł
prywatnych sekretów; dopasowania dotyczą tylko dozwolonego publishable key.

Testy interfejsu wykonywano na osobnej lokalnej kopii danych, bez połączenia do Supabase:
edycja i zaznaczanie zadań, postęp, dodawanie punktów, ponowne otwarcie, przeciąganie,
aktualizacja linii, przyciski zoomu, zoom kółkiem i widok 390 × 844 z wysuwanym panelem.
Produkcja została odczytana kontrolnie i zachowała wszystkie obecne karteczki oraz Realtime.
Nie wykonywano testowych zmian w treści istniejących pomysłów.

Pinch-to-zoom i dotykowe Pointer Events objęto testami automatycznymi, w tym przerwanie
przeciągania przez drugi palec oraz poprawne współrzędne przy 200%. Nie wykonano testu
na fizycznym telefonie ani jednoczesnego ręcznego testu dwóch fizycznych urządzeń.

Workflow Pages uzupełniono o nowe moduły i CSS; test kontroluje kompletność zasobów.
Nie pakuje serwera testowego, danych testowych, node_modules ani outputs. Nie zmieniano
widoczności repozytorium ani ustawień hostingu w ramach przygotowania tej aktualizacji.
