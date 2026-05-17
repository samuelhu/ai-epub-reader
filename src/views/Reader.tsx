import { useEffect, useRef, useState, memo } from 'react';
import { type Book, type Rendition } from 'epubjs';
import { db } from '../db';
import { ArrowLeft, Type, Sparkles, Volume2, X, List, Maximize, Minimize, Pin, PinOff, Square } from 'lucide-react';
import { explainText } from '../utils/ai';
import { useToast } from '../components/Toast';
import { getCachedBook } from '../utils/bookCache';
import { renderMarkdown } from '../components/AiResponse';
import { READER_THEMES, getThemeColors, generateTheme } from '../utils/theme';

interface ReaderProps {
  bookId: number;
  onClose: () => void;
  onGoToSettings: () => void;
}

const TocPanel = memo(({ toc, currentHref, rendition, setShowToc }: any) => {
  const renderToc = (items: any[], level = 0) => {
    return (
      <ul className={level === 0 ? "toc-list" : "toc-list toc-nested"}>
        {items.map((item: any, index: number) => {
          const baseHref = item.href.split('#')[0];
          const isActive = currentHref && (currentHref === item.href || currentHref === baseHref || currentHref.startsWith(baseHref));
          return (
          <li key={index} className="toc-item">
            <a 
              href="#" 
              className={`toc-link ${isActive ? 'active' : ''}`}
              onClick={(e) => { 
                e.preventDefault(); 
                rendition?.display(item.href); 
                setShowToc(false); 
              }}
            >
              {item.label}
            </a>
            {item.subitems && item.subitems.length > 0 && renderToc(item.subitems, level + 1)}
          </li>
          );
        })}
      </ul>
    );
  };

  return (
    <div className="glass-panel toc-panel">
      <div className="panel-header">
        <h3>Table of Contents</h3>
        <button className="icon-btn" onClick={() => setShowToc(false)} aria-label="Close"><X size={16} /></button>
      </div>
      {toc.length > 0 ? renderToc(toc) : <p style={{ opacity: 0.5 }}>No chapters found.</p>}
    </div>
  );
});

const SettingsPanel = memo(({ theme, setTheme, fontSize, setFontSize, lineHeight, setLineHeight, margin, setMargin, fontFamily, setFontFamily, onClose }: any) => {
  return (
    <div className="ai-panel settings-panel-solid">
      <div className="panel-header">
        <h3>Typography & Theme</h3>
        <button className="icon-btn" onClick={onClose} aria-label="Close"><X size={16} /></button>
      </div>

      <div className="settings-fields">
        <div>
          <label className="settings-label">Theme</label>
          <div className="segmented-control">
            <button className={`segmented-item ${theme === 'light' ? 'active' : ''}`} onClick={() => setTheme('light')}>Light</button>
            <button className={`segmented-item ${theme === 'dark' ? 'active' : ''}`} onClick={() => setTheme('dark')}>Dark</button>
            <button className={`segmented-item ${theme === 'sepia' ? 'active' : ''}`} onClick={() => setTheme('sepia')}>Sepia</button>
          </div>
        </div>

        <div>
          <div className="settings-label-row">
            <label className="settings-label">Font Size ({fontSize}%)</label>
          </div>
          <input type="range" className="settings-range" min="80" max="250" step="10" value={fontSize} onChange={(e) => setFontSize(parseInt(e.target.value))} />
        </div>

        <div>
          <div className="settings-label-row">
            <label className="settings-label">Line Spacing</label>
          </div>
          <input type="range" className="settings-range" min="1" max="2.5" step="0.1" value={lineHeight} onChange={(e) => setLineHeight(parseFloat(e.target.value))} />
        </div>

        <div>
          <div className="settings-label-row">
            <label className="settings-label">Page Margin ({margin}px)</label>
          </div>
          <input type="range" className="settings-range" min="0" max="80" step="5" value={margin} onChange={(e) => setMargin(parseInt(e.target.value))} />
        </div>

        <div>
          <label className="settings-label">Font Family</label>
          <select className="settings-select" value={fontFamily} onChange={e => setFontFamily(e.target.value)}>
            <option value="'Inter', system-ui, sans-serif">System Default</option>
            <option value="'Literata', Georgia, serif">Serif (Literata)</option>
            <option value="'JetBrains Mono', monospace">Monospace</option>
          </select>
        </div>
      </div>
    </div>
  );
});

function buildTocMap(items: any[], map = new Map<string, string>()): Map<string, string> {
  for (const item of items) {
    map.set(item.href, item.label);
    if (item.subitems?.length) buildTocMap(item.subitems, map);
  }
  return map;
}

function findChapterTitle(tocMap: Map<string, string>, href: string): string {
  if (tocMap.has(href)) return tocMap.get(href)!;
  // Fallback: match by base href (strip fragment)
  const base = href.split('#')[0];
  for (const [key, label] of tocMap) {
    if (key.split('#')[0] === base) return label;
  }
  return '';
}

export default function Reader({ bookId, onClose, onGoToSettings }: ReaderProps) {
  const { toast } = useToast();
  const viewerRef = useRef<HTMLDivElement>(null);
  const [rendition, setRendition] = useState<Rendition | null>(null);
  
  // UI State
  const [showSettings, setShowSettings] = useState(false);
  const [showToc, setShowToc] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isHeaderVisible, setIsHeaderVisible] = useState(true);
  const [isLoading, setIsLoading] = useState(true);

  // Content State
  const [toc, setToc] = useState<any[]>([]);
  const tocMapRef = useRef<Map<string, string>>(new Map());
  const [progressText, setProgressText] = useState('');
  const [progressPercent, setProgressPercent] = useState(0);
  const [bookTitle, setBookTitle] = useState('');
  const [chapterTitle, setChapterTitle] = useState('');

  // Settings State (persisted)
  const [theme, setTheme] = useState(() => localStorage.getItem('reader_theme') || 'light');
  const [fontSize, setFontSize] = useState(() => {
    const v = parseInt(localStorage.getItem('reader_fontSize') || '');
    return isNaN(v) ? 100 : v;
  });
  const [fontFamily, setFontFamily] = useState(() => localStorage.getItem('reader_fontFamily') || "'Literata', Georgia, serif");
  const [lineHeight, setLineHeight] = useState(() => {
    const v = parseFloat(localStorage.getItem('reader_lineHeight') || '');
    return isNaN(v) ? 1.7 : v;
  });
  const [margin, setMargin] = useState(() => {
    const v = parseInt(localStorage.getItem('reader_margin') || '');
    return isNaN(v) ? 40 : v;
  });

  // TXT State
  const [fileType, setFileType] = useState<'epub' | 'txt'>('epub');
  const [txtContent, setTxtContent] = useState('');

  // AI State
  const [selectedText, setSelectedText] = useState('');
  const [aiExplanation, setAiExplanation] = useState('');
  const [isAiLoading, setIsAiLoading] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [panelVisible, setPanelVisible] = useState(true);
  const [aiPanelPos, setAiPanelPos] = useState<{top: number, left: number} | null>(null);
  const [isPinned, setIsPinned] = useState(false);
  const [aiMode, setAiMode] = useState<'simple' | 'detailed'>('detailed');
  const [currentHref, setCurrentHref] = useState<string>('');

  // Refs so the content hook closure always reads current values (not stale captured ones)
  const lineHeightRef = useRef(lineHeight);
  const marginRef = useRef(margin);
  const isPinnedRef = useRef(isPinned);
  const renditionRef = useRef<Rendition | null>(null);
  const txtContainerRef = useRef<HTMLDivElement>(null);
  const scrollSaveTimerRef = useRef(0);
  lineHeightRef.current = lineHeight;
  marginRef.current = margin;
  isPinnedRef.current = isPinned;

  useEffect(() => {
    let book: Book;
    
    const loadBook = async () => {
      try {
        const dbBook = await db.books.get(bookId);
        if (!dbBook) {
          toast("Book not found in library", 'error');
          onClose();
          return;
        }

        setBookTitle(dbBook.title);
        setFileType(dbBook.fileType || 'epub');

        // Track last opened time for "continue reading" sorting
        db.books.update(bookId, { lastOpenedAt: new Date() });

        const dbFile = await db.files.get(bookId);
        if (!dbFile) {
          toast("File data not found", 'error');
          onClose();
          return;
        }

        // TXT rendering path — no epubjs needed
        if (dbBook.fileType === 'txt') {
          txtInitialProgressRef.current = dbBook.progressPercent || 0;
          const text = await dbFile.fileData.text();
          setTxtContent(text);
          return;
        }

        // EPUB rendering path
        const arrayBuffer = await dbFile.fileData.arrayBuffer();

        const withTimeout = <T,>(promise: Promise<T>, ms: number, label: string): Promise<T> =>
          Promise.race([
            promise,
            new Promise<T>((_, reject) => setTimeout(() => reject(new Error(`${label} timed out after ${ms / 1000}s`)), ms)),
          ]);

        book = await withTimeout(getCachedBook(bookId, arrayBuffer), 30000, 'Opening book');

        if (viewerRef.current) {
          const render = book.renderTo(viewerRef.current, {
            width: '100%',
            height: '100%',
            spread: 'none',
            manager: 'continuous',
            flow: 'paginated'
          });

          render.themes.register("light", generateTheme(READER_THEMES.light));
          render.themes.register("dark", generateTheme(READER_THEMES.dark));
          render.themes.register("sepia", generateTheme(READER_THEMES.sepia));

          // Content hook: inject typography styles + selection listeners
          const setupContentHook = (contents: any) => {
            contents.addStylesheetRules([
              ['::-webkit-scrollbar', ['width: 6px', 'height: 6px', '-webkit-appearance: none']],
              ['::-webkit-scrollbar-track', ['background: transparent']],
              ['::-webkit-scrollbar-thumb', ['background: rgba(100, 116, 139, 0.3)', 'border-radius: 10px']],
              ['::-webkit-scrollbar-thumb:hover', ['background: rgba(100, 116, 139, 0.5)']],
              ['body', [
                `line-height: ${lineHeightRef.current} !important`,
                `padding: 0 ${marginRef.current}px !important`,
                'transition: background-color 0.3s ease, color 0.3s ease !important',
                'text-rendering: optimizeLegibility !important',
                '-webkit-font-smoothing: antialiased !important'
              ]],
              ['p', [
                'margin-bottom: 0.85em !important',
                'orphans: 2 !important',
                'widows: 2 !important'
              ]],
              ['h1, h2, h3, h4, h5, h6', [
                'line-height: 1.25 !important',
                'margin-top: 1.25em !important',
                'margin-bottom: 0.5em !important',
                'font-weight: 600 !important'
              ]],
              ['img', [
                'max-width: 100% !important',
                'height: auto !important',
                'border-radius: 4px !important'
              ]],
              ['blockquote', [
                'margin: 1em 0 !important',
                'padding-left: 1em !important',
                'border-left: 3px solid currentColor !important',
                'opacity: 0.85 !important',
                'font-style: italic !important'
              ]]
            ]);

            // Inject Literata font into the epub iframe for premium typography
            try {
              const fontLink = contents.document.createElement('link');
              fontLink.rel = 'stylesheet';
              fontLink.href = 'https://fonts.googleapis.com/css2?family=Literata:opsz,wght@7..72,400;7..72,500;7..72,600&display=swap';
              contents.document.head.appendChild(fontLink);
            } catch {}

            const handleSelection = () => {
              const selection = contents.window.getSelection();
              if (!selection || selection.isCollapsed) return;

              const text = selection.toString().trim();
              if (text) {
                window.speechSynthesis.cancel();
                setIsSpeaking(false);
                setTimeout(() => {
                  setSelectedText(text);
                  setAiExplanation('');
                  setShowSettings(false);
                  setShowToc(false);

                  try {
                    const range = selection.getRangeAt(0);
                    const rect = range.getBoundingClientRect();
                    if (rect) {
                      const iframe = viewerRef.current?.querySelector('iframe');
                      const iframeRect = iframe ? iframe.getBoundingClientRect() : { left: 0, top: 0, width: window.innerWidth };

                      const selectionCenterX = iframeRect.left + rect.left + (rect.width / 2);
                      const panelWidth = 360;
                      let leftPos = selectionCenterX - (panelWidth / 2);
                      leftPos = Math.max(24, Math.min(window.innerWidth - panelWidth - 24, leftPos));

                      const offsetTop = isFullscreen ? 0 : 64;
                      const topPos = Math.max(offsetTop + 20, Math.min(window.innerHeight - 400, rect.top + offsetTop));

                      setAiPanelPos({ top: topPos, left: leftPos });
                    }
                  } catch (e) {
                    setAiPanelPos(null);
                  }
                }, 50);
              }
            };

            contents.document.addEventListener('mouseup', handleSelection);
            contents.document.addEventListener('touchend', handleSelection);
          };

          render.hooks.content.register(setupContentHook);

          // TOC and Progress — book.ready already resolved by getCachedBook
          const spineCount = (book.spine as any)?.items?.length || (book.spine as any)?.length || 0;
          const locationsCount = Math.max(200, Math.min(3000, spineCount * 50));
          await withTimeout(book.locations.generate(locationsCount), 20000, 'Generating page locations');

          const nav = await book.loaded.navigation;
          setToc(nav.toc);
          tocMapRef.current = buildTocMap(nav.toc);

          if (dbBook.progress && dbBook.progress !== '0') {
            render.display(dbBook.progress);
          } else {
            render.display();
          }

          const updateProgress = (location: any) => {
            if (!location) return;

            if (book.locations.length() > 0) {
              const percentage = book.locations.percentageFromCfi(location.start.cfi);
              setProgressPercent(percentage);
              setProgressText(`${Math.round(percentage * 100)}% read`);
              db.books.update(bookId, { progress: location.start.cfi, progressPercent: percentage });
            }
          };

          render.on('relocated', (location: any) => {
            updateProgress(location);
            if (location?.start?.href) {
              setCurrentHref(location.start.href);
              setChapterTitle(findChapterTitle(tocMapRef.current, location.start.href));
            }
          });

          render.on('click', () => {
            if (!isPinnedRef.current) {
              setSelectedText('');
              setAiPanelPos(null);
              setAiExplanation('');
              setIsPinned(false);
              window.speechSynthesis.cancel();
              setIsSpeaking(false);
            }
            setIsHeaderVisible(v => !v);
          });

          renditionRef.current = render;
          setRendition(render);
        }
      } catch (err: any) {
        console.error('Failed to open book:', err);
        toast('Failed to open book', 'error');
      } finally {
        setIsLoading(false);
      }
    };

    loadBook();

    return () => {
      // Book stays in cache for fast reopen — only clean up the current rendition
      renditionRef.current?.destroy();
      window.speechSynthesis.cancel();
    };
  }, [bookId]);

  // Persist lineHeight/margin and update current iframe body live (no epubjs round-trip)
  useEffect(() => {
    localStorage.setItem('reader_lineHeight', lineHeight.toString());
    localStorage.setItem('reader_margin', margin.toString());

    const iframe = viewerRef.current?.querySelector('iframe') as HTMLIFrameElement | null;
    const body = iframe?.contentDocument?.body;
    if (body) {
      body.style.setProperty('line-height', String(lineHeight), 'important');
      body.style.setProperty('padding', `0 ${margin}px`, 'important');
    }
  }, [lineHeight, margin]);

  // Persist theme/fontSize/fontFamily and apply via epubjs API
  useEffect(() => {
    localStorage.setItem('reader_theme', theme);
    localStorage.setItem('reader_fontSize', fontSize.toString());
    localStorage.setItem('reader_fontFamily', fontFamily);

    if (rendition) {
      document.documentElement.setAttribute('data-theme', theme);

      const colors = getThemeColors(theme);

      rendition.themes.override('color', colors.fg);
      rendition.themes.override('background', colors.bg);

      rendition.themes.select(theme);
      rendition.themes.fontSize(`${fontSize}%`);
      rendition.themes.font(fontFamily);
    }
  }, [theme, fontSize, fontFamily, rendition]);

  // P0: Keyboard Nav
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setIsFullscreen(false);
      if (fileType === 'txt' && txtContainerRef.current) {
        const scroll = window.innerHeight * 0.85;
        if (e.key === 'ArrowRight' || e.key === 'ArrowDown') txtContainerRef.current.scrollBy({ top: scroll, behavior: 'smooth' });
        if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') txtContainerRef.current.scrollBy({ top: -scroll, behavior: 'smooth' });
        return;
      }
      if (e.key === 'ArrowRight') rendition?.next();
      if (e.key === 'ArrowLeft') rendition?.prev();
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [rendition, fileType]);

  // TXT: sync document theme attribute (epub's theme effect only runs when rendition exists)
  useEffect(() => {
    if (fileType === 'txt') {
      document.documentElement.setAttribute('data-theme', theme);
    }
  }, [fileType, theme]);

  // TXT: apply typography to container and track scroll progress
  useEffect(() => {
    if (fileType !== 'txt' || !txtContainerRef.current) return;

    const container = txtContainerRef.current;
    const colors = getThemeColors(theme);

    container.style.background = colors.bg;
    container.style.color = colors.fg;
    container.style.fontFamily = fontFamily;
    container.style.fontSize = `${Math.round(16 * fontSize / 100)}px`;
    container.style.lineHeight = String(lineHeight);
    container.style.padding = `0 ${margin}px 120px`;

    const onScroll = () => {
      const { scrollTop, scrollHeight, clientHeight } = container;
      const pct = scrollHeight > clientHeight ? scrollTop / (scrollHeight - clientHeight) : 0;
      setProgressPercent(pct);
      setProgressText(`${Math.round(pct * 100)}% read`);
      clearTimeout(scrollSaveTimerRef.current);
      scrollSaveTimerRef.current = window.setTimeout(() => {
        db.books.update(bookId, { progressPercent: pct, progress: String(Math.round(pct * 100)) });
      }, 500);
    };
    container.addEventListener('scroll', onScroll, { passive: true });
    return () => {
      container.removeEventListener('scroll', onScroll);
      clearTimeout(scrollSaveTimerRef.current);
    };
  }, [fileType, theme, fontFamily, fontSize, lineHeight, margin, bookId]);

  // TXT: restore saved scroll position on first load
  const txtInitialProgressRef = useRef(0);
  useEffect(() => {
    if (fileType !== 'txt' || !txtContent || !txtContainerRef.current) return;
    const pct = txtInitialProgressRef.current;
    if (pct > 0) {
      const { scrollHeight, clientHeight } = txtContainerRef.current;
      txtContainerRef.current.scrollTop = (scrollHeight - clientHeight) * (pct / 100);
    }
  }, [fileType, txtContent]);

  // Fullscreen toggle — listen to browser event so Escape key stays in sync
  useEffect(() => {
    const onFSChange = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', onFSChange);
    return () => document.removeEventListener('fullscreenchange', onFSChange);
  }, []);

  useEffect(() => {
    if (isFullscreen && !document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => {});
    } else if (!isFullscreen && document.fullscreenElement) {
      document.exitFullscreen().catch(() => {});
    }
  }, [isFullscreen]);

  // Reposition AI panel on viewport resize
  useEffect(() => {
    const onResize = () => {
      if (!isPinnedRef.current) {
        setAiPanelPos(null);
        return;
      }
      setAiPanelPos(prev => {
        if (!prev) return null;
        const panelW = 380;
        return {
          top: Math.max(20, Math.min(window.innerHeight - 450, prev.top)),
          left: Math.max(24, Math.min(window.innerWidth - panelW - 24, prev.left)),
        };
      });
    };
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  // Auto-trigger Brief only for single words (dictionary/lookup). Longer
  // selections show the panel but wait for the user to click Brief or Detailed.
  const lastAutoTextRef = useRef('');
  const isSingleWord = (t: string) => t.trim().split(/\s+/).length === 1;
  useEffect(() => {
    if (selectedText && selectedText !== lastAutoTextRef.current && !isAiLoading && !isPinned && isSingleWord(selectedText)) {
      lastAutoTextRef.current = selectedText;
      handleExplain('simple');
    }
  }, [selectedText]);

  // Show panel when new text is selected (may have been hidden by Read Aloud)
  useEffect(() => {
    if (selectedText) setPanelVisible(true);
  }, [selectedText]);

  // Auto-dismiss chip after 30s if user ignores it
  useEffect(() => {
    if (!isSpeaking && aiExplanation && !panelVisible && selectedText) {
      const timer = setTimeout(() => {
        lastAutoTextRef.current = '';
        setSelectedText('');
        setAiExplanation('');
      }, 30_000);
      return () => clearTimeout(timer);
    }
  }, [isSpeaking, aiExplanation, panelVisible, selectedText]);

  const prevPage = () => rendition?.prev();
  const nextPage = () => rendition?.next();

  const abortRef = useRef<AbortController | null>(null);

  const handleExplain = async (type: 'simple' | 'detailed') => {
    // Abort any in-flight request before starting a new one
    if (abortRef.current) {
      abortRef.current.abort();
    }
    const controller = new AbortController();
    abortRef.current = controller;

    setIsAiLoading(true);
    setAiExplanation('');
    setAiMode(type);
    let partial = '';
    let rafId = 0;
    try {
      await explainText(selectedText, type, (chunk) => {
        partial += chunk;
        if (!rafId) {
          rafId = requestAnimationFrame(() => {
            setAiExplanation(partial);
            rafId = 0;
          });
        }
      }, controller.signal);
      setAiExplanation(partial);
    } catch (e: any) {
      if (e.name === 'AbortError') return;
      if (partial) {
        setAiExplanation(partial + '\n\n[Error: ' + (e.message || 'connection lost') + ']');
      } else {
        setAiExplanation('Error: ' + (e.message || 'Failed to generate explanation'));
      }
    } finally {
      if (abortRef.current === controller) {
        abortRef.current = null;
      }
      setIsAiLoading(false);
    }
  };

  const handleSpeak = () => {
    if (isSpeaking) {
      window.speechSynthesis.cancel();
      setIsSpeaking(false);
    } else {
      setPanelVisible(false);
      setIsHeaderVisible(true);
      const utterance = new SpeechSynthesisUtterance(selectedText);
      utterance.onend = () => setIsSpeaking(false);
      utterance.onerror = () => setIsSpeaking(false);
      window.speechSynthesis.speak(utterance);
      setIsSpeaking(true);
    }
  };

  const handleTxtSelection = () => {
    window.speechSynthesis.cancel();
    setIsSpeaking(false);
    setTimeout(() => {
      const sel = window.getSelection();
      if (!sel || sel.isCollapsed) return;
      const text = sel.toString().trim();
      if (text) {
        setSelectedText(text);
        setAiExplanation('');
        setShowSettings(false);
        setShowToc(false);
        try {
          const range = sel.getRangeAt(0);
          const rect = range.getBoundingClientRect();
          const panelWidth = 360;
          const selectionCenterX = rect.left + rect.width / 2;
          let leftPos = selectionCenterX - panelWidth / 2;
          leftPos = Math.max(24, Math.min(window.innerWidth - panelWidth - 24, leftPos));
          const topPos = Math.max(20, Math.min(window.innerHeight - 400, rect.bottom + 12));
          setAiPanelPos({ top: topPos, left: leftPos });
        } catch {
          setAiPanelPos(null);
        }
      }
    }, 50);
  };

  const closeSelection = () => {
    lastAutoTextRef.current = '';
    abortRef.current?.abort();
    setSelectedText('');
    setAiExplanation('');
    setIsPinned(false);
    if (isSpeaking) {
      window.speechSynthesis.cancel();
      setIsSpeaking(false);
    }
  };

  return (
    <div className={`reader-container ${isFullscreen ? 'fullscreen' : ''}`}>
      {/* Header */}
      <header className={`glass-panel reader-header ${!isHeaderVisible ? 'hidden' : ''}`}>
        <button className="icon-btn" onClick={onClose} aria-label="Back to Library"><ArrowLeft /></button>
        <div className="reader-header-center">
          <div className="reader-header-title">{bookTitle}</div>
          {chapterTitle && <div className="reader-header-chapter">{chapterTitle}</div>}
        </div>
        <div className="reader-header-actions">
          {fileType === 'epub' && (
            <button className="icon-btn" onClick={() => { setShowToc(!showToc); setShowSettings(false); closeSelection(); }} aria-label="Table of Contents"><List /></button>
          )}
          <button className="icon-btn" onClick={() => { setShowSettings(!showSettings); setShowToc(false); closeSelection(); }} aria-label="Typography Settings"><Type /></button>
          <button className="icon-btn" onClick={() => setIsFullscreen(!isFullscreen)} aria-label="Toggle Fullscreen">
            {isFullscreen ? <Minimize /> : <Maximize />}
          </button>
          {isSpeaking && (
            <button className="icon-btn stop-btn" onClick={handleSpeak} aria-label="Stop reading">
              <Square size={16} />
            </button>
          )}
        </div>
      </header>

      {/* TOC Sidebar */}
      {showToc && (
        <TocPanel toc={toc} currentHref={currentHref} rendition={rendition} setShowToc={setShowToc} />
      )}
      
      {/* Settings Panel */}
      {showSettings && !selectedText && (
        <SettingsPanel
          theme={theme} setTheme={setTheme}
          fontSize={fontSize} setFontSize={setFontSize}
          lineHeight={lineHeight} setLineHeight={setLineHeight}
          margin={margin} setMargin={setMargin}
          fontFamily={fontFamily} setFontFamily={setFontFamily}
          onClose={() => setShowSettings(false)}
        />
      )}

      {/* AI Context Panel */}
      {selectedText && panelVisible && !isSpeaking && (
        <div className="ai-panel ai-panel-primary" style={aiPanelPos ? { top: `${aiPanelPos.top}px`, left: `${aiPanelPos.left}px` } : {}}>
          <div className="ai-panel-accent-bar" />
          <div className="ai-panel-inner">
            <div className="ai-panel-header">
              <h3><Sparkles size={16} /> AI Tutor</h3>
              <div style={{ display: 'flex', gap: '0.25rem' }}>
                <button className="icon-btn" onClick={() => setIsPinned(!isPinned)} aria-label={isPinned ? 'Unpin panel' : 'Pin panel'}>
                  {isPinned ? <PinOff size={14} /> : <Pin size={14} />}
                </button>
                <button className="icon-btn" onClick={closeSelection} aria-label="Close"><X size={16} /></button>
              </div>
            </div>

            <div className="ai-panel-quote">
              "{selectedText.length > 150 ? Array.from(selectedText).slice(0, 150).join('') + '...' : selectedText}"
            </div>

            <div className="ai-panel-actions">
              <button className="action-btn primary" onClick={() => handleExplain('simple')}>Brief</button>
              <button className="action-btn secondary" onClick={() => handleExplain('detailed')}>Detailed</button>
            </div>
            <button className="action-btn secondary" onClick={handleSpeak} style={{ width: '100%' }}>
              <Volume2 size={14} /> Read Aloud
            </button>

            <div className={`ai-panel-answer ${aiMode === 'simple' && aiExplanation ? 'ai-panel-answer-brief' : ''}`}>
              {isAiLoading && !aiExplanation && (
                <span className="ai-loading-shimmer">Thinking… analyzing the text…</span>
              )}
              {aiExplanation && (
                aiMode === 'simple'
                  ? <div className="ai-response-brief">{renderMarkdown(aiExplanation)}</div>
                  : renderMarkdown(aiExplanation)
              )}
              {isAiLoading && aiExplanation && (
                <span className="ai-streaming-cursor" />
              )}
              {!isAiLoading && !aiExplanation && (
                isSingleWord(selectedText) ? (
                  <p className="ai-setup-hint">
                    No response for this word.<br />
                    Set up your AI provider in <button className="ai-setup-link" onClick={() => { closeSelection(); onGoToSettings(); }}>Settings</button>.
                  </p>
                ) : (
                  <p className="ai-setup-hint">
                    Tap <strong>Brief</strong> for a quick summary or <strong>Detailed</strong> for in‑depth analysis.
                  </p>
                )
              )}
            </div>
          </div>
        </div>
      )}

      {/* AI Response chip — appears after Read Aloud ends if a response exists */}
      {!isSpeaking && aiExplanation && !panelVisible && selectedText && (
        <div className="ai-response-chip" onClick={() => setPanelVisible(true)}>
          <Sparkles size={14} />
          AI response ready
          <span className="ai-response-chip-action"> — Show</span>
        </div>
      )}

      {isLoading && (
        <div className="reader-loading-overlay">
          <div className="reader-loading-spinner" />
          <p>Opening your book<span className="reader-loading-dot">.</span><span className="reader-loading-dot">.</span><span className="reader-loading-dot">.</span></p>
        </div>
      )}

      <div className="reader-area" onClick={() => { if (showSettings) setShowSettings(false); if (showToc) setShowToc(false); }}>
        {fileType === 'txt' ? (
          <div className="txt-reader" ref={txtContainerRef} onMouseUp={handleTxtSelection} onTouchEnd={handleTxtSelection}>
            {txtContent.split(/\n{2,}/).map((para, i) => (
              <p key={i} className="txt-para">{para}</p>
            ))}
          </div>
        ) : (
          <div id="viewer" ref={viewerRef}></div>
        )}
      </div>

      {fileType === 'epub' && (
        <>
          <div className="invisible-tap-zone left" onClick={prevPage} aria-label="Previous Page"></div>
          <div className="invisible-tap-zone right" onClick={nextPage} aria-label="Next Page"></div>
        </>
      )}

      {/* Progress Bar */}
      <div className={`reading-progress-container ${!isHeaderVisible ? 'hidden' : ''}`}>
        <div className="reading-progress-fill" style={{ width: `${progressPercent * 100}%` }}></div>
        <div className="reading-progress-text">{progressText}</div>
      </div>
    </div>
  );
}
