// Polish dictionary — the source of truth for the Dictionary type
// (types.ts infers from `typeof pl`; en.ts must satisfy it).
//
// Deliberately NO `as const`: values widen to `string` / `(n) => string` so
// the English file can carry different text under the same shape.
//
// TODO(launch): machine-drafted Polish — native-speaker review required
// before launch; schedule alongside plan 09's lawyer pass (Plans/08-i18n.md §6).

import { plPlural } from './plural'

/** Stable family key — identical across locales (used for dot colors). */
export type MaterialFamily = 'standard' | 'engineering' | 'specialty'

type OrderStatus = 'submitted' | 'expired' | 'ordered'

export const pl = {
  meta: {
    title: 'Natychmiastowa wycena druku 3D — wgraj, wyceń, zamów',
    description:
      'Wgraj plik STL, 3MF, OBJ lub STEP i otrzymaj cenę od ręki. Produkcja w UE, wysyłka D+1/D+2 do Niemiec. Bez zakładania konta.',
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
    ctaHeading: 'Masz część pod ręką?',
    ctaButton: 'Wgraj plik',
    note: 'Prototyp · stawki poglądowe · każda wycena jest w pełni rozbita na pozycje',
    meta: 'UE · FDM · PLN · 23% VAT',
    cutoff: 'zamówienia do 14:00',
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
  },
  config: {
    process: 'Technologia i materiał',
    quantity: 'Ilość',
    leadTime: 'Termin realizacji',
    economy: 'Ekonomiczny',
    standard: 'Standardowy',
    express: 'Ekspres',
    warsawCutoff: 'Czas Europe/Warsaw · zamówienia tego samego dnia do 14:00',
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
