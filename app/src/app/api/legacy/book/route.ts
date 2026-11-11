import { z } from "zod";
import { handler, json, rateLimit } from "@/lib/api/http";
import { legacyBookSchema } from "@/lib/legacy/schema";
import { optIn, putBook, removeBook, status } from "@/lib/legacy/server/service";
import { authEmpty, authJson } from "@/lib/legacy/server/http";

/**
 * GET /api/legacy/book → LegacyStatus for the signed-in owner or child (the book, voice info without any voice id,
 * the child's opt-in). Children see the book's contents only after the estate unlocks and they opt in.
 */
export const GET = handler(async (req) => {
  rateLimit(req, "legacy-book-read", 60);
  return json(await status(await authEmpty(req, "book.read")));
});

/** PUT /api/legacy/book { book } → the saved book (owner only, while the estate is active; zod-validated). */
export const PUT = handler(async (req) => {
  rateLimit(req, "legacy-book-write", 20);
  const { body, viewer } = await authJson(req, "book.write", z.object({ book: legacyBookSchema }), ["owner"]);
  return json({ book: await putBook(viewer, body.book) });
});

/** PATCH /api/legacy/book { optIn: boolean } → a child switches the legacy voice on or off for themselves. */
export const PATCH = handler(async (req) => {
  rateLimit(req, "legacy-optin", 20);
  const { body, viewer } = await authJson(req, "optin", z.object({ optIn: z.boolean() }), ["child"]);
  await optIn(viewer, body.optIn);
  return json({ ok: true, optIn: body.optIn });
});

/** DELETE /api/legacy/book → owner deletes the Legacy Book. */
export const DELETE = handler(async (req) => {
  rateLimit(req, "legacy-book-delete", 5);
  await removeBook(await authEmpty(req, "book.delete", ["owner"]));
  return json({ ok: true });
});
