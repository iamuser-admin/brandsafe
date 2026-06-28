/**
 * Robust JSON extraction for LLM/Pegasus output, which can drift into prose or
 * wrap JSON in ```json fences. Strips fences, then takes the outermost {...}.
 */
export function extractJson<T>(text: string): T {
  const cleaned = text.trim();

  // 1) fenced ```json ... ```
  const fenced = cleaned.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidates: string[] = [];
  if (fenced) candidates.push(fenced[1].trim());

  // 2) outermost object span
  const first = cleaned.indexOf("{");
  const last = cleaned.lastIndexOf("}");
  if (first !== -1 && last > first) candidates.push(cleaned.slice(first, last + 1));

  // 3) whole string as-is
  candidates.push(cleaned);

  for (const c of candidates) {
    try {
      return JSON.parse(c) as T;
    } catch {
      // try next candidate
    }
  }
  throw new Error("Could not parse JSON from model output");
}
