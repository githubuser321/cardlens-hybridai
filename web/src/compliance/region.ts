/**
 * Client-side hint that the browser looks like the EEA, the UK, or Switzerland.
 * This is not a location service. It reads language tags and the IANA timezone only.
 * A person physically in those regions can look like somewhere else (VPN, en-US, a US timezone).
 * A person outside them can look restricted (en-GB, Europe/London).
 */

/** ISO 3166-1 alpha-2 tags we treat as EEA, UK, or Switzerland, plus close aliases. */
export const RESTRICTED_REGIONS = [
  'AT', 'BE', 'BG', 'HR', 'CY', 'CZ', 'DK', 'EE', 'FI', 'FR', 'DE', 'GR', 'EL', 'HU', 'IE', 'IT',
  'LV', 'LT', 'LU', 'MT', 'NL', 'PL', 'PT', 'RO', 'SK', 'SI', 'ES', 'SE',
  'IS', 'LI', 'NO',
  'GB', 'UK',
  'CH',
  'AX', 'GI', 'GP', 'GF', 'MQ', 'RE', 'YT', 'MF', 'BL', 'PM',
  'GG', 'JE', 'IM',
] as const;

const RESTRICTED_REGION_SET = new Set<string>(RESTRICTED_REGIONS);

/**
 * IANA timezones whose usual country is in the EEA, the UK (including crown dependencies
 * and Gibraltar), Switzerland, or an EU outermost region. Ambiguous abbreviations such as
 * `CET` are not in this list.
 */
export const RESTRICTED_TIME_ZONES = [
  'Europe/Amsterdam',
  'Europe/Athens',
  'Europe/Berlin',
  'Europe/Bratislava',
  'Europe/Brussels',
  'Europe/Bucharest',
  'Europe/Budapest',
  'Europe/Busingen',
  'Europe/Copenhagen',
  'Europe/Dublin',
  'Europe/Gibraltar',
  'Europe/Guernsey',
  'Europe/Helsinki',
  'Europe/Isle_of_Man',
  'Europe/Jersey',
  'Europe/Lisbon',
  'Europe/Ljubljana',
  'Europe/London',
  'Europe/Luxembourg',
  'Europe/Madrid',
  'Europe/Malta',
  'Europe/Mariehamn',
  'Europe/Oslo',
  'Europe/Paris',
  'Europe/Prague',
  'Europe/Riga',
  'Europe/Rome',
  'Europe/Sofia',
  'Europe/Stockholm',
  'Europe/Tallinn',
  'Europe/Vaduz',
  'Europe/Vienna',
  'Europe/Vilnius',
  'Europe/Warsaw',
  'Europe/Zagreb',
  'Europe/Zurich',
  'Atlantic/Azores',
  'Atlantic/Canary',
  'Atlantic/Madeira',
  'Atlantic/Reykjavik',
  'Arctic/Longyearbyen',
  'Asia/Nicosia',
  'Asia/Famagusta',
  'America/Martinique',
  'America/Guadeloupe',
  'America/Cayenne',
  'America/Miquelon',
  'Indian/Reunion',
  'Indian/Mayotte',
] as const;

const RESTRICTED_TIME_ZONE_SET = new Set<string>(RESTRICTED_TIME_ZONES);

export interface RegionSignals {
  locales: readonly string[];
  timeZone: string | null;
}

export interface RegionAssessment {
  restricted: boolean;
  /** True when a region subtag or a timezone string was available to judge. */
  hasSignal: boolean;
  matchedLocale: string | null;
  matchedTimeZone: string | null;
}

export function assessRegion(signals: RegionSignals): RegionAssessment {
  let matchedLocale: string | null = null;
  let sawLocaleRegion = false;
  for (const tag of signals.locales) {
    const region = regionOf(tag);
    if (!region) {
      continue;
    }
    sawLocaleRegion = true;
    if (RESTRICTED_REGION_SET.has(region)) {
      matchedLocale = region;
      break;
    }
  }
  const timeZone = signals.timeZone?.trim() || null;
  const matchedTimeZone = timeZone && RESTRICTED_TIME_ZONE_SET.has(timeZone) ? timeZone : null;
  return {
    restricted: matchedLocale !== null || matchedTimeZone !== null,
    hasSignal: sawLocaleRegion || timeZone !== null,
    matchedLocale,
    matchedTimeZone,
  };
}

export function regionOf(tag: string): string | null {
  const trimmed = tag.trim();
  if (!trimmed) {
    return null;
  }
  try {
    const region = new Intl.Locale(trimmed).region;
    if (region) {
      return region.toUpperCase();
    }
  } catch {
    // Fall through to a small BCP 47 slice for tags Intl rejects.
  }
  const parts = trimmed.split(/[-_]/);
  for (const part of parts.slice(1)) {
    if (/^[A-Za-z]{2}$/.test(part) || /^\d{3}$/.test(part)) {
      return part.toUpperCase();
    }
  }
  return null;
}

export function readBrowserRegionSignals(): RegionSignals {
  const locales = typeof navigator === 'undefined'
    ? []
    : navigator.languages?.length
      ? [...navigator.languages]
      : navigator.language
        ? [navigator.language]
        : [];
  let timeZone: string | null;
  try {
    timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone || null;
  } catch {
    timeZone = null;
  }
  return { locales, timeZone };
}
