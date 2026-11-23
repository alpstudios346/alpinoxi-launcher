package dev.alpinoxi.mod.hud;

import dev.alpinoxi.mod.bridge.Bridge;
import net.minecraft.client.MinecraftClient;
import net.minecraft.client.gui.DrawContext;
import net.minecraft.text.Text;

import java.util.ArrayDeque;

/** Oyun içi HUD katmanları: FPS, CPS, koordinat, ping, keystrokes, bellek, saat. */
public final class HudRenderer {
    private static final ArrayDeque<Long> LEFT_CLICKS = new ArrayDeque<>();
    private static int cps;

    private HudRenderer() {}

    public static void onMouseButton(int action) {
        if (action == 1) LEFT_CLICKS.add(System.currentTimeMillis());
    }

    private static void updateCps() {
        long now = System.currentTimeMillis();
        while (!LEFT_CLICKS.isEmpty() && now - LEFT_CLICKS.peekFirst() > 1000L) {
            LEFT_CLICKS.pollFirst();
        }
        cps = LEFT_CLICKS.size();
    }

    private static int color(String hex, int alpha) {
        try {
            int rgb = Integer.parseInt(hex.replace("#", ""), 16);
            return (alpha << 24) | rgb;
        } catch (Exception e) {
            return (alpha << 24) | 0x7C5CFF;
        }
    }

    public static void render(DrawContext ctx) {
        MinecraftClient client = MinecraftClient.getInstance();
        Bridge.HudConfig hud = Bridge.hud;
        if (hud == null || !hud.enabled) return;
        if (client.player == null || client.options.hudHidden) return;

        updateCps();

        int accent = color(hud.accent, 255);
        int white = 0xFFFFFFFF;
        int shadow = 0xC0000000;

        ctx.getMatrices().push();
        ctx.getMatrices().scale(hud.scale, hud.scale, 1.0f);

        int screenW = (int) (client.getWindow().getScaledWidth() / hud.scale);
        int line = 10;
        int x = "right".equalsIgnoreCase(hud.layout) ? screenW - 4 : 4;
        int y = 4;
        boolean right = "right".equalsIgnoreCase(hud.layout);

        if (hud.on("fps")) {
            draw(ctx, client, "FPS: " + client.getCurrentFps(), x, y, accent, right);
            y += line;
        }
        if (hud.on("cps")) {
            draw(ctx, client, "CPS: " + cps, x, y, accent, right);
            y += line;
        }
        if (hud.on("coords")) {
            String c = String.format("XYZ: %.1f %.1f %.1f",
                    client.player.getX(), client.player.getY(), client.player.getZ());
            draw(ctx, client, c, x, y, white, right);
            y += line;
        }
        if (hud.on("ping")) {
            int ping = 0;
            if (client.getNetworkHandler() != null && client.player != null) {
                var entry = client.getNetworkHandler().getPlayerListEntry(client.player.getUuid());
                if (entry != null) ping = entry.getLatency();
            }
            draw(ctx, client, "Ping: " + ping + "ms", x, y, white, right);
            y += line;
        }
        if (hud.on("memory")) {
            Runtime rt = Runtime.getRuntime();
            long used = (rt.totalMemory() - rt.freeMemory()) / 1048576L;
            long max = rt.maxMemory() / 1048576L;
            draw(ctx, client, "RAM: " + used + "/" + max + "MB", x, y, white, right);
            y += line;
        }
        if (hud.on("time")) {
            long t = client.world != null ? client.world.getTimeOfDay() % 24000L : 0L;
            draw(ctx, client, "Saat: " + t, x, y, white, right);
            y += line;
        }
        if (hud.on("keystrokes")) {
            y += 2;
            draw(ctx, client, "WASD", x, y, accent, right);
            y += line;
            String keys = (pressed(client.options.forwardKey) ? "W " : "- ")
                    + (pressed(client.options.leftKey) ? "A " : "- ")
                    + (pressed(client.options.backKey) ? "S " : "- ")
                    + (pressed(client.options.rightKey) ? "D" : "-");
            draw(ctx, client, keys, x, y, white, right);
        }

        ctx.getMatrices().pop();
    }

    private static boolean pressed(net.minecraft.client.option.KeyBinding key) {
        return key != null && key.isPressed();
    }

    private static void draw(DrawContext ctx, MinecraftClient client, String text, int x, int y, int color, boolean right) {
        int width = client.textRenderer.getWidth(text);
        ctx.drawTextWithShadow(client.textRenderer, Text.literal(text), right ? x - width : x, y, color);
    }
}
