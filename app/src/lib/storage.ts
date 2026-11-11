import "server-only";
/**
 * Evidence files (death certificates, fee statements, affidavits, registration papers).
 * Stored in the private Supabase Storage bucket `evidence` via the service-role key; only the
 * SHA-256 goes on-chain (POPIA). Without Supabase env we keep files in memory (demo fallback).
 */
import { getSupabase } from "./supabase";
import { sha256Hex } from "./agent/hash";

export const BUCKET = "evidence";
export const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;
export const ALLOWED_MIME = ["application/pdf", "image/jpeg", "image/png"] as const;
export type AllowedMime = (typeof ALLOWED_MIME)[number];

export interface StoredEvidence { path: string; sha256: string; mime: AllowedMime; size: number; backend: "supabase" | "memory" }

const memory = new Map<string, { bytes: Uint8Array; mime: string }>();

/** Checks size, declared type and magic bytes (so a renamed .exe is rejected). */
export function validateUpload(bytes: Uint8Array, mime: string): AllowedMime {
  if (bytes.byteLength === 0) throw new UploadError("The file is empty.");
  if (bytes.byteLength > MAX_UPLOAD_BYTES) throw new UploadError("The file is larger than 10 MB.");
  if (!(ALLOWED_MIME as readonly string[]).includes(mime)) throw new UploadError("Only PDF, JPG or PNG files are accepted.");
  const sniffed = sniff(bytes);
  if (sniffed !== mime) throw new UploadError("The file's contents do not match its type.");
  return mime as AllowedMime;
}

export function sniff(b: Uint8Array): AllowedMime | null {
  if (b[0] === 0x25 && b[1] === 0x50 && b[2] === 0x44 && b[3] === 0x46) return "application/pdf"; // %PDF
  if (b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return "image/jpeg";
  if (b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47) return "image/png";
  return null;
}

export class UploadError extends Error {
  constructor(message: string) { super(message); this.name = "UploadError"; }
}

const EXT: Record<AllowedMime, string> = { "application/pdf": "pdf", "image/jpeg": "jpg", "image/png": "png" };

export async function storeEvidence(bytes: Uint8Array, mime: string, purpose: string): Promise<StoredEvidence> {
  const m = validateUpload(bytes, mime);
  const sha256 = await sha256Hex(bytes);
  const path = `${purpose}/${sha256}.${EXT[m]}`; // content-addressed: no names or personal data in the path
  const sb = getSupabase();
  if (sb) {
    const { error } = await sb.storage.from(BUCKET).upload(path, bytes, { contentType: m, upsert: true });
    if (error) throw new Error(`Could not store the file: ${error.message}`);
    return { path, sha256, mime: m, size: bytes.byteLength, backend: "supabase" };
  }
  memory.set(path, { bytes, mime: m });
  return { path, sha256, mime: m, size: bytes.byteLength, backend: "memory" };
}

/** Short-lived signed URL for verifiers to view a file (Supabase only). */
export async function signedEvidenceUrl(path: string, expiresInSecs = 300): Promise<string | null> {
  const sb = getSupabase();
  if (!sb) return null;
  const { data, error } = await sb.storage.from(BUCKET).createSignedUrl(path, expiresInSecs);
  return error ? null : data.signedUrl;
}
