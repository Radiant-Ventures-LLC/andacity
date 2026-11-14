// @ts-nocheck
// IANA time zone for every seeded city (keyed by city slug). Every airport in a
// city shares its zone. Used to store airport time zones and to turn the
// generator's local wall-clock schedule into real UTC instants.
export const CITY_TIMEZONES = {
  "new-york": "America/New_York",
  "los-angeles": "America/Los_Angeles",
  "las-vegas": "America/Los_Angeles",
  orlando: "America/New_York",
  miami: "America/New_York",
  chicago: "America/Chicago",
  "san-francisco": "America/Los_Angeles",
  "washington-dc": "America/New_York",
  boston: "America/New_York",
  seattle: "America/Los_Angeles",
  "san-diego": "America/Los_Angeles",
  honolulu: "Pacific/Honolulu",
  nashville: "America/Chicago",
  "new-orleans": "America/Chicago",
  toronto: "America/Toronto",
  vancouver: "America/Vancouver",
  montreal: "America/Toronto",
  "mexico-city": "America/Mexico_City",
  cancun: "America/Cancun",
  "cabo-san-lucas": "America/Mazatlan",
  "puerto-vallarta": "America/Mexico_City",
  "san-juan": "America/Puerto_Rico",
  "rio-de-janeiro": "America/Sao_Paulo",
  "sao-paulo": "America/Sao_Paulo",
  "buenos-aires": "America/Argentina/Buenos_Aires",
  lima: "America/Lima",
  santiago: "America/Santiago",
  bogota: "America/Bogota",
  london: "Europe/London",
  paris: "Europe/Paris",
  rome: "Europe/Rome",
  milan: "Europe/Rome",
  venice: "Europe/Rome",
  florence: "Europe/Rome",
  barcelona: "Europe/Madrid",
  madrid: "Europe/Madrid",
  lisbon: "Europe/Lisbon",
  porto: "Europe/Lisbon",
  amsterdam: "Europe/Amsterdam",
  berlin: "Europe/Berlin",
  munich: "Europe/Berlin",
  frankfurt: "Europe/Berlin",
  prague: "Europe/Prague",
  vienna: "Europe/Vienna",
  budapest: "Europe/Budapest",
  athens: "Europe/Athens",
  istanbul: "Europe/Istanbul",
  dublin: "Europe/Dublin",
  edinburgh: "Europe/London",
  zurich: "Europe/Zurich",
  geneva: "Europe/Zurich",
  brussels: "Europe/Brussels",
  copenhagen: "Europe/Copenhagen",
  stockholm: "Europe/Stockholm",
  oslo: "Europe/Oslo",
  helsinki: "Europe/Helsinki",
  reykjavik: "Atlantic/Reykjavik",
  nice: "Europe/Paris",
  dubai: "Asia/Dubai",
  "abu-dhabi": "Asia/Dubai",
  doha: "Asia/Qatar",
  riyadh: "Asia/Riyadh",
  jeddah: "Asia/Riyadh",
  "tel-aviv": "Asia/Jerusalem",
  cairo: "Africa/Cairo",
  marrakech: "Africa/Casablanca",
  "cape-town": "Africa/Johannesburg",
  johannesburg: "Africa/Johannesburg",
  nairobi: "Africa/Nairobi",
  tokyo: "Asia/Tokyo",
  osaka: "Asia/Tokyo",
  kyoto: "Asia/Tokyo",
  seoul: "Asia/Seoul",
  busan: "Asia/Seoul",
  singapore: "Asia/Singapore",
  bangkok: "Asia/Bangkok",
  phuket: "Asia/Bangkok",
  "chiang-mai": "Asia/Bangkok",
  hanoi: "Asia/Ho_Chi_Minh",
  "ho-chi-minh-city": "Asia/Ho_Chi_Minh",
  denpasar: "Asia/Makassar",
  jakarta: "Asia/Jakarta",
  "kuala-lumpur": "Asia/Kuala_Lumpur",
  "hong-kong": "Asia/Hong_Kong",
  taipei: "Asia/Taipei",
  shanghai: "Asia/Shanghai",
  beijing: "Asia/Shanghai",
  guangzhou: "Asia/Shanghai",
  shenzhen: "Asia/Shanghai",
  delhi: "Asia/Kolkata",
  mumbai: "Asia/Kolkata",
  bengaluru: "Asia/Kolkata",
  chennai: "Asia/Kolkata",
  sydney: "Australia/Sydney",
  melbourne: "Australia/Melbourne",
  brisbane: "Australia/Brisbane",
  perth: "Australia/Perth",
  auckland: "Pacific/Auckland",
  queenstown: "Pacific/Auckland",
  denver: "America/Denver",
  austin: "America/Chicago",
  atlanta: "America/New_York",
  dallas: "America/Chicago",
  houston: "America/Chicago",
  philadelphia: "America/New_York",
  phoenix: "America/Phoenix",
  portland: "America/Los_Angeles",
  charlotte: "America/New_York",
  tampa: "America/New_York",
  minneapolis: "America/Chicago",
  detroit: "America/Detroit",
  "salt-lake-city": "America/Denver",
  raleigh: "America/New_York",
  "san-antonio": "America/Chicago",
  savannah: "America/New_York",
  charleston: "America/New_York",
  valencia: "Europe/Madrid",
  seville: "Europe/Madrid",
  malaga: "Europe/Madrid",
  naples: "Europe/Rome",
  palermo: "Europe/Rome",
  warsaw: "Europe/Warsaw",
  krakow: "Europe/Warsaw",
  bucharest: "Europe/Bucharest",
  sofia: "Europe/Sofia",
  tallinn: "Europe/Tallinn",
  riga: "Europe/Riga",
  vilnius: "Europe/Vilnius",
  dubrovnik: "Europe/Zagreb",
  split: "Europe/Zagreb",
  ljubljana: "Europe/Ljubljana",
  amman: "Asia/Amman",
  muscat: "Asia/Muscat",
  "addis-ababa": "Africa/Addis_Ababa",
  accra: "Africa/Accra",
  "port-louis": "Indian/Mauritius",
  "zanzibar-city": "Africa/Dar_es_Salaam",
  colombo: "Asia/Colombo",
  male: "Indian/Maldives",
  kathmandu: "Asia/Kathmandu",
  manila: "Asia/Manila",
  cebu: "Asia/Manila",
  "da-nang": "Asia/Ho_Chi_Minh",
  "siem-reap": "Asia/Phnom_Penh",
  penang: "Asia/Kuala_Lumpur",
  sapporo: "Asia/Tokyo",
  fukuoka: "Asia/Tokyo",
  hiroshima: "Asia/Tokyo",
  chengdu: "Asia/Shanghai",
  adelaide: "Australia/Adelaide",
};

export const timezoneForCity = (slug) => CITY_TIMEZONES[slug] || null;

const DAY_MS = 86_400_000;
const offsetCache = new Map();
const partsFormatters = new Map();

/** Minutes the zone is ahead of UTC at the given instant (e.g. -420 for MST). */
export const zoneOffsetMinutes = (timeZone, epochMs) => {
  // DST changes happen at most once a day; caching per UTC hour keeps the
  // ~13M-row flight seed from calling Intl millions of times.
  const hourKey = `${timeZone}|${Math.floor(epochMs / 3_600_000)}`;
  const cached = offsetCache.get(hourKey);
  if (cached !== undefined) return cached;

  let fmt = partsFormatters.get(timeZone);
  if (!fmt) {
    fmt = new Intl.DateTimeFormat("en-US", {
      timeZone,
      hourCycle: "h23",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
    partsFormatters.set(timeZone, fmt);
  }
  const p = Object.fromEntries(fmt.formatToParts(new Date(epochMs)).map((x) => [x.type, x.value]));
  const asUtc = Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour, +p.minute);
  const offset = Math.round((asUtc - Math.floor(epochMs / 60_000) * 60_000) / 60_000);
  offsetCache.set(hourKey, offset);
  return offset;
};

/** UTC epoch ms for a local wall-clock time (`YYYY-MM-DD` + minutes after midnight) in a zone. */
export const zonedWallTimeToEpoch = (isoDate, minutes, timeZone) => {
  const [y, m, d] = isoDate.split("-").map(Number);
  const naive = Date.UTC(y, m - 1, d) + minutes * 60_000;
  if (!timeZone) return naive;
  const first = naive - zoneOffsetMinutes(timeZone, naive) * 60_000;
  // Re-check at the corrected instant so times on DST-change days land right.
  return naive - zoneOffsetMinutes(timeZone, first) * 60_000;
};

/** Local minutes after midnight (0..1439) for an instant in a zone. */
export const zonedMinutesOfDay = (epochMs, timeZone) => {
  const local = epochMs + (timeZone ? zoneOffsetMinutes(timeZone, epochMs) : 0) * 60_000;
  return Math.floor((((local % DAY_MS) + DAY_MS) % DAY_MS) / 60_000);
};
