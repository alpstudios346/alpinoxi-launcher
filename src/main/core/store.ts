import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname } from 'node:path'

/** Tiny dependency-free JSON persistence helper (atomic-ish writes). */
export class JsonStore<T> {
  private cache: T
  private readonly file: string

  constructor(file: string, defaults: T) {
    this.file = file
    this.cache = defaults
    if (existsSync(file)) {
      try {
        const raw = readFileSync(file, 'utf8')
        this.cache = { ...defaults, ...(JSON.parse(raw) as object) } as T
      } catch {
        this.cache = defaults
      }
    } else {
      this.persist()
    }
  }

  get(): T {
    return this.cache
  }

  set(patch: Partial<T>): T {
    this.cache = { ...this.cache, ...patch }
    this.persist()
    return this.cache
  }

  replace(value: T): T {
    this.cache = value
    this.persist()
    return this.cache
  }

  private persist(): void {
    const dir = dirname(this.file)
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true })
    writeFileSync(this.file, JSON.stringify(this.cache, null, 2), 'utf8')
  }
}

/** Array-backed store for collections (accounts, instances, ...). */
export class ListStore<T extends object> {
  private readonly store: JsonStore<{ items: T[] }>

  constructor(file: string) {
    this.store = new JsonStore<{ items: T[] }>(file, { items: [] })
  }

  all(): T[] {
    return this.store.get().items
  }

  save(items: T[]): T[] {
    this.store.replace({ items })
    return items
  }

  add(item: T): T[] {
    return this.save([...this.all(), item])
  }

  update(predicate: (item: T) => boolean, patch: Partial<T>): T[] {
    return this.save(this.all().map((i) => (predicate(i) ? { ...i, ...patch } : i)))
  }

  remove(predicate: (item: T) => boolean): T[] {
    return this.save(this.all().filter((i) => !predicate(i)))
  }

  find(predicate: (item: T) => boolean): T | undefined {
    return this.all().find(predicate)
  }
}
