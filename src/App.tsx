import { useState, lazy, Suspense } from 'react';
import Library from './views/Library';
import { Settings as SettingsIcon } from 'lucide-react';
import Settings from './views/Settings';
import { ToastProvider } from './components/Toast';
import { ErrorBoundary } from './components/ErrorBoundary';

const Reader = lazy(() => import('./views/Reader'));

export type ViewState = 'library' | 'reader' | 'settings';

function App() {
  const [currentView, setCurrentView] = useState<ViewState>('library');
  const [currentBookId, setCurrentBookId] = useState<number | null>(null);

  const openBook = (id: number) => {
    setCurrentBookId(id);
    setCurrentView('reader');
  };

  const closeBook = () => {
    setCurrentBookId(null);
    setCurrentView('library');
  };

  return (
    <ToastProvider>
    <ErrorBoundary>
    <div className="app-container">
      {currentView !== 'reader' && (
        <header className="glass-panel">
          <h1>{currentView === 'library' ? 'My Bookshelf' : 'Settings'}</h1>
          <div>
            {currentView === 'library' ? (
              <button className="icon-btn" onClick={() => setCurrentView('settings')}>
                <SettingsIcon size={24} />
              </button>
            ) : (
              <button className="icon-btn" onClick={() => setCurrentView('library')}>
                Back to Library
              </button>
            )}
          </div>
        </header>
      )}

      <main>
        {currentView === 'library' && <Library onOpenBook={openBook} />}
        {currentView === 'reader' && currentBookId && (
          <Suspense fallback={
            <div className="library-container">
              <div className="empty-state">
                <div className="reader-loading-spinner" />
                <p>Opening reader<span className="reader-loading-dot">.</span><span className="reader-loading-dot">.</span><span className="reader-loading-dot">.</span></p>
              </div>
            </div>
          }>
            <Reader bookId={currentBookId} onClose={closeBook} onGoToSettings={() => setCurrentView('settings')} />
          </Suspense>
        )}
        {currentView === 'settings' && <Settings />}
      </main>
    </div>
    </ErrorBoundary>
    </ToastProvider>
  );
}

export default App;
