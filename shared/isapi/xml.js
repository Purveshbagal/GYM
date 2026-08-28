/**
 * Minimal, dependency-free XML helpers. Several ISAPI endpoints on this
 * device ignore `?format=json` and return XML regardless (confirmed by
 * the Phase 1 probe against the real DS-K1T320EFWX: deviceInfo,
 * System/capabilities, AccessControl/capabilities, Event notification
 * capabilities, RemoteControl/door capabilities, and Door/param all came
 * back as XML even with format=json requested). This is intentionally a
 * shallow, regex-based extractor — good enough for flat capability flags
 * and single values, not a general XML parser — to avoid pulling in a
 * dependency for a handful of well-known tags.
 */

/** Returns the text content of the first <tag>...</tag>, or null. */
function extractTag(xml, tag) {
  const m = new RegExp(`<${tag}[^>]*>([\\s\\S]*?)</${tag}>`, "i").exec(xml);
  return m ? m[1].trim() : null;
}

/** Same as extractTag but coerces "true"/"false" to a boolean, or null if absent/unparseable. */
function extractBool(xml, tag) {
  const v = extractTag(xml, tag);
  if (v === null) return null;
  if (v.toLowerCase() === "true") return true;
  if (v.toLowerCase() === "false") return false;
  return null;
}

function isXml(text) {
  return typeof text === "string" && text.trim().startsWith("<");
}

module.exports = { extractTag, extractBool, isXml };
