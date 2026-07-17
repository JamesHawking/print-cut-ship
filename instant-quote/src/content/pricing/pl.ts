// Polish copy for the pricing page — the type source of truth (en.ts must
// satisfy the same shape). Every zł amount and percentage is INTERPOLATED
// from the engine dataset (no-literal-prices.spec.ts fails on `\d zł`
// literals in this directory).
//
// TODO(launch): machine-drafted Polish — native-speaker review required
// before launch, together with src/lib/i18n/pl.ts.

import { formatDecimal } from '@/lib/format'
import type { PricingValues } from './data'

export interface PricingCopy {
  metaTitle: string
  metaDescription: string
  h1: string
  /** Transparency rationale — the page's strategic claim. */
  intro: string[]
  formulaIntro: string
  rateCardNote: (v: PricingValues) => string
  discountIntro: (v: PricingValues) => string
  leadIntro: (v: PricingValues) => string
  minimumsIntro: (v: PricingValues) => string
  minOrderExampleNote: (v: PricingValues) => string
  noHidden: (v: PricingValues) => string[]
  comparison: string[]
  faq: Array<{ q: string; a: (v: PricingValues) => string }>
}

export const plPricingCopy: PricingCopy = {
  metaTitle:
    'Cennik druku 3D — pełne stawki, bez zapytań ofertowych | MICRO_FACTORY',
  metaDescription:
    'Publikujemy pełny cennik druku FDM: stawki materiałowe, rabaty ilościowe, terminy i opłaty. Te same liczby, którymi wycenia formularz.',
  h1: 'Cennik',
  intro: [
    'Prawie żaden europejski serwis druku 3D nie publikuje już prawdziwych cen — wszędzie „wyślij zapytanie”. My publikujemy wszystko: stawki, rabaty, minima i opłaty. To dokładnie te same liczby, którymi liczy formularz wyceny; ta strona i silnik czytają jedną konfigurację.',
    'Jeśli czegoś tu nie ma — nie doliczamy tego.',
  ],
  formulaIntro:
    'Cena części to materiał plus czas maszynowy, przeskalowane rabatem ilościowym i mnożnikiem terminu. Wagę liczymy jak slicer: powłoka 0,9 mm na powierzchni plus 20% wypełnienia, przeliczone gęstością materiału.',
  rateCardNote: (v) =>
    `Ceny za sztukę dla idealnego sześcianu o danej objętości, termin standardowy, brutto z ${v.vatPct}% VAT. Przy małych objętościach obowiązuje minimalna cena części ${formatDecimal(v.minPartPricePln, 'pl', 2, 2)} zł — dlatego 1 cm³ i 10 cm³ potrafią kosztować tyle samo.`,
  discountIntro: (v) =>
    `Rabat od sztuki rośnie liniowo między progami, do ${v.maxDiscountPct}% przy 50 sztukach i więcej. Ten sam rabat stosuje formularz — poniżej dokładne progi i przeliczony przykład.`,
  leadIntro: (v) =>
    `Trzy terminy realizacji, jeden mnożnik ceny. Dni robocze odliczamy od dnia zamówienia (sam dzień zamówienia nie wlicza się do terminu); zamówienie po ${v.cutoffHour}:00 czasu warszawskiego przesuwa start odliczania na następny dzień roboczy. Poniżej dwa konkretne scenariusze.`,
  minimumsIntro: (v) =>
    `Minimalna wartość zamówienia to ${v.minOrderPln} zł (dopłata wyrównująca, naliczana raz na zamówienie). Do tego stała opłata ${v.orderFeePln} zł i wysyłka ${v.shippingFlatPln} zł — darmowa od ${v.freeShippingThresholdPln} zł. Dostawa D+1 w Polsce i Niemczech, D+2 w pozostałej UE.`,
  minOrderExampleNote: (v) =>
    `Przykład poniżej: pojedynczy mały wspornik nie dobija do ${v.minOrderPln} zł, więc widzisz dokładnie, ile wynosi wyrównanie. Przy dwóch–trzech częściach minimum zwykle przestaje mieć znaczenie.`,
  noHidden: (v) => [
    `Bez opłat za plik, bez opłat przygotowawczych, bez „skontaktujemy się z wyceną specjalną”. Jedyne pozycje poza ceną części: opłata za zamówienie ${v.orderFeePln} zł i wysyłka.`,
    `Wszystkie ceny są brutto — ${v.vatPct}% VAT (PL) jest w cenie, nie doliczany na końcu. W formularzu wyceny możesz przełączyć widok na ceny netto; kwota do zapłaty się nie zmienia.`,
  ],
  comparison: [
    'Uczciwie: przy dużych, prostych częściach bez terminu azjatycki dostawca bywa tańszy — większa skala, niższe stawki pracy. Jeśli masz trzy tygodnie zapasu i part nie wymaga iteracji, warto to porównać.',
    'My wygrywamy tam, gdzie liczy się czas i pętla poprawek: wysyłka w 3 dni robocze zamiast tygodni, kolejna wersja części w tej samej cenie i bez ryzyka celno-podatkowego przy imporcie spoza UE. Przy częściach funkcjonalnych o typowych rozmiarach różnica w cenie bywa mniejsza, niż sugerują katalogowe stawki.',
  ],
  faq: [
    {
      q: 'Dlaczego moje zamówienie kosztuje więcej niż suma części?',
      a: (v) =>
        `Do wartości części dochodzi stała opłata ${v.orderFeePln} zł i wysyłka ${v.shippingFlatPln} zł (darmowa od ${v.freeShippingThresholdPln} zł). Jeśli suma części nie osiąga ${v.minOrderPln} zł, doliczamy jednorazowe wyrównanie do minimum.`,
    },
    {
      q: 'Czy ceny zawierają VAT?',
      a: (v) =>
        `Tak — wszystkie ceny na stronie i w formularzu są brutto, z ${v.vatPct}% VAT (PL). Widok netto włączysz przełącznikiem w wycenie.`,
    },
    {
      q: 'Ile kosztuje i trwa wysyłka?',
      a: (v) =>
        `Wysyłka kosztuje ${v.shippingFlatPln} zł, a od ${v.freeShippingThresholdPln} zł jest darmowa. Paczki nadane po zakończeniu druku docierają D+1 w Polsce i Niemczech, D+2 w pozostałej UE.`,
    },
    {
      q: 'Jak działają rabaty ilościowe?',
      a: (v) =>
        `Rabat od ceny sztuki rośnie z ilością — progi i wartości znajdziesz w tabeli wyżej, maksymalnie ${v.maxDiscountPct}% od 50 sztuk. Między progami rabat jest interpolowany liniowo, więc 7 sztuk też ma sensowną cenę.`,
    },
    {
      q: 'Jak wygląda płatność?',
      a: () =>
        'Obecnie złożenie zamówienia rezerwuje wycenę — skontaktujemy się z potwierdzeniem i fakturą. Płatności online (w tym BLIK i P24) są w przygotowaniu.',
    },
    {
      q: 'Jak długo ważna jest wycena?',
      a: () =>
        'Wycena i pliki są przechowywane 14 dni. Po tym czasie wystarczy ponownie wgrać plik — wycena liczy się z aktualnej konfiguracji w kilka sekund.',
    },
  ],
}
