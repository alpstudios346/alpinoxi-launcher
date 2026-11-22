import type { LoaderType, ProgressEvent } from '@shared/types'
import { getVersions, installWithDependencies } from './modrinth'
import type { Instance } from '@shared/types'

export const ALPINOXI_FEATURES = [
  'performance',
  'hud',
  'cosmetics',
  'skin-changer',
  'friends',
  'party',
  'smooth-fonts',
  'fps-boost'
] as const

export interface ClientMod {
  slug: string
  name: string
  /** which loaders this mod is available for */
  loaders?: LoaderType[]
  /** minimum minecraft version (inclusive) */
  minMc?: string
  description: string
}

/**
 * The curated Alpinoxi Client mod set. Everything here is fetched from Modrinth
 * at install time so we never ship third-party binaries in the repo.
 */
export const ALPINOXI_MODS: ClientMod[] = [
  { slug: 'fabric-api', name: 'Fabric API', loaders: ['fabric', 'alpinoxi'], description: 'Temel Fabric kütüphanesi' },
  { slug: 'sodium', name: 'Sodium', description: 'Modern render optimizasyonu' },
  { slug: 'lithium', name: 'Lithium', description: 'Sunucu/istemci oyun mantığı optimizasyonu' },
  { slug: 'ferrite-core', name: 'FerriteCore', description: 'Bellek kullanımını azaltır' },
  { slug: 'iris', name: 'Iris Shaders', description: 'Shader desteği (Sodium uyumlu)' },
  { slug: 'krypton', name: 'Krypton', description: 'Ağ yığını optimizasyonu' },
  { slug: 'immediately-fast', name: 'ImmediatelyFast', description: 'Render hızlandırma' },
  { slug: 'entityculling', name: 'EntityCulling', description: 'Görünmeyen varlıkları çizmez' },
  { slug: 'moreculling', name: 'More Culling', description: 'Ek culling optimizasyonları' },
  { slug: 'dynamic-fps', name: 'Dynamic FPS', description: 'Arka planda FPS düşürür' },
  { slug: 'memoryleakfix', name: 'Memory Leak Fix', description: 'Bellek sızıntılarını giderir' },
  { slug: 'debugify', name: 'Debugify', description: 'Hata düzeltmeleri + performans' },
  { slug: 'modmenu', name: 'Mod Menu', loaders: ['fabric', 'alpinoxi'], description: 'Mod listesi arayüzü' },
  { slug: 'noisium', name: 'Noisium', minMc: '1.20', description: 'Dünya üretimi optimizasyonu' },
  { slug: 'c2me-fabric', name: 'C2ME', minMc: '1.19', description: 'Çok çekirdekli chunk yüklemesi' },
  { slug: 'kronhud', name: 'KronHUD', loaders: ['fabric', 'alpinoxi'], description: 'FPS/CPS/koordinat HUD katmanı' },
  { slug: 'smooth-swapping', name: 'Smooth Swapping', minMc: '1.19', description: 'Envanter animasyonları' },
  { slug: 'zoomify', name: 'Zoomify', description: 'Optifine tarzı zoom' }
]

function supports(mod: ClientMod, mcVersion: string, loader: LoaderType): boolean {
  if (mod.loaders && !mod.loaders.includes(loader)) return false
  if (mod.minMc) {
    const [a, b] = mcVersion.split('.').map((n) => parseInt(n, 10))
    const [c, d] = mod.minMc.split('.').map((n) => parseInt(n, 10))
    if (a !== c) return a < c
    return (b ?? 0) < (d ?? 0)
  }
  return true
}

function effectiveLoader(loader: LoaderType): LoaderType {
  return loader === 'alpinoxi' ? 'fabric' : loader
}

export interface InstallPackResult {
  installed: string[]
  skipped: string[]
}

/** Installs the Alpinoxi Client mod set for an instance (Fabric/Quilt only). */
export async function installClientPack(
  instance: Instance,
  onProgress: (e: ProgressEvent) => void
): Promise<InstallPackResult> {
  const loader = effectiveLoader(instance.loader)
  const installed: string[] = []
  const skipped: string[] = []

  if (loader !== 'fabric' && loader !== 'quilt') {
    // Non-optimised loaders: the "client" still works, it just has no bundled mods.
    onProgress({
      phase: 'mods',
      message: `${instance.loader} için dahili mod paketi yok, istemci ayarları uygulanacak.`
    })
    return { installed, skipped: ALPINOXI_MODS.map((m) => m.slug) }
  }

  const candidates = ALPINOXI_MODS.filter((m) => supports(m, instance.mcVersion, loader))
  let index = 0
  const seen = new Set<string>()

  for (const mod of candidates) {
    index++
    onProgress({
      phase: 'mods',
      message: `${mod.name} indiriliyor…`,
      current: index,
      total: candidates.length,
      percent: Math.round((index / candidates.length) * 100)
    })
    try {
      const versions = await getVersions(mod.slug, { mcVersion: instance.mcVersion, loader: 'fabric' })
      const version = versions[0]
      if (!version) {
        skipped.push(mod.slug)
        continue
      }
      const files = await installWithDependencies(instance.id, version, instance.mcVersion, 'fabric', seen)
      installed.push(...files)
    } catch {
      skipped.push(mod.slug)
    }
  }

  return { installed, skipped }
}
