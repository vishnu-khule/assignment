export type SiteLocaleGuess = {
  currency: string;
  locale: string;
  country?: string;
};

const UK_MARKERS =
  /\b(uk|u\.k\.|united kingdom|england|scotland|wales|london|manchester|birmingham|leeds|glasgow|liverpool|edinburgh)\b/i;
const INDIA_MARKERS =
  /\b(india|indian|mumbai|delhi|bengaluru|bangalore|chennai|kolkata|pune|hyderabad|noida|gurgaon|gurugram|maharashtra|pin\s*code|\b\d{6}\b)/i;
const US_MARKERS =
  /\b(usa|u\.s\.a?\.?|united states|california|texas|new york|florida|chicago|los angeles)\b/i;
const EU_MARKERS =
  /\b(germany|france|spain|italy|netherlands|ireland|eurozone|berlin|paris|madrid|dublin)\b/i;

/** Infer currency + locale from free-text site address or location notes. */
export function inferSiteLocale(text: string): SiteLocaleGuess | null {
  const t = text.trim();
  if (t.length < 3) return null;

  if (UK_MARKERS.test(t)) {
    return { currency: "GBP", locale: "en-GB", country: "UK" };
  }
  if (INDIA_MARKERS.test(t)) {
    return { currency: "INR", locale: "en-IN", country: "India" };
  }
  if (EU_MARKERS.test(t)) {
    return { currency: "EUR", locale: "en-EU", country: "EU" };
  }
  if (US_MARKERS.test(t)) {
    return { currency: "USD", locale: "en-US", country: "US" };
  }
  return null;
}

export function applySiteLocaleToRequirements(
  requirements: Record<string, unknown>,
  guess: SiteLocaleGuess,
): Record<string, unknown> {
  return {
    ...requirements,
    inferred_currency: guess.currency,
    inferred_locale: guess.locale,
    inferred_country: guess.country,
  };
}
