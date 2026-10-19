// Built-in provider presets for Hana Magpie.
//
// These mirror the small, stable part of magpie's provider presets
// (internal/provider/presets.go): a name, a base URL and the wire API. Every
// one of them is optional: the primary way to add a provider is still a
// magpie/OpenCode provider plugin, exactly as in magpie.

export const PRESETS = [
  {
    id: "openai", name: "OpenAI", icon: "openai.svg", api: "openai-completions",
    baseUrl: "https://api.openai.com/v1", keyless: false,
    models: ["gpt-5.2", "gpt-5.2-mini", "gpt-5.1", "gpt-4.1", "gpt-4o", "o4-mini"],
    note: "Official OpenAI API key.",
  },
  {
    id: "anthropic", name: "Anthropic", icon: "claude-color.svg", api: "anthropic-messages",
    baseUrl: "https://api.anthropic.com", keyless: false,
    models: ["claude-opus-4-6", "claude-sonnet-4-6", "claude-haiku-4-5"],
    note: "Official Anthropic API key (not a Claude subscription).",
  },
  {
    id: "google", name: "Google Gemini", icon: "gemini-color.svg", api: "openai-completions",
    baseUrl: "https://generativelanguage.googleapis.com/v1beta/openai", keyless: false,
    models: ["gemini-3.1-pro", "gemini-3-flash", "gemini-2.5-pro", "gemini-2.5-flash"],
    note: "Gemini's OpenAI-compatible endpoint.",
  },
  {
    id: "deepseek", name: "DeepSeek", icon: "deepseek-color.svg", api: "openai-completions",
    baseUrl: "https://api.deepseek.com/v1", keyless: false,
    models: ["deepseek-v4-pro", "deepseek-v4-flash", "deepseek-chat", "deepseek-reasoner"],
    note: "DeepSeek open platform.",
  },
  {
    id: "moonshot", name: "Kimi (Moonshot)", icon: "kimi.svg", api: "openai-completions",
    baseUrl: "https://api.moonshot.cn/v1", keyless: false,
    models: ["kimi-k2.5", "kimi-k2-turbo-preview", "moonshot-v1-128k"],
    note: "Moonshot AI, China.",
  },
  {
    id: "zhipu", name: "Zhipu GLM", icon: "zhipu-color.svg", api: "openai-completions",
    baseUrl: "https://open.bigmodel.cn/api/paas/v4", keyless: false,
    models: ["glm-5", "glm-4.6", "glm-4.5-air"],
    note: "Zhipu AI open platform.",
  },
  {
    id: "qwen", name: "Qwen (DashScope)", icon: "qwen-color.svg", api: "openai-completions",
    baseUrl: "https://dashscope.aliyuncs.com/compatible-mode/v1", keyless: false,
    models: ["qwen3-max", "qwen3-coder-plus", "qwen-plus"],
    note: "Alibaba Cloud DashScope compatible mode.",
  },
  {
    id: "xai", name: "xAI", icon: "xai.svg", api: "openai-completions",
    baseUrl: "https://api.x.ai/v1", keyless: false,
    models: ["grok-4", "grok-4-fast", "grok-code-fast-1"],
    note: "xAI API key.",
  },
  {
    id: "groq", name: "Groq", icon: "groq.svg", api: "openai-completions",
    baseUrl: "https://api.groq.com/openai/v1", keyless: false,
    models: ["llama-3.3-70b-versatile", "openai/gpt-oss-120b"],
    note: "GroqCloud API key.",
  },
  {
    id: "mistral", name: "Mistral", icon: "mistral-color.svg", api: "openai-completions",
    baseUrl: "https://api.mistral.ai/v1", keyless: false,
    models: ["mistral-large-latest", "codestral-latest"],
    note: "Mistral La Plateforme.",
  },
  {
    id: "openrouter", name: "OpenRouter", icon: "openrouter.svg", api: "openai-completions",
    baseUrl: "https://openrouter.ai/api/v1", keyless: false,
    models: [], note: "One key for many vendors; models are discovered.",
    headers: { "HTTP-Referer": "https://github.com/liliMozi/openhanako", "X-Title": "Hana Magpie" },
  },
  {
    id: "siliconflow", name: "SiliconFlow", icon: "siliconcloud-color.svg", api: "openai-completions",
    baseUrl: "https://api.siliconflow.cn/v1", keyless: false,
    models: [], note: "SiliconFlow, China.",
  },
  {
    id: "aihubmix", name: "AiHubMix", icon: "aihubmix-color.svg", api: "openai-completions",
    baseUrl: "https://aihubmix.com/v1", keyless: false,
    models: [], note: "One key for many vendors, with automatic model discovery.",
  },
  {
    id: "302ai", name: "302.AI", icon: "ai302-color.svg", api: "openai-completions",
    baseUrl: "https://api.302.ai/v1", keyless: false,
    models: [], note: "One key for many vendors.",
  },
  {
    id: "vercel-ai", name: "Vercel AI Gateway", icon: "vercel.svg", api: "openai-completions",
    baseUrl: "https://ai-gateway.vercel.sh/v1", keyless: false,
    models: [], note: "Vercel AI Gateway, one key for many vendors.",
  },
  {
    id: "ollama", name: "Ollama (local)", icon: "ollama.svg", api: "openai-completions",
    baseUrl: "http://127.0.0.1:11434/v1", keyless: true,
    models: [], note: "Local Ollama; no API key needed.",
  },
  {
    id: "custom", name: "Custom (OpenAI-compatible)", icon: "generic.svg", api: "openai-completions",
    baseUrl: "", keyless: false, models: [],
    note: "Any OpenAI-compatible endpoint.",
  },
];

export function presetById(id) {
  return PRESETS.find((p) => p.id === id) || null;
}

export function presetKind(id) {
  if (id === "ollama") return "local";
  if (id === "openrouter" || id === "siliconflow" || id === "aihubmix" || id === "302ai" || id === "vercel-ai") return "relay";
  if (id === "custom") return "custom";
  return "vendor";
}

const NOTES_ZH = {
  openai: "官方 OpenAI API Key。",
  anthropic: "Anthropic 官方 API Key（不是 Claude 订阅）。",
  google: "Gemini 的 OpenAI 兼容接口。",
  deepseek: "DeepSeek 开放平台。",
  moonshot: "Moonshot AI（中国）。",
  zhipu: "智谱 AI 开放平台。",
  qwen: "阿里云百炼兼容模式。",
  xai: "xAI API Key。",
  groq: "GroqCloud API Key。",
  mistral: "Mistral La Plateforme。",
  openrouter: "一个 Key 接入多家模型，自动发现模型。",
  siliconflow: "硅基流动（中国）。",
  aihubmix: "一个 Key 接入多家模型。",
  "302ai": "一个 Key 接入多家模型。",
  "vercel-ai": "Vercel AI Gateway，一个 Key 接入多家模型。",
  ollama: "本机 Ollama，不需要 API Key。",
  custom: "任意 OpenAI 兼容接口。",
};

export function presetNote(preset, lang = "zh") {
  if (!preset) return "";
  return lang === "zh" ? (NOTES_ZH[preset.id] || preset.note || "") : (preset.note || "");
}

export const API_LABELS = {
  "openai-completions": "Chat Completions",
  "openai-responses": "Responses",
  "anthropic-messages": "Anthropic Messages",
  "google-generative-ai": "Gemini",
};

// HanaAgent/Pi names for the same wire APIs. A model's API decides which
// request shape HanaAgent sends us; we forward that shape to the provider
// plugin, which is what magpie's gateway does after its own translation.
export function hanaApiFor(api) {
  switch (api) {
    case "anthropic-messages": return "anthropic-messages";
    case "openai-responses": return "openai-responses";
    case "google-generative-ai": return "google-generative-ai";
    default: return "openai-completions";
  }
}

// The path a provider plugin's fetch expects, from the npm package that
// model uses (magpie docs, "模型使用的 API").
export function pluginPathForNpm(npm) {
  if (npm === "@ai-sdk/anthropic" || npm === "@ai-sdk/google-vertex/anthropic") return "anthropic";
  if (npm === "@ai-sdk/google") return "gemini";
  if (npm === "@ai-sdk/openai" || npm === "@ai-sdk/azure" || npm === "@ai-sdk/github-copilot") return "responses";
  return "chat";
}

export function apiForNpm(npm) {
  if (npm === "@ai-sdk/anthropic" || npm === "@ai-sdk/google-vertex/anthropic") return "anthropic-messages";
  if (npm === "@ai-sdk/google") return "google-generative-ai";
  if (npm === "@ai-sdk/openai" || npm === "@ai-sdk/azure") return "openai-responses";
  return "openai-completions";
}

export function pluginPathSuffix(kind) {
  switch (kind) {
    case "anthropic": return "/messages";
    case "responses": return "/responses";
    case "gemini": return "/models/"; // model + :streamGenerateContent?alt=sse
    default: return "/chat/completions";
  }
}
