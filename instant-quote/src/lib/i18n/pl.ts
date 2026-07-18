// Polish dictionary — the source of truth for the Dictionary type
// (types.ts infers from `typeof pl`; en.ts must satisfy it).
//
// Deliberately NO `as const`: values widen to `string` / `(n) => string` so
// the English file can carry different text under the same shape.
//
// TODO(launch): machine-drafted Polish — native-speaker review required
// before launch; schedule alongside plan 09's lawyer pass (plans/engineering/08-i18n.md §6).

import type { components } from '@/lib/api/schema'
import { formatDecimal } from '@/lib/format'
import { plPlural } from './plural'

/** Stable family key — identical across locales (used for dot colors). */
export type MaterialFamily = 'standard' | 'engineering' | 'specialty'

// All three derived from the generated contract — a new backend code or
// status without copy here is a compile error (localization contract,
// plans/engineering/08-i18n.md).
type OrderStatus = components['schemas']['OrderSummary']['status']
type DfmCode = components['schemas']['DfmFlag']['code']
type ApiErrorCode = components['schemas']['ApiErrorCode']

type Params = Record<string, unknown>

/** Polish number formatting for param values embedded in copy. */
const num = (v: unknown): string => {
  if (typeof v === 'number') return formatDecimal(v, 'pl', 2)
  return typeof v === 'string' ? v : '—'
}

export const pl = {
  meta: {
    title:
      'Natychmiastowa wycena druku 3D — wgraj, wyceń, zamów | MICRO_FACTORY',
    description:
      'Wgraj plik STL, 3MF, OBJ lub STEP i otrzymaj cenę od ręki. Produkcja w UE, wysyłka D+1/D+2 do Niemiec. Bez zakładania konta.',
    quote: {
      title: 'Twoja wycena — MICRO_FACTORY',
      description:
        'Skonfiguruj materiał, ilość i termin — cena aktualizuje się na żywo.',
    },
    login: {
      title: 'Śledź zamówienie — MICRO_FACTORY',
      description:
        'Dostęp do zamówień jednorazowym kodem — bez konta i bez hasła.',
    },
    orders: {
      title: 'Twoje zamówienia — MICRO_FACTORY',
      description:
        'Historia wycen i zamówień powiązanych z twoim adresem e-mail.',
    },
  },
  hero: {
    wordmark: 'MICRO_FACTORY',
    status: 'EU · FDM · PLN',
    ready: 'Gotowe',
    kickerBadge: 'UE',
    kicker: 'Druk 3D na żądanie · Polska · PLN',
    headline1: 'Wgraj część.',
    headline2: 'Poznaj cenę.',
    sub: 'To nie formularz zapytania ani rozmowa z handlowcem. Upuść plik, a maszyna odpowie — pełny kosztorys i realna data wysyłki, w kilka sekund, bez konta.',
    sample: 'Nie masz pliku pod ręką? Wypróbuj przykładową część →',
    privacy:
      'Prywatność — pliki służą wyłącznie do przygotowania wyceny i są usuwane automatycznie, jeśli nie zamówisz',
    // Zipped with computed values in Hero.tsx (same order).
    specs: [
      'materiałów FDM',
      'dni roboczych realizacji',
      'wysyłka PL/DE',
      'VAT zawsze wliczony',
    ],
  },
  nav: {
    howItWorks: 'Jak to działa',
    materials: 'Materiały',
    pricing: 'Cennik',
    compare: 'Porównania',
    blog: 'Baza wiedzy',
    trackOrder: 'Śledź zamówienie',
    menuLabel: 'Przełącz menu',
    skipToContent: 'Przejdź do treści',
    resume: (n: number) => `Wróć do wyceny (${n}) →`,
    // Narrow-desktop form of `resume` (1024–1280px, PL labels are long).
    resumeShort: (n: number) => `Wycena (${n}) →`,
    newQuote: '← Nowa wycena',
  },
  ticker: [
    'Wysyłka D+1 PL/DE',
    'Darmowa dostawa ≥ 500 zł',
    'Bez konta',
    'Wyprodukowano w UE',
  ],
  process: {
    n: '01',
    heading: 'Od pliku do daty wysyłki w trzech krokach',
    intro:
      'Maszyna prowadzi Twój plik przez linię — zmierzony, wyceniony i z wiążącą datą wysyłki w niecałą minutę. Poniżej prawdziwy przebieg na żywym silniku.',
    steps: [
      { n: '01', kicker: 'WGRAJ', title: 'Upuść plik' },
      { n: '02', kicker: 'WYCEŃ', title: 'Zobacz liczby' },
      { n: '03', kicker: 'ZAMÓW', title: 'Zablokuj termin' },
    ],
    ships: 'WYSYŁKA',
    // "D+1" is the courier-transit claim from the ticker; the weekday is the
    // engine's real express ship date (GET /api/v1/ship-dates).
    shipsDate: (weekday: string) => `${weekday} · D+1`,
    shipsDateFallback: 'D+1',
    shipsCutoff: 'PL / DE · zamówienia do 14:00',
    // The live demo run's machine log (buildScript in how-it-works/demo.ts).
    // Every number arrives pre-formatted per locale; the PRICE line is the
    // real engine answer. Log tags stay untranslated — it's a machine log.
    demo: {
      cmd: (file: string) => `$ wycena ${file}`,
      tags: {
        recv: 'RECV',
        measure: 'MEASURE',
        price: 'PRICE',
        order: 'ORDER',
        ship: 'SHIP',
        done: 'DONE',
      },
      recv: (file: string, size: string) => `${file} · ${size}`,
      measureMesh: (triangles: string) =>
        `${triangles} trójkątów · szczelność OK`,
      measureDims: (volume: string, dims: string) => `${volume} · ${dims}`,
      priceConfig: 'PETG · 1 szt. · standard',
      priceResult: (total: string, weight: string, hours: string) =>
        `${total} z VAT · ${weight} g · ${hours} h druku`,
      order1: 'bez konta · bez telefonu od handlowca',
      order2: 'termin blokuje się przy zamówieniu',
      ship: (weekday: string) =>
        `${weekday} · D+1 · PL/DE · zamówienia do 14:00`,
      shipFallback: 'D+1 · PL/DE · zamówienia do 14:00',
      done: 'wycena gotowa — maszyna odpowiedziała',
      replay: 'Odtwórz ponownie',
      engineLabel: 'quote-engine v1',
      panelTag: 'Przebieg wyceny na żywo',
      meshLabel: (triangles: string) => `siatka · ${triangles} trójkątów`,
      cta: 'Teraz wyceń swoją część →',
      srSummary: (total: string, weekday: string) =>
        `Przykładowy wspornik zmierzony w przeglądarce i wyceniony przez silnik na ${total} z VAT, wysyłka ${weekday}, D+1 do PL/DE.`,
    },
  },
  materialsSection: {
    n: '02',
    heading: 'Siedem materiałów, od prototypu po część użytkową',
    material: 'Materiał',
    application: 'Zastosowanie',
    density: 'Gęstość',
    from: 'Od',
    footnote: 'Stawki brutto z 23% VAT',
    readGuide: 'Przewodnik',
    guideSoon: 'Przewodnik wkrótce',
    // Mega-menu badge (nav-panels.tsx) — the full label would overflow the
    // two-column panel's cell.
    guideSoonShort: 'Wkrótce',
    bracketLabel: 'wspornik z dema · 1 szt.',
  },
  materialFamilies: {
    standard: 'Standardowe',
    engineering: 'Inżynieryjne',
    specialty: 'Specjalistyczne',
  },
  materials: {
    pla: {
      family: 'standard' as MaterialFamily,
      tagline:
        'Najtańszy i najłatwiejszy w druku. Prototypy, modele koncepcyjne, części pokazowe.',
    },
    petg: {
      family: 'standard' as MaterialFamily,
      tagline:
        'Wytrzymały, odporny na wilgoć materiał do wszystkiego. Obudowy, uchwyty, części funkcjonalne.',
    },
    pctg: {
      family: 'standard' as MaterialFamily,
      tagline:
        'Ulepszony PETG o wyższej udarności. Obudowy i części mechaniczne.',
    },
    asa: {
      family: 'engineering' as MaterialFamily,
      tagline:
        'Odporny na UV i warunki atmosferyczne. Części zewnętrzne, motoryzacyjne i elewacyjne.',
    },
    petg_fr: {
      family: 'specialty' as MaterialFamily,
      tagline:
        'Trudnopalny (UL94 V-0). Obudowy elektroniki i szafy sterownicze.',
    },
    pa12_cf: {
      family: 'engineering' as MaterialFamily,
      tagline:
        'Nylon z włóknem węglowym — maksymalna wytrzymałość, odporność do ~170°C. Przyrządy, koła zębate, motorsport.',
    },
    iglidur: {
      family: 'specialty' as MaterialFamily,
      tagline:
        'Samosmarujący materiał Igus. Łożyska, tuleje i części ślizgowe.',
    },
  },
  pricing: {
    n: '03',
    heading: 'Cena to wzór, nie negocjacje',
    formulaLead: 'CENA',
    // Rendered as: PRICE = MATERIAL (…) + MACHINE (…) × QTY (…) × LEAD (…)
    terms: [
      { op: '=', name: 'MATERIAŁ', unit: '(g × zł/kg)' },
      { op: '+', name: 'MASZYNA', unit: '(h × zł/h)' },
      { op: '×', name: 'ILOŚĆ', unit: '(−5…28%)' },
      { op: '×', name: 'TERMIN', unit: '(−10…+30%)' },
    ],
    cards: [
      {
        title: 'Waga jak w slicerze',
        body: 'Powłoka 0,9 mm na powierzchni części plus 20% wypełnienia, przeliczone na gramy według gęstości materiału.',
      },
      {
        title: 'Bez ukrytych opłat',
        body: '1 zł opłaty za zamówienie, 30 zł minimum, 20 zł stała wysyłka — darmowa powyżej 500 zł. To cała lista.',
      },
      {
        title: 'Zawsze z rozbiciem',
        body: 'Każda wycena pokazuje materiał, czas maszynowy i korekty jako osobne pozycje — brutto, z 23% VAT.',
      },
    ],
  },
  // Landing FAQ (section 04, LandingFaq.tsx) — also feeds the route's
  // FAQPage JSON-LD, so items stay {q, a}-shaped.
  landingFaq: {
    n: '04',
    heading: 'Częste pytania',
    items: [
      {
        q: 'Co dzieje się z moim plikiem?',
        a: 'Plik trafia na nasz serwer w UE wyłącznie po to, by przygotować wycenę. Jeśli nie zamówisz, jest usuwany automatycznie. Nikt go nie przegląda i nikomu go nie udostępniamy.',
      },
      {
        q: 'Skąd cena w kilka sekund?',
        a: 'Geometrię mierzy twoja przeglądarka, a cenę liczy ten sam silnik co przy zamówieniu — waga jak w slicerze plus czas maszynowy. Przy zamówieniu silnik przelicza wszystko ponownie z zapisanego pliku, więc cena nigdy nie rozmija się z modelem.',
      },
      {
        q: 'Jakiej dokładności mogę oczekiwać?',
        a: 'Typowo ±0,3 mm na 100 mm w płaszczyźnie XY — tyle daje dobrze zestrojony FDM. Jeśli część wymaga ciaśniejszych pasowań, zaprojektuj zapas albo dopracuj pasowania po druku.',
      },
      {
        q: 'Jak szybko dotrze zamówienie?',
        a: 'Standardowo 3–10 dni roboczych, ekspres szybciej. Zamówienie złożone do 14:00 wchodzi w produkcję tego samego dnia; kurier dowozi D+1 w PL/DE i D+2 w reszcie UE.',
      },
      {
        q: 'Czy muszę zakładać konto?',
        a: 'Nie. Wycena jest anonimowa, a do zamówienia wystarczy e-mail — dostajesz na niego potwierdzenie i jednorazowy kod do śledzenia statusu. Żadnego hasła, żadnego handlowca.',
      },
      {
        q: 'Ile kosztuje wysyłka?',
        a: 'Stałe 20 zł do całej UE, gratis przy zamówieniu od 500 zł. Minimalna wartość zamówienia to 30 zł — wszystkie ceny brutto, z 23% VAT.',
      },
    ],
  },
  footer: {
    note: 'Prototyp · stawki poglądowe · każda wycena jest w pełni rozbita na pozycje',
    meta: 'UE · FDM · PLN · 23% VAT',
    cutoff: 'zamówienia do 14:00',
    navLabel: 'Nawigacja',
    orderLabel: 'Zamówienie',
  },
  notFound: {
    tag: 'Błąd 404',
    heading: 'Nie ma takiej strony',
    body: 'Ten adres nie pasuje do żadnej strony. Sprawdź pisownię albo zacznij od jednego z poniższych.',
    linksLabel: 'Zobacz zamiast tego',
    home: 'Strona główna',
  },
  // Material landing pages — UI chrome only; long-form prose lives in
  // src/content/materials/{pl,en}.ts.
  materialsPages: {
    breadcrumbHome: 'Start',
    breadcrumbMaterials: 'Materiały',
    indexTitle: 'Materiały do druku 3D — ceny i właściwości | MICRO_FACTORY',
    indexDescription:
      'Siedem materiałów FDM od prototypu po część użytkową: właściwości, ograniczenia projektowe i ceny liczone przez silnik wyceny.',
    indexHeading: 'Materiały do druku 3D',
    indexIntro:
      'Każdy materiał drukujemy na tych samych maszynach i wyceniamy tym samym silnikiem co formularz wyceny. Wybierz materiał, aby zobaczyć właściwości, wskazówki projektowe i ceny referencyjne.',
    priceFrom: (price: string) => `od ${price}`,
    comingSoon: 'Strona wkrótce',
    propertiesTitle: 'Właściwości',
    detailsLink: 'Szczegóły →',
    datasheetTitle: 'Karta — wydruk, XY',
    densityRate: 'Gęstość · stawka',
    shipsIn: (days: number) => `wysyłka w ${days} dni rob.`,
    // Short forms for card half-cells (design 5d: the full labels wrap).
    propertyLabelsShort: {
      tensile: 'Rozciąganie',
      hdt: 'HDT',
    },
    propertyLabels: {
      tensile: 'Wytrzymałość na rozciąganie',
      hdt: 'Odporność termiczna (HDT)',
      uv: 'Odporność UV',
      layerAdhesion: 'Adhezja międzywarstwowa',
      minWall: 'Min. grubość ścianki',
      tolerance: 'Tolerancja wymiarowa',
      density: 'Gęstość',
      rate: 'Stawka materiałowa',
    },
    ratings: {
      excellent: 'znakomita',
      good: 'dobra',
      moderate: 'umiarkowana',
      low: 'niska',
    },
    pricesTitle: 'Ceny referencyjne',
    pricesNote:
      'Ceny na żywo — liczy je ten sam silnik co twoją wycenę. Brutto, z 23% VAT, termin standardowy.',
    priceHeaderPart: 'Część referencyjna',
    priceHeaderQty: (n: number) => `${n} szt.`,
    partNames: {
      bracket: 'Wspornik',
      enclosure: 'Obudowa',
      housing: 'Korpus',
    },
    useCasesTitle: 'Zastosowania',
    guidelinesTitle: 'Wskazówki projektowe',
    faqTitle: 'Częste pytania',
    compareTitle: 'Porównaj z',
    pricingLink: 'Jak liczymy ceny →',
    allMaterialsLink: 'Wszystkie materiały →',
  },
  // Pricing page (cennik) — UI chrome only; prose in src/content/pricing.
  pricingPage: {
    breadcrumb: 'Cennik',
    feeMinOrder: 'Minimum zamówienia',
    feeOrderFee: 'Opłata za zamówienie',
    feeShipping: (thresholdPln: number) =>
      `Wysyłka · gratis ≥ ${thresholdPln} zł`,
    feeVat: 'VAT w cenie',
    sliderTitle: 'Szybka wycena według objętości',
    sliderLabel: (volume: string) => `Objętość części: ${volume} cm³`,
    sliderNote:
      'Cena za sztukę, termin standardowy, geometria sześcianu — realną część wyceń przez formularz.',
    formulaTitle: 'Wzór',
    headerFactor: 'współczynnik',
    rateCardTitle: 'Stawki i ceny referencyjne',
    rateCardVolumeHeader: (volume: number) => `${volume} cm³`,
    discountsTitle: 'Rabaty ilościowe',
    headerDiscount: 'Rabat',
    headerLine: 'Wartość pozycji',
    discountExampleLabel: (part: string) => `Przykład: ${part} 60 cm³, PETG`,
    leadTimesTitle: 'Terminy realizacji',
    headerMultiplier: 'Mnożnik',
    orderedLabel: (weekday: string, time: string) =>
      `Zamówienie: ${weekday}, ${time}`,
    shipsLabel: (lead: string, days: number, weekday: string, weeks: number) =>
      `${lead} · ${days} dni rob. → wysyłka ${weekday}${
        weeks === 1
          ? ' w przyszłym tygodniu'
          : weeks >= 2
            ? ' za dwa tygodnie'
            : ''
      }`,
    minimumsTitle: 'Minima i wysyłka',
    minOrderExampleTitle: 'Kiedy minimum ma znaczenie',
    fullRateCardLink: 'Pełny cennik →',
    noHiddenTitle: 'Bez ukrytych kosztów',
    comparisonTitle: 'Uczciwe porównanie',
    faqTitle: 'Częste pytania o ceny',
    seeAlso: 'Zobacz też',
  },
  comparePages: {
    breadcrumb: 'Porównania',
    indexTitle: 'Porównania materiałów i technologii | MICRO_FACTORY',
    indexDescription:
      'ASA czy PETG, druk PA12-CF czy aluminium CNC, własna drukarka czy zamówienie — rozstrzygnięte liczbami, nie przymiotnikami.',
    indexHeading: 'Porównania',
    indexIntro:
      'Trzy decyzje, przy których pomagamy najczęściej. Liczby pochodzą z naszej karty materiałowej i silnika wyceny — tam, gdzie cytujemy cudzy rynek, mówimy to wprost.',
    verdictTitle: 'W skrócie',
    readVerdict: 'Przeczytaj werdykt →',
    // Landing teaser card for the comparisons hub (GuidesTeaser.tsx).
    teaserTitle: 'ASA czy PETG? Własna drukarka czy zamówienie?',
    // Mega-menu panel footer (header/nav-panels.tsx).
    allComparisonsTitle: 'Wszystkie porównania',
    higherBetter: 'więcej = lepiej',
    lowerBetter: 'mniej = lepiej',
    // Decision-tile A/B stats (design 4a; PL drops the /kg to stay one-line).
    tileStatAsa: (hdtC: number) => `${hdtC} °C · UV+`,
    tileStatPetg: (mpa: number, ratePlnPerKg: number) =>
      `${mpa} MPa · ${ratePlnPerKg} zł`,
    tilePrintedQty1: 'Druk · 1 szt.',
    tileCncQty1: 'CNC · 1 szt. [2]',
    tileInHouse: 'Sam, z kosztem pracy',
    tileOrdered: 'Zamówione, z dostawą',
    specTitle: 'Specyfikacja obok siebie',
    assumptionsTitle: 'Założenia',
    costTitle: 'Porównanie kosztów',
    decisionTitle: 'Jak wybrać',
    footnotesTitle: 'Źródła',
    seeAlso: 'Zobacz też',
    citedRangeNote:
      'Przedział dla aluminium to typowe ceny europejskich frezarni CNC — nie nasza wycena. Ceny PA12-CF liczy nasz silnik wyceny.',
    leadTimeLabel: 'Termin realizacji',
    ourLeadValue: (days: number) => `${days} dni rob. (ekspres)`,
    aluLeadValue: (min: number, max: number) => `${min}–${max} dni rob.`,
    maxTempLabel: 'Maks. temperatura pracy',
    hdtValue: (c: number) => `${c} °C (HDT)`,
    aluMaxTempValue: (c: number) => `powyżej ${c} °C`,
    conductivityLabel: 'Przewodność elektryczna',
    conductivityNo: 'nie — izolator',
    conductivityYes: 'tak',
    aluminumHeader: 'Aluminium 6061 (CNC)',
    componentHeader: 'Składnik kosztu',
    amountHeader: 'Kwota',
    tcoMaterial: (g: number) => `Materiał — PLA, ${g} g`,
    tcoMachine: (h: number) => `Amortyzacja drukarki — ${h} h druku`,
    tcoOperator: (min: number) => `Praca operatora — ${min} min`,
    tcoFailure: (pct: number) => `Narzut na nieudane wydruki — ${pct}%`,
    tcoTotalHobby: 'Razem, gdy czas jest „za darmo”',
    tcoTotalCosted: 'Razem, z kosztem pracy',
    tcoOrdered: 'Zamówienie u nas — 1 szt., brutto z wysyłką',
  },
  // Blog / baza wiedzy — UI chrome only; article prose lives in
  // src/content/blog/{pl,en}/*.mdx.
  blogPages: {
    breadcrumb: 'Baza wiedzy',
    indexTitle: 'Baza wiedzy o druku 3D FDM | MICRO_FACTORY',
    indexDescription:
      'Przewodniki inżynierskie po druku FDM: grubości ścian, orientacja, tolerancje, pasowania. Konkretne liczby zamiast przymiotników.',
    indexHeading: 'Baza wiedzy',
    indexIntro:
      'Praktyczne przewodniki po projektowaniu części do druku FDM — pisane przez inżynierów dla inżynierów, na podstawie tego, co naprawdę schodzi z naszych maszyn.',
    tagFilterLabel: 'Filtruj po tagu',
    allTag: 'wszystkie',
    emptyFiltered: 'Brak artykułów z tym tagiem.',
    publishedLabel: 'Opublikowano',
    updatedLabel: 'Aktualizacja',
    authorRole: 'Zespół inżynierski MICRO_FACTORY',
    readingTime: (min: number) => `${min} min czytania`,
    readingTimeLabel: 'Czas czytania',
    tagsLabel: 'Tagi',
    tocTitle: 'Spis treści',
    scrollHint: 'przewiń →',
    shortVersionLabel: 'W skrócie',
    relatedTitle: 'Powiązane artykuły',
    newestLabel: 'Najnowszy',
    readGuide: 'Czytaj przewodnik →',
    // Landing teaser (GuidesTeaser.tsx) — section label above the cards.
    teaserLabel: 'Z bazy wiedzy',
    allGuidesTitle: 'Wszystkie przewodniki',
    guidesCount: (n: number) =>
      `${n} ${plPlural(n, 'przewodnik', 'przewodniki', 'przewodników')}`,
    rssNote: 'nowe przewodniki przez',
    rssLinkLabel: 'RSS ↗',
    writtenBy: 'Pisane przez zespół inżynierski MICRO_FACTORY',
    // Feature-panel figure caption + factual annotation, per translationKey.
    featureFigures: {
      'fdm-tolerances': {
        caption: 'Rys. 01 — Klasy tolerancji',
        annotation: '±0,3 MM / 100 MM',
      },
      'fdm-design-guide': {
        caption: 'Rys. 01 — Anizotropia warstw',
        annotation: 'Z ≈ 50–80% XY',
      },
    } as Record<string, { caption: string; annotation: string }>,
    rssTitle: 'Baza wiedzy MICRO_FACTORY (RSS)',
    rssDescription:
      'Nowe przewodniki inżynierskie po druku 3D FDM od MICRO_FACTORY.',
  },
  // Shared quote CTA (QuoteCta.tsx) — every content page ends in it.
  cta: {
    headline: 'Masz część pod ręką?',
    trust: 'Wycena w sekundach · bez konta · brutto z VAT',
    button: 'Wgraj plik',
  },
  dropzone: {
    idle: 'Upuść tu plik 3D',
    hint: 'albo kliknij, by wybrać — STL, 3MF, OBJ lub STEP · do 100 MB',
    button: 'Wybierz plik',
    multiHint: 'Dodaj do 5 części',
    dragActive: 'Puść, aby wgrać',
    parsing: 'Czytanie geometrii…',
    intake: 'Przyjęcie pliku',
    intakeArmed: 'Przyjęcie pliku — gotowe',
    formats: 'STL · 3MF · OBJ · STEP — do 100 MB',
    maxSize: 'Maks. 340 × 320 × 340 mm',
    mwLabel: 'albo wklej link z MakerWorld',
    mwPlaceholder: 'makerworld.com/en/models/…',
    mwButton: 'Pobierz',
    mwFetching: 'Pobieranie z MakerWorld…',
  },
  quote: {
    parsingTitle: 'Mierzymy twoją część…',
    unitPrice: 'za sztukę',
    orderButton: (price: string) => `Zamów za ${price}`,
    minOrderHint: (min: string) =>
      `Minimalne zamówienie ${min} — doliczono wyrównanie`,
    exVat: 'Ceny netto',
    incVat: 'Ceny brutto (23% VAT PL)',
    priceBreaksTitle: 'Cena za sztukę przy ilości',
    breakdownTitle: 'Rozbicie ceny',
    howWePrice: 'Jak wyceniamy',
    shippingNote: 'Wysyłka D+1 do PL/DE, D+2 do reszty UE',
    notPrintable: 'Nie do wydrukowania',
    discountOff: (pct: string) => `${pct} taniej`,
    lineTotalFor: (total: string, qty: number) => `${total} za ${qty} szt.`,
    metaTriangles: (count: number, formatted: string) =>
      `${formatted} ${plPlural(count, 'trójkąt', 'trójkąty', 'trójkątów')}`,
    metaPieces: (count: number) =>
      `${count} ${plPlural(count, 'element', 'elementy', 'elementów')}`,
    metaPlates: (count: number) =>
      `${count} ${plPlural(count, 'płyta', 'płyty', 'płyt')}`,
  },
  priceBreak: {
    qty: 'Szt.',
    unitPrice: 'Cena jedn.',
    discount: 'Rabat',
  },
  viewer: {
    partPreview: (n: string) => `Część ${n} · Podgląd`,
    boundingBox: 'Gabaryt',
    billableVolume: 'Objętość rozliczeniowa',
    triangles: 'Trójkąty',
  },
  partsList: {
    reading: 'Wczytywanie…',
    manualQuote: 'Wycena ręczna',
    failed: 'Błąd',
    remove: (fileName: string) => `Usuń ${fileName}`,
  },
  dfm: {
    labels: {
      exceeds_build_volume: 'Za duża',
      small_feature: 'Cienki element',
      min_volume_billed: 'Min. objętość',
      geometry_approximated: 'Geometria przybliżona',
      multi_plate: 'Wiele płyt',
    } satisfies Record<DfmCode, string>,
    messages: {
      exceeds_build_volume: (p: Params) =>
        p.piece
          ? `Element przekracza płytę roboczą ${num(p.x)}×${num(p.y)}×${num(p.z)} mm.`
          : `Część przekracza obszar roboczy ${num(p.x)}×${num(p.y)}×${num(p.z)} mm.`,
      small_feature: (p: Params) =>
        `Najmniejszy wymiar to ${num(p.minDimMm)} mm — cienkie elementy mogą nie przetrwać druku.`,
      min_volume_billed: (p: Params) =>
        `Poniżej 1 cm³ — naliczamy minimum ${num(p.minCm3)} cm³.`,
      geometry_approximated: () =>
        'Siatka nie jest szczelna — objętość oszacowana z otoczki wypukłej. Ostateczna cena może się zmienić.',
      multi_plate: (p: Params) =>
        `${num(p.pieces)} elem. mieści się na ${num(p.plates)} płytach roboczych — ${num(p.extraFeePln)} zł za każdą dodatkową płytę.`,
    } satisfies Record<DfmCode, (p: Params) => string>,
    unknown: 'Sprawdź szczegóły części.',
    unknownLabel: 'Uwaga',
    suggestion: (processes: string) => ` Wypróbuj: ${processes}.`,
  },
  breakdown: {
    material: 'Materiał',
    machine: 'Czas maszynowy',
    finishing: 'Wykończenie',
    plates: (n: number) => `Dodatkowe płyty (${n})`,
  },
  apiError: {
    invalid_body:
      'Żądanie było nieprawidłowe. Odśwież stronę i spróbuj ponownie.',
    parts_count: (p: Params) =>
      `Wycena może zawierać od 1 do ${num(p.max ?? 5)} części.`,
    unknown_process:
      'Wybrany materiał nie jest już dostępny. Odśwież i wyceń ponownie.',
    unknown_lead_time:
      'Wybrany termin nie jest już dostępny. Odśwież i wyceń ponownie.',
    quantity_range: (p: Params) =>
      `Ilość musi mieścić się w zakresie 1–${num(p.max ?? 100)}.`,
    invalid_metrics:
      'Geometria części wygląda na nieprawidłową. Wgraj plik ponownie.',
    invalid_email: 'To nie wygląda na adres e-mail.',
    unsupported_country: 'Nie wysyłamy jeszcze do tego kraju.',
    missing_file_fields:
      'Żądanie było niekompletne. Dodaj plik ponownie i spróbuj jeszcze raz.',
    quote_file_invalid:
      'Jeden z plików tej wyceny nie jest już przechowywany. Wgraj go ponownie.',
    quote_not_found: 'Nie znaleziono wyceny lub jej ważność wygasła.',
    missing_file_name: 'Brakuje nazwy pliku. Dodaj plik ponownie.',
    invalid_file_size: 'Nieprawidłowy rozmiar pliku. Dodaj plik ponownie.',
    invalid_design_id: 'Nieprawidłowy link do modelu MakerWorld.',
    invalid_profile_id: 'Nieprawidłowy profil modelu MakerWorld.',
    invalid_hash: 'Nie udało się zweryfikować pliku. Dodaj go ponownie.',
    unsupported_kind:
      'Nieobsługiwany format. Przyjmujemy STL, 3MF, OBJ i STEP.',
    file_size_range: 'Plik ma nieprawidłowy rozmiar (maks. 100 MB).',
    file_not_found: 'Nie znaleziono pliku. Dodaj go ponownie.',
    file_missing_hash: 'Nie udało się zweryfikować pliku. Dodaj go ponownie.',
    upload_object_missing:
      'Przesyłanie pliku nie dotarło do magazynu. Spróbuj ponownie.',
    upload_size_mismatch:
      'Przesłany plik ma inny rozmiar niż zgłoszono. Spróbuj ponownie.',
    storage_unavailable:
      'Magazyn plików jest chwilowo niedostępny. Spróbuj za moment.',
    internal: 'Coś poszło nie tak po naszej stronie. Spróbuj ponownie.',
  } satisfies Record<ApiErrorCode, string | ((p: Params) => string)>,
  apiErrorGeneric: 'Coś poszło nie tak. Sprawdź połączenie i spróbuj ponownie.',
  orderPanel: {
    otherParts: (n: number) => `Pozostałe części — ${n}`,
    minOrderTopUp: 'Wyrównanie do minimum',
    orderFee: 'Opłata za zamówienie',
    shipping: 'Wysyłka',
    free: 'Gratis',
    totalExVat: 'Suma netto',
    totalIncVat: 'Suma brutto',
    includesVat: (pct: number) => `Zawiera VAT (${pct}% PL)`,
    freeShippingApplied: 'Zastosowano darmową wysyłkę',
  },
  howWePrice: {
    subtitle: 'Żadnej ukrytej matematyki. Każda wycena powstaje z tych liczb.',
    weightPara: (v: {
      shellMm: number
      infillPct: number
      cheapest: string
      priciest: string
      shellGh: number
      infillGh: number
    }) =>
      `wyceniamy według wagi i czasu maszynowego. Wagę wydruku szacujemy jak slicer: pełna powłoka ${v.shellMm} mm na powierzchni części plus ${v.infillPct}% wypełnienia wnętrza, przeliczone na gramy według gęstości materiału. Naliczamy stawkę za kilogram (${v.cheapest} do ${v.priciest}), a potem czas maszynowy — ściany drukują się ${v.shellGh} g/h, wypełnienie ${v.infillGh} g/h — × stawka godzinowa maszyny.`,
    weightLead: 'Materiały FDM',
    quantityLead: 'Ilość',
    quantityPara: ' daje rabat od sztuki, od 5% przy 5 szt. do 28% przy 50. ',
    leadTimeLead: 'Termin',
    leadTimePara: (v: { economyPct: number; expressPct: number }) =>
      ` koryguje cenę: Ekonomiczny −${v.economyPct}%, Standardowy baza, Ekspres +${v.expressPct}%.`,
    feesPara: (v: {
      minPart: number
      minOrder: number
      orderFee: number
      shippingFlat: number
      freeThreshold: number
      vatPct: number
    }) =>
      `Każda część kosztuje co najmniej ${v.minPart} zł, a zamówienia poniżej ${v.minOrder} zł są wyrównywane do minimum ${v.minOrder} zł. Każde zamówienie ma stałą opłatę ${v.orderFee} zł. Wysyłka kosztuje ${v.shippingFlat} zł, darmowa powyżej ${v.freeThreshold} zł. Wszystkie ceny zawierają ${v.vatPct}% VAT (PL).`,
  },
  config: {
    process: 'Technologia i materiał',
    quantity: 'Ilość',
    leadTime: 'Termin realizacji',
    economy: 'Ekonomiczny',
    standard: 'Standardowy',
    express: 'Ekspres',
    warsawCutoff: 'Czas Europe/Warsaw · zamówienia tego samego dnia do 14:00',
    warsawTz: 'Europe/Warsaw',
    ships: (date: string) => `Wysyłka ${date}`,
    base: 'baza',
    printMeta: (grams: string, hours: string) =>
      `~${grams} g · ${hours} h druku`,
  },
  step: {
    title: 'Ten STEP wymaga szybkiej ręcznej weryfikacji',
    body: 'Nie udało się automatycznie odczytać tego pliku STEP. Zostaw e-mail, a wycenimy go ręcznie w ciągu 4 godzin roboczych.',
    emailLabel: 'E-mail',
    submit: 'Poproś o wycenę',
    success: 'Przyjęte — wyślemy wycenę e-mailem w ciągu 4 godzin roboczych.',
  },
  order: {
    title: 'Prawie gotowe',
    body: 'Powiedz nam, dokąd wysłać. Bez konta i bez płatności teraz — to rezerwuje twoją wycenę.',
    emailLabel: 'E-mail',
    countryLabel: 'Kraj wysyłki',
    submit: (price: string) => `Złóż zamówienie · ${price}`,
    successTitle: 'Zamówienie przyjęte',
    successBody: 'Wysłaliśmy potwierdzenie e-mailem. Numer twojej wyceny to',
    orderTotal: 'Suma zamówienia',
    done: 'Gotowe',
    failed: 'Nie udało się złożyć zamówienia. Spróbuj ponownie.',
  },
  login: {
    kicker: 'Dostęp_do_zamówień',
    heading: 'Śledź swoje zamówienie.',
    sub: 'Nie ma konta, więc nie ma hasła. Podaj e-mail użyty przy zamówieniu, a wyślemy jednorazowy kod — to całe logowanie.',
    factRetention: 'Wyceny przechowywane',
    factRetentionValue: '14 dni',
    factValidity: 'Ważność kodu',
    factValidityValue: '10 min',
    factClock: 'Europe/Warsaw',
    step1: 'Krok 1 / 2',
    step1Heading: 'Na jaki adres wysłaliśmy potwierdzenie?',
    emailLabel: 'E-mail',
    emailPlaceholder: 'ty@firma.pl',
    emailError: 'To nie wygląda na adres e-mail.',
    sendCode: 'Wyślij jednorazowy kod',
    emailNote: 'Nie zapisujemy e-maila, dopóki nie zamówisz',
    step2: 'Krok 2 / 2',
    step2Heading: 'Wpisz sześciocyfrowy kod',
    sentTo: 'Wysłano na',
    validity: '· ważny 10 minut',
    codeLabel: 'Kod',
    codeError: 'Sześć cyfr — sprawdź e-mail i spróbuj ponownie.',
    openOrders: 'Otwórz moje zamówienia',
    resend: 'Wyślij kod ponownie',
    resent: 'Kod wysłany ponownie ✓',
    changeEmail: 'Zmień e-mail',
    simNote:
      'Prototyp · kody jednorazowe są symulowane · nic nie jest wysyłane',
  },
  orders: {
    signedIn: 'Zalogowano —',
    heading: 'Twoje zamówienia',
    loading: 'Wczytywanie zamówień…',
    loadFailed:
      'Nie udało się wczytać zamówień. Sprawdź połączenie i spróbuj ponownie.',
    retry: 'Spróbuj ponownie',
    empty: 'Brak zamówień dla tego adresu.',
    placed: 'Złożone',
    moreParts: (n: number) =>
      `+ ${n} ${plPlural(n, 'część', 'części', 'części')} więcej`,
    newQuote: 'Rozpocznij nową wycenę →',
    signOut: 'Wyloguj',
    status: {
      submitted: 'Przyjęte',
      ordered: 'W produkcji',
      expired: 'Wygasłe',
    } satisfies Record<OrderStatus, string>,
  },
  errors: {
    tooLarge: 'Ten plik ma ponad 100 MB. Uprość go lub skompresuj.',
    unsupported: 'Nieobsługiwany format. Przyjmujemy STL, 3MF, OBJ i STEP.',
    corrupt: 'Nie udało się odczytać pliku — może być uszkodzony lub pusty.',
    tooManyParts:
      'Maksymalnie 5 części na wycenę. Usuń jedną, aby dodać kolejną.',
    parseFailed:
      'Coś poszło nie tak przy czytaniu geometrii. Spróbuj wgrać ponownie.',
    priceFailed:
      'Nie udało się pobrać ceny. Sprawdź połączenie i spróbuj ponownie.',
    webglMissing:
      'Twoja przeglądarka nie wyświetli podglądu 3D, ale wycena działa normalnie.',
    mwInvalidUrl: 'To nie wygląda na link do modelu MakerWorld.',
    mwNotFound: 'Nie znaleziono modelu na MakerWorld — sprawdź link.',
    mwNoProfile: 'Ten model nie ma profilu druku do pobrania.',
    mwAuthExpired:
      'Dostęp do MakerWorld wygasł — odśwież BAMBU_CLOUD_TOKEN na serwerze.',
    mwNotConfigured:
      'Import z MakerWorld nie jest skonfigurowany na tym serwerze.',
    mwDownloadFailed:
      'Nie udało się pobrać modelu z MakerWorld. Spróbuj ponownie.',
    mwTooLarge: 'Ten model ma ponad 100 MB. Pobierz go i uprość.',
  },
}
