# AI-Powered EPUB Reader

A Chrome extension that transforms your browser into a premium reading environment. Read EPUB and plain text files with an AI Tutor that explains any passage you select — powered by OpenAI, DeepSeek, Anthropic Claude, Google Gemini, or a local Ollama model.

<img src="screenshots/library.png" alt="Library" width="800" />

## Features

### Reading Experience
- **EPUB & TXT support** — same premium reading experience for both formats
- **Typography controls** — font family (Literata, Inter, JetBrains Mono), size (80–250%), line spacing, page margins
- **Three themes** — Light, Dark, Sepia — persisted per book
- **Fullscreen mode** — distraction-free reading
- **Table of contents** — quick navigation for EPUB files
- **Progress tracking** — remembers your position across sessions
- **Keyboard navigation** — arrow keys for EPUB, scroll for TXT

### AI Tutor
- **Select any passage** and get an instant explanation
- **Brief mode** (auto-triggered) — 1–2 sentence distillation of the core meaning
- **Detailed mode** — structured analysis with summary, vocabulary, style notes, and deeper reading
- **Multiple AI providers**: DeepSeek (default), OpenAI, Anthropic Claude, Google Gemini, Ollama
- **Response language** — auto-detect from browser or force a specific language (11 options)
- **Streaming responses** — read along as the AI generates
- **Text-to-speech** — have any passage read aloud

### Library
- **Drag & drop** import — EPUB or TXT files anywhere on the screen
- **Search** — filter by title or author
- **Sort** — by last read, recently added, title, or author
- **Delete** — with confirmation to prevent accidents

## Installation

### Quick Install (No Build Required)

1. Download `ai-epub-reader-v1.0.0.zip` from the [latest release](https://github.com/samuelhu/ai-epub-reader/releases/latest)
2. Unzip to get the `dist/` folder
3. Go to `chrome://extensions`, enable **Developer mode** (toggle in top right)
4. Click **Load unpacked** and select the `dist/` folder
5. The extension is ready — click the puzzle icon in Chrome's toolbar to pin it

### From Source

```bash
git clone https://github.com/samuelhu/ai-epub-reader.git
cd ai-epub-reader
npm install
npm run build
```

Then load the extension in Chrome:
1. Open `chrome://extensions`
2. Enable **Developer mode** (toggle in top right)
3. Click **Load unpacked**
4. Select the `dist/` folder

### Usage

1. Click the extension icon or use the keyboard shortcut to open the reader
2. Drag an `.epub` or `.txt` file onto the library screen
3. Click a book to open it
4. Select any text to trigger the AI Tutor (Brief explanation auto-fires)
5. Click **Detailed** for in-depth analysis, or **Read Aloud** for TTS

## AI Provider Setup

Go to **Settings** (gear icon in Library) to configure:

| Provider | What You Need |
|----------|---------------|
| DeepSeek | [API key](https://platform.deepseek.com/api_keys) |
| OpenAI | [API key](https://platform.openai.com/api-keys) |
| Anthropic | [API key](https://console.anthropic.com/) |
| Google Gemini | [API key](https://aistudio.google.com/apikey) |
| Ollama | Local server (see below) |

### Ollama (Local LLM)

Start the Ollama server with open origins:

```bash
OLLAMA_ORIGINS="*" ollama serve
```

Then in Settings, select **Ollama** as provider, set the URL (default `http://localhost:11434`), and enter your model name (e.g., `llama3.2:3b`, `mistral`, `phi4-mini`).

**Note**: Standard chat models are recommended. Reasoning models (e.g., `qwen3.5`, `deepseek-r1`) that emit internal thinking tokens may cause long delays before responses appear.

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | React 19 + TypeScript 6 |
| Build | Vite 8 + @crxjs/vite-plugin |
| EPUB Engine | epubjs 0.3.93 |
| Database | Dexie.js 4.4 (IndexedDB) |
| Icons | lucide-react |
| Fonts | Inter, Literata, JetBrains Mono (Google Fonts) |

## Project Structure

```
src/
  App.tsx                  Top-level view router
  db.ts                    Dexie schema (V2: books + files tables)
  index.css                All styles (CSS custom properties, components)
  background.ts            Service worker (extension action handler)
  main.tsx                 React entry point

  views/
    Library.tsx            Book grid, import, drag-and-drop
    Reader.tsx             EPUB/TXT rendering, AI panel, typography
    Settings.tsx           AI provider configuration

  components/
    AiResponse.tsx         Custom markdown-to-JSX renderer
    ErrorBoundary.tsx      React error boundary
    Toast.tsx              Toast notification system

  utils/
    ai.ts                  AI provider routing, SSE streaming, abort
    bookCache.ts           LRU cache for epubjs Book objects
    storage.ts             chrome.storage.local bridge
    theme.ts               Shared theme color config + epubjs theme builder
```

## Development

```bash
npm run dev       # Dev server with HMR
npm run build     # Production build (tsc + vite)
npm run lint      # ESLint
```

## License

MIT
