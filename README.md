# Iskra — wspólna tablica uruchamiana lokalnie

Aplikacja działa osobno na dwóch komputerach. Obie przeglądarki łączą się przez internet
z **jednym projektem Supabase**. Nie ma hostingu, GitHub Pages ani kont użytkowników aplikacji.
Repozytorium `iskra-board` ma być **prywatne**. Przyszła gra będzie w oddzielnym repozytorium.

Zachowane funkcje: karteczki, kolory, edycja tekstu, przeciąganie karteczek i pustego tła,
łączenie liniami, usuwanie, eksport/import JSON i tablica 4800 × 3600 px.

## Pierwsze uruchomienie — na KAŻDYM komputerze

1. Zainstaluj Node.js **22 lub nowszy** (LTS) i Git.
2. Właściciel dodaje drugą osobę jako współpracownika prywatnego repozytorium GitHub.
   Druga osoba akceptuje zaproszenie. Dostęp do repozytorium to osobna sprawa od dostępu do tablic.
3. Sklonuj repozytorium (zamień `TWOJ_LOGIN` na login właściciela):

   ```sh
   git clone https://github.com/TWOJ_LOGIN/iskra-board.git
   cd iskra-board
   npm start
   ```

4. Otwórz **http://localhost:3000**. Terminal pozostaw otwarty.
5. Zatrzymanie: **Ctrl+C** w terminalu. Kolejny start: `cd iskra-board`, następnie `npm start`.

Nie trzeba wykonywać `npm install` — projekt nie ma zależności zewnętrznych ani etapu budowania.
Nie otwieraj `index.html` jako pliku `file://`; używaj lokalnego serwera.
Serwer nasłuchuje wyłącznie na `127.0.0.1`, nie udostępnia projektu w sieci lokalnej.

### Gdy port jest zajęty

macOS / Linux:

```sh
PORT=3001 npm start
```

PowerShell:

```powershell
$env:PORT=3001
npm start
```

Otwórz wtedy http://localhost:3001. Komputery mogą używać różnych portów.

## Jak wejść na TĘ SAMĄ tablicę

1. Osoba A otwiera aplikację. Nowa tablica otrzymuje losowy, 64-znakowy **klucz dostępu**.
2. A klika **Kopiuj link do tablicy** albo **Kopiuj klucz tablicy** i przekazuje go B prywatnie.
3. Osoba B uruchamia własne `npm start`, otwiera własny adres localhost i klika **Dołącz do tablicy**.
4. B wkleja pełny link A lub sam klucz i klika **Otwórz tablicę**.
5. Aplikacja przenosi tylko klucz do lokalnego adresu B — nie łączy się z komputerem A.
   Dlatego link z portem 3000 można wkleić w aplikacji działającej na porcie 3001.

**Nowa wspólna tablica** tworzy nowy klucz; poprzednia tablica pozostaje w Supabase.
Zachowaj jej pełny link/klucz, aby wrócić. Nie ma publicznej listy tablic ani odzyskiwania
zgubionych kluczy przez aplikację. Sam login GitHub ani klucz publishable nie daje listy tablic.

## Supabase — wspólny projekt

`dist/config.js` zawiera publiczną konfigurację istniejącego projektu:
`https://cblmjnfnvmrbkploapvt.supabase.co`. Oba komputery mają korzystać z tego samego pliku.
Publiczny klucz `sb_publishable_…` jest przeznaczony do przeglądarki, nie jest hasłem bazy.
**Nie dodawaj service_role, sb_secret, haseł bazy ani osobistych tokenów do żadnego pliku projektu.**

Nie uruchamiaj ponownie `supabase/schema.sql` na obecnym projekcie — schemat już istnieje.
Plik służy jako zapis konfiguracji i do pierwszej instalacji na NOWYM pustym projekcie.
Przed zmianą schematu lub RLS istniejącej bazy potrzebna jest osobna zgoda i kontrolowana migracja.

Jeśli lokalnie chcesz nadpisać konfigurację, utwórz ignorowany przez Git plik
`dist/config.local.js`:

```js
window.ISKRA_CONFIG = {
  supabaseUrl: 'https://TWOJ_PROJEKT.supabase.co',
  publishableKey: 'sb_publishable_TUTAJ_PUBLICZNY_KLUCZ'
};
```

Używamy wyłącznie publishable key. Klient odrzuca pozostałe typy kluczy.

### Realtime i zapis

- Źródłem prawdy jest istniejące RPC `iskra_sync`. Zmiany są zapisywane na poziomie pól.
- Supabase Realtime Broadcast przekazuje wyłącznie puste powiadomienie „zmieniło się”.
  Odbiorca pobiera dane przez RPC ze swoim kluczem tablicy. Dane i klucz tablicy nie są broadcastowane.
- Nie trzeba włączać Postgres Changes ani otwierać odczytu tabeli `iskra_rooms`.
- Temat kanału jest osobnym skrótem SHA-256 od klucza tablicy. Nie jest kluczem RPC ani skrótem zapisanym w tabeli.
- Publiczne kanały Broadcast muszą być dozwolone w ustawieniach Realtime projektu.
  Jeżeli są wyłączone, nie zmieniaj uprawnień pochopnie: aplikacja nadal działa w trybie zapasowym.
- Status **Połączono · Realtime** potwierdza subskrypcję; **tryb zapasowy (5 s)** oznacza
  odpytywanie RPC bez ręcznego odświeżania. Po awarii WebSocket aplikacja próbuje połączyć się ponownie.
- Zapis jest wysyłany po krótkim opóźnieniu 150 ms. Niewysłane zmiany są przechowywane
  lokalnie i ponawiane po odzyskaniu połączenia. Błędy dostępu lub konfiguracji też wyświetlą brak połączenia.
- Podczas pisania lub przeciągania aktualizacje zdalne czekają do zakończenia edycji,
  aby nie zabierać kursora. W razie jednoczesnej edycji tego samego pola wygrywa ostatni zapis.
- Eksport JSON pozostaje ręczną kopią zapasową. Import dotyczy obecnie otwartej tablicy.

## Dostęp i RLS

Tabela `iskra_rooms` ma włączone RLS. Role `anon` i `authenticated` nie mają bezpośrednich
uprawnień SELECT/INSERT/UPDATE/DELETE. Nie dodajemy reguły `using (true)`.
RPC działa z `SECURITY DEFINER`, pustym `search_path` i wybiera pojedynczy wiersz na podstawie
SHA-256 przekazanego, losowego 256-bitowego klucza. Parametr nie jest nazwą tabeli ani ścieżką SQL.
Znajomość klucza jednej tablicy nie pozwala odczytać innych tablic ani innych tabel projektu.

**Klucz tablicy jest sekretem dostępu typu bearer**, a nie publicznym numerem tablicy.
Każda osoba, której przekażesz cały link/klucz, może czytać i edytować tę tablicę.
Nie publikuj linków, kluczy tablic ani ich zrzutów w repozytorium, issue lub logach.
Fragment `#room=…` nie jest wysyłany do lokalnego serwera HTTP, ale klucz trafia przez HTTPS
w treści żądania RPC do Supabase. Jest też przechowywany na Twoim urządzeniu w przeglądarce.

Brak kont oznacza brak indywidualnego cofania dostępu i identyfikacji autorów.
Po ujawnieniu klucza przenieście dane do nowej tablicy z nowym kluczem.
Publiczny endpoint pozwala tworzyć nowe tablice; do szerokiej publicznej dystrybucji potrzebna
byłaby dodatkowa ochrona przed nadużyciami i limitowanie żądań. To narzędzie dla Waszej dwójki.

## Aktualizowanie aplikacji

Zatrzymaj serwer, wykonaj `git pull`, ponownie `npm start` i odśwież lokalną stronę.
Nie resetuj ani nie nadpisuj własnych zmian. Dane tablic pozostają w Supabase.

## Testy

```sh
npm test
npm run test:integration
```

`npm test`: składnia, klucze i linki z różnych portów, scalanie pól, usuwanie połączeń,
operacje offline, ochrona przed prototype pollution, protokół Realtime i lokalny serwer.

Test integracyjny wymaga internetu i łączy się z projektem skonfigurowanym w `dist/config.js`
(lub lokalnym nadpisaniu). Tworzy dwie odrębne testowe tablice, testuje RPC, izolację tablic,
blokadę bezpośredniego odczytu i zapisu oraz **dwa rzeczywiste połączenia Realtime**.
Nie modyfikuje istniejących tablic, schematu ani RLS. Po teście pozostają dwa rekordy testowych
pokoi; zawartość testowych karteczek jest usuwana tylko we własnym pokoju testowym.

Test ręczny na dwóch komputerach: wejdźcie tym samym kluczem, dodajcie różne karteczki,
połączcie je, zmieńcie kolory i położenie, usuńcie połączenie. Sprawdźcie zmiany po obu
stronach bez odświeżania. Następnie na jednym komputerze wyłączcie internet, edytujcie karteczkę,
włączcie internet i sprawdźcie ponowne połączenie. Jeśli trwa edycja tekstu, kliknijcie puste tło.

## Utworzenie PRYWATNEGO repozytorium, gdy agent nie ma dostępu do GitHuba

W Terminalu, w katalogu tego projektu (nie w katalogu innego repozytorium):

```sh
gh auth login
git status
git remote -v
```

Jeśli `origin` już istnieje, upewnij się, że jest to właściwe prywatne `iskra-board`.
Nie nadpisuj adresu innego repozytorium. W obecnym przygotowanym katalogu Git jest już
zainicjalizowany i nie ma remote. Następnie:

```sh
git add -A
git diff --cached --stat
git commit -m "Prepare Iskra for local collaboration with Supabase Realtime"
gh repo create iskra-board --private --source=. --remote=origin --push
gh repo view --json nameWithOwner,isPrivate,url
```

Sprawdź, że `isPrivate` wynosi `true`. Nie włączaj Pages. Jeżeli repozytorium o tej nazwie
już istnieje, zatrzymaj się i sprawdź jego właściciela oraz zawartość — nie nadpisuj go.
Nie używaj `--force`. Przed commitem sprawdź listę plików: nie powinno być `.env`,
`config.local.js`, logów ani linków/kluczy tablic. Nie ma potrzeby zmiany globalnej konfiguracji Git.

Bez CLI: utwórz na GitHub repozytorium `iskra-board`, wybierz **Private**, nie dodawaj
README ani `.gitignore`, a potem użyj instrukcji GitHub dla przesłania istniejącego repozytorium.
Dodaj wspólnika przez Settings → Collaborators; konto GitHub jest potrzebne do klonowania,
nie do korzystania z uruchomionej aplikacji.

Dotychczasowa strona Sites nie jest potrzebna do działania lokalnego. Ta zmiana nie usuwa
wcześniejszej publikacji ani jej danych i nie wykonuje nowego wdrożenia.

## Motyw i nazwy pomysłów

Przycisk w nagłówku przełącza jasny/ciemny motyw. Wybór jest zapamiętywany lokalnie
na każdym komputerze; bez własnego wyboru aplikacja korzysta z motywu systemu.
Kliknij nazwę nad treścią karteczki, aby ją zmienić (maks. 120 znaków). Pusta nazwa
wyświetla dotychczasowy placeholder „POMYSŁ 01”. Stare tablice i eksporty pozostają zgodne.
Nazwy są osobnym polem, synchronizowanym tak jak treść, położenie i kolor.

**Jednorazowa aktualizacja Supabase:** zastosowana 5 listopada 2026 w obecnym projekcie za zgodą właściciela. Na innej bazie właściciel musi zatwierdzić i uruchomić
`supabase/migrations/20261105_idea_titles.sql` w SQL Editor. Zmiana rozszerza walidację
RPC o pole `title`, nie zmienia RLS ani tabel i nie usuwa danych. Nie uruchamiaj ponownie
`schema.sql`. Do czasu zastosowania migracji zapis niestandardowych nazw będzie odrzucany
przez dotychczasowe RPC. Obie osoby powinny zaktualizować klienta.

## Zmiana rozmiaru karteczki

Przeciągnij trójkątny uchwyt w prawym dolnym rogu całej karteczki. Tekst dopasowuje
się do miejsca, a połączenia przesuwają się razem z jej środkiem. Rozmiar zapisuje się
po puszczeniu uchwytu i synchronizuje z drugim komputerem. Uchwyt obsługuje też
strzałki (10 px) i Shift + strzałki (50 px). Minimalny rozmiar: 210 × 194 px, maksymalny:
1200 × 1200 px, z ograniczeniem do obszaru tablicy.

Migracja `supabase/migrations/20261105_card_sizes.sql` dopuszcza opcjonalne pola
`width` i `height` w RPC. Nie usuwa danych i nie zmienia tabel ani RLS. Na obecnym
projekcie zastosowana za zgodą właściciela; na nowej bazie uruchom ją po migracji nazw.
