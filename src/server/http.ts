/** Parses a request body as JSON, catching malformed input (invalid JSON,
 * empty body) rather than letting it throw an unhandled exception — every
 * route that skipped this returned a bare, bodyless 500 on bad input. */
export async function parseJsonBody(
  request: Request,
): Promise<{ ok: true; data: unknown } | { ok: false; response: Response }> {
  try {
    const data = await request.json();
    return { ok: true, data };
  } catch {
    return {
      ok: false,
      response: Response.json(
        { error: "invalid_json", message: "Request body must be valid JSON." },
        { status: 400 },
      ),
    };
  }
}

/** Same as parseJsonBody, for routes that take multipart/form-data
 * (file uploads) instead — request.formData() throws just as readily on a
 * mismatched Content-Type or malformed body. */
export async function parseFormData(
  request: Request,
): Promise<{ ok: true; data: FormData } | { ok: false; response: Response }> {
  try {
    const data = await request.formData();
    return { ok: true, data };
  } catch {
    return {
      ok: false,
      response: Response.json(
        { error: "invalid_form_data", message: "Request body must be valid multipart form data." },
        { status: 400 },
      ),
    };
  }
}
