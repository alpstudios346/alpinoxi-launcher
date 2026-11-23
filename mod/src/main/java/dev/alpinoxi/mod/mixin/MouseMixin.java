package dev.alpinoxi.mod.mixin;

import dev.alpinoxi.mod.hud.HudRenderer;
import net.minecraft.client.Mouse;
import org.spongepowered.asm.mixin.Mixin;
import org.spongepowered.asm.mixin.injection.At;
import org.spongepowered.asm.mixin.injection.Inject;
import org.spongepowered.asm.mixin.injection.callback.CallbackInfo;

/** CPS (clicks per second) sayımı için fare tıklamalarını yakalar. */
@Mixin(Mouse.class)
public class MouseMixin {
    @Inject(method = "onMouseButton", at = @At("HEAD"))
    private void alpinoxi$onMouseButton(long window, int button, int action, int mods, CallbackInfo ci) {
        if (button == 0 || button == 1) {
            HudRenderer.onMouseButton(action);
        }
    }
}
