export enum VibrancyMaterial {
  UNDER_WINDOW = 'under-window',
  UNDER_PAGE = 'under-page',
  CONTENT = 'content',
  FULLSCREEN_UI = 'fullscreen-ui',
  WINDOW = 'window',
}

export const MACOS_VIBRANCY = [
  VibrancyMaterial.UNDER_WINDOW,
  VibrancyMaterial.UNDER_PAGE,
  VibrancyMaterial.CONTENT,
  VibrancyMaterial.FULLSCREEN_UI,
  VibrancyMaterial.WINDOW,
];

export type GlassSurface = 'nav' | 'sidebar' | 'player' | 'menu';

export type LiquidGlassConfig = {
  enabled: boolean;
  blur: number; // px, 0..40
  opacity: number; // 0..1
  tintStrength: number; // 0..1 (0 = neutral frosted)
  specular: boolean;
  nativeVibrancy: boolean; // macOS only
  vibrancyMaterial: VibrancyMaterial;
  surfaces: GlassSurface[];
};
