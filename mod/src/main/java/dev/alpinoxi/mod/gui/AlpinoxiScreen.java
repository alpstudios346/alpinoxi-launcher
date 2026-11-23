package dev.alpinoxi.mod.gui;

import dev.alpinoxi.mod.bridge.Bridge;
import dev.alpinoxi.mod.skin.SkinSupport;
import net.minecraft.client.gui.DrawContext;
import net.minecraft.client.gui.screen.Screen;
import net.minecraft.client.gui.widget.ButtonWidget;
import net.minecraft.client.gui.widget.TextFieldWidget;
import net.minecraft.text.Text;

import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

/** Dawn tarzı, Alpinoxi markalı oyun içi menü. Sekmeler: Ana Sayfa / HUD / Arkadaşlar / Parti / Hesaplar / Ayarlar. */
public class AlpinoxiScreen extends Screen {
    private enum Tab {
        HOME("Ana Sayfa"),
        HUD("HUD"),
        FRIENDS("Arkadaşlar"),
        PARTY("Parti"),
        ACCOUNTS("Hesaplar"),
        SETTINGS("Ayarlar");

        final String label;

        Tab(String label) {
            this.label = label;
        }
    }

    private static final int SIDEBAR_W = 116;
    private static final int PAD = 8;
    private static final int HEADER_H = 32;

    /** Minecraft ana menüsündeki "splash" yazıları (assets/minecraft/texts/splashes.txt ile aynı). */
    private static final String[] SPLASHES = {
            "OneClient is the best!",
            "Alpinoxi Client!",
            "Launcher + oyun içi senkron!",
            "HUD tamamen senin kontrolünde!",
            "Essential benzeri arkadaşlık!",
            "Partiler burada!",
            "Fabric gücüyle çalışır!",
            "Dawn'dan ilham aldık!",
            "gradlew ile derlendi!",
            "Sağ Shift ile menüyü aç!",
            "Tüm sürümler için tasarlandı!"
    };

    private Tab tab = Tab.HOME;
    private TextFieldWidget friendField;
    private TextFieldWidget partyField;
    private String splash = SPLASHES[0];

    private int panelX, panelY, panelW, panelH;

    public AlpinoxiScreen() {
        super(Text.literal("Alpinoxi Client"));
    }

    @Override
    protected void init() {
        panelX = PAD;
        panelY = PAD;
        panelW = this.width - PAD * 2;
        panelH = this.height - PAD * 2;
        splash = SPLASHES[(int) (Math.random() * SPLASHES.length)];
        rebuild();
    }

    @Override
    public boolean shouldPause() {
        return false;
    }

    private void rebuild() {
        clearChildren();
        int contentX = panelX + SIDEBAR_W + 12;
        int contentW = panelW - SIDEBAR_W - 24;
        int bottom = panelY + panelH - 30;

        if (tab == Tab.FRIENDS) {
            friendField = new TextFieldWidget(this.textRenderer, contentX, bottom, contentW - 90, 20, Text.literal("Kullanıcı adı"));
            friendField.setMaxLength(32);
            addDrawableChild(friendField);
            addDrawableChild(ButtonWidget.builder(Text.literal("Arkadaş Ekle"), b -> addFriend())
                    .dimensions(contentX + contentW - 84, bottom, 84, 20).build());
        } else if (tab == Tab.PARTY) {
            partyField = new TextFieldWidget(this.textRenderer, contentX, bottom, contentW - 190, 20, Text.literal("Parti kodu"));
            partyField.setMaxLength(8);
            addDrawableChild(partyField);
            addDrawableChild(ButtonWidget.builder(Text.literal("Katıl"), b -> joinParty())
                    .dimensions(contentX + contentW - 184, bottom, 60, 20).build());
            addDrawableChild(ButtonWidget.builder(Text.literal("Oluştur"), b -> createParty())
                    .dimensions(contentX + contentW - 120, bottom, 60, 20).build());
            addDrawableChild(ButtonWidget.builder(Text.literal("Ayrıl"), b -> leaveParty())
                    .dimensions(contentX + contentW - 56, bottom, 56, 20).build());
        }
    }

    private void setTab(Tab t) {
        this.tab = t;
        rebuild();
    }

    // ---------------------------------------------------------------- actions

    private void addFriend() {
        String name = friendField == null ? "" : friendField.getText().trim();
        if (name.isEmpty()) return;
        for (Bridge.FriendDto f : Bridge.social.friends) {
            if (name.equalsIgnoreCase(f.username)) {
                friendField.setText("");
                return;
            }
        }
        Bridge.FriendDto f = new Bridge.FriendDto();
        f.id = UUID.randomUUID().toString();
        f.username = name;
        f.status = "pending";
        Bridge.social.friends.add(f);
        Bridge.write("mod");
        friendField.setText("");
    }

    private void removeFriend(String id) {
        List<Bridge.FriendDto> next = new ArrayList<>();
        for (Bridge.FriendDto f : Bridge.social.friends) {
            if (!f.id.equals(id)) next.add(f);
        }
        Bridge.social.friends = next;
        Bridge.write("mod");
    }

    private void createParty() {
        Bridge.PartyDto p = new Bridge.PartyDto();
        p.id = UUID.randomUUID().toString();
        StringBuilder code = new StringBuilder();
        String alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
        for (int i = 0; i < 6; i++) {
            code.append(alphabet.charAt((int) (Math.random() * alphabet.length())));
        }
        p.code = code.toString();
        p.hostId = Bridge.social.selfId;
        p.members = new ArrayList<>();
        Bridge.MemberDto me = new Bridge.MemberDto();
        me.id = Bridge.social.selfId;
        me.username = Bridge.social.selfName.isEmpty() ? "Sen" : Bridge.social.selfName;
        me.isHost = true;
        me.ready = true;
        p.members.add(me);
        Bridge.social.party = p;
        Bridge.write("mod");
    }

    private void joinParty() {
        String code = partyField == null ? "" : partyField.getText().trim().toUpperCase();
        if (code.isEmpty()) return;
        Bridge.PartyDto p = new Bridge.PartyDto();
        p.id = UUID.randomUUID().toString();
        p.code = code;
        p.hostId = "unknown";
        p.members = new ArrayList<>();
        Bridge.MemberDto me = new Bridge.MemberDto();
        me.id = Bridge.social.selfId;
        me.username = Bridge.social.selfName.isEmpty() ? "Sen" : Bridge.social.selfName;
        me.ready = true;
        p.members.add(me);
        Bridge.social.party = p;
        Bridge.write("mod");
        partyField.setText("");
    }

    private void leaveParty() {
        Bridge.social.party = null;
        Bridge.write("mod");
    }

    // ---------------------------------------------------------------- render

    @Override
    public void render(DrawContext ctx, int mouseX, int mouseY, float delta) {
        this.renderBackground(ctx);

        // panel
        ctx.fill(panelX, panelY, panelX + panelW, panelY + panelH, Theme.PANEL);
        ctx.fill(panelX, panelY, panelX + panelW, panelY + 2, Theme.ACCENT);

        // sidebar
        ctx.fill(panelX, panelY + 2, panelX + SIDEBAR_W, panelY + panelH, Theme.SIDEBAR);

        // header
        ctx.drawTextWithShadow(this.textRenderer, Text.literal("ALPINOXI"), panelX + 12, panelY + 10, Theme.ACCENT);
        ctx.drawTextWithShadow(this.textRenderer, Text.literal("CLIENT"), panelX + 12 + this.textRenderer.getWidth("ALPINOXI ") , panelY + 10, Theme.ACCENT_2);

        // splash (Minecraft ana menüsündeki gibi, hafif salınımlı)
        int splashW = this.textRenderer.getWidth(splash);
        int bob = (int) Math.round(Math.sin((System.currentTimeMillis() % 1600L) / 1600.0 * Math.PI * 2) * 2);
        ctx.drawTextWithShadow(this.textRenderer, Text.literal(splash), panelX + panelW - splashW - 12, panelY + 12 + bob, Theme.WARN);

        // tabs
        int ty = panelY + HEADER_H + 8;
        for (Tab t : Tab.values()) {
            boolean active = t == this.tab;
            boolean hover = isInside(mouseX, mouseY, panelX + 6, ty, SIDEBAR_W - 12, 22);
            if (active) ctx.fill(panelX + 6, ty, panelX + SIDEBAR_W - 6, ty + 22, Theme.ACCENT & 0x60FFFFFF | 0x33000000);
            else if (hover) ctx.fill(panelX + 6, ty, panelX + SIDEBAR_W - 6, ty + 22, Theme.ROW_HOVER);
            ctx.drawTextWithShadow(this.textRenderer, Text.literal(t.label), panelX + 14, ty + 7, active ? Theme.TEXT : Theme.DIM);
            ty += 26;
        }

        // status footer
        String status = Bridge.social.connected ? "Sosyal: Bağlı" : "Sosyal: Bağlı değil";
        int statusColor = Bridge.social.connected ? Theme.GOOD : Theme.BAD;
        ctx.drawTextWithShadow(this.textRenderer, Text.literal(status), panelX + 12, panelY + panelH - 26, statusColor);

        int contentX = panelX + SIDEBAR_W + 12;
        int contentW = panelW - SIDEBAR_W - 24;
        int cy = panelY + HEADER_H + 4;
        ctx.drawTextWithShadow(this.textRenderer, Text.literal(this.tab.label), contentX, cy, Theme.TEXT);
        cy += 18;

        switch (this.tab) {
            case HOME -> renderHome(ctx, contentX, cy);
            case HUD -> renderHud(ctx, contentX, cy, contentW, mouseX, mouseY);
            case FRIENDS -> renderFriends(ctx, contentX, cy, contentW, mouseX, mouseY);
            case PARTY -> renderParty(ctx, contentX, cy, contentW);
            case ACCOUNTS -> renderAccounts(ctx, contentX, cy, contentW, mouseX, mouseY);
            case SETTINGS -> renderSettings(ctx, contentX, cy);
        }

        super.render(ctx, mouseX, mouseY, delta);

        ctx.drawTextWithShadow(this.textRenderer,
                Text.literal("Sağ Shift: Menü  •  ESC: Kapat"),
                contentX, panelY + panelH - 44, Theme.DIM);
    }

    private void renderHome(DrawContext ctx, int x, int y) {
        ctx.drawTextWithShadow(this.textRenderer, Text.literal("Alpinoxi Client v1.0"), x, y, Theme.ACCENT_2);
        y += 14;
        ctx.drawTextWithShadow(this.textRenderer, Text.literal("Launcher + oyun içi senkron: HUD, arkadaşlık ve parti."), x, y, Theme.TEXT);
        y += 12;
        ctx.drawTextWithShadow(this.textRenderer, Text.literal("Hesap: " + (Bridge.social.selfName.isEmpty() ? "—" : Bridge.social.selfName)), x, y, Theme.TEXT);
        y += 12;
        ctx.drawTextWithShadow(this.textRenderer, Text.literal("Arkadaş: " + Bridge.social.friends.size()), x, y, Theme.TEXT);
        y += 12;
        ctx.drawTextWithShadow(this.textRenderer, Text.literal("Parti: " + (Bridge.social.party == null ? "yok" : Bridge.social.party.code)), x, y, Theme.TEXT);
    }

    private void renderHud(DrawContext ctx, int x, int y, int w, int mouseX, int mouseY) {
        String[][] rows = {
                {"fps", "FPS göstergesi"},
                {"cps", "CPS göstergesi"},
                {"coords", "Koordinatlar"},
                {"ping", "Ping"},
                {"memory", "Bellek kullanımı"},
                {"time", "Dünya saati"},
                {"keystrokes", "Tuş basımları (WASD)"}
        };
        for (String[] row : rows) {
            boolean on = Bridge.hud.on(row[0]);
            boolean hover = isInside(mouseX, mouseY, x, y, w, 18);
            if (hover) ctx.fill(x, y, x + w, y + 18, Theme.ROW_HOVER);
            else ctx.fill(x, y, x + w, y + 18, Theme.ROW);
            ctx.drawTextWithShadow(this.textRenderer, Text.literal(row[1]), x + 6, y + 5, Theme.TEXT);
            ctx.drawTextWithShadow(this.textRenderer, Text.literal(on ? "AÇIK" : "KAPALI"), x + w - 48, y + 5, on ? Theme.GOOD : Theme.BAD);
            y += 20;
        }
        y += 4;
        boolean right = "right".equalsIgnoreCase(Bridge.hud.layout);
        ctx.drawTextWithShadow(this.textRenderer, Text.literal("Yerleşim: " + (right ? "Sağ" : "Sol") + "  (sol tık ile değiştir)"), x, y, Theme.DIM);
        y += 12;
        ctx.drawTextWithShadow(this.textRenderer, Text.literal(String.format("Ölçek: %.2f", Bridge.hud.scale)), x, y, Theme.DIM);
    }

    private void renderFriends(DrawContext ctx, int x, int y, int w, int mouseX, int mouseY) {
        if (Bridge.social.friends.isEmpty()) {
            ctx.drawTextWithShadow(this.textRenderer, Text.literal("Henüz arkadaş yok. Aşağıdan ekle."), x, y, Theme.DIM);
            return;
        }
        for (Bridge.FriendDto f : Bridge.social.friends) {
            boolean hover = isInside(mouseX, mouseY, x, y, w - 90, 18);
            ctx.fill(x, y, x + w - 90, y + 18, hover ? Theme.ROW_HOVER : Theme.ROW);
            ctx.drawTextWithShadow(this.textRenderer, Text.literal(f.username), x + 6, y + 5, Theme.TEXT);
            ctx.drawTextWithShadow(this.textRenderer, Text.literal(f.status), x + w - 130, y + 5, Theme.DIM);
            ctx.drawTextWithShadow(this.textRenderer, Text.literal("[x]"), x + w - 100, y + 5, Theme.BAD);
            y += 20;
        }
    }

    private void renderParty(DrawContext ctx, int x, int y, int w) {
        Bridge.PartyDto p = Bridge.social.party;
        if (p == null) {
            ctx.drawTextWithShadow(this.textRenderer, Text.literal("Aktif parti yok. Aşağıdan oluştur veya koda katıl."), x, y, Theme.DIM);
            return;
        }
        ctx.drawTextWithShadow(this.textRenderer, Text.literal("Kod: " + p.code), x, y, Theme.ACCENT_2);
        y += 14;
        for (Bridge.MemberDto m : p.members) {
            String label = (m.isHost ? "[Host] " : "") + m.username + (m.ready ? " ✓" : " …");
            ctx.fill(x, y, x + w, y + 18, Theme.ROW);
            ctx.drawTextWithShadow(this.textRenderer, Text.literal(label), x + 6, y + 5, Theme.TEXT);
            y += 20;
        }
    }

    private void renderAccounts(DrawContext ctx, int x, int y, int w, int mouseX, int mouseY) {
        if (Bridge.accounts.isEmpty()) {
            ctx.drawTextWithShadow(this.textRenderer, Text.literal("Hesap bulunamadı. Launcher'dan hesap ekleyin."), x, y, Theme.DIM);
            return;
        }
        for (Bridge.AccountDto a : Bridge.accounts) {
            boolean active = a.id != null && a.id.equals(Bridge.activeAccountId);
            boolean hover = isInside(mouseX, mouseY, x, y, w, 18);
            ctx.fill(x, y, x + w, y + 18, active ? Theme.ROW_ACTIVE : (hover ? Theme.ROW_HOVER : Theme.ROW));
            String label = (active ? "● " : "○ ") + a.username;
            ctx.drawTextWithShadow(this.textRenderer, Text.literal(label), x + 6, y + 5, active ? Theme.TEXT : Theme.DIM);
            ctx.drawTextWithShadow(this.textRenderer, Text.literal(a.type), x + w - 70, y + 5, Theme.ACCENT_2);
            y += 20;
        }
        y += 4;
        ctx.drawTextWithShadow(this.textRenderer, Text.literal("Hesap değişikliği bir sonraki başlatmada etkin olur."), x, y, Theme.DIM);
    }

    private void renderSettings(DrawContext ctx, int x, int y) {
        ctx.drawTextWithShadow(this.textRenderer, Text.literal("Menü tuşu: Sağ Shift"), x, y, Theme.TEXT);
        y += 12;
        ctx.drawTextWithShadow(this.textRenderer, Text.literal("Köprü dosyası: config/alpinoxi-bridge.json"), x, y, Theme.DIM);
        y += 12;
        ctx.drawTextWithShadow(this.textRenderer, Text.literal("Ağ bağlantısı launcher tarafından yönetilir."), x, y, Theme.DIM);
        y += 12;
        ctx.drawTextWithShadow(this.textRenderer, Text.literal("Skin modu: " + SkinSupport.mode()), x, y, Theme.ACCENT_2);
        y += 12;
        String skin = SkinSupport.skinPath();
        ctx.drawTextWithShadow(this.textRenderer,
                Text.literal(skin.isEmpty() ? "Skin: launcher'dan bir skin yükleyin." : "Skin: aktif"),
                x, y, Theme.DIM);
    }

    // ---------------------------------------------------------------- input

    @Override
    public boolean mouseClicked(double mouseX, double mouseY, int button) {
        int ty = panelY + HEADER_H + 8;
        for (Tab t : Tab.values()) {
            if (isInside(mouseX, mouseY, panelX + 6, ty, SIDEBAR_W - 12, 22)) {
                setTab(t);
                return true;
            }
            ty += 26;
        }

        int contentX = panelX + SIDEBAR_W + 12;
        int contentW = panelW - SIDEBAR_W - 24;
        int cy = panelY + HEADER_H + 22;

        if (this.tab == Tab.HUD) {
            String[] keys = {"fps", "cps", "coords", "ping", "memory", "time", "keystrokes"};
            for (String key : keys) {
                if (isInside(mouseX, mouseY, contentX, cy, contentW, 18)) {
                    Bridge.hud.toggle(key);
                    Bridge.write("mod");
                    return true;
                }
                cy += 20;
            }
            cy += 4;
            if (isInside(mouseX, mouseY, contentX, cy, contentW, 12)) {
                Bridge.hud.layout = "right".equalsIgnoreCase(Bridge.hud.layout) ? "left" : "right";
                Bridge.write("mod");
                return true;
            }
        } else if (this.tab == Tab.FRIENDS) {
            for (Bridge.FriendDto f : Bridge.social.friends) {
                if (isInside(mouseX, mouseY, contentX + contentW - 110, cy, 20, 18)) {
                    removeFriend(f.id);
                    return true;
                }
                cy += 20;
            }
        } else if (this.tab == Tab.ACCOUNTS) {
            for (Bridge.AccountDto a : Bridge.accounts) {
                if (isInside(mouseX, mouseY, contentX, cy, contentW, 18)) {
                    Bridge.selectAccount(a.id);
                    return true;
                }
                cy += 20;
            }
        }

        return super.mouseClicked(mouseX, mouseY, button);
    }

    private static boolean isInside(double mx, double my, int x, int y, int w, int h) {
        return mx >= x && mx <= x + w && my >= y && my <= y + h;
    }
}
