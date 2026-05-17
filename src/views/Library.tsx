import React, { useState, useRef, useEffect, memo, useCallback } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, type Book } from '../db';
import { BookPlus, Trash2, Loader2, Search, MoreVertical, Plus } from 'lucide-react';
import { useToast } from '../components/Toast';

interface LibraryProps {
  onOpenBook: (id: number) => void;
}

const BookCard = memo(({ 
  book, 
  activeDropdownId, 
  confirmDeleteId, 
  onOpenBook, 
  setActiveDropdownId, 
  setConfirmDeleteId, 
  deleteBook 
}: {
  book: Book,
  activeDropdownId: number | null,
  confirmDeleteId: number | null,
  onOpenBook: (id: number) => void,
  setActiveDropdownId: (id: number | null) => void,
  setConfirmDeleteId: (id: number | null) => void,
  deleteBook: (e: React.MouseEvent, id?: number) => void
}) => {
  const [coverUrl, setCoverUrl] = useState('');

  useEffect(() => {
    if (!book.cover) return;
    const url = URL.createObjectURL(book.cover);
    setCoverUrl(url);
    
    // Memory Leak Fix: Revoke URL when unmounted or changed
    return () => URL.revokeObjectURL(url);
  }, [book.cover]);
  
  return (
    <div className="book-card" onClick={() => book.id && onOpenBook(book.id)}>
      <div className="book-cover">
        {book.cover ? (
          <img src={coverUrl} alt={book.title} />
        ) : (
          <span className="no-cover-text">{book.title}</span>
        )}
        
        {/* V4: More Options Menu */}
        <button 
          className="book-options-btn" 
          onClick={(e) => {
            e.stopPropagation();
            setActiveDropdownId(activeDropdownId === book.id ? null : (book.id || null));
            setConfirmDeleteId(null);
          }}
          aria-label="More options"
        >
          <MoreVertical size={16} />
        </button>
        
        {activeDropdownId === book.id && (
          <div className="book-dropdown">
            <button 
              className={`dropdown-item ${confirmDeleteId === book.id ? '' : 'danger'}`}
              style={confirmDeleteId === book.id ? { backgroundColor: '#ef4444', color: 'white' } : {}}
              onClick={(e) => deleteBook(e, book.id)}
            >
              <Trash2 size={14} /> {confirmDeleteId === book.id ? 'Confirm Delete' : 'Remove Book'}
            </button>
          </div>
        )}
      </div>
      <div className="book-info">
        <div className="book-title" title={book.title}>{book.title}</div>
        <div className="book-author">{book.author}</div>
      </div>
      {book.progressPercent > 0 && (
        <div className="book-progress-mini">
          <div className="book-progress-mini-track">
            <div className="book-progress-mini-fill" style={{ width: `${Math.round(book.progressPercent * 100)}%` }} />
          </div>
          <span className="book-progress-label">{Math.round(book.progressPercent * 100)}%</span>
        </div>
      )}
    </div>
  );
});

export default function Library({ onOpenBook }: LibraryProps) {
  const { toast } = useToast();
  const books = useLiveQuery(() => db.books.orderBy('addedAt').reverse().toArray());
  const [isDragging, setIsDragging] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [sortOrder, setSortOrder] = useState<'recent' | 'lastRead' | 'title' | 'author'>('lastRead');
  const [activeDropdownId, setActiveDropdownId] = useState<number | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<number | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Close dropdowns when clicking outside (only active when a dropdown is open)
  useEffect(() => {
    if (activeDropdownId === null) return;
    const closeDropdowns = () => {
      setActiveDropdownId(null);
      setConfirmDeleteId(null);
    };
    window.addEventListener('click', closeDropdowns);
    return () => window.removeEventListener('click', closeDropdowns);
  }, [activeDropdownId]);

  const filteredBooks = React.useMemo(() => {
    if (!books) return undefined;
    let result = [...books];
    
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter(b => 
        b.title.toLowerCase().includes(q) || 
        b.author.toLowerCase().includes(q)
      );
    }

    if (sortOrder === 'lastRead') {
      result.sort((a, b) => {
        const aTime = a.lastOpenedAt?.getTime() || 0;
        const bTime = b.lastOpenedAt?.getTime() || 0;
        return bTime - aTime; // Most recently read first
      });
    } else if (sortOrder === 'title') {
      result.sort((a, b) => a.title.localeCompare(b.title));
    } else if (sortOrder === 'author') {
      result.sort((a, b) => a.author.localeCompare(b.author));
    }
    // 'recent' preserves the IndexedDB order (by addedAt desc)
    return result;
  }, [books, searchQuery, sortOrder]);

  const importTxt = useCallback(async (file: File): Promise<void> => {
    const text = await file.text();
    const title = file.name.replace(/\.txt$/i, '');
    const author = 'Plain Text';

    const existing = await db.books.where({ title, author, fileType: 'txt' }).first();
    if (existing) {
      toast(`"${title}" is already in your library`, 'info');
      return;
    }

    const bookId = await db.books.add({
      title,
      author,
      cover: null,
      progress: '0',
      progressPercent: 0,
      addedAt: new Date(),
      fileType: 'txt',
    });

    await db.files.add({
      bookId,
      fileData: new Blob([text], { type: 'text/plain' }),
    });
  }, [toast]);

  const importEpub = useCallback(async (file: File): Promise<void> => {
    const arrayBuffer = await new Promise<ArrayBuffer>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as ArrayBuffer);
      reader.onerror = () => reject(new Error('Failed to read file'));
      reader.readAsArrayBuffer(file);
    });

    const { default: ePub } = await import('epubjs');
    const book = ePub(arrayBuffer);
    try {
      await book.ready;

      const metadata = await book.loaded.metadata;
      const coverUrl = await book.coverUrl();

      const title = metadata.title || 'Unknown Title';
      const author = metadata.creator || 'Unknown Author';

      const existing = await db.books.where({ title, author, fileType: 'epub' }).first();
      if (existing) {
        toast(`"${title}" is already in your library`, 'info');
        return;
      }

      let coverBlob = null;
      if (coverUrl) {
        try {
          const response = await fetch(coverUrl);
          coverBlob = await response.blob();
        } catch (err) {
          console.error('Failed to fetch cover', err);
        }
      }

      const bookId = await db.books.add({
        title,
        author,
        cover: coverBlob,
        progress: '0',
        progressPercent: 0,
        addedAt: new Date(),
        fileType: 'epub',
      });

      await db.files.add({
        bookId,
        fileData: file
      });
    } finally {
      book.destroy();
    }
  }, [toast]);

  const handleFile = async (file: File) => {
    const name = file.name.toLowerCase();
    if (!name.endsWith('.epub') && !name.endsWith('.txt')) {
      toast('Please upload a .epub or .txt file', 'error');
      return;
    }

    setIsImporting(true);
    try {
      if (name.endsWith('.txt')) {
        await importTxt(file);
      } else {
        await importEpub(file);
      }
    } catch (err) {
      console.error('Error importing book:', err);
      toast('Failed to import book', 'error');
    } finally {
      setIsImporting(false);
    }
  };

  const deleteBook = async (e: React.MouseEvent, id?: number) => {
    e.stopPropagation();
    if (!id) return;
    
    if (confirmDeleteId === id) {
      // Actually delete
      await db.books.delete(id);
      await db.files.delete(id);
      const { invalidateBookCache } = await import('../utils/bookCache');
      invalidateBookCache(id);
      setActiveDropdownId(null);
      setConfirmDeleteId(null);
    } else {
      // Show confirmation state
      setConfirmDeleteId(id);
    }
  };

  const onDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const onDragLeave = () => setIsDragging(false);

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFile(e.dataTransfer.files[0]);
    }
  };

  return (
    <div 
      className={`library-container ${isDragging ? 'drag-active' : ''}`}
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
      style={isDragging ? { background: 'rgba(0, 102, 204, 0.05)', borderRadius: '1rem', border: '2px dashed var(--primary-color)' } : {}}
    >
      <div className="library-header-actions" style={{ justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', gap: '1rem', flex: 1, flexWrap: 'wrap' }}>
          <div className="search-input-wrapper" style={{ flex: '1 1 250px' }}>
            <Search size={18} />
            <input 
              type="text" 
              className="premium-input" 
              placeholder="Search books..." 
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
            />
          </div>
          <select 
            className="premium-select"
            value={sortOrder}
            onChange={e => {
              const v = e.target.value;
              if (v === 'lastRead' || v === 'recent' || v === 'title' || v === 'author') setSortOrder(v);
            }}
          >
            <option value="lastRead">Last Read</option>
            <option value="recent">Recently Added</option>
            <option value="title">Sort by Title</option>
            <option value="author">Sort by Author</option>
          </select>
        </div>
        
        <button 
          className="action-btn primary" 
          onClick={() => !isImporting && fileInputRef.current?.click()}
          style={{ whiteSpace: 'nowrap', padding: '0.8rem 1.5rem', borderRadius: '12px' }}
        >
          {isImporting ? <Loader2 className="spin" size={18} /> : <Plus size={18} />}
          {isImporting ? 'Importing...' : 'Add Book'}
        </button>
        
        <input 
          type="file" 
          accept=".epub,.txt"
          ref={fileInputRef} 
          style={{ display: 'none' }} 
          onChange={(e) => e.target.files && handleFile(e.target.files[0])}
        />
      </div>

      {filteredBooks === undefined ? (
        <div className="empty-state">
          <Loader2 className="spin" size={48} style={{ opacity: 0.5, marginBottom: '1rem' }} />
          <p>Loading library<span className="reader-loading-dot">.</span><span className="reader-loading-dot">.</span><span className="reader-loading-dot">.</span></p>
        </div>
      ) : filteredBooks.length === 0 ? (
        <div className="empty-state">
          <div style={{ background: 'var(--card-bg)', padding: '2rem', borderRadius: '50%', marginBottom: '1.5rem', boxShadow: '0 8px 32px rgba(0,0,0,0.05)' }}>
            <BookPlus size={48} style={{ opacity: 0.6, color: 'var(--primary-color)' }} />
          </div>
          <h3 style={{ fontSize: '1.5rem', marginBottom: '0.5rem', fontWeight: 600 }}>Build Your Library</h3>
          <p style={{ maxWidth: '300px', lineHeight: 1.5 }}>Drag and drop EPUB or TXT files anywhere on this screen or click 'Add Book' to get started.</p>
        </div>
      ) : (
        <div className="book-grid">
          {filteredBooks.map(book => (
            <BookCard 
              key={book.id}
              book={book}
              activeDropdownId={activeDropdownId}
              confirmDeleteId={confirmDeleteId}
              onOpenBook={onOpenBook}
              setActiveDropdownId={setActiveDropdownId}
              setConfirmDeleteId={setConfirmDeleteId}
              deleteBook={deleteBook}
            />
          ))}
        </div>
      )}
    </div>
  );
}
