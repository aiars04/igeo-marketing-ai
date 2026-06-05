/**
 * IndexedDB-based document store for content type reference files.
 * Handles PDFs, images, Word/PowerPoint docs, etc.
 */

export type DocMeta = {
  id: string
  contentTypeId: string
  name: string
  mimeType: string
  size: number
  uploadedAt: string
}

type IDBRecord = DocMeta & { blob: Blob }

const DB_NAME    = 'igeo_marketing_docs'
const STORE_NAME = 'documents'
const DB_VERSION = 1

let _db: Promise<IDBDatabase> | null = null

function getDB(): Promise<IDBDatabase> {
  if (_db) return _db
  _db = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION)
    req.onupgradeneeded = e => {
      const db = (e.target as IDBOpenDBRequest).result
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        const store = db.createObjectStore(STORE_NAME, { keyPath: 'id' })
        store.createIndex('contentTypeId', 'contentTypeId', { unique: false })
      }
    }
    req.onsuccess = e => resolve((e.target as IDBOpenDBRequest).result)
    req.onerror   = e => { _db = null; reject((e.target as IDBOpenDBRequest).error) }
  })
  return _db
}

/* ─── CRUD ─── */

export async function saveDoc(
  meta: Omit<DocMeta, 'id' | 'uploadedAt'>,
  blob: Blob,
): Promise<DocMeta> {
  const db = await getDB()
  const record: IDBRecord = {
    ...meta,
    id:         `doc_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    uploadedAt: new Date().toISOString().split('T')[0],
    blob,
  }
  return new Promise((resolve, reject) => {
    const tx  = db.transaction(STORE_NAME, 'readwrite')
    tx.objectStore(STORE_NAME).add(record)
    tx.oncomplete = () => {
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { blob: _b, ...docMeta } = record
      resolve(docMeta)
    }
    tx.onerror = () => reject(tx.error)
  })
}

export async function getDocBlob(id: string): Promise<Blob | null> {
  const db = await getDB()
  return new Promise((resolve, reject) => {
    const req = db.transaction(STORE_NAME, 'readonly').objectStore(STORE_NAME).get(id)
    req.onsuccess = () => resolve((req.result as IDBRecord)?.blob ?? null)
    req.onerror   = () => reject(req.error)
  })
}

export async function listDocsByType(contentTypeId: string): Promise<DocMeta[]> {
  const db = await getDB()
  return new Promise((resolve, reject) => {
    const req = db
      .transaction(STORE_NAME, 'readonly')
      .objectStore(STORE_NAME)
      .index('contentTypeId')
      .getAll(contentTypeId)
    req.onsuccess = () => {
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
    resolve((req.result as IDBRecord[]).map(({ blob, ...meta }) => meta))
    }
    req.onerror = () => reject(req.error)
  })
}

export async function listAllDocMeta(): Promise<DocMeta[]> {
  const db = await getDB()
  return new Promise((resolve, reject) => {
    const req = db.transaction(STORE_NAME, 'readonly').objectStore(STORE_NAME).getAll()
    req.onsuccess = () => {
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
    resolve((req.result as IDBRecord[]).map(({ blob, ...meta }) => meta))
    }
    req.onerror = () => reject(req.error)
  })
}

export async function deleteDoc(id: string): Promise<void> {
  const db = await getDB()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite')
    tx.objectStore(STORE_NAME).delete(id)
    tx.oncomplete = () => resolve()
    tx.onerror    = () => reject(tx.error)
  })
}

/* ─── Helpers ─── */

export function formatFileSize(bytes: number): string {
  if (bytes < 1024)        return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

export function fileCategory(mimeType: string): 'pdf' | 'image' | 'word' | 'ppt' | 'excel' | 'other' {
  if (mimeType === 'application/pdf')                           return 'pdf'
  if (mimeType.startsWith('image/'))                           return 'image'
  if (mimeType.includes('wordprocessingml') || mimeType.includes('msword')) return 'word'
  if (mimeType.includes('presentationml') || mimeType.includes('powerpoint')) return 'ppt'
  if (mimeType.includes('spreadsheetml') || mimeType.includes('excel'))  return 'excel'
  return 'other'
}
