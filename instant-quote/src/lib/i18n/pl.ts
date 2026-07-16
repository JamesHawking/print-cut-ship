// Polish dictionary — the source of truth for the Dictionary type
// (types.ts infers from `typeof pl`; en.ts must satisfy it).
//
// Deliberately NO `as const`: values widen to `string` / `(n) => string` so
// the English file can carry different text under the same shape.
//
// TODO(launch): machine-drafted Polish — native-speaker review required
// before launch; schedule alongside plan 09's lawyer pass (Plans/08-i18n.md §6).

import type { components } from '@/lib/api/schema'
import { plPlural } from './plural'

/** Stable family key — identical across locales (used for dot colors). */
export type MaterialFamily = 'standard' | 'engineering' | 'specialty'

type OrderStatus = 'submitted' | 'expired' | 'ordered'

// Mirrors the OpenAPI DfmFlag.code enum (backend/api/openapi.yaml).
type DfmCode =
  | 'exceeds_build_volume'
  | 'small_feature'
  | 'min_volume_billed'
  | 'geometry_approximated'
  | 'multi_plate'

// Generated from the contract — adding a backend code without copy here is a
// compile error (localization contract, Plans/08-i18n.md).
type ApiErrorCode = components['schemas']['ApiErrorCode']

type Params = Record<string, unknown>

/** Polish decimal comma for param values embedded in copy. */
const num = (v: unknown): string => {
  if (typeof v === 'number')
    return String(Math.round(v * 100) / 100).replace('.', ',')
  return typeof v === 'string' ? v : '—'
}

export const pl = {
  meta: {
    title: 'Natychmiastowa wycena druku 3D — wgraj, wyceń, zamów',
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
    figCaption: 'Zautomatyzowana linia — druk · odbiór · pakowanie · wysyłka',
    figAlt:
      'Zautomatyzowana linia produkcyjna: część jest drukowana w 3D, przenoszona przez ramię robota i pakowana do wysyłki.',
    figNo: 'Rys. 01',
    // Zipped with computed values in Hero.tsx (same order).
    specs: [
      'materiałów FDM',
      'dni roboczych realizacji',
      'wysyłka PL/DE · D+2 UE',
      'VAT zawsze wliczony',
    ],
  },
  nav: {
    howItWorks: 'Jak to działa',
    materials: 'Materiały',
    pricing: 'Cennik',
    trackOrder: 'Śledź zamówienie',
    menuLabel: 'Przełącz menu',
    resume: (n: number) => `Wróć do wyceny (${n}) →`,
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
    steps: [
      {
        n: '01',
        title: 'Wgraj',
        body: 'Upuść plik STL, 3MF, OBJ lub STEP. Geometria jest mierzona bezpośrednio w przeglądarce, a plik przechowujemy bezpiecznie na potrzeby druku — usuniemy go automatycznie, jeśli nie zamówisz.',
      },
      {
        n: '02',
        title: 'Wyceń',
        body: 'Przejrzysta wycena z rozbiciem na pozycje pojawia się w kilka sekund. Materiał, czas maszynowy, ilość, termin — każdą liczbę da się wyjaśnić.',
      },
      {
        n: '03',
        title: 'Zamów',
        body: 'Wybierz materiał i ilość, zobacz realną datę wysyłki i złóż zamówienie. Bez konta, bez telefonu od handlowca, bez czekania.',
      },
    ],
  },
  materialsSection: {
    n: '02',
    heading: 'Siedem materiałów, od prototypu po część użytkową',
    material: 'Materiał',
    application: 'Zastosowanie',
    density: 'Gęstość',
    from: 'Od',
    footnote: 'Stawki brutto z 23% VAT',
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
  footer: {
    note: 'Prototyp · stawki poglądowe · każda wycena jest w pełni rozbita na pozycje',
    meta: 'UE · FDM · PLN · 23% VAT',
    cutoff: 'zamówienia do 14:00',
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
    lineTotal: 'suma pozycji',
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
