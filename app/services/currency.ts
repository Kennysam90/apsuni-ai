import { useSyncExternalStore } from 'react';

export type Country = { code: string; name: string; currency: string; symbol: string };

/**
 * Countries offered at sign-up with the currency the app shows for each.
 * Generated from the backend table in userauths/countries.py — keep them in sync.
 */
const COUNTRY_ROWS: [string, string, string, string][] = [
  ["AF", "Afghanistan", "AFN", "؋"],
  ["AL", "Albania", "ALL", "L"],
  ["DZ", "Algeria", "DZD", "DA"],
  ["AD", "Andorra", "EUR", "€"],
  ["AO", "Angola", "AOA", "Kz"],
  ["AG", "Antigua and Barbuda", "XCD", "EC$"],
  ["AR", "Argentina", "ARS", "$"],
  ["AM", "Armenia", "AMD", "֏"],
  ["AU", "Australia", "AUD", "A$"],
  ["AT", "Austria", "EUR", "€"],
  ["AZ", "Azerbaijan", "AZN", "₼"],
  ["BS", "Bahamas", "BSD", "B$"],
  ["BH", "Bahrain", "BHD", "BD"],
  ["BD", "Bangladesh", "BDT", "৳"],
  ["BB", "Barbados", "BBD", "Bds$"],
  ["BY", "Belarus", "BYN", "Br"],
  ["BE", "Belgium", "EUR", "€"],
  ["BZ", "Belize", "BZD", "BZ$"],
  ["BJ", "Benin", "XOF", "CFA"],
  ["BT", "Bhutan", "BTN", "Nu."],
  ["BO", "Bolivia", "BOB", "Bs"],
  ["BA", "Bosnia and Herzegovina", "BAM", "KM"],
  ["BW", "Botswana", "BWP", "P"],
  ["BR", "Brazil", "BRL", "R$"],
  ["BN", "Brunei", "BND", "B$"],
  ["BG", "Bulgaria", "BGN", "лв"],
  ["BF", "Burkina Faso", "XOF", "CFA"],
  ["BI", "Burundi", "BIF", "FBu"],
  ["CV", "Cabo Verde", "CVE", "Esc"],
  ["KH", "Cambodia", "KHR", "៛"],
  ["CM", "Cameroon", "XAF", "FCFA"],
  ["CA", "Canada", "CAD", "C$"],
  ["CF", "Central African Republic", "XAF", "FCFA"],
  ["TD", "Chad", "XAF", "FCFA"],
  ["CL", "Chile", "CLP", "$"],
  ["CN", "China", "CNY", "¥"],
  ["CO", "Colombia", "COP", "$"],
  ["KM", "Comoros", "KMF", "CF"],
  ["CG", "Congo", "XAF", "FCFA"],
  ["CD", "Congo (DRC)", "CDF", "FC"],
  ["CR", "Costa Rica", "CRC", "₡"],
  ["CI", "Côte d'Ivoire", "XOF", "CFA"],
  ["HR", "Croatia", "EUR", "€"],
  ["CU", "Cuba", "CUP", "$"],
  ["CY", "Cyprus", "EUR", "€"],
  ["CZ", "Czechia", "CZK", "Kč"],
  ["DK", "Denmark", "DKK", "kr"],
  ["DJ", "Djibouti", "DJF", "Fdj"],
  ["DM", "Dominica", "XCD", "EC$"],
  ["DO", "Dominican Republic", "DOP", "RD$"],
  ["EC", "Ecuador", "USD", "$"],
  ["EG", "Egypt", "EGP", "E£"],
  ["SV", "El Salvador", "USD", "$"],
  ["GQ", "Equatorial Guinea", "XAF", "FCFA"],
  ["ER", "Eritrea", "ERN", "Nfk"],
  ["EE", "Estonia", "EUR", "€"],
  ["SZ", "Eswatini", "SZL", "E"],
  ["ET", "Ethiopia", "ETB", "Br"],
  ["FJ", "Fiji", "FJD", "FJ$"],
  ["FI", "Finland", "EUR", "€"],
  ["FR", "France", "EUR", "€"],
  ["GA", "Gabon", "XAF", "FCFA"],
  ["GM", "Gambia", "GMD", "D"],
  ["GE", "Georgia", "GEL", "₾"],
  ["DE", "Germany", "EUR", "€"],
  ["GH", "Ghana", "GHS", "GH₵"],
  ["GR", "Greece", "EUR", "€"],
  ["GD", "Grenada", "XCD", "EC$"],
  ["GT", "Guatemala", "GTQ", "Q"],
  ["GN", "Guinea", "GNF", "FG"],
  ["GW", "Guinea-Bissau", "XOF", "CFA"],
  ["GY", "Guyana", "GYD", "G$"],
  ["HT", "Haiti", "HTG", "G"],
  ["HN", "Honduras", "HNL", "L"],
  ["HK", "Hong Kong", "HKD", "HK$"],
  ["HU", "Hungary", "HUF", "Ft"],
  ["IS", "Iceland", "ISK", "kr"],
  ["IN", "India", "INR", "₹"],
  ["ID", "Indonesia", "IDR", "Rp"],
  ["IR", "Iran", "IRR", "﷼"],
  ["IQ", "Iraq", "IQD", "IQD"],
  ["IE", "Ireland", "EUR", "€"],
  ["IL", "Israel", "ILS", "₪"],
  ["IT", "Italy", "EUR", "€"],
  ["JM", "Jamaica", "JMD", "J$"],
  ["JP", "Japan", "JPY", "¥"],
  ["JO", "Jordan", "JOD", "JD"],
  ["KZ", "Kazakhstan", "KZT", "₸"],
  ["KE", "Kenya", "KES", "KSh"],
  ["KI", "Kiribati", "AUD", "A$"],
  ["KW", "Kuwait", "KWD", "KD"],
  ["KG", "Kyrgyzstan", "KGS", "с"],
  ["LA", "Laos", "LAK", "₭"],
  ["LV", "Latvia", "EUR", "€"],
  ["LB", "Lebanon", "LBP", "L£"],
  ["LS", "Lesotho", "LSL", "L"],
  ["LR", "Liberia", "LRD", "L$"],
  ["LY", "Libya", "LYD", "LD"],
  ["LI", "Liechtenstein", "CHF", "CHF"],
  ["LT", "Lithuania", "EUR", "€"],
  ["LU", "Luxembourg", "EUR", "€"],
  ["MO", "Macao", "MOP", "MOP$"],
  ["MG", "Madagascar", "MGA", "Ar"],
  ["MW", "Malawi", "MWK", "MK"],
  ["MY", "Malaysia", "MYR", "RM"],
  ["MV", "Maldives", "MVR", "Rf"],
  ["ML", "Mali", "XOF", "CFA"],
  ["MT", "Malta", "EUR", "€"],
  ["MH", "Marshall Islands", "USD", "$"],
  ["MR", "Mauritania", "MRU", "UM"],
  ["MU", "Mauritius", "MUR", "₨"],
  ["MX", "Mexico", "MXN", "MX$"],
  ["FM", "Micronesia", "USD", "$"],
  ["MD", "Moldova", "MDL", "L"],
  ["MC", "Monaco", "EUR", "€"],
  ["MN", "Mongolia", "MNT", "₮"],
  ["ME", "Montenegro", "EUR", "€"],
  ["MA", "Morocco", "MAD", "DH"],
  ["MZ", "Mozambique", "MZN", "MT"],
  ["MM", "Myanmar", "MMK", "K"],
  ["NA", "Namibia", "NAD", "N$"],
  ["NR", "Nauru", "AUD", "A$"],
  ["NP", "Nepal", "NPR", "रू"],
  ["NL", "Netherlands", "EUR", "€"],
  ["NZ", "New Zealand", "NZD", "NZ$"],
  ["NI", "Nicaragua", "NIO", "C$"],
  ["NE", "Niger", "XOF", "CFA"],
  ["NG", "Nigeria", "NGN", "₦"],
  ["KP", "North Korea", "KPW", "₩"],
  ["MK", "North Macedonia", "MKD", "ден"],
  ["NO", "Norway", "NOK", "kr"],
  ["OM", "Oman", "OMR", "OMR"],
  ["PK", "Pakistan", "PKR", "Rs"],
  ["PW", "Palau", "USD", "$"],
  ["PS", "Palestine", "ILS", "₪"],
  ["PA", "Panama", "PAB", "B/."],
  ["PG", "Papua New Guinea", "PGK", "K"],
  ["PY", "Paraguay", "PYG", "₲"],
  ["PE", "Peru", "PEN", "S/"],
  ["PH", "Philippines", "PHP", "₱"],
  ["PL", "Poland", "PLN", "zł"],
  ["PT", "Portugal", "EUR", "€"],
  ["QA", "Qatar", "QAR", "QR"],
  ["RO", "Romania", "RON", "lei"],
  ["RU", "Russia", "RUB", "₽"],
  ["RW", "Rwanda", "RWF", "FRw"],
  ["KN", "Saint Kitts and Nevis", "XCD", "EC$"],
  ["LC", "Saint Lucia", "XCD", "EC$"],
  ["VC", "Saint Vincent and the Grenadines", "XCD", "EC$"],
  ["WS", "Samoa", "WST", "WS$"],
  ["SM", "San Marino", "EUR", "€"],
  ["ST", "São Tomé and Príncipe", "STN", "Db"],
  ["SA", "Saudi Arabia", "SAR", "SR"],
  ["SN", "Senegal", "XOF", "CFA"],
  ["RS", "Serbia", "RSD", "din"],
  ["SC", "Seychelles", "SCR", "SR"],
  ["SL", "Sierra Leone", "SLE", "Le"],
  ["SG", "Singapore", "SGD", "S$"],
  ["SK", "Slovakia", "EUR", "€"],
  ["SI", "Slovenia", "EUR", "€"],
  ["SB", "Solomon Islands", "SBD", "SI$"],
  ["SO", "Somalia", "SOS", "Sh"],
  ["ZA", "South Africa", "ZAR", "R"],
  ["KR", "South Korea", "KRW", "₩"],
  ["SS", "South Sudan", "SSP", "SSP"],
  ["ES", "Spain", "EUR", "€"],
  ["LK", "Sri Lanka", "LKR", "Rs"],
  ["SD", "Sudan", "SDG", "SDG"],
  ["SR", "Suriname", "SRD", "Sr$"],
  ["SE", "Sweden", "SEK", "kr"],
  ["CH", "Switzerland", "CHF", "CHF"],
  ["SY", "Syria", "SYP", "LS"],
  ["TW", "Taiwan", "TWD", "NT$"],
  ["TJ", "Tajikistan", "TJS", "SM"],
  ["TZ", "Tanzania", "TZS", "TSh"],
  ["TH", "Thailand", "THB", "฿"],
  ["TL", "Timor-Leste", "USD", "$"],
  ["TG", "Togo", "XOF", "CFA"],
  ["TO", "Tonga", "TOP", "T$"],
  ["TT", "Trinidad and Tobago", "TTD", "TT$"],
  ["TN", "Tunisia", "TND", "DT"],
  ["TR", "Türkiye", "TRY", "₺"],
  ["TM", "Turkmenistan", "TMT", "m"],
  ["TV", "Tuvalu", "AUD", "A$"],
  ["UG", "Uganda", "UGX", "USh"],
  ["UA", "Ukraine", "UAH", "₴"],
  ["AE", "United Arab Emirates", "AED", "AED"],
  ["GB", "United Kingdom", "GBP", "£"],
  ["US", "United States", "USD", "$"],
  ["UY", "Uruguay", "UYU", "$U"],
  ["UZ", "Uzbekistan", "UZS", "soʻm"],
  ["VU", "Vanuatu", "VUV", "VT"],
  ["VA", "Vatican City", "EUR", "€"],
  ["VE", "Venezuela", "VES", "Bs.S"],
  ["VN", "Vietnam", "VND", "₫"],
  ["YE", "Yemen", "YER", "﷼"],
  ["ZM", "Zambia", "ZMW", "ZK"],
  ["ZW", "Zimbabwe", "ZWL", "Z$"],
];

export const COUNTRIES: Country[] = COUNTRY_ROWS.map(([code, name, currency, symbol]) => ({ code, name, currency, symbol }));

const DEFAULT_COUNTRY = 'NG';
const byCode = new Map(COUNTRIES.map((country) => [country.code, country]));

export function findCountry(value?: string | null) {
  if (!value) return undefined;
  const text = value.trim();
  return byCode.get(text.toUpperCase()) ?? COUNTRIES.find((country) => country.name.toLowerCase() === text.toLowerCase());
}

/** Emoji flag built from the two regional-indicator letters of the ISO code. */
export function countryFlag(code: string) {
  return code.toUpperCase().replace(/./g, (letter) => String.fromCodePoint(127397 + letter.charCodeAt(0)));
}

/* ---- The signed-in user's currency, shared across every screen ---- */

let current: Country = byCode.get(DEFAULT_COUNTRY)!;
const listeners = new Set<() => void>();

export function setUserCountry(value?: string | null) {
  const next = findCountry(value) ?? byCode.get(DEFAULT_COUNTRY)!;
  if (next === current) return;
  current = next;
  listeners.forEach((listener) => listener());
}

export function getUserCurrency() {
  return current;
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/**
 * Formats with the user's currency symbol: $1,234.00 / ₦1,234.00.
 * Written by hand because Hermes' Intl locale support varies by device.
 * The amount is shown as stored — no exchange-rate conversion happens here.
 */
export function formatMoney(value?: string | number | null, options: { decimals?: boolean; currency?: Country } = {}) {
  const { symbol } = options.currency ?? current;
  const amount = Number(value ?? 0);
  const safe = Number.isFinite(amount) ? amount : 0;
  const [whole, fraction] = Math.abs(safe).toFixed(2).split('.');
  const grouped = whole.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  const separator = /^[A-Za-z]/.test(symbol) && /[A-Za-z.]$/.test(symbol) ? ' ' : '';
  const body = options.decimals === false ? grouped : `${grouped}.${fraction}`;
  return `${safe < 0 ? '-' : ''}${symbol}${separator}${body}`;
}

/** Re-renders the calling component when the user's currency changes. */
export function useCurrency() {
  const currency = useSyncExternalStore(subscribe, getUserCurrency, getUserCurrency);
  return {
    ...currency,
    format: (value?: string | number | null, decimals = true) => formatMoney(value, { decimals, currency }),
  };
}
