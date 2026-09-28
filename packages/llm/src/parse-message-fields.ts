/** Pull structured estimate fields from free-text user messages. */
export function parseDimensionsFromMessage(message: string): {
  area_sqft: number;
  area_sqm: number;
  area_dimensions: string;
} | null {
  const dim =
    message.match(
      /(\d+(?:\.\d+)?)\s*[x×]\s*(\d+(?:\.\d+)?)\s*(?:feet|foot|ft|'|m|meter|metres)?/i,
    ) ??
    message.match(
      /(?:feet|foot|ft)\s+(\d+(?:\.\d+)?)\s*[x×]\s*(\d+(?:\.\d+)?)/i,
    );
  if (dim) {
    const w = parseFloat(dim[1]);
    const h = parseFloat(dim[2]);
    const isMeters = /m(?:eter|etre)?s?\b/i.test(dim[0]);
    const sqUnits = w * h;
    const sqft = isMeters ? sqUnits * 10.7639 : sqUnits;
    const label = isMeters ? `${w}×${h} m` : `${w}×${h} ft`;
    return {
      area_sqft: Math.round(sqft * 100) / 100,
      area_sqm: Math.round((sqft / 10.7639) * 100) / 100,
      area_dimensions: label,
    };
  }

  const sqftMatch = message.match(
    /(\d+(?:\.\d+)?)\s*(?:sq\.?\s*ft|square\s*feet|sqft)\b/i,
  );
  if (sqftMatch) {
    const sqft = parseFloat(sqftMatch[1]);
    return {
      area_sqft: sqft,
      area_sqm: Math.round((sqft / 10.7639) * 100) / 100,
      area_dimensions: `${sqft} sq ft`,
    };
  }

  const sqmMatch = message.match(
    /(\d+(?:\.\d+)?)\s*(?:sq\.?\s*m|square\s*met(?:er|re)s?)\b/i,
  );
  if (sqmMatch) {
    const sqm = parseFloat(sqmMatch[1]);
    return {
      area_sqm: sqm,
      area_sqft: Math.round(sqm * 10.7639 * 100) / 100,
      area_dimensions: `${sqm} sq m`,
    };
  }

  return null;
}
