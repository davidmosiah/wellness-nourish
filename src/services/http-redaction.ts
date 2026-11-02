/** Provider diagnostics must never disclose credentials carried in request URLs. */
const SENSITIVE_PARAMETER = /^(?:api[_-]?key|key|access[_-]?token|refresh[_-]?token|token|client[_-]?secret|password|secret|authorization)$/i;

function redactUrl(value: string): string {
  try {
    const url = new URL(value);
    if (url.username) url.username = "REDACTED";
    if (url.password) url.password = "REDACTED";
    for (const key of [...url.searchParams.keys()]) {
      if (SENSITIVE_PARAMETER.test(key)) url.searchParams.set(key, "REDACTED");
    }
    // Fragments are not sent to providers and need not appear in diagnostics.
    url.hash = "";
    return url.toString();
  } catch {
    return "[invalid provider URL]";
  }
}

export function sanitizeHttpDiagnostics(url: string, message: string): { url: string; message: string } {
  const secrets = new Set<string>();
  try {
    const parsed = new URL(url);
    for (const [key, value] of parsed.searchParams) {
      if (SENSITIVE_PARAMETER.test(key) && value) secrets.add(value);
    }
    if (parsed.username) secrets.add(decodeURIComponent(parsed.username));
    if (parsed.password) secrets.add(decodeURIComponent(parsed.password));
  } catch {
    // Do not return raw diagnostics when we cannot determine the URL's secrets.
    return { url: "[invalid provider URL]", message: "Provider request failed (invalid URL)." };
  }
  let safeMessage = message;
  for (const secret of [...secrets].sort((a, b) => b.length - a.length)) {
    const jsonEscaped = JSON.stringify(secret).slice(1, -1);
    for (const representation of new Set([
      secret, jsonEscaped, JSON.stringify(jsonEscaped).slice(1, -1),
      encodeURIComponent(secret), new URLSearchParams({ v: secret }).toString().slice(2),
    ])) {
      safeMessage = safeMessage.split(representation).join("REDACTED");
    }
  }
  safeMessage = safeMessage.replace(/https?:\/\/[^\s<>"']+/gi, redactUrl);
  return { url: redactUrl(url), message: safeMessage };
}
