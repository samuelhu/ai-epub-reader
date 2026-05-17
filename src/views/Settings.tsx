import { useState, useEffect } from 'react';
import { getStorageItem, setStorageItem, migrateFromLocalStorage } from '../utils/storage';
import { useToast } from '../components/Toast';

const STORAGE_KEYS = ['ai_provider', 'ai_api_key', 'ai_ollama_url', 'ai_ollama_model', 'ai_openai_model', 'ai_anthropic_model', 'ai_gemini_model', 'ai_deepseek_model', 'ai_language'];

const LANGUAGES: Record<string, string> = {
  auto: 'Auto (browser default)',
  en: 'English',
  zh: '中文',
  ja: '日本語',
  ko: '한국어',
  fr: 'Français',
  de: 'Deutsch',
  es: 'Español',
  pt: 'Português',
  ru: 'Русский',
  ar: 'العربية',
};

export default function Settings() {
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(true);
  const [provider, setProvider] = useState('deepseek');
  const [apiKey, setApiKey] = useState('');
  const [ollamaUrl, setOllamaUrl] = useState('http://localhost:11434');
  const [ollamaModel, setOllamaModel] = useState('llama3.2:3b');
  const [openaiModel, setOpenaiModel] = useState('gpt-4o');
  const [anthropicModel, setAnthropicModel] = useState('claude-haiku-4-5-20251001');
  const [geminiModel, setGeminiModel] = useState('gemini-1.5-flash');
  const [deepseekModel, setDeepseekModel] = useState('deepseek-v4-flash');
  const [language, setLanguage] = useState('auto');

  useEffect(() => {
    migrateFromLocalStorage(STORAGE_KEYS).then(() => {
      Promise.all([
        getStorageItem('ai_provider').then(v => v && setProvider(v)),
        getStorageItem('ai_api_key').then(v => v && setApiKey(v)),
        getStorageItem('ai_ollama_url').then(v => v && setOllamaUrl(v)),
        getStorageItem('ai_ollama_model').then(v => v && setOllamaModel(v)),
        getStorageItem('ai_openai_model').then(v => v && setOpenaiModel(v)),
        getStorageItem('ai_anthropic_model').then(v => v && setAnthropicModel(v)),
        getStorageItem('ai_gemini_model').then(v => v && setGeminiModel(v)),
        getStorageItem('ai_deepseek_model').then(v => v && setDeepseekModel(v)),
        getStorageItem('ai_language').then(v => v && setLanguage(v)),
      ]).finally(() => setIsLoading(false));
    });
  }, []);

  if (isLoading) {
    return (
      <div className="library-container">
        <div className="empty-state">
          <p style={{ opacity: 0.5 }}>Loading settings…</p>
        </div>
      </div>
    );
  }

  const save = async () => {
    await setStorageItem('ai_provider', provider);
    await setStorageItem('ai_api_key', apiKey);
    await setStorageItem('ai_ollama_url', ollamaUrl);
    await setStorageItem('ai_ollama_model', ollamaModel);
    await setStorageItem('ai_openai_model', openaiModel);
    await setStorageItem('ai_anthropic_model', anthropicModel);
    await setStorageItem('ai_gemini_model', geminiModel);
    await setStorageItem('ai_deepseek_model', deepseekModel);
    await setStorageItem('ai_language', language);
    toast('Settings saved', 'success');
  };

  return (
    <div className="library-container">
      <div className="glass-panel" style={{ maxWidth: 600, margin: '0 auto', padding: '2rem', borderRadius: '1rem' }}>
        <h2 style={{ marginBottom: '1.5rem' }}>AI Settings</h2>

        <div className="settings-fields">
          <div>
            <label className="settings-label" htmlFor="ai-provider">Provider</label>
            <select
              id="ai-provider"
              className="premium-select"
              value={provider}
              onChange={e => setProvider(e.target.value)}
            >
              <option value="openai">OpenAI</option>
              <option value="gemini">Google Gemini</option>
              <option value="anthropic">Anthropic Claude</option>
              <option value="deepseek">DeepSeek</option>
              <option value="ollama">Ollama (Local LLM)</option>
            </select>
          </div>

          <div>
            <label className="settings-label" htmlFor="ai-language">Response Language</label>
            <select
              id="ai-language"
              className="premium-select"
              value={language}
              onChange={e => setLanguage(e.target.value)}
            >
              {Object.entries(LANGUAGES).map(([code, name]) => (
                <option key={code} value={code}>{name}</option>
              ))}
            </select>
            <p className="settings-hint">
              Auto uses your browser's display language. Override to force responses in a specific language.
            </p>
          </div>

          {provider !== 'ollama' && (
            <>
              <div>
                <label className="settings-label" htmlFor="ai-api-key">API Key</label>
                <input
                  id="ai-api-key"
                  className="settings-input"
                  type="password"
                  value={apiKey}
                  onChange={e => setApiKey(e.target.value)}
                  placeholder={`Enter your ${provider} API Key`}
                />
              </div>
              <div>
                <label className="settings-label" htmlFor="ai-model">Model Name</label>
                {provider === 'openai' && (
                  <input id="ai-model" className="settings-input" type="text" value={openaiModel} onChange={e => setOpenaiModel(e.target.value)} placeholder="gpt-4o" />
                )}
                {provider === 'anthropic' && (
                  <input id="ai-model" className="settings-input" type="text" value={anthropicModel} onChange={e => setAnthropicModel(e.target.value)} placeholder="claude-haiku-4-5-20251001" />
                )}
                {provider === 'gemini' && (
                  <input id="ai-model" className="settings-input" type="text" value={geminiModel} onChange={e => setGeminiModel(e.target.value)} placeholder="gemini-1.5-flash" />
                )}
                {provider === 'deepseek' && (
                  <input id="ai-model" className="settings-input" type="text" value={deepseekModel} onChange={e => setDeepseekModel(e.target.value)} placeholder="deepseek-v4-flash" />
                )}
              </div>
            </>
          )}

          {provider === 'ollama' && (
            <>
              <div>
                <label className="settings-label" htmlFor="ollama-url">Ollama URL</label>
                <input
                  id="ollama-url"
                  className="settings-input"
                  type="text"
                  value={ollamaUrl}
                  onChange={e => setOllamaUrl(e.target.value)}
                  placeholder="http://localhost:11434"
                />
              </div>
              <div>
                <label className="settings-label" htmlFor="ollama-model">Ollama Model Name</label>
                <input
                  id="ollama-model"
                  className="settings-input"
                  type="text"
                  value={ollamaModel}
                  onChange={e => setOllamaModel(e.target.value)}
                  placeholder="llama3.2:3b, mistral, phi4-mini, etc."
                />
                <p className="settings-hint">
                  Standard chat models are recommended. Reasoning models (e.g. qwen3.5, deepseek-r1) that emit internal thinking tokens may cause long delays before responses appear.
                </p>
                <p className="settings-hint" style={{ marginTop: '0.75rem' }}>
                  To allow the extension to connect, start Ollama with:<br />
                  <code style={{ background: 'var(--card-bg)', padding: '0.15rem 0.4rem', borderRadius: '0.25rem', fontSize: '0.85em' }}>OLLAMA_ORIGINS="*" ollama serve</code>
                </p>
              </div>
            </>
          )}
        </div>

        <button
          onClick={save}
          className="action-btn primary"
          style={{ width: '100%', marginTop: '1rem' }}
        >
          Save Settings
        </button>
      </div>
    </div>
  );
}
