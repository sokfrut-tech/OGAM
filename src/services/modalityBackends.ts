import { useAppStore } from '../stores/appStore';

/**
 * Where each modality runs on this phone, in the words people see: the NPU, the GPU or the CPU.
 * Modality names follow the OGAM-owned backend policy.
 */
import type { ModalityPlacement } from '../utils/mobileRuntimePolicy';
import type { ModalityName, ProcessorPlace } from '../types';

export type { ModalityName, ProcessorPlace };

/** The shared result shape from OGAM backend policy. */
export type { ModalityPlacement } from '../utils/mobileRuntimePolicy';

export function savedPlace(modality: ModalityName): ProcessorPlace | undefined {
  return useAppStore.getState().settings.modalityBackends?.[modality];
}

export function savePlacements(placements: readonly ModalityPlacement[]): void {
  const current = useAppStore.getState().settings.modalityBackends ?? {};
  const next = { ...current };
  for (const placement of placements)
    if (isPhoneModality(placement.modality)) next[placement.modality] = placement.place;
  useAppStore.getState().updateSettings({ modalityBackends: next });
}

const PHONE_MODALITIES: readonly string[] = ['llm', 'image', 'video', 'stt', 'tts', 'embeddings'];
function isPhoneModality(modality: string): modality is ModalityName {
  return PHONE_MODALITIES.includes(modality);
}

export const PLACE_LABEL: Record<ProcessorPlace, string> = { npu: 'NPU', gpu: 'GPU', cpu: 'CPU' };
