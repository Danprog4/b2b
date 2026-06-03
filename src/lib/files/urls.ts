import { getPublicStorageUrl } from "@/lib/files/storage";

type PublicFileUrlInput = {
  id: string | null;
  storageKey: string | null;
};

export function getPublicFileUrl(file: PublicFileUrlInput) {
  if (!file.id || !file.storageKey) {
    return null;
  }

  return getPublicStorageUrl(file.storageKey) ?? `/files/${file.id}`;
}
