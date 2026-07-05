/**
 * Shared HTTP-error translator for the argus service clients (FastAPI
 * backends). FastAPI's `detail` is a string for HTTPException, but a LIST of
 * {loc, msg, type} objects for 422 validation errors — naive string coercion
 * renders those as "[object Object]".
 */

interface ValidationItem {
  loc?: unknown;
  msg?: unknown;
}

function formatDetail(detail: unknown, status: number): string {
  if (typeof detail === "string" && detail) return detail;
  if (Array.isArray(detail)) {
    const parts = detail.map((item) => {
      const v = item as ValidationItem;
      if (v && typeof v.msg === "string") {
        const loc = Array.isArray(v.loc) ? v.loc.filter((p) => p !== "body").join(".") : "";
        return loc ? `${loc}: ${v.msg}` : v.msg;
      }
      return JSON.stringify(item);
    });
    if (parts.length) return `Invalid request — ${parts.join("; ")}`;
  }
  if (detail != null) return JSON.stringify(detail);
  return `Server error: ${status}`;
}

/** Throw the response's FastAPI `detail` (any shape) as a readable Error. */
export async function asError(resp: Response): Promise<never> {
  const body: unknown = await resp.json().catch(() => null);
  const detail = body && typeof body === "object" ? (body as { detail?: unknown }).detail : null;
  throw new Error(formatDetail(detail, resp.status));
}
