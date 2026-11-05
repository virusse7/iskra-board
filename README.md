# Iskra

Statyczna tablica pomysłów: przeciąganie karteczek i tła, połączenia, eksport/import.
Bez konfiguracji Supabase działa lokalnie. Po konfiguracji wspólny pokój jest identyfikowany
losowym sekretem w części `#room=...` adresu. Skopiuj cały adres dla drugiej osoby.
Każdy posiadacz pełnego linku może czytać i zmieniać tablicę.

## Uruchomienie współdzielenia

1. Utwórz projekt na https://supabase.com/dashboard (plan Free wystarcza na początek).
2. W SQL Editor uruchom zawartość `supabase/schema.sql` jeden raz.
3. W ustawieniach projektu skopiuj Project URL i publiczny Publishable key (lub legacy anon key).
4. Wpisz je do `dist/config.js`. **Nigdy nie umieszczaj tam secret key, service_role ani hasła bazy.**
5. Otwórz stronę. Kliknij „Link dla wspólnika” i przekaż cały link.
6. Opcjonalnie kliknij „Przenieś lokalne pomysły” w przeglądarce, która zawiera starą tablicę.

Dane synchronizują się co sekundę przez RPC. Tabela ma RLS i nie pozwala na bezpośredni
odczyt ani zapis przez publiczny klucz. RPC sprawdza sekret pokoju; nie ma publicznej listy pokoi.
Zmiany różnych pól są scalane pod blokadą wiersza. Przy edycji tego samego pola wygrywa ostatni zapis.
Zmiany zdalne pojawiają się po zakończeniu pisania lub przeciągania. Niewysłane zmiany są
przechowywane lokalnie i ponawiane po odzyskaniu połączenia.

## GitHub Pages

Wymaga autoryzacji `gh auth login`. Repozytorium ma być publiczne, zgodnie z wybraną konfiguracją.
Sekret pokoju pozostaje wyłącznie w pełnym linku przekazywanym uczestnikom.
W Settings → Pages wybierz Source: GitHub Actions. Workflow publikuje `dist/` po pushu na `main`.
Nie publikuj sekretu pokoju w repozytorium ani w konfiguracji.

## Stan weryfikacji

Sprawdzona składnia JavaScript oraz działający docelowy Supabase: tworzenie pokoju,
odczyt zmian przez oddzielne żądania, scalanie pól, usuwanie oraz blokada bezpośredniego
odczytu tabeli. Test interakcji dwóch przeglądarek i ponownego połączenia pozostaje do wykonania.
