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

/**
 * A backend's refusal, as a plain `Error` so existing error spans render
 * `message` as they always have. `status` is the HTTP status.
 */
export class ApiError extends Error {
  readonly status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

/** The response's FastAPI `detail` (any shape), as readable text. */
export async function readError(resp: Response): Promise<string> {
  const body: unknown = await resp.json().catch(() => null);
  const detail = body && typeof body === "object" ? (body as { detail?: unknown }).detail : null;
  return formatDetail(detail, resp.status);
}

/** Throw the response's FastAPI `detail` as an {@link ApiError}. */
export async function asError(resp: Response): Promise<never> {
  throw new ApiError(await readError(resp), resp.status);
}
