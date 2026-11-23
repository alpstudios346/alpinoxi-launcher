package dev.alpinoxi.mod.bridge;

import com.google.gson.Gson;
import com.google.gson.GsonBuilder;
import net.minecraft.client.MinecraftClient;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * Launcher ile oyun içi modül arasındaki dosya köprüsü.
 * Tek bir JSON dosyası (config/alpinoxi-bridge.json) her iki tarafça okunur/yazılır.
 * Ağ bağlantısının sahibi launcher'dır; mod yalnızca bu dosyayı düzenler ve okur.
 */
public final class Bridge {
    private static final Gson GSON = new GsonBuilder().setPrettyPrinting().create();

    private static java.io.File file;
    private static int tick;

    public static HudConfig hud = new HudConfig();
    public static SocialState social = new SocialState();

    /** Launcher'ın yazdığı, oyun içi kullanılacak skin yolu (varsa). */
    public static String skinPath = "";
    public static String skinModel = "classic";

    private Bridge() {}

    public static void init() {
        java.io.File run = MinecraftClient.getInstance().runDirectory;
        java.io.File dir = new java.io.File(run, "config");
        if (!dir.exists() && !dir.mkdirs()) {
            // yoksay — dosya yazımı sırasında tekrar denenir
        }
        file = new java.io.File(dir, "alpinoxi-bridge.json");
        read();
    }

    public static synchronized void read() {
        if (file == null || !file.exists()) return;
        try {
            String json = new String(Files.readAllBytes(file.toPath()), StandardCharsets.UTF_8);
            Payload p = GSON.fromJson(json, Payload.class);
            if (p != null) {
                if (p.hud != null) hud = p.hud;
                if (p.social != null) social = p.social;
                if (p.skinPath != null) skinPath = p.skinPath;
                if (p.skinModel != null) skinModel = p.skinModel;
            }
        } catch (Exception ignored) {
            // bozuk dosya — mevcut durum korunur
        }
    }

    public static synchronized void write() {
        write("mod");
    }

    public static synchronized void write(String source) {
        if (file == null) return;
        try {
            if (!file.getParentFile().exists()) file.getParentFile().mkdirs();
            Payload p = new Payload();
            p.hud = hud;
            p.social = social;
            p.skinPath = skinPath;
            p.skinModel = skinModel;
            p.source = source;
            p.updatedAt = System.currentTimeMillis();
            Files.write(file.toPath(), GSON.toJson(p).getBytes(StandardCharsets.UTF_8));
        } catch (IOException ignored) {
            // yazılamadı — sessizce geç
        }
    }

    public static void tick() {
        if (++tick % 40 == 0) read();
    }

    public static class Payload {
        public HudConfig hud;
        public SocialState social;
        public String skinPath = "";
        public String skinModel = "classic";
        public String source = "mod";
        public long updatedAt;
    }

    public static class HudConfig {
        public boolean enabled = true;
        public float scale = 1.0f;
        public String layout = "left";
        public String accent = "#7C5CFF";
        public Map<String, Boolean> elements = defaults();

        private static Map<String, Boolean> defaults() {
            Map<String, Boolean> m = new LinkedHashMap<>();
            m.put("fps", true);
            m.put("cps", true);
            m.put("coords", true);
            m.put("ping", false);
            m.put("keystrokes", false);
            m.put("memory", false);
            m.put("time", false);
            return m;
        }

        public boolean on(String key) {
            Boolean v = elements == null ? null : elements.get(key);
            return v != null && v;
        }

        public void toggle(String key) {
            if (elements == null) elements = defaults();
            elements.put(key, !on(key));
        }
    }

    public static class SocialState {
        public String selfId = "";
        public String selfName = "";
        public boolean connected = false;
        public List<FriendDto> friends = new ArrayList<>();
        public PartyDto party = null;
    }

    public static class FriendDto {
        public String id;
        public String username;
        public String status = "offline";
    }

    public static class PartyDto {
        public String id;
        public String code;
        public String hostId;
        public List<MemberDto> members = new ArrayList<>();
    }

    public static class MemberDto {
        public String id;
        public String username;
        public boolean isHost;
        public boolean ready;
    }
}
