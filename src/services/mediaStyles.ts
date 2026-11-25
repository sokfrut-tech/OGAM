import { IMAGE_STYLES, VIDEO_STYLES, type MediaStyle, type MediaStyleKind } from '../constants/mediaStyles';
import type { ImageSourcePropType } from 'react-native';

/**
 * OGAM's preview lookup for the local style catalog. The style IDs are persisted in chat history;
 * keep this asset map in lockstep with src/constants/mediaStyles.ts.
 */
const PREVIEWS: Record<MediaStyleKind, Record<string, ImageSourcePropType>> = {
  image: {
    'photoreal': require('../assets/styles/image/photoreal.jpg'),
    'cinematic': require('../assets/styles/image/cinematic.jpg'),
    'anime': require('../assets/styles/image/anime.jpg'),
    'sketch': require('../assets/styles/image/sketch.jpg'),
    'watercolor': require('../assets/styles/image/watercolor.jpg'),
    'oil-painting': require('../assets/styles/image/oil-painting.jpg'),
    'monochrome': require('../assets/styles/image/monochrome.jpg'),
    'neon': require('../assets/styles/image/neon.jpg'),
    '3d-render': require('../assets/styles/image/3d-render.jpg'),
    'steampunk': require('../assets/styles/image/steampunk.jpg'),
    'surreal': require('../assets/styles/image/surreal.jpg'),
    'vintage-film': require('../assets/styles/image/vintage-film.jpg'),
    'minimal': require('../assets/styles/image/minimal.jpg'),
    'risograph': require('../assets/styles/image/risograph.jpg'),
    'fantasy-art': require('../assets/styles/image/fantasy-art.jpg'),
    'studio-portrait': require('../assets/styles/image/studio-portrait.jpg'),
  },
  video: {
    'talking-head': require('../assets/styles/video/talking-head.jpg'),
    'cinematic': require('../assets/styles/video/cinematic.jpg'),
    'product': require('../assets/styles/video/product.jpg'),
    'nature': require('../assets/styles/video/nature.jpg'),
    'animation': require('../assets/styles/video/animation.jpg'),
    'vintage': require('../assets/styles/video/vintage.jpg'),
  },
};

export function stylesFor(kind: MediaStyleKind): readonly MediaStyle[] {
  return kind === 'image' ? IMAGE_STYLES : VIDEO_STYLES;
}

export function stylePreview(kind: MediaStyleKind, id: string): ImageSourcePropType | undefined {
  return PREVIEWS[kind][id];
}
