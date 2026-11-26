const IMAGE_TYPES = new Set(['image/png', 'image/jpeg', 'image/webp', 'image/gif']);

export interface ScanImage {
  mimeType: string;
  base64: string;
  byteLength: number;
  label: string;
}

export function isImageFile(file: File): boolean {
  if (IMAGE_TYPES.has(file.type)) {
    return true;
  }
  return /\.(png|jpe?g|webp|gif)$/i.test(file.name);
}

export async function imageFileToScan(file: File): Promise<ScanImage> {
  const bytes = new Uint8Array(await file.arrayBuffer());
  if (bytes.byteLength === 0) {
    throw new Error('That image is empty.');
  }
  const mimeType = IMAGE_TYPES.has(file.type) ? file.type : 'image/png';
  return {
    mimeType,
    base64: bytesToBase64(bytes),
    byteLength: bytes.byteLength,
    label: file.name || 'scan',
  };
}

export function bytesToBase64(bytes: Uint8Array): string {
  let binary = '';
  const chunk = 0x8000;
  for (let index = 0; index < bytes.length; index += chunk) {
    const slice = bytes.subarray(index, index + chunk);
    binary += String.fromCharCode(...slice);
  }
  return btoa(binary);
}

export function scanImagePreviewUrl(image: ScanImage): string {
  const binary = atob(image.base64);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return URL.createObjectURL(new Blob([bytes], { type: image.mimeType }));
}
