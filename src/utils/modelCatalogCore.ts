/**
 * OGAM-owned master offline/bundled model catalog and device-pick ranking engine.
 * Replaces `@offgrid/models` `CATALOG` and `pickModelsForDevice` with zero external package
 * dependencies.
 */

import type {
  ModelEntry,
  PickCandidate,
} from '../types/modelCatalog';

export type {
  MobileTextCatalogModel,
  ModelEntry,
  PickCandidate,
} from '../types/modelCatalog';

export interface FitBudgetRatio {
  soft: number;
  hard: number;
}

export interface DevicePickResult {
  fast?: string;
  balanced?: string;
  best?: string;
}

export const CATALOG: readonly ModelEntry[] = [
  // ---------------------------------------------------------------------------
  // Curated Text & Vision Models
  // ---------------------------------------------------------------------------
  {
    id: 'openbmb/MiniCPM5-2B-GGUF',
    sourceModelId: 'openbmb/MiniCPM5-2B',
    quality: 95,
    name: 'MiniCPM5 2B',
    kind: 'text',
    org: 'openbmb',
    description: 'Strong coding, reasoning, and tool use with 128K context',
    params: 2,
    minRamGb: 4,
    quant: 'Q4_K_M',
    isNew: true,
    files: [
      {
        name: 'MiniCPM5-2B-Q4_K_M.gguf',
        url: 'https://huggingface.co/openbmb/MiniCPM5-2B-GGUF/resolve/main/MiniCPM5-2B-Q4_K_M.gguf',
        sizeBytes: 1561318368,
        sha256: 'ec2d5801640099e97d8d7e8003ad4d81f336e757811f03a26173dddf386602fd',
        role: 'primary',
      },
    ],
  },
  {
    id: 'unsloth/Qwen3.5-4B-GGUF',
    sourceModelId: 'Qwen/Qwen3.5-4B',
    quality: 90,
    name: 'Qwen 3.5 4B',
    kind: 'vision',
    org: 'Qwen',
    description: 'Thinking + vision multimodal chat, 262K context',
    params: 4,
    minRamGb: 6,
    quant: 'Q4_K_M',
    files: [
      {
        name: 'Qwen3.5-4B-Q4_K_M.gguf',
        url: 'https://huggingface.co/unsloth/Qwen3.5-4B-GGUF/resolve/main/Qwen3.5-4B-Q4_K_M.gguf',
        sizeBytes: 2740937888,
        sha256: '00fe7986ff5f6b463e62455821146049db6f9313603938a70800d1fb69ef11a4',
        role: 'primary',
      },
      {
        name: 'mmproj-F16.gguf',
        url: 'https://huggingface.co/unsloth/Qwen3.5-4B-GGUF/resolve/main/mmproj-F16.gguf',
        sizeBytes: 672423616,
        sha256: 'cd88edcf8d031894960bb0c9c5b9b7e1fea6ebee02b9f7ce925a00d12891f864',
        role: 'mmproj',
      },
    ],
  },
  {
    id: 'LiquidAI/LFM2.5-8B-A1B-GGUF',
    sourceModelId: 'LiquidAI/LFM2.5-8B-A1B',
    quality: 88,
    name: 'LFM2.5 8B A1B',
    kind: 'text',
    org: 'LiquidAI',
    description: 'Fast MoE language model (1B active parameters)',
    params: 8,
    activeParams: 1,
    minRamGb: 8,
    quant: 'Q4_K_M',
    files: [
      {
        name: 'LFM2.5-8B-A1B-Q4_K_M.gguf',
        url: 'https://huggingface.co/LiquidAI/LFM2.5-8B-A1B-GGUF/resolve/main/LFM2.5-8B-A1B-Q4_K_M.gguf',
        sizeBytes: 5155564768,
        sha256: '4923ec14f06b968b74d663e5949867d2d9c3bf13a20b8be1a9f9af39989b2bb0',
        role: 'primary',
      },
    ],
  },
  {
    id: 'unsloth/Qwen3.5-9B-GGUF',
    sourceModelId: 'Qwen/Qwen3.5-9B',
    quality: 96,
    name: 'Qwen 3.5 9B',
    kind: 'vision',
    org: 'Qwen',
    description: 'Best Qwen 3.5 quality, thinking mode, 262K context',
    params: 9,
    minRamGb: 8,
    quant: 'Q4_K_M',
    files: [
      {
        name: 'Qwen3.5-9B-Q4_K_M.gguf',
        url: 'https://huggingface.co/unsloth/Qwen3.5-9B-GGUF/resolve/main/Qwen3.5-9B-Q4_K_M.gguf',
        sizeBytes: 5680522464,
        sha256: '03b74727a860a56338e042c4420bb3f04b2fec5734175f4cb9fa853daf52b7e8',
        role: 'primary',
      },
      {
        name: 'mmproj-F16.gguf',
        url: 'https://huggingface.co/unsloth/Qwen3.5-9B-GGUF/resolve/main/mmproj-F16.gguf',
        sizeBytes: 918166080,
        sha256: 'f70dc3509053962b0d0d3ee8a7eacebf5d60aa560cad78254ae8698516ae029f',
        role: 'mmproj',
      },
    ],
  },
  {
    id: 'unsloth/gemma-4-E4B-it-GGUF',
    sourceModelId: 'google/gemma-4-E4B-it',
    quality: 86,
    name: 'Gemma 4 E4B',
    kind: 'vision',
    org: 'google',
    description: "Google's multimodal Gemma 4 model with stronger reasoning",
    params: 4,
    minRamGb: 6,
    quant: 'Q4_K_M',
    isNew: true,
    files: [
      {
        name: 'gemma-4-E4B-it-Q4_K_M.gguf',
        url: 'https://huggingface.co/unsloth/gemma-4-E4B-it-GGUF/resolve/main/gemma-4-E4B-it-Q4_K_M.gguf',
        sizeBytes: 4977171584,
        sha256: '85a896a047553e842f25297ee5b031d64ff30147d9c4af17b1e4b394cd1fab87',
        role: 'primary',
      },
      {
        name: 'mmproj-F16.gguf',
        url: 'https://huggingface.co/unsloth/gemma-4-E4B-it-GGUF/resolve/main/mmproj-F16.gguf',
        sizeBytes: 990372672,
        sha256: 'ddf46c21d7078e95338cfc22306b19b276a29a5ad089023449dd54d4b6170a51',
        role: 'mmproj',
      },
    ],
  },
  {
    id: 'unsloth/gemma-4-E2B-it-GGUF',
    sourceModelId: 'google/gemma-4-E2B-it',
    quality: 84,
    name: 'Gemma 4 E2B',
    kind: 'vision',
    org: 'google',
    description: "Google's compact Gemma 4 model with thinking mode + vision",
    params: 2,
    minRamGb: 4,
    quant: 'Q4_K_M',
    isNew: true,
    files: [
      {
        name: 'gemma-4-E2B-it-Q4_K_M.gguf',
        url: 'https://huggingface.co/unsloth/gemma-4-E2B-it-GGUF/resolve/main/gemma-4-E2B-it-Q4_K_M.gguf',
        sizeBytes: 3106738272,
        sha256: '740185b21d22ceb83a11c3aa62ad5842ef32c70f6096d756bbee85a1e4ec34b8',
        role: 'primary',
      },
      {
        name: 'mmproj-F16.gguf',
        url: 'https://huggingface.co/unsloth/gemma-4-E2B-it-GGUF/resolve/main/mmproj-F16.gguf',
        sizeBytes: 985654080,
        sha256: '140be8d7849741f88c50757d529b84373ee8e27052cc2236855b537f4a8215fa',
        role: 'mmproj',
      },
    ],
  },
  {
    id: 'unsloth/Qwen3.5-2B-GGUF',
    sourceModelId: 'Qwen/Qwen3.5-2B',
    quality: 82,
    name: 'Qwen 3.5 2B',
    kind: 'vision',
    org: 'Qwen',
    description: 'Hybrid thinking + chat, 262K context',
    params: 2,
    minRamGb: 4,
    quant: 'Q4_K_M',
    files: [
      {
        name: 'Qwen3.5-2B-Q4_K_M.gguf',
        url: 'https://huggingface.co/unsloth/Qwen3.5-2B-GGUF/resolve/main/Qwen3.5-2B-Q4_K_M.gguf',
        sizeBytes: 1280835840,
        sha256: 'aaf42c8b7c3cab2bf3d69c355048d4a0ee9973d48f16c731c0520ee914699223',
        role: 'primary',
      },
      {
        name: 'mmproj-F16.gguf',
        url: 'https://huggingface.co/unsloth/Qwen3.5-2B-GGUF/resolve/main/mmproj-F16.gguf',
        sizeBytes: 668227264,
        sha256: '7035e9cb8d7c6a9681d07eef9a364783e86ea4cd73faab2eabb4f43a101830c7',
        role: 'mmproj',
      },
    ],
  },
  {
    id: 'unsloth/Qwen3.5-0.8B-GGUF',
    sourceModelId: 'Qwen/Qwen3.5-0.8B',
    quality: 75,
    name: 'Qwen 3.5 0.8B',
    kind: 'vision',
    org: 'Qwen',
    description: 'Thinking mode, ultra-light, 262K context',
    params: 0.8,
    minRamGb: 3,
    quant: 'Q4_K_M',
    files: [
      {
        name: 'Qwen3.5-0.8B-Q4_K_M.gguf',
        url: 'https://huggingface.co/unsloth/Qwen3.5-0.8B-GGUF/resolve/main/Qwen3.5-0.8B-Q4_K_M.gguf',
        sizeBytes: 532517120,
        sha256: 'bd258782e35f7f458f8aced1adc053e6e92e89bc735ba3be89d38a06121dc517',
        role: 'primary',
      },
      {
        name: 'mmproj-F16.gguf',
        url: 'https://huggingface.co/unsloth/Qwen3.5-0.8B-GGUF/resolve/main/mmproj-F16.gguf',
        sizeBytes: 204987232,
        sha256: '56e4c6cfe73b0c82e3e82bc518d7591997e61d81f723fc41a586f4fa69ea2453',
        role: 'mmproj',
      },
    ],
  },
  {
    id: 'ggml-org/SmolLM3-3B-GGUF',
    sourceModelId: 'HuggingFaceTB/SmolLM3-3B',
    quality: 70,
    name: 'SmolLM3 3B',
    kind: 'text',
    org: 'HuggingFaceTB',
    description: 'Purpose-built for constrained devices, 128K context',
    params: 3,
    minRamGb: 6,
    quant: 'Q4_K_M',
    files: [
      {
        name: 'SmolLM3-Q4_K_M.gguf',
        url: 'https://huggingface.co/ggml-org/SmolLM3-3B-GGUF/resolve/main/SmolLM3-Q4_K_M.gguf',
        sizeBytes: 1915305312,
        sha256: '8334b850b7bd46238c16b0c550df2138f0889bf433809008cc17a8b05761863e',
        role: 'primary',
      },
    ],
  },
  {
    id: 'IFM/K2-Horizon-3.7B-GGUF',
    sourceModelId: 'IFM/K2-Horizon-3.7B',
    quality: 78,
    name: 'K2 Horizon 3.7B',
    kind: 'text',
    org: 'IFM',
    description: 'Compact reasoning model requiring newer llama.cpp builds',
    params: 3.7,
    minRamGb: 6,
    quant: 'Q4_K_M',
    minLlamaBuild: 12000,
    files: [
      {
        name: 'K2-Horizon-4B-Q4_K_M.gguf',
        url: 'https://huggingface.co/IFM/K2-Horizon-3.7B-GGUF/resolve/main/K2-Horizon-4B-Q4_K_M.gguf',
        sizeBytes: 3156598144,
        sha256: '07773aed93890d4f5d08b421430000d5c8d73cefc74fbdc32e67d820f23207b2',
        role: 'primary',
      },
    ],
  },
  {
    id: 'IFM/K2-Horizon-7B-GGUF',
    sourceModelId: 'IFM/K2-Horizon-7B',
    quality: 80,
    name: 'K2 Horizon 7B',
    kind: 'text',
    org: 'IFM',
    description: '7B reasoning model requiring newer llama.cpp builds',
    params: 7,
    minRamGb: 8,
    quant: 'Q4_K_M',
    minLlamaBuild: 12000,
    files: [
      {
        name: 'K2-Horizon-7B-Q4_K_M.gguf',
        url: 'https://huggingface.co/IFM/K2-Horizon-7B-GGUF/resolve/main/K2-Horizon-7B-Q4_K_M.gguf',
        sizeBytes: 5592217984,
        sha256: 'eb89c15a0ae9712be2ee462bf43802de14200f20f93b73da6eb68c2ebdd28e4e',
        role: 'primary',
      },
    ],
  },
  {
    id: 'Qwen/Qwen3-VL-2B-Instruct-GGUF',
    sourceModelId: 'Qwen/Qwen3-VL-2B-Instruct',
    name: 'Qwen3-VL 2B',
    kind: 'vision',
    org: 'Qwen',
    description: 'Superseded by Qwen 3.5 2B',
    params: 2,
    minRamGb: 4,
    quant: 'Q4_K_M',
    supersededBy: 'unsloth/Qwen3.5-2B-GGUF',
    files: [
      {
        name: 'Qwen3VL-2B-Instruct-Q4_K_M.gguf',
        url: 'https://huggingface.co/Qwen/Qwen3-VL-2B-Instruct-GGUF/resolve/main/Qwen3VL-2B-Instruct-Q4_K_M.gguf',
        sizeBytes: 1280000000,
        role: 'primary',
      },
    ],
  },
  {
    id: 'LiquidAI/LFM3-1.7B-GGUF',
    sourceModelId: 'LiquidAI/LFM3-1.7B',
    quality: 8,
    name: 'LFM3 1.7B',
    kind: 'text',
    org: 'LiquidAI',
    description: 'Fast agent and tool use with reasoning; text only',
    params: 1.73,
    minRamGb: 4,
    quant: 'Q4_K_M',
    minLlamaBuild: 11938,
    isNew: true,
    releaseDate: '2026-10-24',
    files: [
      {
        name: 'LFM3-1.7B-Q4_K_M.gguf',
        url: 'https://huggingface.co/LiquidAI/LFM3-1.7B-GGUF/resolve/bad5729bba61d076fff20d2548e62526665af215/LFM3-1.7B-Q4_K_M.gguf',
        sizeBytes: 1099627808,
        sha256: '3793e1e6e2266919d6e015287221b41100175a98eddaba92e111aed3b05c93c4',
        role: 'primary',
      },
    ],
  },
  {
    id: 'LiquidAI/LFM3-VL-2B-GGUF',
    sourceModelId: 'LiquidAI/LFM3-VL-2B',
    quality: 8,
    name: 'LFM3 VL 2B',
    kind: 'vision',
    org: 'LiquidAI',
    description: 'Fast reasoning with vision, reads documents and charts',
    params: 1.92,
    minRamGb: 4,
    quant: 'Q4_K_M',
    minLlamaBuild: 11938,
    isNew: true,
    releaseDate: '2026-10-19',
    files: [
      {
        name: 'LFM3-VL-2B-Q4_K_M.gguf',
        url: 'https://huggingface.co/LiquidAI/LFM3-VL-2B-GGUF/resolve/b36554cfd35854b06429900131730cd80f092cdb/LFM3-VL-2B-Q4_K_M.gguf',
        sizeBytes: 1099627808,
        sha256: '56dac2e192ff0d9ab8507f4f1aeb4aed0463449bbbefaac79497f041c95f21eb',
        role: 'primary',
      },
      {
        name: 'mmproj-LFM3-VL-2B-F16.gguf',
        url: 'https://huggingface.co/LiquidAI/LFM3-VL-2B-GGUF/resolve/b36554cfd35854b06429900131730cd80f092cdb/mmproj-LFM3-VL-2B-F16.gguf',
        sizeBytes: 378996032,
        sha256: '1d8e6e58eefc093e09d6332f081516e1ddbd5b35cfca7f35463fb270db230b1e',
        role: 'mmproj',
      },
    ],
  },
  {
    id: 'XHToken/Spark-X2.6-4B-GGUF',
    sourceModelId: 'XHToken/Spark-X2.6-4B',
    quality: 18,
    name: 'Spark X2.6 4B',
    kind: 'text',
    org: 'XHToken',
    description: 'Best agent and coding model at 4B; text only',
    params: 4.1,
    minRamGb: 6,
    quant: 'Q4_K_M',
    minLlamaBuild: 10828,
    isNew: true,
    releaseDate: '2026-10-19',
    files: [
      {
        name: 'Spark-X2.6-4B-Q4_K_M.gguf',
        url: 'https://huggingface.co/XHToken/Spark-X2.6-4B-GGUF/resolve/fe31f8d64890302cc3a1d365d700357b4b75ba77/Spark-X2.6-4B-Q4_K_M.gguf',
        sizeBytes: 3543441312,
        sha256: '91cb2811aebb47ac916aa619d27d4cdd7f4143106b7917accb8ead4cd7f5cbd9',
        role: 'primary',
      },
    ],
  },
  {
    id: 'unsloth/gemma-4-12b-it-GGUF',
    sourceModelId: 'google/gemma-4-12b-it',
    quality: 94,
    name: 'Gemma 4 12B',
    kind: 'vision',
    org: 'google',
    description: "Google's 12B multimodal Gemma 4 model with strong reasoning and vision",
    params: 12,
    minRamGb: 12,
    quant: 'Q4_K_M',
    isNew: true,
    files: [
      {
        name: 'gemma-4-12b-it-Q4_K_M.gguf',
        url: 'https://huggingface.co/unsloth/gemma-4-12b-it-GGUF/resolve/main/gemma-4-12b-it-Q4_K_M.gguf',
        sizeBytes: 6400000000,
        role: 'primary',
      },
      {
        name: 'mmproj-F16.gguf',
        url: 'https://huggingface.co/unsloth/gemma-4-12b-it-GGUF/resolve/main/mmproj-F16.gguf',
        sizeBytes: 900000000,
        role: 'mmproj',
      },
    ],
  },
  {
    id: 'unsloth/Muse-Glimmer-30B-GGUF',
    sourceModelId: 'meta-llama/Muse-Glimmer-30B',
    quality: 85,
    name: 'Muse Glimmer 30B',
    kind: 'vision',
    org: 'Meta',
    description: 'High-capacity Llama multimodal model with vision support',
    params: 30,
    minRamGb: 24,
    quant: 'Q4_K_M',
    files: [
      {
        name: 'Muse-Glimmer-30B-UD-Q4_K_XL.gguf',
        url: 'https://huggingface.co/unsloth/Muse-Glimmer-30B-GGUF/resolve/main/Muse-Glimmer-30B-UD-Q4_K_XL.gguf',
        sizeBytes: 15500000000,
        role: 'primary',
      },
      {
        name: 'mmproj-Muse-Glimmer-30B-Q8_0.gguf',
        url: 'https://huggingface.co/unsloth/Muse-Glimmer-30B-GGUF/resolve/main/mmproj-Muse-Glimmer-30B-Q8_0.gguf',
        sizeBytes: 1000000000,
        role: 'mmproj',
      },
    ],
  },
  {
    id: 'unsloth/Devstral-Small-2-24B-Instruct-2512-GGUF',
    sourceModelId: 'mistralai/Devstral-Small-2-24B-Instruct-2512',
    quality: 84,
    name: 'Devstral Small 2 24B',
    kind: 'vision',
    org: 'Mistral',
    description: "Mistral's 24B coding and vision model for desktop-class phones",
    params: 24,
    minRamGb: 24,
    quant: 'Q4_K_M',
    files: [
      {
        name: 'Devstral-Small-2-24B-Instruct-2512-Q4_K_M.gguf',
        url: 'https://huggingface.co/unsloth/Devstral-Small-2-24B-Instruct-2512-GGUF/resolve/main/Devstral-Small-2-24B-Instruct-2512-Q4_K_M.gguf',
        sizeBytes: 14300000000,
        role: 'primary',
      },
      {
        name: 'mmproj-F16.gguf',
        url: 'https://huggingface.co/unsloth/Devstral-Small-2-24B-Instruct-2512-GGUF/resolve/main/mmproj-F16.gguf',
        sizeBytes: 800000000,
        role: 'mmproj',
      },
    ],
  },

  // ---------------------------------------------------------------------------
  // Transcription Models
  // ---------------------------------------------------------------------------
  {
    id: 'ggml-org/Qwen3-ASR-0.6B-GGUF',
    sourceModelId: 'Qwen/Qwen3-ASR-0.6B',
    name: 'Qwen3-ASR 0.6B',
    kind: 'transcription',
    engine: 'qwen3-asr',
    org: 'Qwen',
    description: 'Multilingual speech recognition across 30 languages',
    minRamGb: 3,
    minLlamaBuild: 8500,
    quant: 'Q8_0',
    files: [
      {
        name: 'Qwen3-ASR-0.6B-Q8_0.gguf',
        url: 'https://huggingface.co/ggml-org/Qwen3-ASR-0.6B-GGUF/resolve/main/Qwen3-ASR-0.6B-Q8_0.gguf',
        sizeBytes: 804749536,
        sha256: '05c9e10cecb37f6fc0cac0e786195dba82f12c15021f0b8a09473dbf3b6f090d',
        role: 'primary',
      },
      {
        name: 'mmproj-Qwen3-ASR-0.6B-Q8_0.gguf',
        url: 'https://huggingface.co/ggml-org/Qwen3-ASR-0.6B-GGUF/resolve/main/mmproj-Qwen3-ASR-0.6B-Q8_0.gguf',
        sizeBytes: 214392544,
        sha256: '3b5e371a03e7d14bc1b5a66f38ff3c5eec3a99b3f96deb72b3814da9adafb16d',
        role: 'mmproj',
      },
    ],
  },

  // ---------------------------------------------------------------------------
  // Image Models (sd.cpp DiT packs & SDXL checkpoints)
  // ---------------------------------------------------------------------------
  {
    id: 'leejet/Qwen-Image-2.1-GGUF',
    name: 'Qwen Image 2.1',
    kind: 'image',
    org: 'Qwen',
    description: 'Diffusion-transformer text-to-image model with strong text rendering',
    minRamGb: 16,
    quant: 'Q8_0',
    imageModes: ['txt2img'],
    files: [
      {
        name: 'qwen_image_2.1-Q8_0.gguf',
        url: 'https://huggingface.co/leejet/Qwen-Image-2.1-GGUF/resolve/main/qwen_image_2.1-Q8_0.gguf',
        sizeBytes: 7687155744,
        sha256: 'f8b244b00937f0e444a40dbf7866460871b89b30142594973b6012d1b471dc0a',
        role: 'primary',
      },
      {
        name: 'qwen_image_vae.safetensors',
        url: 'https://huggingface.co/Comfy-Org/Qwen-Image_ComfyUI/resolve/main/split_files/vae/qwen_image_vae.safetensors',
        sizeBytes: 254000000,
        role: 'aux',
      },
      {
        name: 'Qwen3VL-2B-Instruct-Q4_K_M.gguf',
        url: 'https://huggingface.co/unsloth/Qwen3-VL-2B-Instruct-GGUF/resolve/main/Qwen3-VL-2B-Instruct-Q4_K_M.gguf',
        sizeBytes: 1280000000,
        role: 'aux',
      },
    ],
  },
  {
    id: 'leejet/FLUX.2-klein-4B-GGUF',
    quantLabel: 'Full quality',
    sourceModelId: 'black-forest-labs/FLUX.2-klein-4B',
    name: 'FLUX.2 klein 4B',
    kind: 'image',
    tags: ['2026', 'Fast', 'Image editing'],
    org: 'Black Forest Labs',
    description: 'The small FLUX from Black Forest Labs: 4 steps, sharp detail and text, edits with a reference image. Apache-2.0. The Qwen3 text encoder and VAE are included in the download.',
    minRamGb: 11,
    quant: 'Q8_0',
    releaseDate: '2026-01-15',
    imageModes: ['txt2img', 'img2img'],
    files: [
      {
        name: 'flux-2-klein-4b-Q8_0.gguf',
        url: 'https://huggingface.co/leejet/FLUX.2-klein-4B-GGUF/resolve/3b1f5a9dc3abb32238b053aeb3d823c30afdacbd/flux-2-klein-4b-Q8_0.gguf',
        role: 'primary',
        sizeBytes: 4300629440,
        sha256: '0bba6951258ec8f92d51114a8fa13e66828297bfff58a738f52729b3ef66fa28',
      },
      {
        name: 'Qwen3-4B-Q4_K_M.gguf',
        url: 'https://huggingface.co/unsloth/Qwen3-4B-GGUF/resolve/22c9fc8a8c7700b76a1789366280a6a5a1ad1120/Qwen3-4B-Q4_K_M.gguf',
        role: 'aux',
        sizeBytes: 2497281312,
        sha256: 'f6f851777709861056efcdad3af01da38b31223a3ba26e61a4f8bf3a2195813a',
      },
      {
        name: 'flux2-vae.safetensors',
        url: 'https://huggingface.co/Comfy-Org/Flux-2-Klein-4B/resolve/533c4cbc3d3b89af1743d9466c434e89810391c0/split_files/vae/flux2-vae.safetensors',
        role: 'aux',
        sizeBytes: 336211292,
        sha256: '868fe7b343cc8f3a19dbcfcafbc3d5f888802be3f89bd81b65b3621a066ce8f3',
      },
    ],
  },
  {
    id: 'leejet/FLUX.2-klein-4B-GGUF-Q4',
    quantOf: 'leejet/FLUX.2-klein-4B-GGUF',
    quantLabel: 'Light',
    sourceModelId: 'black-forest-labs/FLUX.2-klein-4B',
    name: 'FLUX.2 klein 4B (Light)',
    kind: 'image',
    tags: ['2026', 'Light', 'Fast', 'Image editing'],
    org: 'Black Forest Labs',
    description: 'The small FLUX from Black Forest Labs: 4 steps, sharp detail and text, edits with a reference image. Apache-2.0. The Qwen3 text encoder and VAE are included in the download.',
    minRamGb: 7,
    quant: 'Q4_0',
    releaseDate: '2026-01-15',
    imageModes: ['txt2img', 'img2img'],
    files: [
      {
        name: 'flux-2-klein-4b-Q4_0.gguf',
        url: 'https://huggingface.co/leejet/FLUX.2-klein-4B-GGUF/resolve/3b1f5a9dc3abb32238b053aeb3d823c30afdacbd/flux-2-klein-4b-Q4_0.gguf',
        role: 'primary',
        sizeBytes: 2460378560,
        sha256: 'd1023499ef3f2f82ff7c50e6778495195c1b6cc34835741778868428111f9ff4',
      },
      {
        name: 'Qwen3-4B-Q4_K_M.gguf',
        url: 'https://huggingface.co/unsloth/Qwen3-4B-GGUF/resolve/22c9fc8a8c7700b76a1789366280a6a5a1ad1120/Qwen3-4B-Q4_K_M.gguf',
        role: 'aux',
        sizeBytes: 2497281312,
        sha256: 'f6f851777709861056efcdad3af01da38b31223a3ba26e61a4f8bf3a2195813a',
      },
      {
        name: 'flux2-vae.safetensors',
        url: 'https://huggingface.co/Comfy-Org/Flux-2-Klein-4B/resolve/533c4cbc3d3b89af1743d9466c434e89810391c0/split_files/vae/flux2-vae.safetensors',
        role: 'aux',
        sizeBytes: 336211292,
        sha256: '868fe7b343cc8f3a19dbcfcafbc3d5f888802be3f89bd81b65b3621a066ce8f3',
      },
    ],
  },
  {
    id: 'leejet/Z-Image-Turbo-GGUF',
    quantLabel: 'Full quality',
    sourceModelId: 'Tongyi-MAI/Z-Image-Turbo',
    name: 'Z-Image Turbo (2026)',
    kind: 'image',
    tags: ['Recommended', '2026', 'Top quality'],
    org: 'Alibaba Tongyi',
    description: '1024px in 8 steps, strong bilingual text. Apache-2.0. The Qwen3 text encoder and VAE are included in the download.',
    minRamGb: 15,
    quant: 'Q4_K',
    imageModes: ['txt2img'],
    files: [
      {
        name: 'z_image_turbo-Q4_K.gguf',
        url: 'https://huggingface.co/leejet/Z-Image-Turbo-GGUF/resolve/c61c0e422dc8b541b7548cf33a4ef8302b0f8085/z_image_turbo-Q4_K.gguf',
        role: 'primary',
        sizeBytes: 3864250304,
        sha256: '14b375ab4f226bc5378f68f37e899ef3c2242b8541e61e2bc1aff40976086fbd',
      },
      {
        name: 'Qwen3-4B-Instruct-2507-Q4_K_M.gguf',
        url: 'https://huggingface.co/unsloth/Qwen3-4B-Instruct-2507-GGUF/resolve/a06e946bb6b655725eafa393f4a9745d460374c9/Qwen3-4B-Instruct-2507-Q4_K_M.gguf',
        role: 'aux',
        sizeBytes: 2497281120,
        sha256: '3605803b982cb64aead44f6c1b2ae36e3acdb41d8e46c8a94c6533bc4c67e597',
      },
      {
        name: 'ae.safetensors',
        url: 'https://huggingface.co/second-state/FLUX.1-schnell-GGUF/resolve/8c45a2ba25e2d02bd34230989fb54983f39e44ec/ae.safetensors',
        role: 'aux',
        sizeBytes: 335304388,
        sha256: 'afc8e28272cd15db3919bacdb6918ce9c1ed22e96cb12c4d5ed0fba823529e38',
      },
    ],
  },
  {
    id: 'leejet/Z-Image-Turbo-GGUF-Q3',
    quantOf: 'leejet/Z-Image-Turbo-GGUF',
    quantLabel: 'Light',
    sourceModelId: 'Tongyi-MAI/Z-Image-Turbo',
    name: 'Z-Image Turbo (Light)',
    kind: 'image',
    tags: ['2026', 'Light'],
    org: 'Alibaba Tongyi',
    description: '1024px in 8 steps, strong bilingual text. Apache-2.0. The Qwen3 text encoder and VAE are included in the download.',
    minRamGb: 11,
    quant: 'Q3_K',
    imageModes: ['txt2img'],
    files: [
      {
        name: 'z_image_turbo-Q3_K.gguf',
        url: 'https://huggingface.co/leejet/Z-Image-Turbo-GGUF/resolve/c61c0e422dc8b541b7548cf33a4ef8302b0f8085/z_image_turbo-Q3_K.gguf',
        role: 'primary',
        sizeBytes: 3143559104,
        sha256: '4b44bdaa7814f20d7cf144e3939bd93aa32f50660204dd0c2aea5c5376232980',
      },
      {
        name: 'Qwen3-4B-Instruct-2507-Q4_K_M.gguf',
        url: 'https://huggingface.co/unsloth/Qwen3-4B-Instruct-2507-GGUF/resolve/a06e946bb6b655725eafa393f4a9745d460374c9/Qwen3-4B-Instruct-2507-Q4_K_M.gguf',
        role: 'aux',
        sizeBytes: 2497281120,
        sha256: '3605803b982cb64aead44f6c1b2ae36e3acdb41d8e46c8a94c6533bc4c67e597',
      },
      {
        name: 'ae.safetensors',
        url: 'https://huggingface.co/second-state/FLUX.1-schnell-GGUF/resolve/8c45a2ba25e2d02bd34230989fb54983f39e44ec/ae.safetensors',
        role: 'aux',
        sizeBytes: 335304388,
        sha256: 'afc8e28272cd15db3919bacdb6918ce9c1ed22e96cb12c4d5ed0fba823529e38',
      },
    ],
  },
  {
    id: 'mzwing/SDXL-Lightning-GGUF',
    supersededBy: 'leejet/FLUX.2-klein-4B-GGUF',
    name: 'SDXL Lightning (4-step)',
    kind: 'image',
    tags: ['Recommended', 'Fast'],
    org: 'ByteDance',
    description: 'Near-SDXL quality at 1024px in 4 steps (~7× faster). ~4GB model. Best balance — recommended.',
    minRamGb: 8,
    imageModes: ['txt2img', 'img2img'],
    files: [
      {
        name: 'sdxl_lightning_4step.q8_0.gguf',
        url: 'https://huggingface.co/mzwing/SDXL-Lightning-GGUF/resolve/main/sdxl_lightning_4step.q8_0.gguf',
        role: 'primary',
        sizeBytes: 4098988672,
      },
    ],
  },
  {
    id: 'OlegSkutte/sdxl-turbo-GGUF',
    supersededBy: 'leejet/FLUX.2-klein-4B-GGUF',
    name: 'SDXL Turbo (fast drafts)',
    kind: 'image',
    tags: ['Fastest', 'Drafts'],
    org: 'Stability AI',
    description: 'Distilled SDXL — 1-4 steps, ~10s drafts at 512px. Fastest option; lower fidelity.',
    minRamGb: 8,
    imageModes: ['txt2img', 'img2img'],
    files: [
      {
        name: 'sd_xl_turbo_1.0.q8_0.gguf',
        url: 'https://huggingface.co/OlegSkutte/sdxl-turbo-GGUF/resolve/main/sd_xl_turbo_1.0.q8_0.gguf',
        role: 'primary',
        sizeBytes: 4098988672,
      },
    ],
  },
  {
    id: 'offgrid-ai/realvisxl-v5.0-GGUF',
    quantLabel: 'Full quality',
    name: 'RealVisXL v5.0 (photoreal)',
    kind: 'image',
    tags: ['High quality', 'Photoreal'],
    org: 'RealVis',
    description: 'Top photorealism SDXL — Off Grid GGUF build of SG161222/RealVisXL_V5.0.',
    minRamGb: 8,
    quant: 'Q8_0',
    releaseDate: '2024-08-05',
    imageModes: ['txt2img', 'img2img'],
    files: [
      {
        name: 'realvisxl-v5.0-Q8_0.gguf',
        url: 'https://huggingface.co/off-grid-ai/realvisxl-v5.0-GGUF/resolve/main/realvisxl-v5.0-Q8_0.gguf',
        role: 'primary',
        sizeBytes: 4180188864,
      },
    ],
  },
  {
    id: 'offgrid-ai/realvisxl-v5.0-GGUF-Q4',
    quantOf: 'offgrid-ai/realvisxl-v5.0-GGUF',
    quantLabel: 'Light',
    name: 'RealVisXL v5.0 (Light)',
    kind: 'image',
    tags: ['Photoreal', 'Light'],
    org: 'RealVis',
    description: 'Top photorealism SDXL. Q4 quant: ~35% less memory, small quality trade-off. Runs on a 16GB Mac. Off Grid GGUF build of SG161222/RealVisXL_V5.0.',
    minRamGb: 8,
    quant: 'Q4_K',
    releaseDate: '2024-08-05',
    imageModes: ['txt2img', 'img2img'],
    files: [
      {
        name: 'realvisxl-v5.0-Q4_K.gguf',
        url: 'https://huggingface.co/off-grid-ai/realvisxl-v5.0-GGUF/resolve/main/realvisxl-v5.0-Q4_K.gguf',
        role: 'primary',
        sizeBytes: 2797755008,
      },
    ],
  },
  {
    id: 'offgrid-ai/realvisxl-v5.0-lightning-GGUF',
    quantLabel: 'Full quality',
    name: 'RealVisXL v5.0 Lightning (photoreal)',
    kind: 'image',
    tags: ['Photoreal'],
    org: 'RealVis',
    description: 'Photoreal SDXL, few-step (fast) — Off Grid GGUF build of SG161222/RealVisXL_V5.0_Lightning.',
    minRamGb: 8,
    quant: 'Q8_0',
    releaseDate: '2024-09-02',
    imageModes: ['txt2img', 'img2img'],
    files: [
      {
        name: 'realvisxl-v5.0-lightning-Q8_0.gguf',
        url: 'https://huggingface.co/off-grid-ai/realvisxl-v5.0-lightning-GGUF/resolve/main/realvisxl-v5.0-lightning-Q8_0.gguf',
        role: 'primary',
        sizeBytes: 4180188864,
      },
    ],
  },
  {
    id: 'offgrid-ai/realvisxl-v5.0-lightning-GGUF-Q4',
    quantOf: 'offgrid-ai/realvisxl-v5.0-lightning-GGUF',
    quantLabel: 'Light',
    name: 'RealVisXL v5.0 Lightning (Light)',
    kind: 'image',
    tags: ['Fast', 'Photoreal', 'Light'],
    org: 'RealVis',
    description: 'Photoreal SDXL, few-step (fast). Q4 quant: ~35% less memory, small quality trade-off. Runs on a 16GB Mac. Off Grid GGUF build of SG161222/RealVisXL_V5.0_Lightning.',
    minRamGb: 8,
    quant: 'Q4_K',
    releaseDate: '2024-09-02',
    imageModes: ['txt2img', 'img2img'],
    files: [
      {
        name: 'realvisxl-v5.0-lightning-Q4_K.gguf',
        url: 'https://huggingface.co/off-grid-ai/realvisxl-v5.0-lightning-GGUF/resolve/main/realvisxl-v5.0-lightning-Q4_K.gguf',
        role: 'primary',
        sizeBytes: 2797755008,
      },
    ],
  },
  {
    id: 'offgrid-ai/dreamshaper-xl-v2-turbo-GGUF',
    quantLabel: 'Full quality',
    name: 'DreamShaper XL v2 Turbo (versatile)',
    kind: 'image',
    tags: ['Versatile'],
    org: 'Lykon',
    description: 'The all-rounder — photoreal, art, fantasy, 3D. Off Grid GGUF build of Lykon/dreamshaper-xl-v2-turbo. Full Q8 quant (best quality); best on 24GB+ RAM.',
    minRamGb: 8,
    quant: 'Q8_0',
    releaseDate: '2024-02-07',
    imageModes: ['txt2img', 'img2img'],
    files: [
      {
        name: 'dreamshaper-xl-v2-turbo-Q8_0.gguf',
        url: 'https://huggingface.co/off-grid-ai/dreamshaper-xl-v2-turbo-GGUF/resolve/main/dreamshaper-xl-v2-turbo-Q8_0.gguf',
        role: 'primary',
        sizeBytes: 4180813664,
      },
    ],
  },
  {
    id: 'offgrid-ai/dreamshaper-xl-v2-turbo-GGUF-Q4',
    quantOf: 'offgrid-ai/dreamshaper-xl-v2-turbo-GGUF',
    quantLabel: 'Light',
    name: 'DreamShaper XL v2 Turbo (Light)',
    kind: 'image',
    tags: ['Versatile', 'Fast', 'Light'],
    org: 'Lykon',
    description: 'The all-rounder — photoreal, art, fantasy, 3D. Q4 quant: ~35% less memory than the full model, small quality trade-off. Runs on a 16GB Mac. Off Grid GGUF build of Lykon/dreamshaper-xl-v2-turbo.',
    minRamGb: 8,
    quant: 'Q4_K',
    releaseDate: '2024-02-07',
    imageModes: ['txt2img', 'img2img'],
    files: [
      {
        name: 'dreamshaper-xl-v2-turbo-Q4_K.gguf',
        url: 'https://huggingface.co/off-grid-ai/dreamshaper-xl-v2-turbo-GGUF/resolve/main/dreamshaper-xl-v2-turbo-Q4_K.gguf',
        role: 'primary',
        sizeBytes: 2798084896,
      },
    ],
  },
  {
    id: 'offgrid-ai/juggernaut-xl-v9-GGUF',
    quantLabel: 'Full quality',
    name: 'Juggernaut XL v9 (photoreal)',
    kind: 'image',
    tags: ['High quality', 'Photoreal'],
    org: 'RunDiffusion',
    description: 'Versatile photoreal SDXL — cinematic, portraits, landscapes. Off Grid GGUF build of RunDiffusion/Juggernaut-XL-v9.',
    minRamGb: 8,
    quant: 'Q8_0',
    releaseDate: '2024-02-18',
    imageModes: ['txt2img', 'img2img'],
    files: [
      {
        name: 'juggernaut-xl-v9-Q8_0.gguf',
        url: 'https://huggingface.co/off-grid-ai/juggernaut-xl-v9-GGUF/resolve/main/juggernaut-xl-v9-Q8_0.gguf',
        role: 'primary',
        sizeBytes: 4347454816,
      },
    ],
  },
  {
    id: 'offgrid-ai/juggernaut-xl-v9-GGUF-Q4',
    quantOf: 'offgrid-ai/juggernaut-xl-v9-GGUF',
    quantLabel: 'Light',
    name: 'Juggernaut XL v9 (Light)',
    kind: 'image',
    tags: ['Photoreal', 'Light'],
    org: 'RunDiffusion',
    description: 'Versatile photoreal SDXL. Q4 quant: ~35% less memory, small quality trade-off. Runs on a 16GB Mac. Off Grid GGUF build of RunDiffusion/Juggernaut-XL-v9.',
    minRamGb: 8,
    quant: 'Q4_K',
    releaseDate: '2024-02-18',
    imageModes: ['txt2img', 'img2img'],
    files: [
      {
        name: 'juggernaut-xl-v9-Q4_K.gguf',
        url: 'https://huggingface.co/off-grid-ai/juggernaut-xl-v9-GGUF/resolve/main/juggernaut-xl-v9-Q4_K.gguf',
        role: 'primary',
        sizeBytes: 2965023776,
      },
    ],
  },
  {
    id: 'offgrid-ai/animagine-xl-4.0-GGUF',
    quantLabel: 'Full quality',
    name: 'Animagine XL 4.0 (anime)',
    kind: 'image',
    tags: ['High quality', 'Anime'],
    org: 'Cagliostro',
    description: 'Leading anime SDXL — strong character knowledge. Off Grid GGUF build of cagliostrolab/animagine-xl-4.0.',
    minRamGb: 8,
    quant: 'Q8_0',
    releaseDate: '2025-01-10',
    imageModes: ['txt2img', 'img2img'],
    files: [
      {
        name: 'animagine-xl-4.0-Q8_0.gguf',
        url: 'https://huggingface.co/off-grid-ai/animagine-xl-4.0-GGUF/resolve/main/animagine-xl-4.0-Q8_0.gguf',
        role: 'primary',
        sizeBytes: 4180186816,
      },
    ],
  },
  {
    id: 'offgrid-ai/animagine-xl-4.0-GGUF-Q4',
    quantOf: 'offgrid-ai/animagine-xl-4.0-GGUF',
    quantLabel: 'Light',
    name: 'Animagine XL 4.0 (Light)',
    kind: 'image',
    tags: ['Anime', 'Light'],
    org: 'Cagliostro',
    description: 'Leading anime SDXL — strong character knowledge. Q4 quant: ~35% less memory, small quality trade-off. Runs on a 16GB Mac. Off Grid GGUF build of cagliostrolab/animagine-xl-4.0.',
    minRamGb: 8,
    quant: 'Q4_K',
    releaseDate: '2025-01-10',
    imageModes: ['txt2img', 'img2img'],
    files: [
      {
        name: 'animagine-xl-4.0-Q4_K.gguf',
        url: 'https://huggingface.co/off-grid-ai/animagine-xl-4.0-GGUF/resolve/main/animagine-xl-4.0-Q4_K.gguf',
        role: 'primary',
        sizeBytes: 2797752960,
      },
    ],
  },
  {
    id: 'offgrid-ai/illustrious-xl-v2.0-GGUF',
    quantLabel: 'Full quality',
    name: 'Illustrious XL v2.0 (anime)',
    kind: 'image',
    tags: ['High quality', 'Anime'],
    org: 'OnomaAI',
    description: 'Top anime / illustration SDXL base. Off Grid GGUF build of OnomaAIResearch/Illustrious-XL-v2.0.',
    minRamGb: 8,
    quant: 'Q8_0',
    releaseDate: '2025-04-18',
    imageModes: ['txt2img', 'img2img'],
    files: [
      {
        name: 'illustrious-xl-v2.0-Q8_0.gguf',
        url: 'https://huggingface.co/off-grid-ai/illustrious-xl-v2.0-GGUF/resolve/main/illustrious-xl-v2.0-Q8_0.gguf',
        role: 'primary',
        sizeBytes: 4180186816,
      },
    ],
  },
  {
    id: 'offgrid-ai/illustrious-xl-v2.0-GGUF-Q4',
    quantOf: 'offgrid-ai/illustrious-xl-v2.0-GGUF',
    quantLabel: 'Light',
    name: 'Illustrious XL v2.0 (Light)',
    kind: 'image',
    tags: ['Anime', 'Light'],
    org: 'OnomaAI',
    description: 'Top anime / illustration SDXL base. Q4 quant: ~35% less memory, small quality trade-off. Runs on a 16GB Mac. Off Grid GGUF build of OnomaAIResearch/Illustrious-XL-v2.0.',
    minRamGb: 8,
    quant: 'Q4_K',
    releaseDate: '2025-04-18',
    imageModes: ['txt2img', 'img2img'],
    files: [
      {
        name: 'illustrious-xl-v2.0-Q4_K.gguf',
        url: 'https://huggingface.co/off-grid-ai/illustrious-xl-v2.0-GGUF/resolve/main/illustrious-xl-v2.0-Q4_K.gguf',
        role: 'primary',
        sizeBytes: 2797752960,
      },
    ],
  },

  // ---------------------------------------------------------------------------
  // Video Models (Wan 2.1 / Wan 2.2)
  // ---------------------------------------------------------------------------
  {
    id: 'off-grid-ai/Wan2.1-T2V-1.3B-GGUF-Q4',
    quantOf: 'off-grid-ai/Wan2.1-T2V-1.3B-GGUF',
    quantLabel: 'Light',
    sourceModelId: 'Wan-AI/Wan2.1-T2V-1.3B',
    name: 'Wan 2.1 (1.3B), Light',
    kind: 'video',
    org: 'Off Grid AI',
    description: 'Create short, silent videos from a description. Converted to GGUF by Off Grid AI; the text encoder and VAE are included in the download.',
    minRamGb: 16,
    quant: 'Q4_K',
    videoModes: ['text-to-video'],
    tags: ['Text to video', 'Short clips', 'Light'],
    files: [
      {
        name: 'Wan2.1-T2V-1.3B-calibrated-Q4_K_S.gguf',
        url: 'https://huggingface.co/off-grid-ai/Wan2.1-T2V-1.3B-GGUF/resolve/main/Wan2.1-T2V-1.3B-calibrated-Q4_K_S.gguf',
        sizeBytes: 816061024,
        sha256: '82788a4a3ce6e206edd3e8e5fe512b2a75344a3d272d80f07cd4e48b60b7aaf7',
        role: 'primary',
      },
      {
        name: 'wan_2.1_vae.safetensors',
        url: 'https://huggingface.co/off-grid-ai/Video-Companions-GGUF/resolve/main/wan_2.1_vae.safetensors',
        sizeBytes: 253815318,
        sha256: '2fc39d31359a4b0a64f55876d8ff7fa8d780956ae2cb13463b0223e15148976b',
        role: 'aux',
      },
      {
        name: 'umt5-xxl-encoder-Q4_K_M.gguf',
        url: 'https://huggingface.co/off-grid-ai/Video-Companions-GGUF/resolve/main/umt5-xxl-encoder-Q4_K_M.gguf',
        sizeBytes: 3655145312,
        sha256: '17cf97a5bbbc60a646d6105b832b6f657ce904a8a1ad970e4b59df0c67584a40',
        role: 'aux',
      },
    ],
  },
  {
    id: 'off-grid-ai/Wan2.1-T2V-1.3B-GGUF',
    quantLabel: 'Full quality',
    sourceModelId: 'Wan-AI/Wan2.1-T2V-1.3B',
    name: 'Wan 2.1 (1.3B)',
    kind: 'video',
    org: 'Off Grid AI',
    description: 'Create short, silent videos from a description.',
    minRamGb: 16,
    quant: 'Q8_0',
    videoModes: ['text-to-video'],
    tags: ['Text to video', 'Short clips'],
    files: [
      {
        name: 'Wan2.1-T2V-1.3B-Q8_0.gguf',
        url: 'https://huggingface.co/off-grid-ai/Wan2.1-T2V-1.3B-GGUF/resolve/main/Wan2.1-T2V-1.3B-Q8_0.gguf',
        sizeBytes: 1519435360,
        sha256: 'de0eb6b6b75abe801b59d7b2004ecc0ca424d4ed0eeb9eed34f0d8aaf321f888',
        role: 'primary',
      },
      {
        name: 'wan_2.1_vae.safetensors',
        url: 'https://huggingface.co/off-grid-ai/Video-Companions-GGUF/resolve/main/wan_2.1_vae.safetensors',
        sizeBytes: 253815318,
        sha256: '2fc39d31359a4b0a64f55876d8ff7fa8d780956ae2cb13463b0223e15148976b',
        role: 'aux',
      },
      {
        name: 'umt5-xxl-encoder-Q4_K_M.gguf',
        url: 'https://huggingface.co/off-grid-ai/Video-Companions-GGUF/resolve/main/umt5-xxl-encoder-Q4_K_M.gguf',
        sizeBytes: 3655145312,
        sha256: '17cf97a5bbbc60a646d6105b832b6f657ce904a8a1ad970e4b59df0c67584a40',
        role: 'aux',
      },
    ],
  },
  {
    id: 'off-grid-ai/Wan2.2-TI2V-5B-GGUF-Q4',
    quantOf: 'off-grid-ai/Wan2.2-TI2V-5B-GGUF',
    quantLabel: 'Light',
    sourceModelId: 'Wan-AI/Wan2.2-TI2V-5B',
    name: 'Wan 2.2 (5B), Light',
    kind: 'video',
    org: 'Off Grid AI',
    description: 'Create short, silent videos with Wan 2.2, from a description or a photo. Converted to GGUF by Off Grid AI; the text encoder and VAE are included in the download.',
    minRamGb: 24,
    quant: 'Q4_K',
    videoModes: ['text-to-video', 'image-to-video'],
    tags: ['Text to video', 'Short clips', 'Light'],
    files: [
      {
        name: 'Wan2.2-TI2V-5B-Q4_K_S.gguf',
        url: 'https://huggingface.co/off-grid-ai/Wan2.2-TI2V-5B-GGUF/resolve/main/Wan2.2-TI2V-5B-Q4_K_S.gguf',
        sizeBytes: 2861621472,
        sha256: '2221abe02e0f9024181aafebd92944cd999518955a0ae7706650fbc0941a14c2',
        role: 'primary',
      },
      {
        name: 'wan2.2_vae.safetensors',
        url: 'https://huggingface.co/off-grid-ai/Wan2.2-TI2V-5B-GGUF/resolve/main/wan2.2_vae.safetensors',
        sizeBytes: 1409400960,
        sha256: 'e40321bd36b9709991dae2530eb4ac303dd168276980d3e9bc4b6e2b75fed156',
        role: 'aux',
      },
      {
        name: 'umt5-xxl-encoder-Q4_K_M.gguf',
        url: 'https://huggingface.co/off-grid-ai/Video-Companions-GGUF/resolve/main/umt5-xxl-encoder-Q4_K_M.gguf',
        sizeBytes: 3655145312,
        sha256: '17cf97a5bbbc60a646d6105b832b6f657ce904a8a1ad970e4b59df0c67584a40',
        role: 'aux',
      },
    ],
  },
  {
    id: 'off-grid-ai/Wan2.2-TI2V-5B-GGUF',
    quantLabel: 'Full quality',
    sourceModelId: 'Wan-AI/Wan2.2-TI2V-5B',
    name: 'Wan 2.2 (5B)',
    kind: 'video',
    org: 'Off Grid AI',
    description: 'Create short, silent videos with Wan 2.2, from a description or a photo.',
    minRamGb: 24,
    quant: 'Q8_0',
    videoModes: ['text-to-video', 'image-to-video'],
    tags: ['Text to video', 'Short clips'],
    files: [
      {
        name: 'Wan2.2-TI2V-5B-Q8_0.gguf',
        url: 'https://huggingface.co/off-grid-ai/Wan2.2-TI2V-5B-GGUF/resolve/main/Wan2.2-TI2V-5B-Q8_0.gguf',
        sizeBytes: 5344405728,
        sha256: '050819a3bf10a2cd63aee5791050ed95adffedac99a103a25801b9be00f50455',
        role: 'primary',
      },
      {
        name: 'wan2.2_vae.safetensors',
        url: 'https://huggingface.co/off-grid-ai/Wan2.2-TI2V-5B-GGUF/resolve/main/wan2.2_vae.safetensors',
        sizeBytes: 1409400960,
        sha256: 'e40321bd36b9709991dae2530eb4ac303dd168276980d3e9bc4b6e2b75fed156',
        role: 'aux',
      },
      {
        name: 'umt5-xxl-encoder-Q4_K_M.gguf',
        url: 'https://huggingface.co/off-grid-ai/Video-Companions-GGUF/resolve/main/umt5-xxl-encoder-Q4_K_M.gguf',
        sizeBytes: 3655145312,
        sha256: '17cf97a5bbbc60a646d6105b832b6f657ce904a8a1ad970e4b59df0c67584a40',
        role: 'aux',
      },
    ],
  },
  {
    id: 'hum-ma/Wan2.2-TI2V-5B-Turbo-GGUF',
    sourceModelId: 'Wan-AI/Wan2.2-TI2V-5B',
    name: 'Wan 2.2 (5B), Turbo',
    kind: 'video',
    org: 'hum-ma',
    description: '4-step distilled Wan 2.2 TI2V model for GPU-capable devices.',
    minRamGb: 24,
    quant: 'Q4_K_S',
    videoModes: ['text-to-video', 'image-to-video'],
    tags: ['Text to video', 'Turbo', '4-step'],
    files: [
      {
        name: 'Wan2_2-TI2V-5B-Turbo-Q4_K_S.gguf',
        url: 'https://huggingface.co/hum-ma/Wan2.2-TI2V-5B-Turbo-GGUF/resolve/main/Wan2_2-TI2V-5B-Turbo-Q4_K_S.gguf',
        sizeBytes: 3121191648,
        sha256: 'fa881481cd7baa116adfdbceb3c6179165d6e26194199f0e22bc36e95fe4510d',
        role: 'primary',
      },
      {
        name: 'wan2.2_vae.safetensors',
        url: 'https://huggingface.co/off-grid-ai/Wan2.2-TI2V-5B-GGUF/resolve/main/wan2.2_vae.safetensors',
        sizeBytes: 1409400960,
        sha256: 'e40321bd36b9709991dae2530eb4ac303dd168276980d3e9bc4b6e2b75fed156',
        role: 'aux',
      },
      {
        name: 'umt5-xxl-encoder-Q4_K_M.gguf',
        url: 'https://huggingface.co/off-grid-ai/Video-Companions-GGUF/resolve/main/umt5-xxl-encoder-Q4_K_M.gguf',
        sizeBytes: 3655145312,
        sha256: '17cf97a5bbbc60a646d6105b832b6f657ce904a8a1ad970e4b59df0c67584a40',
        role: 'aux',
      },
    ],
  },
  {
    id: 'Comfy-Org/Wan_2.1_ComfyUI_repackaged',
    sourceModelId: 'Wan-AI/Wan2.1-T2V-1.3B',
    name: 'Wan 2.1 (1.3B), FP16',
    kind: 'video',
    org: 'Comfy-Org',
    description: 'FP16 Wan 2.1 package without published per-file SHA-256 checksums.',
    minRamGb: 16,
    quant: 'FP16',
    videoModes: ['text-to-video'],
    tags: ['Text to video', 'FP16'],
    files: [
      {
        name: 'wan2.1_t2v_1.3B_fp16.safetensors',
        url: 'https://huggingface.co/Comfy-Org/Wan_2.1_ComfyUI_repackaged/resolve/main/split_files/diffusion_models/wan2.1_t2v_1.3B_fp16.safetensors',
        sizeBytes: 2838303560,
        role: 'primary',
      },
      {
        name: 'wan_2.1_vae.safetensors',
        url: 'https://huggingface.co/Comfy-Org/Wan_2.1_ComfyUI_repackaged/resolve/main/split_files/vae/wan_2.1_vae.safetensors',
        sizeBytes: 253815318,
        role: 'aux',
      },
      {
        name: 'umt5-xxl-encoder-Q4_K_M.gguf',
        url: 'https://huggingface.co/off-grid-ai/Video-Companions-GGUF/resolve/main/umt5-xxl-encoder-Q4_K_M.gguf',
        sizeBytes: 3655145312,
        role: 'aux',
      },
    ],
  },
];

function sizeMetric(candidate: PickCandidate): number {
  return candidate.activeParams ?? candidate.params ?? candidate.sizeBytes / 1e9;
}

/**
 * Selects Fast, Balanced, and Best picks from candidate models that fit inside `ramGB` and
 * satisfy engine compatibility rules.
 */
export function pickModelsForDevice(
  candidates: readonly PickCandidate[],
  ramGB: number,
  budget: FitBudgetRatio | { comfortable: number; ceil: number },
  tier: 'runsWell' | 'fits' = 'runsWell',
  engineBuild = 0,
): DevicePickResult {
  const soft = 'soft' in budget ? budget.soft : budget.comfortable;
  const hard = 'hard' in budget ? budget.hard : budget.ceil;
  const ratio = tier === 'runsWell' ? soft : hard;
  const maxBytes = ramGB * ratio * 1e9;

  const eligible = candidates.filter(c => {
    if (c.supersededBy || c.nonCommercial) return false;
    if (c.minLlamaBuild && engineBuild < c.minLlamaBuild) return false;
    if (!Number.isFinite(c.sizeBytes) || c.sizeBytes <= 0) return false;
    return c.sizeBytes <= maxBytes;
  });

  if (eligible.length === 0) return {};

  const hasQuality = eligible.some(c => typeof c.quality === 'number');
  if (hasQuality) {
    const byQuality = [...eligible].sort((a, b) => {
      const qDiff = (b.quality ?? 0) - (a.quality ?? 0);
      if (qDiff !== 0) return qDiff;
      return a.sizeBytes - b.sizeBytes;
    });

    if (byQuality.length === 1) {
      return { best: byQuality[0].id };
    }
    if (byQuality.length === 2) {
      return { best: byQuality[0].id, fast: byQuality[1].id };
    }

    const best = byQuality[0];
    return {
      fast: byQuality[2].id,
      balanced: byQuality[1].id,
      best: best.id,
    };
  }

  const bySize = [...eligible].sort((a, b) => {
    const mDiff = sizeMetric(a) - sizeMetric(b);
    if (mDiff !== 0) return mDiff;
    return a.sizeBytes - b.sizeBytes;
  });

  if (bySize.length === 1) {
    return { best: bySize[0].id };
  }
  if (bySize.length === 2) {
    return { fast: bySize[0].id, best: bySize[1].id };
  }
  const fast = bySize[0];
  const best = bySize[bySize.length - 1];
  const target = Math.sqrt(sizeMetric(fast) * sizeMetric(best));
  const balanced = bySize.slice(1, -1).reduce((closest, candidate) => {
    const cDiff = Math.abs(sizeMetric(candidate) - target);
    const bestDiff = Math.abs(sizeMetric(closest) - target);
    if (cDiff !== bestDiff) return cDiff < bestDiff ? candidate : closest;
    return candidate.sizeBytes < closest.sizeBytes ? candidate : closest;
  });
  return {
    fast: fast.id,
    balanced: balanced.id,
    best: best.id,
  };
}
