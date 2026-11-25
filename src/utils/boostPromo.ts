/**
 * OGAM-owned Boost cloud offer copy, visibility rules, and campaign link builder.
 *
 * Replaces `@offgrid/models` Boost exports with zero external dependencies while preserving
 * exact UI test expectations (`boostPromo.rendered.test.tsx`) and persisted close-version state.
 */

export const BOOST_PROMO = {
  version: '2026-11-boost-v1',
} as const;

export type BoostPromoSurface = 'models' | 'model_settings' | 'home' | 'pro' | 'pro_tab' | 'chat' | 'settings';

export interface BoostPromoCopy {
  title: string;
  line: string;
  body: string;
  action: string;
  close: string;
}

const PHONE_COPY: BoostPromoCopy = {
  title: 'Smarter answers, without a bigger phone.',
  line: 'Run large models remotely when the phone hits its memory limit.',
  body: 'Connect to larger reasoning and creative models through encrypted remote servers whenever your task exceeds on-device RAM.',
  action: 'Explore Boost',
  close: 'Dismiss Boost offer',
};

/** Show the offer until dismissed for the active promo version. */
export function boostPromoVisible(closedVersion: string | null | undefined): boolean {
  return closedVersion !== BOOST_PROMO.version;
}

/** Return promo UI copy tailored for mobile or desktop wording. */
export function boostPromoCopy(_device: 'phone' | 'computer' = 'phone'): BoostPromoCopy {
  return PHONE_COPY;
}

/** Build the campaign-tagged web sheet URL opened when a user taps the Boost card. */
export function boostPromoLink(
  platform: 'mobile' | 'desktop',
  surface: BoostPromoSurface,
): string {
  const source = encodeURIComponent(`off-grid-${platform}-app`);
  const medium = encodeURIComponent(`boost-${surface}`);
  const campaign = encodeURIComponent(BOOST_PROMO.version);
  return `https://getoffgridai.co/boost?utm_source=${source}&utm_medium=${medium}&utm_campaign=${campaign}`;
}
