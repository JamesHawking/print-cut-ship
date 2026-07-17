// Polish copy for the comparison pages — the type source of truth (en.ts must
// satisfy the same shape). Every zł amount and engine-derived percentage is
// INTERPOLATED from CompareValues (no-literal-prices.spec.ts fails on `\d zł`
// literals in this directory). Material claims trace to MATERIAL_DATA /
// catalog-static; cited external figures live in data.ts with footnotes.
//
// TODO(launch): machine-drafted Polish — native-speaker review required
// before launch, together with src/lib/i18n/pl.ts.

import { formatPln } from '@/lib/format'
import type { CompareValues } from './data'
import type { CompareSlug } from './slugs'

export interface CompareCopy {
  metaTitle: string
  metaDescription: string
  h1: string
  /** Short display name for index cards and cross-links, e.g. 'ASA vs PETG'. */
  title: string
  /** One-sentence index-card teaser. */
  teaser: string
  /** TL;DR verdict — the answer in ≤3 sentences, rendered above the fold. */
  verdict: (v: CompareValues) => string[]
  intro: (v: CompareValues) => string[]
  /** Analysis prose rendered in the decision section, above the cards. */
  body: (v: CompareValues) => string[]
  chooseA: { title: string; items: string[] }
  chooseB: { title: string; items: string[] }
  faq: Array<{ q: string; a: (v: CompareValues) => string }>
  /** Rendered sources for the cited static figures ([1], [2], …). */
  footnotes: string[]
}

const pln = (v: number) => formatPln(v, 'pl')

export const plCompareCopy: Record<CompareSlug, CompareCopy> = {
  'asa-vs-petg': {
    metaTitle: 'ASA czy PETG — porównanie z żywymi cenami | MICRO_FACTORY',
    metaDescription:
      'ASA i PETG obok siebie: UV, temperatura, adhezja warstw, tolerancje i ceny liczone przez silnik wyceny. Decyzja w trzech zdaniach, nie w trzech akapitach.',
    h1: 'ASA czy PETG?',
    title: 'ASA vs PETG',
    teaser:
      'Na zewnątrz i w cieple wygrywa ASA, przy kontakcie z chemią i napiętym budżecie — PETG.',
    verdict: (v) => [
      `Część pracująca na zewnątrz albo powyżej 70 °C → ASA: znakomita odporność UV i HDT 98 °C. Część mająca kontakt ze smarami i środkami czyszczącymi, drukowana tanio i przewidywalnie → PETG: znakomita adhezja warstw i 50 MPa wytrzymałości. Różnica cen na wsporniku referencyjnym: ${pln(v.petgBracket1Pln)} (PETG) vs ${pln(v.asaBracket1Pln)} (ASA), czyli ASA drożej o ~${v.asaOverPetgPct}%.`,
    ],
    intro: (v) => [
      `To dwa najczęściej mylone tworzywa konstrukcyjne w FDM — oba drukują się stabilnie, oba nadają się na części użytkowe, a jednak wybór rzadko jest obojętny. Poniżej twarde liczby z naszej karty materiałowej i ceny liczone przez ten sam silnik, który wycenia twoje pliki (stawki ${v.petgPlnPerKg} zł/kg za PETG i ${v.asaPlnPerKg} zł/kg za ASA).`,
    ],
    body: (v) => [
      'Fizyka decyzji jest prosta. ASA to styrenowe tworzywo o znakomitej odporności na promieniowanie UV i wyższej temperaturze ugięcia (HDT 98 °C vs 70 °C) — obudowa czujnika na elewacji czy uchwyt w komorze silnika po roku na słońcu wygląda i pracuje jak nowa. PETG odpowiada wyższą wytrzymałością na rozciąganie (50 MPa vs 40 MPa) i znakomitą adhezją międzywarstwową, przez co część obciążona w osi Z pęka później niż odpowiednik z ASA.',
      `Cenowo PETG wygrywa zawsze — surowiec kosztuje ${v.petgPlnPerKg} zł/kg wobec ${v.asaPlnPerKg} zł/kg. Na małych częściach różnica bywa symboliczna (tabela wyżej), na dużych korpusach robi się istotna. Jeśli część nie widzi słońca ani ciepła, dopłata do ASA nie kupuje niczego.`,
    ],
    chooseA: {
      title: 'Wybierz ASA, jeśli…',
      items: [
        'część pracuje na zewnątrz — pełne słońce, deszcz, mróz',
        'temperatura pracy przekracza 70 °C (HDT ASA: 98 °C)',
        'kolor i powierzchnia mają nie żółknąć przez lata',
        'akceptujesz ok. 2,4× wyższą stawkę materiałową',
      ],
    },
    chooseB: {
      title: 'Wybierz PETG, jeśli…',
      items: [
        'część ma kontakt ze smarami lub środkami czyszczącymi',
        'liczy się wytrzymałość między warstwami (obciążenia w osi Z)',
        'drukujesz dużo i budżet gra rolę',
        'część pracuje wewnątrz, poniżej 70 °C',
      ],
    },
    faq: [
      {
        q: 'Czy PETG nadaje się na zewnątrz?',
        a: () =>
          'Krótkoterminowo tak, długoterminowo nie — odporność UV PETG oceniamy jako umiarkowaną: po sezonach na słońcu powierzchnia matowieje, a właściwości mechaniczne spadają. Na stałą ekspozycję wybierz ASA (odporność UV: znakomita).',
      },
      {
        q: 'O ile ASA jest droższe w praktyce?',
        a: (v) =>
          `Na wsporniku referencyjnym (20 cm³): ${pln(v.petgBracket1Pln)} za PETG vs ${pln(v.asaBracket1Pln)} za ASA przy 1 szt., czyli ~${v.asaOverPetgPct}% różnicy. Im większa i masywniejsza część, tym różnica bliższa stosunkowi stawek ${v.petgPlnPerKg} do ${v.asaPlnPerKg} zł/kg.`,
      },
      {
        q: 'Które tworzywo jest wytrzymalsze?',
        a: () =>
          'Na rozciąganie PETG (50 MPa vs 40 MPa) i to PETG ma znakomitą adhezję międzywarstwową. ASA odzyskuje przewagę w cieple: przy 90 °C PETG jest już blisko HDT (70 °C) i mięknie, ASA pracuje dalej.',
      },
      {
        q: 'Czy oba materiały drukują się z tą samą dokładnością?',
        a: () =>
          'Tak — dla obu deklarujemy tę samą tolerancję ±0,3 mm / 100 mm i minimalną ściankę 1,2 mm. Różnice pojawiają się dopiero w warunkach pracy, nie w geometrii wydruku.',
      },
      {
        q: 'A może po prostu PA12-CF?',
        a: () =>
          'Jeśli potrzebujesz jednocześnie sztywności, temperatury i stabilności wymiarowej — tak, PA12-CF gra w wyższej lidze (100 MPa, HDT 170 °C), ale przy ~7-krotności stawki PETG. Do typowych obudów i uchwytów to przepłacanie.',
      },
    ],
    footnotes: [],
  },

  'pa-cf-vs-aluminum': {
    metaTitle:
      'Druk PA12-CF czy frezowane aluminium? Koszty i granice | MICRO_FACTORY',
    metaDescription:
      'Kiedy drukowany wspornik z PA12-CF zastępuje frezowany z aluminium 6061 — masa, koszt przy 1–50 szt., termin — a kiedy metal zostaje bez dyskusji.',
    h1: 'Druk PA12-CF czy frezowane aluminium?',
    title: 'PA12-CF vs aluminium',
    teaser:
      'Wspornik z PA12-CF bywa 2,5× lżejszy i o rząd wielkości tańszy przy małych seriach — ale nie zastąpi metalu wszędzie.',
    verdict: (v) => [
      `Uchwyt, wspornik czy chwytak obciążony mechanicznie w temperaturze pokojowej: drukowany PA12-CF kosztuje ${pln(v.paCfBracket1Pln)} przy 1 szt. i wysyłamy go w ${v.expressDays} dni robocze — frezowane aluminium to typowo ${pln(v.aluBracketQty1MinPln)}–${pln(v.aluBracketQty1MaxPln)} i ${v.aluLeadMinDays}–${v.aluLeadMaxDays} dni roboczych u europejskiej frezarni [2]. Do tego część polimerowa jest ~2,5× lżejsza (gęstość 1,08 vs 2,70 g/cm³). Metal zostaje, gdy potrzebujesz pracy ciągłej znacznie powyżej 100 °C, tolerancji poniżej ±0,1 mm albo przewodności elektrycznej.`,
    ],
    intro: () => [
      'PA12 z włóknem węglowym to najsztywniejsze tworzywo w naszej ofercie: 100 MPa wytrzymałości na rozciąganie i HDT 170 °C. To wystarcza, by w wielu oprzyrządowaniach, uchwytach pomiarowych i wspornikach maszynowych zastąpić frezowane aluminium 6061 — nie wszędzie i nie bezwarunkowo. Poniżej uczciwa granica między tymi dwiema technologiami, z liczbami po obu stronach.',
    ],
    body: (v) => [
      'W liczbach bezwzględnych aluminium 6061-T6 pozostaje mocniejsze: 310 MPa wobec 100 MPa i sztywność, której żaden polimer nie dogoni [1]. Ale wspornik rzadko pracuje na granicy wytrzymałości — pracuje na sztywność przy zadanej masie. Przy gęstości 1,08 g/cm³ część z PA12-CF o tej samej kopercie waży 40% tego, co aluminiowa, a wydrukowane żebra i kieszenie nie kosztują ani złotówki więcej, podczas gdy każda kieszeń frezowana to minuty pracy wrzeciona.',
      `Ekonomia jest jeszcze wyraźniejsza: przy 50 szt. płacisz ${pln(v.paCfBracket50Pln)} za sztukę — frezarnie schodzą wtedy typowo do ${pln(v.aluBracketQty50MinPln)}–${pln(v.aluBracketQty50MaxPln)} [2]. Granice też są twarde: praca ciągła znacznie powyżej 100 °C pod obciążeniem, pasowania poniżej ±0,1 mm (my deklarujemy ±0,25 mm / 100 mm, CNC osiąga ±0,05 mm [1]) i wszędzie tam, gdzie część ma przewodzić prąd lub ciepło — polimer odpada z definicji.`,
    ],
    chooseA: {
      title: 'Drukuj z PA12-CF, jeśli…',
      items: [
        'to wspornik, uchwyt, oprzyrządowanie lub chwytak, nie element silnie termiczny',
        'potrzebujesz 1–50 szt. w dni, nie tygodnie',
        'masa ma znaczenie: 1,08 vs 2,70 g/cm³',
        'geometria jest żebrowana lub organiczna — druk nie liczy sobie za złożoność',
      ],
    },
    chooseB: {
      title: 'Zostań przy aluminium, jeśli…',
      items: [
        'część pracuje ciągle znacznie powyżej 100 °C pod obciążeniem',
        'pasowania wymagają tolerancji poniżej ±0,1 mm',
        'potrzebna jest przewodność elektryczna lub cieplna',
        'seria idzie w setki sztuk — CNC i odlew przejmują prowadzenie',
      ],
    },
    faq: [
      {
        q: 'Ile realnie lżejsza jest część z PA12-CF?',
        a: () =>
          'Przy identycznej geometrii ~2,5× (gęstość 1,08 vs 2,70 g/cm³ [1]). W praktyce więcej — wydruk pozwala tanio dodać żebra i pustki, których frezowanie by nie wybaczyło.',
      },
      {
        q: 'Jakie tolerancje trzyma druk PA12-CF?',
        a: () =>
          'Deklarujemy ±0,25 mm / 100 mm. Frezarka CNC osiąga ±0,05 mm [1]. Pasowania krytyczne projektuj z luzem albo przewidź powiercanie/rozwiercanie otworów po wydruku.',
      },
      {
        q: 'Co z gwintami i połączeniami śrubowymi?',
        a: () =>
          'Gwinty bezpośrednio w polimerze pracują poprawnie przy małych obciążeniach; przy większych stosuj inserty wgrzewane — projektowo to standardowa kieszeń, którą drukujemy bez dopłaty.',
      },
      {
        q: 'Skąd przedział cen dla aluminium?',
        a: (v) =>
          `To typowy przedział ofert europejskich frezarni CNC dla części wielkości wspornika referencyjnego: ${pln(v.aluBracketQty1MinPln)}–${pln(v.aluBracketQty1MaxPln)} przy 1 szt. [2]. Cytujemy cudzy rynek, nie własny cennik — frezowania nie oferujemy.`,
      },
      {
        q: 'Czy PA12-CF wytrzyma pracę w komorze silnika?',
        a: () =>
          'HDT wynosi 170 °C, więc krótkotrwałe piki temperatury nie są problemem. Przy pracy ciągłej pod obciążeniem trzymaj polimer wyraźnie poniżej HDT — dla stref stale gorących uczciwa odpowiedź brzmi: metal.',
      },
    ],
    footnotes: [
      '[1] Typowe wartości katalogowe stopu aluminium 6061-T6: wytrzymałość na rozciąganie ~310 MPa, gęstość 2,70 g/cm³, tolerancje frezowania wg ISO 2768.',
      '[2] Typowy przedział cen europejskich frezarni CNC (3 osie, część wielkości wspornika ~80×60×30 mm, połowa 2026 r.). To cytowany rynek zewnętrzny, nie nasza wycena.',
    ],
  },

  'print-in-house-vs-order': {
    metaTitle:
      'Drukować samemu czy zamówić? Uczciwy rachunek kosztów | MICRO_FACTORY',
    metaDescription:
      'Amortyzacja drukarki, czas operatora i nieudane wydruki kontra cena zamówienia. Liczymy uczciwie — łącznie z wnioskiem, kiedy NIE opłaca się u nas zamawiać.',
    h1: 'Drukować samemu czy zamówić?',
    title: 'Druk u siebie vs zamówienie',
    teaser:
      'Uczciwy rachunek: kiedy własna drukarka wygrywa z zamówieniem — a kiedy tylko udaje, że wygrywa.',
    verdict: (v) => [
      `Jednorazowy wydruk z PLA na drukarce, którą już masz, kosztuje ~${pln(v.inHouseHobbyPln)} w materiale i amortyzacji — jeśli twój czas jest „za darmo", nie mamy tu czego szukać. Gdy policzysz pół godziny pracy po ${v.operatorPlnPerHour} zł/h i ${v.failureRatePct}% nieudanych wydruków, ta sama część kosztuje ~${pln(v.inHouseCostedPln)}, a zamówiona u nas z wysyłką ${pln(v.orderedBracketTotalPln)}. Materiały inżynieryjne, serie i terminy przesuwają rachunek jednoznacznie w stronę zamawiania.`,
    ],
    intro: (v) => [
      `Ta strona liczy na niekorzyść naszego biznesu tam, gdzie tak wychodzi z arytmetyki. Założenia poniżej są jawne: drukarka za ${pln(v.printerCostPln)}, resurs 5000 godzin druku, filament PLA po ${v.filamentPlaPlnPerKg} zł/kg, praca po ${v.operatorPlnPerHour} zł/h [1] i ${v.failureRatePct}% wydruków do kosza [2]. Podstaw własne liczby — struktura rachunku się nie zmieni.`,
    ],
    body: (v) => [
      `Rachunek dla jednej części (wspornik ~50 g, 4 h druku): materiał ${pln(v.inHouseMaterialPln)}, amortyzacja maszyny ${pln(v.inHouseMachinePln)}, praca operatora ${pln(v.inHouseOperatorPln)} — slicing, start, zdjęcie ze stołu, oczyszczenie. Po doliczeniu ${v.failureRatePct}% strat: ~${pln(v.inHouseHobbyPln)} bez kosztu pracy albo ~${pln(v.inHouseCostedPln)} z nim. Pozycja, która dominuje, to nie plastik — to człowiek.`,
      `Zamówienie tej samej części u nas: ${pln(v.orderedBracketTotalPln)} brutto z wysyłką (pojedyncza sztuka dobija do minimum ${v.minOrderPln} zł — szczegóły w cenniku). Przy hobbystycznym „czas się nie liczy" przegrywamy z twoją drukarką i uczciwie to przyznajemy. Rachunek odwraca się, gdy w grę wchodzi ASA lub PA12-CF (komora, suszenie, profile), seria kilkunastu sztuk w powtarzalnej jakości albo termin, za który ktoś odpowiada.`,
    ],
    chooseA: {
      title: 'Drukuj u siebie, jeśli…',
      items: [
        'masz już drukarkę, a czas druku nikogo nie kosztuje',
        'wystarcza PLA lub PETG w jakości „dla siebie"',
        'iterujesz prototyp kilka razy dziennie',
        'pojedyncza nieudana sztuka niczego nie psuje',
      ],
    },
    chooseB: {
      title: 'Zamów, jeśli…',
      items: [
        'część ma być z ASA, PA12-CF lub innego tworzywa wymagającego komory i suszenia',
        'potrzebujesz serii w powtarzalnej jakości, nie pojedynczych udanych sztuk',
        'termin jest zobowiązaniem, a nie nadzieją',
        'godzina twojej pracy kosztuje więcej niż różnica w cenie',
      ],
    },
    faq: [
      {
        q: 'Czy 10% nieudanych wydruków to nie przesada?',
        a: () =>
          'Dla dopracowanego profilu PLA — bywa mniej. Dla nowych materiałów, pierwszych iteracji geometrii i drukarek bez komory — często więcej. Przyjmujemy 10% jako uczciwą średnią [2]; podstaw własną wartość, struktura rachunku się nie zmienia.',
      },
      {
        q: 'Kiedy własna drukarka w firmie ma sens?',
        a: (v) =>
          `Gdy drukujecie regularnie i ktoś realnie ją opiekuje. Sama maszyna to ${pln(v.printerCostPln)}, ale rachunek robi czas: przy kilku wydrukach miesięcznie taniej wychodzi zamawianie, przy codziennym prototypowaniu — własna drukarka plus zamawianie części inżynieryjnych.`,
      },
      {
        q: 'Dlaczego nie liczycie prądu i części zamiennych?',
        a: () =>
          'Liczymy je w uproszczeniu wewnątrz amortyzacji — przy tej skali kosztów prąd i dysze zmieniają wynik o pojedyncze grosze na część. Pozycją, która naprawdę decyduje, jest czas operatora.',
      },
      {
        q: 'Skoro dla PLA jesteście drożsi, po co ta strona?',
        a: () =>
          'Bo wolimy, żebyś wiedział, zanim zamówisz. Nasza przewaga zaczyna się przy materiałach inżynieryjnych, seriach i terminach — i wolimy klienta, który wraca z takim zleceniem, niż rozczarowanego jednorazową sztuką z PLA.',
      },
    ],
    footnotes: [
      '[1] Ceny uliczne i stawki dla Polski, połowa 2026 r.: zamknięta drukarka desktopowa z akcesoriami, szpula PLA 1 kg, pełny koszt godziny pracy inżyniera.',
      '[2] Szacunkowy udział nieudanych lub odrzuconych wydruków przy druku biurowym/hobbystycznym bez stałego nadzoru.',
    ],
  },
}
