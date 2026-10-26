/**
 * MHOMHO — country inference from a WhatsApp number.
 *
 * There is no country picker in the sign-up form, so the country is derived
 * from the dialling code the creator already supplies. Local Zimbabwe numbers
 * (leading 0) are treated as Zimbabwe, which is the overwhelming majority of
 * the roster. Numbers that cannot be matched fall back to "Unknown".
 *
 * This is display/aggregation data only. It is never used for eligibility,
 * pricing or payments. Imported by the Worker so the client cannot spoof it.
 */

export interface CountryMatch {
  /** ISO 3166-1 alpha-2 code, or "ZZ" when unknown. */
  code: string;
  name: string;
}

const UNKNOWN: CountryMatch = { code: 'ZZ', name: 'Unknown' };

const DIAL_CODES: Array<{ dial: string; code: string; name: string }> = [
  { dial: '263', code: 'ZW', name: 'Zimbabwe' },
  { dial: '27', code: 'ZA', name: 'South Africa' },
  { dial: '260', code: 'ZM', name: 'Zambia' },
  { dial: '265', code: 'MW', name: 'Malawi' },
  { dial: '258', code: 'MZ', name: 'Mozambique' },
  { dial: '267', code: 'BW', name: 'Botswana' },
  { dial: '264', code: 'NA', name: 'Namibia' },
  { dial: '266', code: 'LS', name: 'Lesotho' },
  { dial: '268', code: 'SZ', name: 'Eswatini' },
  { dial: '255', code: 'TZ', name: 'Tanzania' },
  { dial: '254', code: 'KE', name: 'Kenya' },
  { dial: '256', code: 'UG', name: 'Uganda' },
  { dial: '250', code: 'RW', name: 'Rwanda' },
  { dial: '257', code: 'BI', name: 'Burundi' },
  { dial: '234', code: 'NG', name: 'Nigeria' },
  { dial: '233', code: 'GH', name: 'Ghana' },
  { dial: '244', code: 'AO', name: 'Angola' },
  { dial: '243', code: 'CD', name: 'DR Congo' },
  { dial: '237', code: 'CM', name: 'Cameroon' },
  { dial: '225', code: 'CI', name: 'Côte d’Ivoire' },
  { dial: '221', code: 'SN', name: 'Senegal' },
  { dial: '20', code: 'EG', name: 'Egypt' },
  { dial: '212', code: 'MA', name: 'Morocco' },
  { dial: '251', code: 'ET', name: 'Ethiopia' },
  { dial: '44', code: 'GB', name: 'United Kingdom' },
  { dial: '353', code: 'IE', name: 'Ireland' },
  { dial: '1', code: 'US', name: 'United States / Canada' },
  { dial: '61', code: 'AU', name: 'Australia' },
  { dial: '64', code: 'NZ', name: 'New Zealand' },
  { dial: '971', code: 'AE', name: 'United Arab Emirates' },
  { dial: '966', code: 'SA', name: 'Saudi Arabia' },
  { dial: '974', code: 'QA', name: 'Qatar' },
  { dial: '965', code: 'KW', name: 'Kuwait' },
  { dial: '90', code: 'TR', name: 'Türkiye' },
  { dial: '91', code: 'IN', name: 'India' },
  { dial: '92', code: 'PK', name: 'Pakistan' },
  { dial: '880', code: 'BD', name: 'Bangladesh' },
  { dial: '86', code: 'CN', name: 'China' },
  { dial: '63', code: 'PH', name: 'Philippines' },
  { dial: '62', code: 'ID', name: 'Indonesia' },
  { dial: '49', code: 'DE', name: 'Germany' },
  { dial: '33', code: 'FR', name: 'France' },
  { dial: '31', code: 'NL', name: 'Netherlands' },
  { dial: '32', code: 'BE', name: 'Belgium' },
  { dial: '34', code: 'ES', name: 'Spain' },
  { dial: '39', code: 'IT', name: 'Italy' },
  { dial: '351', code: 'PT', name: 'Portugal' },
  { dial: '46', code: 'SE', name: 'Sweden' },
  { dial: '47', code: 'NO', name: 'Norway' },
  { dial: '45', code: 'DK', name: 'Denmark' },
  { dial: '48', code: 'PL', name: 'Poland' },
  { dial: '7', code: 'RU', name: 'Russia' },
  { dial: '55', code: 'BR', name: 'Brazil' },
  { dial: '52', code: 'MX', name: 'Mexico' },
  { dial: '54', code: 'AR', name: 'Argentina' },
  { dial: '592', code: 'GY', name: 'Guyana' },
  { dial: '1876', code: 'JM', name: 'Jamaica' },
  { dial: '1868', code: 'TT', name: 'Trinidad and Tobago' },
  { dial: '1246', code: 'BB', name: 'Barbados' },
  { dial: '1242', code: 'BS', name: 'Bahamas' },
];

// Longest dial code first so +1 vs +1246 resolves correctly.
const SORTED_DIAL_CODES = [...DIAL_CODES].sort((a, b) => b.dial.length - a.dial.length);

/**
 * Infer a country from a phone number. Accepts "+263 77…", "26377…",
 * "0026377…" and local Zimbabwe formats like "0771…".
 */
export function countryFromPhone(raw: string | null | undefined): CountryMatch {
  if (!raw) return UNKNOWN;
  let digits = String(raw).replace(/\D/g, '');
  if (!digits) return UNKNOWN;

  if (digits.startsWith('00')) digits = digits.slice(2);

  // Local Zimbabwe format (07… / 071… etc.). Mhomho is a Zimbabwe-first
  // platform, so an unqualified leading zero is treated as a local number.
  if (digits.startsWith('0')) {
    return digits.length >= 9 ? { code: 'ZW', name: 'Zimbabwe' } : UNKNOWN;
  }

  for (const entry of SORTED_DIAL_CODES) {
    if (digits.startsWith(entry.dial)) {
      return { code: entry.code, name: entry.name };
    }
  }
  return UNKNOWN;
}
