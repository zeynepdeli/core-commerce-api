/** Yerel görsel (/media/...) API adresiyle, Cloudinary (https) olduğu gibi */
export function mediaSrc(url: string, mediaBaseUrl: string) {
  return url.startsWith("/media/") ? `${mediaBaseUrl}${url}` : url;
}
