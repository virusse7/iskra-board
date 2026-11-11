# Iskra — jedna wspólna tablica

Frontend HTML/CSS/JavaScript, Node.js do pracy lokalnej, wspólny Supabase RPC i Realtime.
Docelowa strona: https://virusse7.github.io/iskra-board/ — dostęp do danych wymaga pełnego
**prywatnego linku z kluczem w #room=…**. Sam publiczny adres pokazuje ekran dostępu.
Nie ma kont użytkowników, tworzenia nowych tablic ani wyboru innych tablic.

## Uruchomienie lokalnie na obu komputerach

Wymagany Node.js 22+ i Git. Każda osoba wykonuje:

```sh
git clone https://github.com/virusse7/iskra-board.git
cd iskra-board
npm start
```

Jeżeli repozytorium nadal jest prywatne, właściciel musi dodać wspólnika jako współpracownika.
Otwórz otrzymany prywatny link, zmieniając tylko jego początek na `http://localhost:3000/`
i pozostawiając część `#room=…`. Prawidłowy klucz jest zapamiętywany w przeglądarce
po potwierdzeniu dostępu przez Supabase. Na nowym urządzeniu otwórz ponownie pełny prywatny link.
Nie otwieraj index.html przez file://. Terminal pozostaw otwarty, zatrzymanie przez Ctrl+C.
Serwer nasłuchuje wyłącznie na 127.0.0.1.

Bez instalowania zależności można uruchomić samą aplikację. Do testów użyj `npm ci --ignore-scripts`.
Jedyna zależność deweloperska to PGlite — odizolowany PostgreSQL do testów migracji.
Nie jest wysyłana do przeglądarki ani na Pages.

Inny port: `PORT=3001 npm start` (macOS/Linux) lub `$env:PORT=3001; npm start` (PowerShell).
Podgląd ścieżki Pages lokalnie: http://localhost:3000/iskra-board/ z tym samym prywatnym fragmentem.
Aktualizowanie: zatrzymaj serwer, `git pull --ff-only`, ponownie `npm start`, odśwież stronę.

## Zachowane funkcje

Karteczki z własnymi nazwami, tekstem i kolorami, przesuwanie karteczek oraz tła,
łączenie i usuwanie linii, eksport/import JSON, tablica 4800 × 3600 px, ciemny motyw.
Uchwyt w dolnym prawym rogu zmienia rozmiar całej karteczki. Strzałki: 10 px,
Shift + strzałki: 50 px. Rozmiar zapisuje się po puszczeniu uchwytu.
Przy dodawaniu i przesuwaniu karteczki zachowują 16 px odstępu. Powiększanie zatrzymuje
się przed sąsiadem. Otworzenie istniejącej tablicy nie przestawia jej zapisanych karteczek.
Import modyfikuje obecną tablicę — nie tworzy nowego rekordu tablicy.

„Kopiuj prywatny link” używa docelowego adresu Pages, także przy pracy lokalnej.
Zanim Pages zostanie uruchomione, wspólnik może otworzyć ten link po zamianie początku
na swój localhost. Klucz nie jest umieszczany w publicznych plikach ani konfiguracji.

## Jedna tablica i bezpieczeństwo Supabase

Publiczna konfiguracja istniejącego projektu jest w `dist/config.js`: Project URL,
klucz **publishable** oraz publiczny adres strony. To konfiguracja klienta, nie sekrety.
Nigdy nie dodawaj service_role, sb_secret, haseł, osobistych tokenów, klucza tablicy
ani całego prywatnego linku do Git, workflow, screenshotów z paskiem adresu lub logów.

Migracja `supabase/migrations/20261106_single_board.sql` została zastosowana 6 listopada
2026 za zgodą właściciela dla głównej tablicy z wcześniejszymi pomysłami. Nie uruchamiaj
ponownie migracji ani `schema.sql` na działającym projekcie.

- `iskra_sync` **nie wykonuje INSERT do iskra_rooms**; odczytuje i aktualizuje wyłącznie
  istniejący wiersz wskazany w chronionej `iskra_active_board`.
- `iskra_active_board` zawiera tylko jeden wpis ze skrótem klucza. Ma RLS i odebrane
  bezpośrednie uprawnienia public/anon/authenticated. Nie zawiera jawnego klucza.
- Wszystkie rekordy starych tablic pozostają w `iskra_rooms`, ale RPC ich nie udostępnia.
- Nieznany, pusty, błędny lub prawidłowy klucz innej tablicy otrzymuje odmowę dostępu.
- `iskra_rooms` nadal ma RLS i brak bezpośrednich uprawnień anon/authenticated.
- RPC działa z SECURITY DEFINER i pustym search_path. Sekret sprawdzany jest po SHA-256.
- Dowolna osoba posiadająca pełny prywatny link ma uprawnienia do czytania i edycji
  wspólnej tablicy. Nie ma rozróżnienia autorów ani indywidualnego cofania dostępu.
- Brak tworzenia rekordów usuwa poprzednią blokadę audytu związaną z nieograniczonym
  tworzeniem tablic. Nie zastępuje to ogólnej ochrony infrastruktury przed przeciążeniem.

Klucz jest w fragmencie URL i pamięci przeglądarki. Fragment nie trafia do GitHub Pages
w żądaniu HTTP; klucz jest przekazywany do Supabase w treści żądania HTTPS. Strona
ustawia referrer=no-referrer. Utrata pamięci przeglądarki wymaga ponownego prywatnego linku.
Na stronie bez klucza nie ma formularza do wybierania/dołączania do innych tablic.

Dla NOWEJ instalacji na innej bazie: uruchom schema.sql, kolejne migracje, wskaż skrót
już istniejącego rekordu przez sesyjny `iskra.allowed_board_hash`, dopiero wtedy uruchom
migrację jednej tablicy. Ten krok jest operacją administratora wymagającą osobnej zgody;
klucz tablicy nie może trafić do pliku migracji. Migracja wycofuje się, jeżeli nie wskazano
istniejącej tablicy. Nie przywracaj starszych wersji RPC: umożliwiały tworzenie rekordów.

## Synchronizacja i tryb offline

RPC zapisuje zmienione pola. Realtime Broadcast przekazuje tylko puste powiadomienie,
nie dane ani klucz. Temat jest osobnym SHA-256 od klucza. Odbiorca ponownie czyta RPC.
Bez Realtime działa zapasowe odpytywanie co 5 s. Przywrócenie sieci ponawia połączenie.
Oczekujące operacje zapisują się lokalnie; przed ich wysłaniem po ponownym otwarciu aplikacja
najpierw weryfikuje klucz odczytem bez zmian. Podczas pisania/przeciągania zdalne zmiany
czekają do zakończenia edycji. Jednoczesna zmiana tego samego pola: ostatni zapis wygrywa.
Eksport JSON jest dodatkową ręczną kopią zapasową.

## Testy i audyt

```sh
npm ci --ignore-scripts
npm test
npm run test:integration
```

`npm test` obejmuje rzeczywisty PostgreSQL PGlite: zachowanie wszystkich rekordów i ich
zawartości po migracji, dozwolony odczyt/zapis głównej tablicy jako anon, odmowę dla
nieznanego klucza i klucza innej istniejącej tablicy, brak nowych rekordów i brak dostępu
bezpośredniego do obu tabel. Obejmuje też synchronizację offline, geometrię, motyw i serwer.

Test integracyjny na działającym Supabase nie wymaga sekretnego klucza. Sprawdza, że
losowy klucz otrzymuje odmowę odczytu/zapisu, oraz blokadę GET/POST/PATCH/DELETE do obu
tabel. Nie tworzy rekordów i nie zmienia danych. Zachowanie licznika rekordów sprawdzono
również w produkcyjnej transakcji wdrażającej migrację. Nie używaj starego testu, który tworzył pokoje.

## GitHub Pages — przygotowane, bez automatycznej publikacji

Workflow `.github/workflows/pages.yml` uruchamia się **wyłącznie ręcznie**. Instaluje
zależności testowe, uruchamia testy i pakuje wskazane pliki statyczne z dist/. Nie pakuje
lokalnych nadpisań konfiguracji, outputs/, testów, node_modules ani żadnego klucza tablicy.
Ścieżki skryptów są względne, działają pod `/iskra-board/`. Serwer Node nie jest potrzebny na Pages.

Dopiero po potwierdzonej migracji i pozytywnym audycie właściciel może:

1. Scalić zatwierdzoną gałąź ze zmianami do main.
2. W Settings → General → Danger Zone ustawić Public, jeżeli nadal chce publicznej publikacji.
3. W Settings → Pages wybrać Source: GitHub Actions.
4. W Actions wybrać „Deploy Iskra to GitHub Pages” → Run workflow na main.
5. Po sukcesie otworzyć docelowy adres, a dane sprawdzić przez prywatny link z kluczem.
6. Na telefonie i drugim komputerze otworzyć pełny prywatny link, sprawdzić synchronizację.

Samo przesłanie gałęzi nie zmienia widoczności i nie wdraża strony. Nie uznawaj adresu
Pages za działający, dopóki workflow i test wdrożenia nie potwierdzą sukcesu.

## Aktualizacja: telefon, checklisty i zoom

Interfejs telefonu/tabletu ma wysuwany panel „☰”, pełną szerokość przestrzeni roboczej
oraz przyciski dostosowane do dotyku. Przeciągnij puste tło jednym palcem, a karteczkę
za uchwyt „⠿” lub jej pusty fragment. Dotknięcie tytułu, tekstu i punktów listy rozpoczyna
edycję. Zawartość karteczki przewija się niezależnie; przypadkowe zaznaczanie i gesty
cofania strony są blokowane na przestrzeni roboczej.

Zoom 25–250% działa kółkiem, gestem pinch i przyciskami −/+. Przycisk ↺ resetuje widok.
Zmiana skali nie zmienia zapisanych współrzędnych.
Narzędzie „Usuń połączenie” nadal działa dotykiem.

Kliknij „Dodaj checklistę” w karteczce. Dodawaj kolejne punkty przez „＋ Zadanie” lub Enter,
zaznaczaj wykonane zadania, edytuj ich tekst i usuwaj punkty przez ×. Licznik pokazuje
postęp. Brak stałego limitu liczby punktów w interfejsie; pojedynczy tekst punktu ma maks.
2000 znaków, a dotychczasowy limit całej tablicy 4 MB pozostaje. Przy długiej liście zawartość
karteczki przewija się. Stare karteczki nadal działają bez checklist.

Punkty mają osobne identyfikatory. Dodawanie dwóch różnych punktów, edycja tekstu i
zaznaczanie są scalane oddzielnie. Przy równoczesnej zmianie tego samego pola wygrywa
ostatni zapis. Usunięcie punktu pozostawia znacznik usunięcia: opóźniony zapis nie przywróci
zadania. Powtórzona operacja utworzenia nie resetuje zmian drugiej osoby. Import JSON
nadaje importowanym punktom nowe identyfikatory, pozwalając świadomie odtworzyć usunięte
zadania. Dane zapisują się w Supabase i lokalnej kolejce oczekującej na połączenie.

Migracja `supabase/migrations/20261106_checklists.sql` została wdrożona 6 listopada 2026
po zgodzie właściciela. Zmienia wyłącznie funkcję RPC — nie dodaje tabel, nie zmienia RLS,
nie otwiera tworzenia nowych tablic. Kontrola w transakcji potwierdziła zachowanie wszystkich
danych przed i po migracji. Na innej bazie wymaga osobnego zatwierdzenia; nie uruchamiaj
ponownie starszych migracji.

Dodatkowe moduły: `dist/app.js` (interfejs), `dist/viewport.js` (zoom/gesty),
`dist/interaction.css` (responsywność). Workflow Pages zawiera wszystkie te zasoby.
Testy obejmują zdarzenia Pointer Events, stałe współrzędne i operacje
checklist wykonywane w PostgreSQL. `node tests/preview-server.mjs` udostępnia opcjonalny
podgląd wyłącznie lokalnych danych testowych na localhost:31390, bez połączenia z Supabase.
Testowego serwera i danych nie publikuje się na Pages.

## Ułatwienia edycji karteczek i checklist

Pole opisu karteczki rozszerza się wraz z wpisywanym tekstem (do 900 px).
W miarę możliwości sama karteczka rośnie w pionie, zachowując odstęp od innych
karteczek; gdy nie ma miejsca, jej zawartość przewija się. Rozmiar karteczki
nadal można dostosować ręcznie uchwytem w prawym dolnym rogu.

W checklistach aktywne punkty są na górze, ukończone — na dole. Po odznaczeniu
punkt wraca do swojego pierwotnego miejsca wśród aktywnych zadań. Zmienia się
tylko kolejność wyświetlania, a nie zapisane identyfikatory, znaczniki czasu
czy kolejność utworzenia. Synchronizacja z Supabase działa bez migracji.

Podczas edycji kółko przewija karteczkę, dopóki jest w niej miejsce do przewinięcia.
Tekst opisu i zadań zawija się do szerokości karteczki, także dla długich adresów.
W checkliście Enter dodaje zadanie, Shift+Enter wstawia nowy wiersz.
