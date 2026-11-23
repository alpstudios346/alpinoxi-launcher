package dev.alpinoxi.mod;

import dev.alpinoxi.mod.bridge.Bridge;
import dev.alpinoxi.mod.gui.AlpinoxiScreen;
import dev.alpinoxi.mod.hud.HudRenderer;
import net.fabricmc.api.ClientModInitializer;
import net.fabricmc.fabric.api.client.event.lifecycle.v1.ClientTickEvents;
import net.fabricmc.fabric.api.client.keybinding.v1.KeyBindingHelper;
import net.fabricmc.fabric.api.client.rendering.v1.HudRenderCallback;
import net.minecraft.client.option.KeyBinding;
import net.minecraft.client.util.InputUtil;
import org.lwjgl.glfw.GLFW;

/**
 * Alpinoxi Client — oyun içi modül.
 * HUD + arkadaşlık/parti + Dawn tarzı menü; Alpinoxi Launcher ile dosya köprüsü üzerinden senkronize olur.
 */
public class AlpinoxiMod implements ClientModInitializer {
    public static final String MOD_ID = "alpinoxi";

    public static KeyBinding openMenuKey;

    @Override
    public void onInitializeClient() {
        openMenuKey = KeyBindingHelper.registerKeyBinding(new KeyBinding(
                "key.alpinoxi.menu",
                InputUtil.Type.KEYSYM,
                GLFW.GLFW_KEY_RIGHT_SHIFT,
                "category.alpinoxi"
        ));

        Bridge.init();

        ClientTickEvents.END_CLIENT_TICK.register(client -> {
            while (openMenuKey.wasPressed()) {
                if (client.currentScreen == null) {
                    client.setScreen(new AlpinoxiScreen());
                }
            }
            Bridge.tick();
        });

        HudRenderCallback.EVENT.register((context, tickDelta) -> HudRenderer.render(context));
    }
}
