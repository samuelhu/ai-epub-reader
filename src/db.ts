import Dexie, { type Table } from 'dexie';

export interface Book {
  id?: number;
  title: string;
  author: string;
  cover?: Blob | null;
  progress: string; // epubcfi for EPUB, scroll percentage string "12.5" for TXT
  progressPercent: number;
  addedAt: Date;
  lastOpenedAt?: Date;
  fileType?: 'epub' | 'txt';
}

export interface BookFile {
  bookId: number;
  fileData: Blob;
}

export class AppDB extends Dexie {
  books!: Table<Book, number>;
  files!: Table<BookFile, number>;

  constructor() {
    super('ai-epub-reader');
    
    // V1 Schema
    this.version(1).stores({
      books: '++id, title, author, addedAt'
    });

    // V2 Schema: Separate massive blobs into a `files` table
    this.version(2).stores({
      books: '++id, title, author, addedAt',
      files: 'bookId' // bookId is the primary key here
    }).upgrade(tx => {
      // Migrate V1 books that had inline fileData
      return tx.table('books').toCollection().modify((book: any) => {
        if (book.fileData) {
          if (book.id) {
            tx.table('files').put({ bookId: book.id, fileData: book.fileData });
          }
          delete book.fileData;
        }
      });
    });
  }
}

export const db = new AppDB();
