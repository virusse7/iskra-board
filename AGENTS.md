# Iskra — zasady pracy

Pracuj wyłącznie w katalogu tego projektu i repozytorium GitHub `iskra-board`.
Przed zmianami sprawdź `pwd`, `git remote -v` i stan Git. Nie przeglądaj ani nie
modyfikuj innych repozytoriów. Jeśli remote wskazuje repozytorium o innej nazwie,
zatrzymaj się. Brak remote jest dozwolony przy przygotowaniu tego projektu przed
utworzeniem prywatnego repozytorium. Nie zmieniaj globalnej konfiguracji systemu.

Zachowuj wygląd oraz działające funkcje. Stosuj małe, czytelne zmiany i istniejące
rozwiązania; nie dodawaj zależności bez uzasadnienia. Komunikuj się po polsku.
Uruchamiaj `npm test` i odpowiednie testy integracyjne. Nie twierdź, że wykonano
test przeglądarkowy lub produkcyjny, jeżeli nie został wykonany.

Nie zapisuj w Git sekretów, linków z kluczami tablic, haseł, `.env`, service_role
ani kluczy sb_secret. Klucz publishable jest publiczną konfiguracją klienta.
Nie wysyłaj kodu do innego repozytorium. Projekt gry będzie osobnym repozytorium.
Projekt działa lokalnie i jest przygotowany do GitHub Pages pod /iskra-board/.
Nie uruchamiaj publikacji ani nie zmieniaj widoczności repo bez polecenia i pozytywnego audytu.
Migracja jednej tablicy musi być wdrożona i przetestowana przed publiczną publikacją.

Przed destrukcyjnymi operacjami, zmianami RLS, schematu lub uprawnień produkcji
przedstaw skutki i uzyskaj wyraźną zgodę. Zachowuj dotychczasowe migracje.
Nie usuwaj danych ani nie wykonuj force push. Repozytorium ma pozostać prywatne.
Nie zmieniaj głównej gałęzi, nie twórz commitów ani PR bez polecenia, chyba że
bieżące zadanie wyraźnie wymaga utworzenia repozytorium i przesłania projektu.
