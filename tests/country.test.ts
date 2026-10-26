import { describe, expect, it } from 'vitest';
import { countryFromPhone } from '../shared/country.ts';

describe('countryFromPhone', () => {
  it('reads an international Zimbabwe number with a plus', () => {
    expect(countryFromPhone('+263 77 123 4567')).toEqual({ code: 'ZW', name: 'Zimbabwe' });
  });

  it('reads a Zimbabwe number without a plus or punctuation', () => {
    expect(countryFromPhone('263771234567')).toEqual({ code: 'ZW', name: 'Zimbabwe' });
  });

  it('treats a local leading-zero number as Zimbabwe', () => {
    expect(countryFromPhone('0771234567')).toEqual({ code: 'ZW', name: 'Zimbabwe' });
  });

  it('strips the international 00 prefix', () => {
    expect(countryFromPhone('00263771234567')).toEqual({ code: 'ZW', name: 'Zimbabwe' });
  });

  it('resolves regional and diaspora dialling codes', () => {
    expect(countryFromPhone('+27 82 000 0000').name).toBe('South Africa');
    expect(countryFromPhone('+44 7700 900000').name).toBe('United Kingdom');
    expect(countryFromPhone('+1 202 555 0143').code).toBe('US');
  });

  it('prefers the longest dialling code so +1 territories resolve correctly', () => {
    expect(countryFromPhone('+1 876 555 0100').name).toBe('Jamaica');
    expect(countryFromPhone('+1 246 555 0100').name).toBe('Barbados');
  });

  it('falls back to Unknown for empty or unusable numbers', () => {
    expect(countryFromPhone('').name).toBe('Unknown');
    expect(countryFromPhone(null).code).toBe('ZZ');
    expect(countryFromPhone('+999 123').name).toBe('Unknown');
  });
});
