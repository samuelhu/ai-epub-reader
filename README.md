# AI-Powered EPUB Reader

A Chrome extension that turns your browser into a distraction-free reading environment. Read EPUB and TXT files with an AI tutor that explains any passage — select text and get an instant, intelligent explanation.

<br>

## Why You'll Like It

**Minimal by design.** No accounts, no cloud sync, no bloat. Just books and an AI tutor. The extension lives in your browser toolbar, opens in a clean full-window view, and stays out of your way while you read.

**Your data stays yours.** Everything runs locally. Books are stored in your browser's IndexedDB — they never touch a server. AI requests go directly from your browser to the provider you choose. No telemetry, no analytics, no third-party tracking.

**One-click AI.** Select any text and the AI tutor appears. For a single word, Brief fires automatically like a dictionary lookup. For longer passages, tap *Brief* for a one-sentence distillation or *Detailed* for a structured breakdown with vocabulary, style notes, and deeper reading. Text-to-speech is built in — have any passage read aloud with a single click.

**Read your way.** EPUB and TXT, three themes (Light, Dark, Sepia), adjustable fonts and sizing, fullscreen mode, keyboard navigation. Your reading position and theme preference are remembered per book.

<br>

## Recommended AI Provider — DeepSeek

DeepSeek is the default and strongly recommended. It delivers **GPT-4-class quality at ~1/50th the cost** — roughly $0.27 per million input tokens. For the typical reading session (a few thousand tokens of selected text), you'll spend **fractions of a cent** per explanation. It won't even register on your billing dashboard.

| Provider | Input Cost (per 1M tokens) | Quality |
|----------|---------------------------|---------|
| **DeepSeek** | **$0.27** | Excellent |
| OpenAI (GPT-4o) | $2.50 | Excellent |
| Anthropic (Claude) | $3.00 | Excellent |
| Google Gemini | $0.15 (free tier available) | Very Good |
| Ollama | Free (runs on your machine) | Varies by model |

Other providers are fully supported if you prefer them — switch anytime in Settings.

<br>

## Installation

### Quick Install

1. Download `ai-epub-reader-v1.0.0.zip` from the [latest release](https://github.com/samuelhu/ai-epub-reader/releases/latest)
2. Unzip anywhere on your computer
3. Go to `chrome://extensions`, enable **Developer mode**
4. Click **Load unpacked** and select the unzipped `dist/` folder

No Node.js, no build tools, no command line needed.

### From Source

```bash
git clone https://github.com/samuelhu/ai-epub-reader.git
cd ai-epub-reader
npm install
npm run build
```

Then load the `dist/` folder as an unpacked extension (same as steps 3–4 above).

<br>

## How to Use

1. Click the extension icon in Chrome's toolbar to open the reader
2. Drag an `.epub` or `.txt` file onto the library — books are stored locally
3. Click a book to open it
4. **Select any text** — the AI tutor panel appears. Single words get an instant dictionary lookup; longer selections wait for you to tap Brief or Detailed
5. Click **Detailed** for in-depth analysis, or **Read Aloud** for text-to-speech
6. Configure your AI provider in **Settings** (gear icon in the library)

<br>

## AI Providers

All requests are sent directly from your browser to the AI provider. No intermediary server.

| Provider | Setup |
|----------|-------|
| **DeepSeek** | [Get an API key](https://platform.deepseek.com/api_keys) — $0.27/M tokens |
| OpenAI | [Get an API key](https://platform.openai.com/api-keys) |
| Anthropic | [Get an API key](https://console.anthropic.com/) |
| Google Gemini | [Get an API key](https://aistudio.google.com/apikey) |
| Ollama | [Install locally](https://ollama.com) — fully offline |

For Ollama, start the server with `OLLAMA_ORIGINS="*" ollama serve` and enter your model name in Settings (e.g. `llama3.2:3b`, `mistral`).

<br>

## Tech Stack

React 19, TypeScript, Vite 8, epubjs, Dexie.js (IndexedDB). Built as a Chrome Manifest V3 extension.

## License

MIT
