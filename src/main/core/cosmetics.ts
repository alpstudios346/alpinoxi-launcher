import { copyFileSync, existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs'
import { join, basename } from 'node:path'
import type { CosmeticItem, EquippedCosmetics } from '@shared/types'
import { dirs } from './paths'
import { JsonStore } from './store'

const IMG = (prompt: string): string =>
  `https://coresg-normal.trae.ai/api/ide/v1/text_to_image?prompt=${encodeURIComponent(prompt)}&image_size=square`

/** Built-in cosmetics catalog. Previews are rendered from a themed gradient. */
export const COSMETIC_CATALOG: CosmeticItem[] = [
  { id: 'cape-alpinoxi', name: 'Alpinoxi Cape', category: 'cape', textureUrl: IMG('minecraft cape, purple and cyan neon gradient, pixel art, game cosmetic icon'), animated: false, freeInMicrosoft: true, requiredForElyby: false },
  { id: 'cape-nebula', name: 'Nebula', category: 'cape', textureUrl: IMG('minecraft cape, cosmic nebula galaxy, deep blue purple stars, pixel art'), animated: true, freeInMicrosoft: true, requiredForElyby: false },
  { id: 'cape-flame', name: 'Alev', category: 'cape', textureUrl: IMG('minecraft cape, orange fire flames animated, pixel art'), animated: true, freeInMicrosoft: true, requiredForElyby: true },
  { id: 'cape-frost', name: 'Buz', category: 'cape', textureUrl: IMG('minecraft cape, ice frost crystals light blue, pixel art'), animated: false, freeInMicrosoft: true, requiredForElyby: false },
  { id: 'wings-dragon', name: 'Ejder Kanatları', category: 'wings', textureUrl: IMG('minecraft wings cosmetic, black dragon wings with purple glow, pixel art'), animated: true, freeInMicrosoft: true, requiredForElyby: true },
  { id: 'wings-angel', name: 'Melek Kanatları', category: 'wings', textureUrl: IMG('minecraft wings cosmetic, white angel feathered wings, pixel art'), animated: true, freeInMicrosoft: true, requiredForElyby: true },
  { id: 'wings-cyber', name: 'Cyber Wings', category: 'wings', textureUrl: IMG('minecraft wings cosmetic, cyberpunk neon circuit wings, pixel art'), animated: true, freeInMicrosoft: true, requiredForElyby: true },
  { id: 'hat-crown', name: 'Altın Taç', category: 'hat', textureUrl: IMG('minecraft hat cosmetic, golden king crown, pixel art'), animated: false, freeInMicrosoft: true, requiredForElyby: false },
  { id: 'hat-halo', name: 'Halo', category: 'hat', textureUrl: IMG('minecraft hat cosmetic, glowing golden halo ring, pixel art'), animated: true, freeInMicrosoft: true, requiredForElyby: false },
  { id: 'hat-viking', name: 'Viking Miğferi', category: 'hat', textureUrl: IMG('minecraft hat cosmetic, viking helmet with horns, pixel art'), animated: false, freeInMicrosoft: true, requiredForElyby: false },
  { id: 'bandana-ninja', name: 'Ninja Bandana', category: 'bandana', textureUrl: IMG('minecraft bandana cosmetic, black ninja headband, pixel art'), animated: false, freeInMicrosoft: true, requiredForElyby: false },
  { id: 'boots-rocket', name: 'Roket Botları', category: 'boots', textureUrl: IMG('minecraft boots cosmetic, rocket powered boots with flames, pixel art'), animated: true, freeInMicrosoft: true, requiredForElyby: true },
  { id: 'boots-ice', name: 'Buz Pateni', category: 'boots', textureUrl: IMG('minecraft boots cosmetic, ice skates glowing blue, pixel art'), animated: false, freeInMicrosoft: true, requiredForElyby: false },
  { id: 'back-backpack', name: 'Sırt Çantası', category: 'back', textureUrl: IMG('minecraft back accessory, brown adventure backpack, pixel art'), animated: false, freeInMicrosoft: true, requiredForElyby: false },
  { id: 'back-jetpack', name: 'Jetpack', category: 'back', textureUrl: IMG('minecraft back accessory, sci-fi jetpack with thrusters, pixel art'), animated: true, freeInMicrosoft: true, requiredForElyby: true },
  { id: 'emote-wave', name: 'El Sallama', category: 'emote', textureUrl: IMG('minecraft emote icon, waving hand, pixel art badge'), animated: true, freeInMicrosoft: true, requiredForElyby: false },
  { id: 'emote-dance', name: 'Dans', category: 'emote', textureUrl: IMG('minecraft emote icon, dancing character, pixel art badge'), animated: true, freeInMicrosoft: true, requiredForElyby: false }
]

export interface ActiveSkin {
  /** `dirs.skins` altındaki kalıcı dosya yolu */
  path: string
  /** 'classic' | 'slim' */
  model: string
}

let equippedStore: JsonStore<EquippedCosmetics> | null = null
let activeSkinStore: JsonStore<Partial<ActiveSkin>> | null = null

function equipped(): JsonStore<EquippedCosmetics> {
  if (!equippedStore) equippedStore = new JsonStore<EquippedCosmetics>(join(dirs.cosmetics, 'equipped.json'), {})
  return equippedStore
}

function activeSkinFile(): JsonStore<Partial<ActiveSkin>> {
  if (!activeSkinStore) activeSkinStore = new JsonStore<Partial<ActiveSkin>>(join(dirs.skins, 'active.json'), {})
  return activeSkinStore
}

/**
 * Oyunda (client içi) kullanılacak aktif skin'i kaydeder. QuickSkin bulunmayan
 * sürümlerde launcher bu dosyayı oyun dizinine kopyalar; böylece skin değiştirme
 * launcher tarafından yönetilir.
 */
export function setActiveSkin(filePath: string, model: 'classic' | 'slim' = 'classic'): ActiveSkin {
  const info = readPngInfo(filePath)
  const valid = (info.width === 64 && (info.height === 64 || info.height === 32)) || (info.width === 128 && info.height === 128)
  if (!valid) throw new Error('Skin 64x64, 64x32 veya 128x128 PNG olmalı')
  mkdirSync(dirs.skins, { recursive: true })
  const dest = join(dirs.skins, 'active.png')
  copyFileSync(filePath, dest)
  activeSkinFile().replace({ path: dest, model })
  return { path: dest, model }
}

export function getActiveSkin(): ActiveSkin | null {
  const rec = activeSkinFile().get()
  if (!rec.path) return null
  if (!existsSync(rec.path)) return null
  return { path: rec.path, model: rec.model ?? 'classic' }
}

/** Uploaded items are exposed through the `alpinoxi://` protocol. */
export function listCosmetics(): CosmeticItem[] {
  const uploadDir = join(dirs.cosmetics, 'uploads')
  const uploaded: CosmeticItem[] = []
  if (existsSync(uploadDir)) {
    for (const file of readdirSync(uploadDir)) {
      if (!file.endsWith('.png')) continue
      const category = file.startsWith('cape-') ? 'cape' : file.startsWith('skin-') ? 'hat' : 'back'
      uploaded.push({
        id: file.replace('.png', ''),
        name: basename(file, '.png').replace(/^(cape|skin)-/, ''),
        category: category as CosmeticItem['category'],
        textureUrl: `alpinoxi://cosmetic/${file}`,
        animated: false,
        freeInMicrosoft: true,
        requiredForElyby: false
      })
    }
  }
  return [...COSMETIC_CATALOG, ...uploaded]
}

export function getEquipped(): EquippedCosmetics {
  return equipped().get()
}

export function equipCosmetic(category: string, itemId: string | undefined): EquippedCosmetics {
  const current = { ...equipped().get() }
  if (itemId) current[category] = itemId
  else delete current[category]
  return equipped().replace(current)
}

interface PngInfo {
  width: number
  height: number
}

function readPngInfo(file: string): PngInfo {
  const buf = readFileSync(file)
  const signature = buf.subarray(0, 8).toString('hex')
  if (signature !== '89504e470d0a1a0a') throw new Error('Geçersiz PNG dosyası')
  return { width: buf.readUInt32BE(16), height: buf.readUInt32BE(20) }
}

export interface UploadResult {
  url: string
  animated: boolean
}

/**
 * Stores an uploaded skin. Accepts classic (64x64) and legacy (64x32) layouts.
 * Returns an `alpinoxi://` url the renderer can display.
 */
export function uploadSkinFile(filePath: string, model: 'classic' | 'slim' = 'classic'): UploadResult {
  const active = setActiveSkin(filePath, model)
  return { url: `alpinoxi://skin/${basename(active.path)}`, animated: false }
}

/**
 * Stores an uploaded cape. Animated capes are vertical sprite sheets
 * (height is a multiple of the frame height, e.g. 64x320 = 5 frames).
 */
export function uploadCapeFile(filePath: string): UploadResult {
  const info = readPngInfo(filePath)
  if (info.width !== 64 && info.width !== 128) throw new Error('Cape genişliği 64 veya 128 px olmalı')
  const dir = join(dirs.cosmetics, 'uploads')
  mkdirSync(dir, { recursive: true })
  const dest = join(dir, `cape-${Date.now()}.png`)
  copyFileSync(filePath, dest)
  const animated = info.height > info.width
  return { url: `alpinoxi://cosmetic/${basename(dest)}`, animated }
}

/** Splits a vertical sprite sheet into individual frames and counts them. */
export function processAnimated(filePath: string): { url: string; frames: number } {
  const info = readPngInfo(filePath)
  if (info.height <= info.width) throw new Error('Animasyonlu doku dikey şerit olmalı (yükseklik > genişlik)')
  const frames = Math.max(1, Math.floor(info.height / info.width))
  const dir = join(dirs.cosmetics, 'uploads')
  mkdirSync(dir, { recursive: true })
  const stamp = Date.now()
  const dest = join(dir, `anim-${stamp}.png`)
  copyFileSync(filePath, dest)
  writeFileSync(join(dir, `anim-${stamp}.json`), JSON.stringify({ frames, frameHeight: info.width }))
  return { url: `alpinoxi://cosmetic/${basename(dest)}`, frames }
}
