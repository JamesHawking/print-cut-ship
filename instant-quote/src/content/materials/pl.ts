// Polish copy for the material landing pages — the type source of truth
// (en.ts must satisfy the same Record). Engineer-to-engineer tone, concrete
// numbers consistent with data.ts; no prices in prose (tables own prices).
//
// TODO(launch): machine-drafted Polish — native-speaker review required
// before launch, together with src/lib/i18n/pl.ts.

import type { PublishedMaterialId } from './slugs'

export interface MaterialCopy {
  metaTitle: string
  metaDescription: string
  h1: string
  /** Value promise incl. the lead-time/delivery line. */
  promise: string
  useCases: string[]
  guidelines: string[]
  finishes: string[]
  faq: Array<{ q: string; a: string }>
}

export const plMaterialsCopy: Record<PublishedMaterialId, MaterialCopy> = {
  petg: {
    metaTitle:
      'Druk 3D z PETG — wytrzymałe części na zamówienie | MICRO_FACTORY',
    metaDescription:
      'Usługa druku 3D z PETG: 50 MPa na rozciąganie, znakomita adhezja warstw, odporność na wilgoć. Wycena w sekundach, wysyłka w 3 dni robocze, D+1 PL/DE.',
    h1: 'Druk 3D z PETG',
    promise:
      'PETG to nasz materiał pierwszego wyboru do części funkcjonalnych: łączy wytrzymałość ok. 50 MPa ze znakomitą adhezją międzywarstwową i odpornością na wilgoć, bez kaprysów przetwórczych ABS-u. Części wysyłamy w 3 dni robocze (termin standardowy), z dostawą D+1 w Polsce i Niemczech oraz D+2 w pozostałej UE — bez konta i bez minimalnych nakładów.',
    useCases: [
      'Obudowy elektroniki i panele montażowe',
      'Uchwyty, wsporniki i elementy maszyn pracujące wewnątrz budynków',
      'Prowadnice, osłony i elementy chwytaków w automatyce',
      'Prototypy funkcjonalne testowane pod rzeczywistym obciążeniem',
      'Części mające kontakt z wilgocią — kanały, obudowy czujników, zbiorniczki',
    ],
    guidelines: [
      'Minimalna grubość ścianki to 1,2 mm; cieńsze ścianki tracą sztywność i mogą prześwitywać. Dla elementów nośnych zalecamy 2,4 mm — dwie pełne ścieżki obrysu z każdej strony.',
      'Tolerancja wymiarowa wynosi ±0,3 mm na 100 mm. Otwory pod pasowania projektuj 0,2 mm większe od nominału albo przewidź rozwiercanie po druku.',
      'Mostki dłuższe niż ok. 8 mm wymagają podpór, a podpory zostawiają ślad. Zorientuj część tak, aby powierzchnie widoczne drukowały się ku górze, a przewieszenia nie przekraczały 45°.',
      'Adhezja warstw PETG jest na tyle dobra, że obciążenie wzdłuż osi Z odbiera tylko ok. 20–30% wytrzymałości — mimo to główne naprężenia orientuj w płaszczyźnie XY.',
    ],
    finishes: [
      'Usunięcie podpór i oczyszczenie krawędzi w standardzie',
      'Wygładzenie powierzchni styku (płaszczyzny montażowe)',
      'Mosiężne inserty gwintowane na życzenie',
    ],
    faq: [
      {
        q: 'Czym PETG różni się od PLA?',
        a: 'PETG jest odporniejszy termicznie (HDT ok. 70 °C wobec ok. 55 °C dla PLA), mniej kruchy i nie degraduje od wilgoci. PLA zostaw do modeli koncepcyjnych; do części, które mają pracować, wybierz PETG.',
      },
      {
        q: 'Czy części z PETG nadają się na zewnątrz?',
        a: 'Krótkoterminowo tak, ale po miesiącach ekspozycji UV PETG żółknie i traci udarność. Do stałych zastosowań zewnętrznych polecamy ASA — porównanie znajdziesz niżej.',
      },
      {
        q: 'Jaka jest maksymalna wielkość części?',
        a: 'Obszar roboczy to 340 × 320 × 340 mm. Większe elementy dzielimy na segmenty do klejenia lub skręcania; formularz wyceny automatycznie oznaczy część, która nie mieści się na płycie.',
      },
      {
        q: 'Czy PETG może mieć kontakt z żywnością?',
        a: 'Sam granulat bywa certyfikowany, ale druk FDM zostawia mikroszczeliny między warstwami, w których osadzają się bakterie. Nie zalecamy części FDM do wielokrotnego, bezpośredniego kontaktu z żywnością.',
      },
      {
        q: 'Jak gładka będzie powierzchnia?',
        a: 'Standardowo drukujemy warstwą 0,2 mm — linie warstw są widoczne i wyczuwalne. Powierzchnie funkcyjne trzymają tolerancję ±0,3 mm; wykończenie kosmetyczne (szlif, lakier) leży po stronie odbiorcy.',
      },
      {
        q: 'Ile kosztuje druk z PETG?',
        a: 'Cena zależy od wagi i czasu druku — tabela wyżej pokazuje ceny referencyjne liczone przez ten sam silnik co formularz wyceny. Najszybciej: wgraj własny plik i zobacz cenę w kilka sekund.',
      },
    ],
  },
  asa: {
    metaTitle: 'Druk 3D z ASA — części odporne na UV i pogodę | MICRO_FACTORY',
    metaDescription:
      'Usługa druku 3D z ASA: znakomita odporność UV, HDT 98 °C, stabilność barwy na zewnątrz. Wycena od ręki, wysyłka w 3 dni robocze, D+1 PL/DE.',
    h1: 'Druk 3D z ASA',
    promise:
      'ASA to materiał na części, które mają przetrwać na zewnątrz: nie żółknie pod UV, znosi 98 °C ugięcia cieplnego i zachowuje udarność w mrozie. Wybierz je wszędzie tam, gdzie PETG z czasem odpuszcza. Wysyłka w 3 dni robocze (termin standardowy), D+1 w PL/DE, D+2 w pozostałej UE.',
    useCases: [
      'Obudowy urządzeń montowanych na zewnątrz — czujniki, kamery, bramki',
      'Zaślepki, uchwyty i osłony motoryzacyjne (poza bezpośrednim sąsiedztwem źródeł ciepła)',
      'Mocowania instalacji PV, anten i oświetlenia',
      'Obudowy narzędzi i osprzętu ogrodowego',
      'Części maszyn w nasłonecznionych halach i przy oknach',
    ],
    guidelines: [
      'Minimalna grubość ścianki to 1,2 mm; ASA skurcza się mocniej niż PETG, więc duże płaskie powierzchnie projektuj z żebrowaniem zamiast pełnych grubych ścian.',
      'Tolerancja wymiarowa wynosi ±0,3 mm na 100 mm; przy długich, cienkich elementach dolicz zapas na skurcz przetwórczy.',
      'Adhezja warstw jest dobra, ale wyraźnie słabsza niż w PETG — części obciążane wzdłuż osi Z orientujemy przy wycenie; zaznacz kierunek obciążenia w uwagach, jeśli jest krytyczny.',
      'Ostre naroża wewnętrzne koncentrują naprężenia; stosuj promienie ≥ 1 mm, a przy łączeniach wkrętami — inserty zamiast gwintowania wprost w materiale.',
    ],
    finishes: [
      'Usunięcie podpór i oczyszczenie krawędzi w standardzie',
      'Powierzchnia matowa, stabilna kolorystycznie na zewnątrz',
      'Mosiężne inserty gwintowane na życzenie',
    ],
    faq: [
      {
        q: 'ASA czy ABS — co wybrać?',
        a: 'ASA to następca ABS-u do zastosowań zewnętrznych: podobna mechanika i temperatura pracy, ale bez żółknięcia i kredowania pod UV. Wszędzie tam, gdzie kiedyś brałeś ABS na zewnątrz, dziś bierz ASA.',
      },
      {
        q: 'Jak długo część z ASA wytrzyma na słońcu?',
        a: 'ASA jest stabilizowane na UV — utrzymuje kolor i udarność przez lata, nie miesiące. To materiał stosowany fabrycznie na lusterka samochodowe i obudowy zewnętrzne.',
      },
      {
        q: 'Jaką temperaturę zniesie ASA?',
        a: 'HDT wynosi ok. 98 °C (0,45 MPa). Część zachowa kształt w nagrzanym wnętrzu auta czy przy słonecznej elewacji; nie nadaje się bezpośrednio przy kolektorze wydechowym — tam spójrz na PA12-CF.',
      },
      {
        q: 'Czy ASA można malować i kleić?',
        a: 'Tak — ASA klei się klejami do ABS (w tym rozpuszczalnikowymi) i dobrze przyjmuje lakiery po zmatowieniu powierzchni. Do łączeń rozłącznych zalecamy inserty gwintowane.',
      },
      {
        q: 'Czy ASA jest sztywniejsze od PETG?',
        a: 'Porównywalnie: ASA ma ok. 40 MPa na rozciąganie wobec ok. 50 MPa PETG, za to wyraźnie wyższą odporność termiczną i UV. Do wnętrz zwykle wygrywa PETG, na zewnątrz — ASA.',
      },
      {
        q: 'Ile kosztuje druk z ASA?',
        a: 'Tabela wyżej pokazuje ceny referencyjne liczone przez silnik wyceny (ASA jest ok. 2× droższe od PETG w przeliczeniu na kilogram). Wgraj plik, a dostaniesz cenę swojej części od ręki.',
      },
    ],
  },
  pa12_cf: {
    metaTitle: 'Druk 3D z PA12-CF — nylon z włóknem węglowym | MICRO_FACTORY',
    metaDescription:
      'PA12 z włóknem węglowym: ok. 100 MPa, HDT 170 °C, sztywność części frezowanych przy ułamku wagi. Oprzyrządowanie i części techniczne w 3 dni robocze.',
    h1: 'Druk 3D z PA12-CF',
    promise:
      'PA12-CF to nasz najmocniejszy materiał: nylon zbrojony włóknem węglowym o wytrzymałości ok. 100 MPa i odporności do 170 °C. Tam, gdzie dotąd frezowałeś aluminium albo POM, często wystarczy wydruk — przy ułamku wagi i bez kosztów uruchomienia obróbki. Wysyłka w 3 dni robocze, D+1 w PL/DE, D+2 w pozostałej UE.',
    useCases: [
      'Chwytaki i palce robotów, końcówki efektorów',
      'Oprzyrządowanie produkcyjne: przyrządy, uchwyty, sprawdziany',
      'Koła zębate, krzywki i dźwignie pracujące pod obciążeniem',
      'Elementy dronów i motorsportu — sztywne, lekkie, odporne na ciepło',
      'Części zamienne maszyn, których nikt już nie produkuje',
    ],
    guidelines: [
      'Minimalna grubość ścianki to 1,0 mm; włókno węglowe usztywnia ścieżki, więc cienkie żebra niosą więcej niż w materiałach niezbrojonych.',
      'Kompozyt jest wyraźnie anizotropowy: wzdłuż ścieżek (XY) osiąga pełną sztywność, między warstwami (Z) około połowy. Kierunek głównego obciążenia podaj w uwagach do zamówienia — dobierzemy orientację na płycie.',
      'Tolerancja wynosi ±0,25 mm na 100 mm; PA12 absorbuje mało wilgoci (to nie PA6), więc wymiary są stabilne również w wilgotnym otoczeniu.',
      'Gwinty wykonuj przez mosiężne inserty wgrzewane — gwint cięty wprost w kompozycie ścina się przy wielokrotnym montażu.',
      'Powierzchnia jest matowa, ciemnografitowa; jeśli część trze o miękkie tworzywa, zaplanuj wkładkę lub tuleję — wypełnienie węglowe działa ściernie.',
    ],
    finishes: [
      'Usunięcie podpór i oczyszczenie krawędzi w standardzie',
      'Matowe, jednolite wykończenie węglowe',
      'Mosiężne inserty wgrzewane na życzenie',
    ],
    faq: [
      {
        q: 'Czy PA12-CF zastąpi część z aluminium?',
        a: 'Często tak — sztywność właściwa (sztywność do wagi) wydruku CF bywa zbliżona do frezowanego aluminium, a koszt i czas wykonania są ułamkiem obróbki CNC. Granicą są temperatury powyżej ~170 °C i pasowania precyzyjne poniżej ±0,1 mm.',
      },
      {
        q: 'Czy materiał przewodzi prąd?',
        a: 'Nie — włókna węglowe są krótkie i zatopione w nylonie; część pozostaje izolatorem. To nie jest materiał ESD-safe, jeśli potrzebujesz odprowadzania ładunków, napisz do nas przed zamówieniem.',
      },
      {
        q: 'Jak PA12-CF znosi wilgoć?',
        a: 'PA12 absorbuje kilkukrotnie mniej wody niż popularny PA6 — części trzymają wymiar i sztywność także na zewnątrz i w wilgotnych halach. Drukujemy z granulatu suszonego na bieżąco.',
      },
      {
        q: 'Czy da się go obrabiać po druku?',
        a: 'Tak: wiercenie, rozwiercanie i gwintowanie insertami działają dobrze. Używaj narzędzi z węglikiem — wypełnienie węglowe szybko tępi zwykłą stal narzędziową.',
      },
      {
        q: 'Dlaczego jest wyraźnie droższy od PETG i ASA?',
        a: 'Granulat kosztuje kilkukrotnie więcej, drukuje się wolniej i zużywa dysze. W tabeli wyżej widzisz dokładnie, jak przekłada się to na cenę części — liczy ją ten sam silnik co formularz wyceny.',
      },
      {
        q: 'Kiedy lepszy będzie zwykły PA12 albo PETG?',
        a: 'Jeśli część ma się sprężynować (zatrzaski) albo pracować udarowo, sztywny kompozyt bywa zbyt kruchy — wtedy lepszy jest nieozbrojony nylon lub PETG. Napisz, co część ma robić, a doradzimy.',
      },
    ],
  },
}
