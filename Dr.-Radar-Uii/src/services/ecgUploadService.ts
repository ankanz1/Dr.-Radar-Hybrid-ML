import { supabase } from '../lib/supabase';
import { getAuthenticatedPatientRecord } from './ecgPersistence';

/**
 * ECG original-file storage (Phase 2A).
 *
 * Persists the ORIGINAL uploaded ECG file in the PRIVATE Supabase Storage
 * bucket "ecg-uploads" plus its metadata row in public.ecg_uploads. Paths are
 * always patient-scoped: {patient_id}/{upload_id}/{safe_filename} where the
 * patient_id comes from the caller's own RLS-resolved patient row and the
 * upload_id is a fresh UUID. The user never supplies path components.
 *
 * Uses ONLY the publishable (anon) key via the user's own session — no
 * service-role key exists anywhere in frontend code. All access is RLS-
 * enforced (ecg-qml/db/009_ecg_storage.sql).
 */

const BUCKET = 'ecg-uploads';
const SIGNED_URL_EXPIRY_SECONDS = 300; // short-lived, never a permanent URL

const ALLOWED_MIME_TYPES = new Set([
  'text/csv',
  'text/plain',
  'application/pdf',
  'application/octet-stream',
]);

const MIME_TO_UPLOAD_TYPE: Record<string, EcgUploadType> = {
  'text/csv': 'ecg-csv',
  'text/plain': 'ecg-txt',
  'application/pdf': 'ecg-pdf',
  'application/octet-stream': 'ecg-csv', // octet-stream must be a data file
};

export type EcgUploadType = 'ecg-csv' | 'ecg-txt' | 'ecg-pdf';

export interface StoredEcgUpload {
  id: string;
  patientId: string;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  storagePath: string;
  uploadType: EcgUploadType;
  createdAt: string;
}

export interface EcgStorageResult {
  ok: boolean;
  stored?: StoredEcgUpload;
  error?: string;
}

/** Sanitize a filename: keep the base name, strip path components/control chars. */
export function sanitizeFileName(name: string): string {
  const base = name.split(/[\\/]/).pop() ?? '';
  const cleaned = base
    // eslint-disable-next-line no-control-regex
    .replace(/[\u0000-\u001f\u007f]/g, '')
    .replace(/[^A-Za-z0-9._ ()-]/g, '_')
    .replace(/\s+/g, ' ')
    .trim();
  const safe = cleaned.length > 0 ? cleaned : 'upload';
  return safe.length > 200 ? safe.slice(0, 200) : safe;
}

/** True when the browser-provided MIME is one the bucket whitelist accepts. */
export function isStorageAcceptedMime(mime: string): boolean {
  return ALLOWED_MIME_TYPES.has(mime);
}

/**
 * Development-only diagnostics (TEMPORARY). Logs the exact failing stage with
 * error codes/messages/status and NON-SECRET identifiers only: authenticated
 * user id, resolved patient id, upload id, bucket, storage path, filename,
 * MIME type and size. NEVER logs access/refresh tokens, passwords, or keys.
 */
function logStorageDiag(stage: string, details: Record<string, unknown>): void {
  if (!import.meta.env.DEV) return;
  console.error(`[ecg-storage] ${stage} FAILED`, details);
}

/**
 * Persist an original ECG file: Storage upload -> ecg_uploads metadata row.
 * Transactional-like: if the metadata insert fails, the just-uploaded object
 * is removed so no silent orphan file is left behind.
 */
export async function storeEcgFile(file: File): Promise<EcgStorageResult> {
  // 1. Verify the authenticated session explicitly (Part 2 step 1-2)
  const { data: sessionData } = await supabase.auth.getSession();
  const sessionUserId = sessionData.session?.user?.id ?? null;
  if (!sessionUserId) {
    logStorageDiag('session check', { reason: 'no active Supabase session' });
    return { ok: false, error: 'Sign in with your patient account to store the original ECG file.' };
  }

  // 2. Resolve the caller's own patient row (RLS-safe; no user-supplied IDs)
  const resolution = await getAuthenticatedPatientRecord();
  if (resolution.status === 'signed-out') {
    logStorageDiag('patient resolution', { sessionUserId, reason: 'signed-out' });
    return { ok: false, error: 'Sign in with your patient account to store the original ECG file.' };
  }
  if (resolution.status === 'no-patient-record') {
    logStorageDiag('patient resolution', { sessionUserId, reason: 'no public.patients row for this user' });
    return { ok: false, error: 'No patient profile is linked to this account, so the file cannot be stored.' };
  }
  if (resolution.status === 'error') {
    logStorageDiag('patient resolution', { sessionUserId, reason: resolution.error });
    return { ok: false, error: `Could not resolve your patient record: ${resolution.error}` };
  }
  const patientId = resolution.patientId;

  // 2. Determine MIME + upload type. text/csv and text/plain keep their type;
  //    a CSV under application/octet-stream is still parseable ECG data.
  const mime = ALLOWED_MIME_TYPES.has(file.type) ? file.type : 'application/octet-stream';
  const isCsvLike = /\.(csv|txt)$/i.test(file.name);
  if (mime === 'application/octet-stream' && !isCsvLike) {
    logStorageDiag('mime gate', { 'file name': file.name, 'browser mime': file.type || '(empty)' });
    return { ok: false, error: 'Unsupported file type for ECG storage.' };
  }
  const uploadType: EcgUploadType = mime === 'application/pdf'
    ? 'ecg-pdf'
    : mime === 'text/plain'
      ? 'ecg-txt'
      : 'ecg-csv';

  // 3. Build the patient-scoped path. Only DB-derived patient_id, a fresh
  //    UUID and the sanitized filename enter the path — no traversal possible.
  const uploadId = crypto.randomUUID();
  const safeName = sanitizeFileName(file.name);
  const storagePath = `${patientId}/${uploadId}/${safeName}`;

  // 4. Upload the ORIGINAL file bytes to the private bucket
  const { error: uploadError } = await supabase.storage
    .from(BUCKET)
    .upload(storagePath, file, {
      contentType: mime,
      cacheControl: '3600',
      upsert: false,
    });
  if (uploadError) {
    logStorageDiag('storage upload', {
      'authenticated user id': sessionUserId,
      'resolved patient id': patientId,
      'upload id': uploadId,
      'bucket': BUCKET,
      'storage path': storagePath,
      'file name': safeName,
      'mime type': mime,
      'file size': file.size,
      'storage error code': uploadError.name ?? null,
      'storage error status': (uploadError as { statusCode?: string | number }).statusCode ?? null,
      'storage error message': uploadError.message,
    });
    return { ok: false, error: `Storage upload failed: ${uploadError.message}` };
  }

  // 5. Insert the metadata row; on failure, remove the orphan object
  const { data, error: insertError } = await supabase
    .from('ecg_uploads')
    .insert({
      patient_id: patientId,
      file_name: safeName,
      mime_type: mime,
      size_bytes: file.size,
      storage_path: storagePath,
      upload_type: uploadType,
    })
    .select('id, patient_id, file_name, mime_type, size_bytes, storage_path, upload_type, created_at')
    .single();

  if (insertError || !data) {
    logStorageDiag('ecg_uploads metadata insert', {
      'authenticated user id': sessionUserId,
      'resolved patient id': patientId,
      'upload id': uploadId,
      'storage path': storagePath,
      'insert error code': insertError?.code ?? null,
      'insert error message': insertError?.message ?? 'no row returned',
      'insert error details': insertError?.details ?? null,
      'insert error hint': insertError?.hint ?? null,
    });
    const { error: cleanupError } = await supabase.storage.from(BUCKET).remove([storagePath]);
    return {
      ok: false,
      error: `File was uploaded but its record could not be saved${cleanupError ? ' (and the uploaded file could not be cleaned up)' : ''}: ${insertError?.message ?? 'no row returned'}`,
    };
  }

  return {
    ok: true,
    stored: {
      id: data.id as string,
      patientId: data.patient_id as string,
      fileName: data.file_name as string,
      mimeType: data.mime_type as string,
      sizeBytes: Number(data.size_bytes),
      storagePath: data.storage_path as string,
      uploadType: data.upload_type as EcgUploadType,
      createdAt: data.created_at as string,
    },
  };
}

/**
 * Short-lived signed URL for a stored file. Authorization is doubly enforced:
 * the SELECT on ecg_uploads is RLS-filtered (own row or appointment-authorized
 * doctor), and Storage RLS restricts createSignedUrl to the same path rules.
 */
export async function createEcgUploadSignedUrl(uploadId: string): Promise<{ ok: boolean; url?: string; error?: string }> {
  const { data, error } = await supabase
    .from('ecg_uploads')
    .select('storage_path')
    .eq('id', uploadId)
    .maybeSingle();

  if (error) {
    return { ok: false, error: `Could not resolve the stored file: ${error.message}` };
  }
  if (!data?.storage_path) {
    return { ok: false, error: 'Stored file not found (or you are not authorized to access it).' };
  }

  const { data: signed, error: signedError } = await supabase.storage
    .from(BUCKET)
    .createSignedUrl(data.storage_path as string, SIGNED_URL_EXPIRY_SECONDS);

  if (signedError || !signed?.signedUrl) {
    return { ok: false, error: `Could not create a download link: ${signedError?.message ?? 'no URL returned'}` };
  }
  return { ok: true, url: signed.signedUrl };
}

/**
 * List the signed-in patient's stored ECG uploads (newest first).
 */
export async function fetchPatientEcgUploads(limit = 50): Promise<{ ok: boolean; uploads?: StoredEcgUpload[]; error?: string }> {
  const resolution = await getAuthenticatedPatientRecord();
  if (resolution.status === 'signed-out') {
    return { ok: false, error: 'Sign in with your patient account to see stored ECG files.' };
  }
  if (resolution.status === 'no-patient-record') {
    return { ok: false, error: 'No patient profile is linked to this account.' };
  }
  if (resolution.status === 'error') {
    return { ok: false, error: `Could not resolve your patient record: ${resolution.error}` };
  }

  const { data, error } = await supabase
    .from('ecg_uploads')
    .select('id, patient_id, file_name, mime_type, size_bytes, storage_path, upload_type, created_at')
    .eq('patient_id', resolution.patientId)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) {
    return { ok: false, error: `Could not load stored ECG files: ${error.message}` };
  }

  const uploads: StoredEcgUpload[] = (data ?? []).map((row) => ({
    id: row.id as string,
    patientId: row.patient_id as string,
    fileName: row.file_name as string,
    mimeType: row.mime_type as string,
    sizeBytes: Number(row.size_bytes),
    storagePath: row.storage_path as string,
    uploadType: row.upload_type as EcgUploadType,
    createdAt: row.created_at as string,
  }));

  return { ok: true, uploads };
}

/**
 * List stored ECG uploads for ONE patient for the doctor dashboard.
 * RLS returns only rows for appointment-authorized patients; an unauthorized
 * patient simply yields zero rows.
 */
export async function fetchPatientEcgUploadsForDoctor(
  patientId: string,
  limit = 20
): Promise<{ ok: boolean; uploads?: StoredEcgUpload[]; error?: string }> {
  const { data, error } = await supabase
    .from('ecg_uploads')
    .select('id, patient_id, file_name, mime_type, size_bytes, storage_path, upload_type, created_at')
    .eq('patient_id', patientId)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) {
    return { ok: false, error: `Could not load stored ECG files: ${error.message}` };
  }
  const uploads: StoredEcgUpload[] = (data ?? []).map((row) => ({
    id: row.id as string,
    patientId: row.patient_id as string,
    fileName: row.file_name as string,
    mimeType: row.mime_type as string,
    sizeBytes: Number(row.size_bytes),
    storagePath: row.storage_path as string,
    uploadType: row.upload_type as EcgUploadType,
    createdAt: row.created_at as string,
  }));
  return { ok: true, uploads };
}

export { SIGNED_URL_EXPIRY_SECONDS };
