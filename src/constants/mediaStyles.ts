/**
 * OGAM-owned image/video style catalog.
 *
 * IDs are persisted in chat history and style settings; keep them stable. The style words are
 * prompt modifiers owned by OGAM and are appended to the user's own prompt, never substituted
 * for it. No upstream assets or source text are required at runtime.
 */
export type MediaStyleKind = 'image' | 'video';

export interface MediaStyle {
  id: string;
  name: string;
  words: string;
}

export const IMAGE_STYLES: readonly MediaStyle[] = [
  { id: 'photoreal', name: 'Photoreal', words: 'Photorealistic detail, natural materials and believable lighting.' },
  { id: 'cinematic', name: 'Cinematic', words: 'Cinematic composition, intentional framing, dramatic but natural lighting, subtle film color grade.' },
  { id: 'anime', name: 'Anime', words: 'Polished anime illustration, expressive shapes, clean linework and rich cel-shaded color.' },
  { id: 'sketch', name: 'Sketch', words: 'Hand-drawn pencil sketch, confident graphite lines, visible paper texture and restrained shading.' },
  { id: 'watercolor', name: 'Watercolor', words: 'Traditional watercolor painting, translucent pigment washes, soft edges and textured cold-press paper.' },
  { id: 'oil-painting', name: 'Oil painting', words: 'Traditional oil painting, layered brushwork, rich pigment and subtle canvas texture.' },
  { id: 'monochrome', name: 'Monochrome', words: 'Expressive black-and-white image, strong tonal separation and carefully controlled contrast.' },
  { id: 'neon', name: 'Neon', words: 'Vibrant neon palette, luminous accents, atmospheric colored light and deep shadows.' },
  { id: '3d-render', name: '3D render', words: 'High-quality 3D render, refined materials, dimensional lighting and clean surface detail.' },
  { id: 'steampunk', name: 'Steampunk', words: 'Steampunk design language, intricate brass mechanisms, aged metal, leather and mechanical details.' },
  { id: 'surreal', name: 'Surreal', words: 'Surreal visual composition, dreamlike scale and unexpected but coherent visual relationships.' },
  { id: 'vintage-film', name: 'Vintage film', words: 'Analog film character, gentle grain, softened highlights and a restrained vintage color response.' },
  { id: 'minimal', name: 'Minimal', words: 'Minimalist composition, deliberate negative space, simple geometry and a restrained palette.' },
  { id: 'risograph', name: 'Risograph', words: 'Risograph print aesthetic, limited spot colors, visible ink texture and subtle registration offsets.' },
  { id: 'fantasy-art', name: 'Fantasy art', words: 'Atmospheric fantasy illustration, imaginative environmental detail and painterly light.' },
  { id: 'studio-portrait', name: 'Studio portrait', words: 'Professional studio portrait lighting, flattering soft key light and clean subject separation.' },
];

export const VIDEO_STYLES: readonly MediaStyle[] = [
  { id: 'talking-head', name: 'Talking head', words: 'A natural talking-head shot, stable framing, realistic facial motion and subtle gestures.' },
  { id: 'cinematic', name: 'Cinematic', words: 'Cinematic camera language, deliberate movement, composed framing and filmic lighting.' },
  { id: 'product', name: 'Product', words: 'A polished product showcase, controlled camera movement, clear subject visibility and refined highlights.' },
  { id: 'nature', name: 'Nature', words: 'Naturalistic environmental motion, organic camera movement and realistic atmospheric detail.' },
  { id: 'animation', name: 'Animation', words: 'Cohesive animated motion, readable silhouettes, consistent design and smooth transitions.' },
  { id: 'vintage', name: 'Vintage', words: 'Vintage film presentation, subtle grain, gentle flicker and warm analog color.' },
];

export function mediaStyle(
  kind: MediaStyleKind,
  styleId?: string | null,
): MediaStyle | undefined {
  if (!styleId) return undefined;
  const styles = kind === 'image' ? IMAGE_STYLES : VIDEO_STYLES;
  return styles.find(style => style.id === styleId);
}
