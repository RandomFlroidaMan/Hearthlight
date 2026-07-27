import OpenAI from "openai";

const globalForOpenAI = globalThis as unknown as {
  openai: OpenAI | undefined;
};

function getClient(): OpenAI {
  if (!globalForOpenAI.openai) {
    globalForOpenAI.openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  }
  return globalForOpenAI.openai;
}

/** A lazy proxy: importing this module must never construct the real
 * OpenAI client. Next's build-time "collecting page data" step imports
 * every route module just to analyze it, which used to run `new
 * OpenAI(...)` — and the SDK throws immediately if OPENAI_API_KEY isn't
 * set. That broke builds on any host where the key is injected as a
 * runtime env var rather than being present at build time (e.g. Railway).
 * Deferring construction to first actual property access means the key
 * is only required once a request really calls into the API. */
export const openai = new Proxy({} as OpenAI, {
  get(_target, prop, receiver) {
    return Reflect.get(getClient(), prop, receiver);
  },
});
