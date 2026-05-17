import { getStorageItem } from './storage';

// ── Non-streaming response parsers ──────────────────────────────────────────

function parseNonStreamResponse(data: any, provider: string): string {
  if (provider === 'openai' || provider === 'deepseek') return data.choices?.[0]?.message?.content || 'No response.';
  if (provider === 'ollama') return data.message?.content || 'No response.';
  if (provider === 'gemini') return data.candidates?.[0]?.content?.parts?.[0]?.text || 'No response.';
  if (provider === 'anthropic') return data.content?.[0]?.text || 'No response.';
  return 'Unknown provider.';
}

// ── Streaming delta extractors ──────────────────────────────────────────────

function extractStreamDelta(data: any, provider: string): string | null {
  if (provider === 'openai' || provider === 'deepseek') {
    return data.choices?.[0]?.delta?.content || null;
  }
  if (provider === 'anthropic') {
    if (data.type === 'content_block_delta' && data.delta?.type === 'text_delta') {
      return data.delta.text || null;
    }
    return null;
  }
  if (provider === 'gemini') {
    return data.candidates?.[0]?.content?.parts?.[0]?.text || null;
  }
  if (provider === 'ollama') {
    return data.message?.content || null;
  }
  return null;
}

// ── Shared SSE / JSONL parser — call addChunk() for each raw text chunk ─────
//    then flush() to drain remaining buffer. onChunk fires for each text delta.

function createStreamParser(
  provider: string,
  onChunk: (text: string) => void,
) {
  let buffer = '';
  let fullText = '';
  const delimiter = provider === 'ollama' ? '\n' : '\n\n';

  function processParts(parts: string[]) {
    for (let i = 0; i < parts.length; i++) {
      const trimmed = parts[i].trim();
      if (!trimmed) continue;

      const lines = trimmed.split('\n');
      for (const line of lines) {
        const sseData = line.startsWith('data: ')
          ? line.slice(6)
          : provider === 'ollama'
            ? trimmed
            : null;
        if (!sseData || sseData === '[DONE]') continue;

        try {
          const parsed = JSON.parse(sseData);
          const delta = extractStreamDelta(parsed, provider);
          if (delta) {
            fullText += delta;
            onChunk(delta);
          }
        } catch {
          // Malformed JSON in stream — skip
        }
      }
    }
  }

  return {
    addChunk(chunk: string) {
      buffer += chunk;
      const parts = buffer.split(delimiter);
      buffer = parts.pop() || '';
      processParts(parts);
    },
    flush() {
      if (buffer.trim() && buffer.trim() !== '[DONE]') {
        processParts([buffer]);
        buffer = '';
      }
    },
    getFullText() {
      return fullText;
    },
  };
}

// ── Direct fetch streaming ──────────────────────────────────────────────────

async function streamDirect(
  url: string,
  headers: Record<string, string>,
  body: unknown,
  provider: string,
  onChunk: (text: string) => void,
  signal?: AbortSignal,
): Promise<string> {
  const res = await fetch(url, {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
    signal,
  });

  if (!res.ok) {
    const text = await res.text();
    let errMsg = `HTTP ${res.status}`;
    try {
      const err = JSON.parse(text);
      errMsg = err.error?.message || err.error || errMsg;
    } catch {}
    throw new Error(errMsg);
  }

  const reader = res.body?.getReader();
  if (!reader) throw new Error('Response body is not readable');

  const decoder = new TextDecoder();
  const parser = createStreamParser(provider, onChunk);

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    parser.addChunk(decoder.decode(value, { stream: true }));
  }
  parser.flush();

  return parser.getFullText() || 'No response.';
}

// ── Main API ────────────────────────────────────────────────────────────────

export async function explainText(
  text: string,
  type: 'simple' | 'detailed',
  onChunk?: (chunk: string) => void,
  signal?: AbortSignal,
): Promise<string> {
  const provider = (await getStorageItem('ai_provider')) || 'deepseek';
  const apiKey = (await getStorageItem('ai_api_key')) || '';
  const ollamaUrl = (await getStorageItem('ai_ollama_url')) || 'http://localhost:11434';
  const ollamaModel = (await getStorageItem('ai_ollama_model')) || 'llama3.2:3b';
  const langCode = (await getStorageItem('ai_language')) || 'auto';

  const langNames: Record<string, string> = {
    auto: navigator.language.startsWith('zh') ? 'Chinese (中文)' : navigator.language.startsWith('ja') ? 'Japanese' : navigator.language.startsWith('ko') ? 'Korean' : navigator.language.startsWith('fr') ? 'French' : navigator.language.startsWith('de') ? 'German' : navigator.language.startsWith('es') ? 'Spanish' : navigator.language.startsWith('pt') ? 'Portuguese' : navigator.language.startsWith('ru') ? 'Russian' : navigator.language.startsWith('ar') ? 'Arabic' : 'English',
    en: 'English',
    zh: 'Chinese (中文)',
    ja: 'Japanese',
    ko: 'Korean',
    fr: 'French',
    de: 'German',
    es: 'Spanish',
    pt: 'Portuguese',
    ru: 'Russian',
    ar: 'Arabic',
  };
  const langInstruction = `Respond in ${langNames[langCode] || langNames.auto}.`;

  const systemPrompt =
    type === 'simple'
      ? `You are a sophisticated AI reading companion. Explain the following text passage in exactly 1–2 elegant sentences. Distill the core meaning and why it matters. Use **bold** sparingly for the single most important term or concept — no other formatting. Be insightful, not verbose. ${langInstruction}`
      : `You are a world-class literature tutor. Analyze the following text passage with insight and clarity.

Structure your response with these sections (use markdown headings):

### Summary
A 1–2 sentence distillation of the passage's core meaning and significance.

### Key Vocabulary
- **term** — definition with usage context (only for words worth explaining)
- **term** — definition with usage context

### Language & Style
- Note sentence structure, rhythm, or literary/rhetorical devices at play
- Grammar points worth appreciating (not basic rules — focus on what's interesting)

### Deeper Reading
- Subtext, cultural context, or thematic connections
- How this passage serves the broader work

Guidelines:
- Use **bold** for key terms, *italics* for emphasis
- Keep sections focused — every sentence should add insight, not filler
- Skip sections that don't apply (if a passage has no notable vocabulary, omit Key Vocabulary)
- Quality over quantity — a crisp response is better than a long one\n${langInstruction}`;

  const stream = typeof onChunk === 'function';

  let url = '';
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  let body: any = {};

  if (provider === 'openai') {
    url = 'https://api.openai.com/v1/chat/completions';
    headers['Authorization'] = `Bearer ${apiKey}`;
    body = {
      model: (await getStorageItem('ai_openai_model')) || 'gpt-4o',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: text },
      ],
      stream,
    };
  } else if (provider === 'deepseek') {
    url = 'https://api.deepseek.com/chat/completions';
    headers['Authorization'] = `Bearer ${apiKey}`;
    body = {
      model: (await getStorageItem('ai_deepseek_model')) || 'deepseek-v4-flash',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: text },
      ],
      stream,
    };
  } else if (provider === 'anthropic') {
    url = 'https://api.anthropic.com/v1/messages';
    headers['x-api-key'] = apiKey;
    headers['anthropic-version'] = '2023-06-01';
    body = {
      model: (await getStorageItem('ai_anthropic_model')) || 'claude-haiku-4-5-20251001',
      max_tokens: 1024,
      system: systemPrompt,
      messages: [{ role: 'user', content: text }],
      stream,
    };
  } else if (provider === 'gemini') {
    const model = (await getStorageItem('ai_gemini_model')) || 'gemini-1.5-flash';
    url = stream
      ? `https://generativelanguage.googleapis.com/v1beta/models/${model}:streamGenerateContent?alt=sse&key=${apiKey}`
      : `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
    body = {
      contents: [{ parts: [{ text: `${systemPrompt}\n\nText: ${text}` }] }],
    };
  } else if (provider === 'ollama') {
    const cleanUrl = ollamaUrl.replace(/\/+$/, '');
    url = `${cleanUrl}/api/chat`;
    body = {
      model: ollamaModel,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: text },
      ],
      stream,
    };
  } else {
    return 'Provider not supported yet.';
  }

  if (stream) {
    try {
      return await streamDirect(url, headers, body, provider, onChunk!, signal);
    } catch (err: any) {
      if (err.name === 'AbortError') return '';
      return `Network error: ${err.message}`;
    }
  }

  // Non-streaming fallback
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
      signal,
    });
    const textResp = await res.text();
    if (!textResp) return `Error: Empty response from ${provider}.`;

    const data = JSON.parse(textResp);
    if (!res.ok) return `Error (${res.status}): ${data.error?.message || data.error || 'Unknown'}`;

    return parseNonStreamResponse(data, provider);
  } catch (err: any) {
    if (err.name === 'AbortError') return '';
    return `Network error: ${err.message}`;
  }
}
