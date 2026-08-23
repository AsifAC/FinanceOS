import { supabase } from "../lib/supabaseClient";
import { createOwnRow, getCurrentUserId, getErrorMessage, ServiceResult } from "./serviceUtils";
import { UploadedFile } from "./dbTypes";

export type FinanceBucket = "avatars" | "receipts" | "exports" | "attachments";

export async function uploadUserFile(
  bucket: FinanceBucket,
  path: string,
  file: File | Blob,
  metadata: Omit<UploadedFile, "id" | "user_id" | "created_at" | "bucket_name" | "file_path">,
): Promise<ServiceResult<UploadedFile>> {
  try {
    const userId = await getCurrentUserId();
    if (!path.startsWith(`${userId}/`)) {
      throw new Error("Storage path must stay inside the authenticated user's folder.");
    }
    const { error } = await supabase.storage.from(bucket).upload(path, file, { upsert: false });
    if (error) throw error;
    return createOwnRow<UploadedFile>("uploaded_files", {
      ...metadata,
      bucket_name: bucket,
      file_path: path,
    });
  } catch (error) {
    return { data: null, error: getErrorMessage(error) };
  }
}

export async function createSignedFileUrl(bucket: FinanceBucket, path: string, expiresInSeconds = 3600) {
  try {
    const userId = await getCurrentUserId();
    if (!path.startsWith(`${userId}/`)) {
      throw new Error("Storage path must stay inside the authenticated user's folder.");
    }
    const { data, error } = await supabase.storage.from(bucket).createSignedUrl(path, expiresInSeconds);
    if (error) throw error;
    return { data: data.signedUrl, error: null };
  } catch (error) {
    return { data: null, error: getErrorMessage(error) };
  }
}

export async function removeUserFile(bucket: FinanceBucket, path: string): Promise<ServiceResult<boolean>> {
  try {
    const userId = await getCurrentUserId();
    if (!path.startsWith(`${userId}/`)) {
      throw new Error("Storage path must stay inside the authenticated user's folder.");
    }
    const { error } = await supabase.storage.from(bucket).remove([path]);
    if (error) throw error;
    return { data: true, error: null };
  } catch (error) {
    return { data: null, error: getErrorMessage(error) };
  }
}
