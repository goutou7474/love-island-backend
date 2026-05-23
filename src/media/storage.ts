import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'

export interface MediaStorageWriteInput {
  storageKey: string
  contentType: string
  bytes: Buffer
}

export interface MediaStorage {
  write(input: MediaStorageWriteInput): Promise<void>
  read(storageKey: string): Promise<Buffer | null>
}

export class InMemoryMediaStorage implements MediaStorage {
  private files = new Map<string, Buffer>()

  async write(input: MediaStorageWriteInput): Promise<void> {
    this.files.set(input.storageKey, Buffer.from(input.bytes))
  }

  async read(storageKey: string): Promise<Buffer | null> {
    const file = this.files.get(storageKey)
    return file ? Buffer.from(file) : null
  }
}

export class LocalMediaStorage implements MediaStorage {
  private readonly rootDir: string

  constructor(rootDir: string) {
    this.rootDir = resolve(rootDir)
  }

  async write(input: MediaStorageWriteInput): Promise<void> {
    const filePath = this.resolveStorageKey(input.storageKey)
    await mkdir(dirname(filePath), { recursive: true })
    await writeFile(filePath, input.bytes)
  }

  async read(storageKey: string): Promise<Buffer | null> {
    try {
      return await readFile(this.resolveStorageKey(storageKey))
    } catch (error) {
      if (isFileNotFound(error)) {
        return null
      }

      throw error
    }
  }

  private resolveStorageKey(storageKey: string) {
    const filePath = resolve(this.rootDir, storageKey)

    if (!filePath.startsWith(this.rootDir)) {
      throw new Error('Invalid media storage key')
    }

    return filePath
  }
}

function isFileNotFound(error: unknown) {
  return typeof error === 'object' && error !== null && 'code' in error && error.code === 'ENOENT'
}
