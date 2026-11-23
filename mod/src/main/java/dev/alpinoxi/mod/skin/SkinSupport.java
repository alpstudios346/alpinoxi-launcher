package dev.alpinoxi.mod.skin;

import dev.alpinoxi.mod.bridge.Bridge;
import net.fabricmc.loader.api.FabricLoader;

/**
 * Skin yönetimi.
 *
 * <p>QuickSkin yalnızca 1.20.1 için yayınlandığından skin davranışı sürüme göre değişir:
 * <ul>
 *   <li>1.20.1 + QuickSkin kurulu: oyun içi skin değiştirmeyi QuickSkin üstlenir.</li>
 *   <li>Diğer sürümler: QuickSkin bulunmadığından skin, launcher (client içi) tarafından
 *       yönetilir; mod yalnızca launcher'ın köprüye yazdığı skin yolunu bilir.</li>
 * </ul>
 */
public final class SkinSupport {
    private SkinSupport() {}

    public static boolean quickSkinPresent() {
        return FabricLoader.getInstance().isModLoaded("quickskin");
    }

    public static boolean launcherManaged() {
        return !quickSkinPresent();
    }

    public static String mode() {
        return quickSkinPresent() ? "QuickSkin (oyun içi)" : "Launcher (client içi)";
    }

    public static String skinPath() {
        return Bridge.skinPath == null ? "" : Bridge.skinPath;
    }
}
