/**
 * Hakkımızda sayfası alanları (eski enfesGurme düzeni). Görsel alanları tek listede: doğrulama,
 * medya "kullanımda" kontrolü ve admin formu aynı listeyi kullanır.
 */
export const ABOUT_IMAGE_FIELDS = [
  'cardImage',
  'textureImage',
  'sketchImage1',
  'sketchImage2',
  'sketchImage3',
  'sketchImage4',
  'visionImage',
  'visionMiniImage',
  'missionImage',
  'storyImage',
  'miniImage1',
  'miniImage2',
  'miniImage3',
  'valuesImage',
] as const;
export type AboutImageField = (typeof ABOUT_IMAGE_FIELDS)[number];

/** Sayfada görünecek bir şey var mı (yalnızca varsayılan başlıklar dolu ise sayfa boş sayılır) */
export function hasAboutContent(about: Record<string, unknown>): boolean {
  return [
    'visionText',
    'missionTitle',
    'missionText',
    'storyTitle',
    'storyText',
    'valuesTitle',
    'valuesText',
  ].some(
    (k) => typeof about[k] === 'string' && (about[k] as string).trim() !== '',
  );
}
