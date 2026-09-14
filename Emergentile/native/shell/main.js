#!/usr/bin/env -S gjs -m
import Gtk from 'gi://Gtk?version=3.0';
import Gdk from 'gi://Gdk?version=3.0';
import Gio from 'gi://Gio';
import GLib from 'gi://GLib';
import GObject from 'gi://GObject';
import Wnck from 'gi://Wnck?version=3.0';
import GdkPixbuf from 'gi://GdkPixbuf?version=2.0';

const APP_ID = 'org.emergentile.Shell';
const APP_DIR = GLib.getenv('EMERGENTILE_DIR') || GLib.build_filenamev([GLib.get_home_dir(), '.local', 'share', 'emergentile']);
const PREVIEW_MODE = GLib.getenv('EMERGENTILE_PREVIEW') === '1';

function label(text, css = '') {
    const widget = new Gtk.Label({ label: text, xalign: 0 });
    if (css) widget.get_style_context().add_class(css);
    return widget;
}

function commandExists(name) {
    return GLib.find_program_in_path(name) !== null;
}

function spawn(command) {
    try {
        GLib.spawn_command_line_async(command);
        return true;
    } catch (error) {
        logError(error);
        return false;
    }
}

function runFirst(commands) {
    const chosen = commands.find(([program]) => commandExists(program));
    return chosen ? spawn(chosen[1]) : false;
}

const EmergentileShell = GObject.registerClass(
class EmergentileShell extends Gtk.Application {
    constructor() {
        super({ application_id: APP_ID, flags: Gio.ApplicationFlags.FLAGS_NONE });
        this.launcherApps = [];
        this.pinsFile = GLib.build_filenamev([GLib.get_user_config_dir(), 'emergentile', 'pins.json']);
        this.pinnedIds = this.loadPins();
        this.themeFile = GLib.build_filenamev([GLib.get_user_config_dir(), 'emergentile', 'theme']);
        this.theme = this.loadTheme();
        this.edition = this.loadEdition();
        this.preferencesFile = GLib.build_filenamev([GLib.get_user_config_dir(), 'emergentile', 'settings.json']);
        this.preferences = this.loadPreferences();
        this.preferencesStamp = this.fileStamp(this.preferencesFile);
    }

    vfunc_startup() {
        super.vfunc_startup();
        Wnck.set_client_type(Wnck.ClientType.PAGER);
        this.wnckScreen = Wnck.Screen.get_default();
        const provider = new Gtk.CssProvider();
        try { provider.load_from_path(GLib.build_filenamev([APP_DIR, 'shell', 'style.css'])); }
        catch (error) { logError(error); }
        Gtk.StyleContext.add_provider_for_screen(Gdk.Screen.get_default(), provider, Gtk.STYLE_PROVIDER_PRIORITY_APPLICATION);
        this.loadEditionStyles();
    }

    loadEdition() {
        const profiles = [
            GLib.build_filenamev([GLib.get_user_config_dir(), 'emergentile', 'edition.json']),
            '/etc/emergentile/edition.json'
        ];
        for (const profile of profiles) {
            try {
                const [, contents] = GLib.file_get_contents(profile);
                return JSON.parse(new TextDecoder().decode(contents));
            } catch (_) {}
        }
        return { desktop_title: 'EmergentileGUI-1', accent: '#dc7655', logo: '', background: '' };
    }

    loadEditionStyles() {
        const accent = /^#[0-9a-fA-F]{6}$/.test(this.edition.accent || '') ? this.edition.accent : '#dc7655';
        let css = `@define-color accent ${accent};\n.theme-selected { background: ${accent}; }\n`;
        const background = String(this.preferences?.background || this.edition.background || '');
        if (background && GLib.file_test(background, GLib.FileTest.IS_REGULAR)) {
            const safePath = background.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
            css += `.desktop { background-image: url("${safePath}"); background-size: cover; background-position: center; }\n`;
        }
        if (!this.editionStyleProvider) this.editionStyleProvider = new Gtk.CssProvider();
        try { this.editionStyleProvider.load_from_data(css); }
        catch (error) { logError(error); }
        Gtk.StyleContext.add_provider_for_screen(Gdk.Screen.get_default(), this.editionStyleProvider, Gtk.STYLE_PROVIDER_PRIORITY_APPLICATION + 1);
    }

    vfunc_activate() {
        if (this.window) { this.window.present(); return; }
        this.buildDesktop();
        this.applyTheme();
        this.window.show_all();
        if (this.dockWindow) {
            this.dockWindow.show_all();
            this.positionDockWindow();
            this.updateDockVisibility();
        }
        if (!PREVIEW_MODE) this.showSessionSplash();
        // Detached GTK popovers may be mapped by a toplevel show_all() on some
        // window managers. Always begin with both panels explicitly closed.
        this.launcherPopover?.popdown();
        this.launcherPopover?.hide();
        if (!PREVIEW_MODE) {
            // Some Openbox builds ignore fullscreen requests made before a
            // desktop-type GDK window has been realized. Apply exact monitor
            // geometry now, then repeat fullscreen once the event loop runs.
            this.fitDesktopToMonitor();
            GLib.idle_add(GLib.PRIORITY_HIGH_IDLE, () => {
                this.fitDesktopToMonitor();
                this.window.fullscreen();
                return GLib.SOURCE_REMOVE;
            });
        }
        this.notify('Welcome to Emergentile', 'Your Linux desktop is ready.');
        GLib.timeout_add_seconds(GLib.PRIORITY_DEFAULT, 1, () => {
            this.reloadPreferences();
            return GLib.SOURCE_CONTINUE;
        });
    }

    defaultPreferences() {
        return { background: '', background_text: this.edition.desktop_title || 'EmergentileGUI-1', profile_picture: '', show_background_text: true, clock_popup: true, dock_autohide: true, theme: this.theme };
    }

    loadPreferences() {
        const defaults = this.defaultPreferences();
        try {
            const [, contents] = GLib.file_get_contents(this.preferencesFile);
            return Object.assign(defaults, JSON.parse(new TextDecoder().decode(contents)));
        } catch (_) { return defaults; }
    }

    fileStamp(path) {
        try {
            const info = Gio.File.new_for_path(path).query_info('time::modified,time::modified-usec', Gio.FileQueryInfoFlags.NONE, null);
            return `${info.get_attribute_uint64('time::modified')}:${info.get_attribute_uint32('time::modified-usec')}`;
        } catch (_) { return ''; }
    }

    reloadPreferences() {
        const stamp = this.fileStamp(this.preferencesFile);
        if (stamp === this.preferencesStamp) return;
        this.preferencesStamp = stamp;
        this.preferences = this.loadPreferences();
        this.theme = this.preferences.theme === 'dark' ? 'dark' : 'default';
        this.applyPreferences();
    }

    applyPreferences() {
        if (this.desktopTitle) {
            this.desktopTitle.set_text(String(this.preferences.background_text || ''));
            this.desktopTitle.set_visible(this.preferences.show_background_text !== false);
        }
        if (this.profileImage) this.updateProfileImage();
        this.loadEditionStyles();
        this.applyTheme();
        this.updateDockVisibility();
    }

    fitDesktopToMonitor() {
        const display = Gdk.Display.get_default();
        const monitor = display.get_primary_monitor() || display.get_monitor(0);
        if (!monitor) return;
        const geometry = monitor.get_geometry();
        this.window.unfullscreen();
        this.window.move(geometry.x, geometry.y);
        this.window.resize(geometry.width, geometry.height);
        this.window.set_default_size(geometry.width, geometry.height);
    }

    buildDesktop() {
        this.window = new Gtk.ApplicationWindow({
            application: this,
            title: PREVIEW_MODE ? 'Emergentile Desktop Preview' : 'Emergentile Desktop',
            decorated: PREVIEW_MODE,
            skip_taskbar_hint: !PREVIEW_MODE,
            skip_pager_hint: !PREVIEW_MODE
        });
        if (PREVIEW_MODE) {
            // A maximized normal window stays visible above the user's current
            // desktop while giving an accurate full-display shell preview.
            this.window.set_default_size(1100, 700);
            this.window.maximize();
        } else {
            this.window.set_type_hint(Gdk.WindowTypeHint.DESKTOP);
            this.window.set_resizable(false);
        }
        this.window.get_style_context().add_class('desktop');

        const overlay = new Gtk.Overlay();
        this.window.add(overlay);

        const hero = new Gtk.Box({ orientation: Gtk.Orientation.VERTICAL, spacing: 3, halign: Gtk.Align.CENTER, valign: Gtk.Align.CENTER });
        const product = label(this.edition.desktop_title || 'EmergentileGUI-1', 'greeting');
        product.set_xalign(.5);
        this.desktopTitle = product;
        product.set_text(String(this.preferences.background_text || this.edition.desktop_title || 'EmergentileGUI-1'));
        product.set_visible(this.preferences.show_background_text !== false);
        hero.pack_start(product, false, false, 0);
        overlay.add(hero);

        this.topbar = this.buildTopbar();
        this.topbar.set_halign(Gtk.Align.FILL); this.topbar.set_valign(Gtk.Align.START);
        this.topbar.set_margin_top(14); this.topbar.set_margin_left(16); this.topbar.set_margin_right(16); this.topbar.set_size_request(-1, 42);
        overlay.add_overlay(this.topbar);

        const dock = this.buildDock();
        this.dock = dock;
        dock.set_size_request(-1, 66);
        if (PREVIEW_MODE) {
            dock.set_halign(Gtk.Align.CENTER); dock.set_valign(Gtk.Align.END); dock.set_margin_bottom(34);
            overlay.add_overlay(dock);
        } else {
            this.buildDockWindow(dock);
        }

        this.notification = new Gtk.Box({ orientation: Gtk.Orientation.VERTICAL, halign: Gtk.Align.END, valign: Gtk.Align.END, margin_right: 18, margin_bottom: 90 });
        this.notification.get_style_context().add_class('notification');
        this.notification.set_no_show_all(true);
        overlay.add_overlay(this.notification);

        if (!PREVIEW_MODE) {
            this.splashRevealer = new Gtk.Revealer({
                transition_type: Gtk.RevealerTransitionType.CROSSFADE,
                transition_duration: 500,
                reveal_child: true,
                halign: Gtk.Align.FILL,
                valign: Gtk.Align.FILL,
                hexpand: true,
                vexpand: true
            });
            const splash = new Gtk.EventBox({ visible_window: true, halign: Gtk.Align.FILL, valign: Gtk.Align.FILL, hexpand: true, vexpand: true });
            splash.get_style_context().add_class('session-splash');
            const content = new Gtk.Box({ orientation: Gtk.Orientation.VERTICAL, spacing: 12, halign: Gtk.Align.CENTER, valign: Gtk.Align.CENTER });
            const customLogo = String(this.edition.logo || '');
            const logoPath = customLogo && GLib.file_test(customLogo, GLib.FileTest.IS_REGULAR) ? customLogo : GLib.build_filenamev([APP_DIR, 'assets', 'emergentile.svg']);
            const logoPixbuf = GdkPixbuf.Pixbuf.new_from_file_at_scale(logoPath, 112, 112, true);
            const mark = new Gtk.Image({ pixbuf: logoPixbuf }); mark.get_style_context().add_class('splash-logo');
            const title = label(this.edition.desktop_title || 'EmergentileGUI-1', 'splash-title'); title.set_xalign(.5);
            const subtitle = label('PREPARING YOUR DESKTOP', 'splash-subtitle'); subtitle.set_xalign(.5);
            content.pack_start(mark, false, false, 0); content.pack_start(title, false, false, 0); content.pack_start(subtitle, false, false, 0);
            const splashLayout = new Gtk.Overlay(); splashLayout.add(content);
            const project = label('The Emergentile Project', 'splash-project');
            project.set_halign(Gtk.Align.END); project.set_valign(Gtk.Align.END); project.set_margin_right(28); project.set_margin_bottom(24);
            splashLayout.add_overlay(project);
            splash.add(splashLayout); this.splashRevealer.add(splash); overlay.add_overlay(this.splashRevealer);
        }
    }

    showSessionSplash() {
        if (!this.splashRevealer) return;
        if (this.dockWindow) this.dockWindow.hide();
        this.splashRevealer.show_all();
        this.splashRevealer.set_reveal_child(true);
        // Keep the welcome screen present for 9.45 seconds, then use the
        // existing 550 ms fade/cleanup period for a 10-second total.
        GLib.timeout_add(GLib.PRIORITY_DEFAULT, 9450, () => {
            this.splashRevealer.set_reveal_child(false);
            GLib.timeout_add(GLib.PRIORITY_DEFAULT, 550, () => {
                this.splashRevealer.hide();
                if (this.dockWindow) {
                    this.dockWindow.show_all();
                    this.positionDockWindow();
                    this.updateDockVisibility();
                }
                return GLib.SOURCE_REMOVE;
            });
            return GLib.SOURCE_REMOVE;
        });
    }

    buildDockWindow(dock) {
        this.dockPointerInside = false;
        this.dockWindow = new Gtk.ApplicationWindow({
            application: this,
            title: 'Emergentile Dock',
            decorated: false,
            skip_taskbar_hint: true,
            skip_pager_hint: true,
            accept_focus: false,
            focus_on_map: false,
            resizable: false
        });
        this.dockWindow.set_type_hint(Gdk.WindowTypeHint.UTILITY);
        this.dockWindow.set_keep_above(true);
        this.dockWindow.set_app_paintable(true);
        this.dockWindow.get_style_context().add_class('dock-host');
        const rgbaVisual = this.dockWindow.get_screen().get_rgba_visual();
        if (rgbaVisual) this.dockWindow.set_visual(rgbaVisual);

        const container = new Gtk.Box({ orientation: Gtk.Orientation.VERTICAL, halign: Gtk.Align.CENTER });
        this.dockRevealer = new Gtk.Revealer({
            transition_type: Gtk.RevealerTransitionType.SLIDE_UP,
            transition_duration: 220,
            reveal_child: true
        });
        this.dockRevealer.add(dock);
        container.pack_start(this.dockRevealer, false, false, 0);

        // This narrow surface stays above application windows when the dock is
        // hidden, allowing a bottom-edge pointer gesture to reveal it.
        const sensor = new Gtk.EventBox({ visible_window: false, above_child: true });
        sensor.set_size_request(260, 5);
        container.pack_end(sensor, false, false, 0);
        this.dockWindow.add(container);

        this.dockWindow.add_events(Gdk.EventMask.ENTER_NOTIFY_MASK | Gdk.EventMask.LEAVE_NOTIFY_MASK);
        this.dockWindow.connect('enter-notify-event', () => {
            this.dockPointerInside = true;
            this.dockRevealer.set_reveal_child(true);
            this.positionDockWindow();
            return false;
        });
        this.dockWindow.connect('leave-notify-event', () => {
            this.dockPointerInside = false;
            GLib.timeout_add(GLib.PRIORITY_DEFAULT, 450, () => {
                this.updateDockVisibility();
                return GLib.SOURCE_REMOVE;
            });
            return false;
        });
        this.dockWindow.connect('size-allocate', () => this.positionDockWindow());
        GLib.timeout_add(GLib.PRIORITY_DEFAULT, 350, () => {
            this.updateDockVisibility();
            return GLib.SOURCE_CONTINUE;
        });
    }

    positionDockWindow() {
        if (!this.dockWindow) return;
        const display = Gdk.Display.get_default();
        const monitor = display.get_primary_monitor() || display.get_monitor(0);
        if (!monitor) return;
        const geometry = monitor.get_geometry();
        const width = Math.max(this.dockWindow.get_allocated_width(), 260);
        const height = Math.max(this.dockWindow.get_allocated_height(), 5);
        this.dockWindow.move(
            geometry.x + Math.round((geometry.width - width) / 2),
            geometry.y + geometry.height - height
        );
    }

    activeWindowNeedsDockSpace() {
        if (!this.wnckScreen) return false;
        this.wnckScreen.force_update();
        const active = this.wnckScreen.get_active_window();
        if (!active || active.is_skip_tasklist()) return false;
        const windowClass = active.get_class_group_name() || '';
        if (/emergentile|gjs/i.test(windowClass)) return false;
        if (active.is_fullscreen() || active.is_maximized()) return true;

        const display = Gdk.Display.get_default();
        const monitor = display.get_primary_monitor() || display.get_monitor(0);
        if (!monitor) return false;
        const monitorGeometry = monitor.get_geometry();
        const [, windowY,, windowHeight] = active.get_geometry();
        return windowY + windowHeight >= monitorGeometry.y + monitorGeometry.height - 92;
    }

    updateDockVisibility() {
        if (!this.dockRevealer) return;
        const autohide = this.preferences.dock_autohide !== false;
        const reveal = !autohide || this.dockPointerInside || !this.activeWindowNeedsDockSpace();
        if (this.dockRevealer.get_reveal_child() !== reveal) {
            this.dockRevealer.set_reveal_child(reveal);
            GLib.timeout_add(GLib.PRIORITY_DEFAULT, 240, () => {
                this.positionDockWindow();
                return GLib.SOURCE_REMOVE;
            });
        }
    }

    buildTopbar() {
        const bar = new Gtk.Box({ orientation: Gtk.Orientation.HORIZONTAL });
        bar.get_style_context().add_class('topbar');
        const brand = new Gtk.Button({ label: '▰  Emergentile', halign: Gtk.Align.START, relief: Gtk.ReliefStyle.NONE }); brand.get_style_context().add_class('brand');
        const launcher = this.buildLauncher();
        this.launcherPopover = launcher;
        launcher.set_relative_to(brand);
        launcher.set_position(Gtk.PositionType.BOTTOM);
        brand.connect('clicked', () => {
            if (launcher.get_visible()) launcher.popdown();
            else launcher.popup();
        });
        const spaces = new Gtk.Box({ spacing: 4, halign: Gtk.Align.CENTER });
        this.workspaceButtons = [];
        for (let n = 1; n <= 4; n++) {
            const b = new Gtk.EventBox({ visible_window: true, tooltip_text: `Workspace ${n}`, valign: Gtk.Align.CENTER });
            b.set_size_request(22, 8);
            b.get_style_context().add_class('workspace'); if (n === 1) b.get_style_context().add_class('workspace-active');
            b.connect('button-press-event', () => {
                this.wnckScreen.force_update();
                const workspace = this.wnckScreen.get_workspace(n - 1);
                if (workspace) workspace.activate(Gtk.get_current_event_time() || Gdk.CURRENT_TIME);
                GLib.timeout_add(GLib.PRIORITY_DEFAULT, 150, () => { this.updateWorkspaces(); return GLib.SOURCE_REMOVE; });
                return true;
            });
            this.workspaceButtons.push(b); spaces.pack_start(b, false, false, 0);
        }
        const status = new Gtk.Button({ halign: Gtk.Align.END, relief: Gtk.ReliefStyle.NONE }); status.get_style_context().add_class('status');
        const clock = label(''); clock.set_xalign(.5); status.add(clock);
        const tick = () => { clock.set_text(`⌁   ${GLib.DateTime.new_now_local().format('%H:%M')}   ▰`); return GLib.SOURCE_CONTINUE; }; tick(); GLib.timeout_add_seconds(GLib.PRIORITY_DEFAULT, 30, tick);
        const clockPopover = new Gtk.Popover({ relative_to: status, position: Gtk.PositionType.BOTTOM });
        clockPopover.get_style_context().add_class('popover');
        const clockBox = new Gtk.Box({ orientation: Gtk.Orientation.VERTICAL, spacing: 8, margin: 14 });
        const date = label(GLib.DateTime.new_now_local().format('%A, %d %B %Y'), 'launcher-title');
        clockBox.pack_start(date, false, false, 0); clockBox.pack_start(new Gtk.Calendar(), false, false, 0);
        clockPopover.add(clockBox); clockBox.show_all(); clockPopover.set_no_show_all(true); clockPopover.hide();
        this.clockPopover = clockPopover;
        status.connect('clicked', () => {
            if (this.preferences.clock_popup === false) return;
            date.set_text(GLib.DateTime.new_now_local().format('%A, %d %B %Y'));
            if (clockPopover.get_visible()) clockPopover.popdown(); else clockPopover.popup();
        });
        bar.pack_start(brand, false, false, 0); bar.set_center_widget(spaces); bar.pack_end(status, false, false, 0);
        GLib.timeout_add_seconds(GLib.PRIORITY_DEFAULT, 1, () => { this.updateWorkspaces(); return GLib.SOURCE_CONTINUE; });
        return bar;
    }

    discoverApps() {
        // Emergentile intentionally exposes the complete XDG application
        // registry, including utilities marked NoDisplay by other desktops.
        const infos = Gio.AppInfo.get_all();
        infos.sort((a,b) => a.get_display_name().localeCompare(b.get_display_name()));
        return infos;
    }

    loadPins() {
        try {
            const [, contents] = GLib.file_get_contents(this.pinsFile);
            const pins = JSON.parse(new TextDecoder().decode(contents));
            return Array.isArray(pins) ? pins.filter(id => typeof id === 'string') : [];
        } catch (_) { return []; }
    }

    savePins() {
        GLib.mkdir_with_parents(GLib.path_get_dirname(this.pinsFile), 0o755);
        GLib.file_set_contents(this.pinsFile, JSON.stringify(this.pinnedIds, null, 2));
    }

    loadTheme() {
        try {
            const [, contents] = GLib.file_get_contents(this.themeFile);
            return new TextDecoder().decode(contents).trim() === 'dark' ? 'dark' : 'default';
        } catch (_) { return 'default'; }
    }

    setTheme(theme) {
        this.theme = theme === 'dark' ? 'dark' : 'default';
        GLib.mkdir_with_parents(GLib.path_get_dirname(this.themeFile), 0o755);
        GLib.file_set_contents(this.themeFile, this.theme);
        this.applyTheme();
    }

    applyTheme() {
        const dark = this.theme === 'dark';
        // Tooltips and some GTK popup nodes live outside the main window, so
        // use GTK's native preference in addition to Emergentile's CSS.
        Gtk.Settings.get_default().set_property('gtk-application-prefer-dark-theme', dark);
        [this.window, this.topbar, this.dock, this.launcherPopover, this.clockPopover, this.notification].filter(Boolean).forEach(widget => {
            const context = widget.get_style_context();
            if (dark) context.add_class('dark'); else context.remove_class('dark');
        });
        if (this.defaultThemeButton && this.darkThemeButton) {
            const defaultContext = this.defaultThemeButton.get_style_context();
            const darkContext = this.darkThemeButton.get_style_context();
            if (dark) { darkContext.add_class('theme-selected'); defaultContext.remove_class('theme-selected'); }
            else { defaultContext.add_class('theme-selected'); darkContext.remove_class('theme-selected'); }
        }
    }

    setPinned(appId, pinned) {
        if (!appId) return;
        if (pinned && !this.pinnedIds.includes(appId)) this.pinnedIds.push(appId);
        if (!pinned) this.pinnedIds = this.pinnedIds.filter(id => id !== appId);
        this.savePins();
        this.renderPinnedApps();
        this.launcherApps.forEach(item => {
            if (item.info.get_id() === appId && item.pin.get_active() !== pinned) item.pin.set_active(pinned);
        });
    }

    buildLauncher() {
        const popover = new Gtk.Popover(); popover.get_style_context().add_class('popover');
        const box = new Gtk.Box({ orientation: Gtk.Orientation.VERTICAL }); box.get_style_context().add_class('launcher');
        const profile = new Gtk.Box({ spacing: 10, valign: Gtk.Align.CENTER });
        this.profileImage = new Gtk.Image({ pixel_size: 44 });
        this.profileImage.set_size_request(44, 44);
        const profileText = new Gtk.Box({ orientation: Gtk.Orientation.VERTICAL, valign: Gtk.Align.CENTER });
        profileText.pack_start(label(GLib.get_real_name() || GLib.get_user_name(), 'launcher-title'), false, false, 0);
        profileText.pack_start(label('Emergentile profile', 'launcher-caption'), false, false, 0);
        profile.pack_start(this.profileImage, false, false, 0); profile.pack_start(profileText, true, true, 0);
        box.pack_start(profile, false, false, 0);
        this.updateProfileImage();
        box.pack_start(label('Everything, close at hand.', 'launcher-title'), false, false, 0);
        box.pack_start(label('Installed applications', 'launcher-caption'), false, false, 0);
        const themes = new Gtk.Box({ spacing: 6 }); themes.get_style_context().add_class('theme-row');
        this.defaultThemeButton = new Gtk.Button({ label: 'Default', relief: Gtk.ReliefStyle.NONE }); this.defaultThemeButton.get_style_context().add_class('theme-button');
        this.darkThemeButton = new Gtk.Button({ label: 'Dark', relief: Gtk.ReliefStyle.NONE }); this.darkThemeButton.get_style_context().add_class('theme-button');
        this.defaultThemeButton.connect('clicked', () => this.setTheme('default'));
        this.darkThemeButton.connect('clicked', () => this.setTheme('dark'));
        themes.pack_start(this.defaultThemeButton, false, false, 0); themes.pack_start(this.darkThemeButton, false, false, 0);
        box.pack_start(themes, false, false, 0);
        const search = new Gtk.SearchEntry({ placeholder_text: 'Search installed applications…' }); search.get_style_context().add_class('search'); box.pack_start(search, false, false, 0);
        const scroll = new Gtk.ScrolledWindow({ min_content_height: 330, max_content_height: 420 });
        const list = new Gtk.ListBox({ selection_mode: Gtk.SelectionMode.NONE });
        list.set_sort_func((a, b) => (a._appName || '').localeCompare(b._appName || ''));
        this.availableApps = this.discoverApps();
        if (this.pinnedIds.length === 0 && !GLib.file_test(this.pinsFile, GLib.FileTest.EXISTS)) {
            const defaults = [/file manager|files/i, /terminal/i, /firefox|chromium|web browser/i, /settings manager|settings/i];
            this.pinnedIds = defaults.map(pattern => this.availableApps.find(app => pattern.test(app.get_display_name()))?.get_id()).filter(Boolean);
            this.savePins();
        }
        this.launcherApps = this.availableApps.map(info => {
            const button = new Gtk.Button({ relief: Gtk.ReliefStyle.NONE }); button.get_style_context().add_class('app-button');
            const row = new Gtk.Box({ spacing: 9 });
            const icon = new Gtk.Image({ gicon: info.get_icon(), pixel_size: 32 });
            const text = new Gtk.Box({ orientation: Gtk.Orientation.VERTICAL, valign: Gtk.Align.CENTER });
            text.pack_start(label(info.get_display_name(), 'app-name'), false, false, 0);
            text.pack_start(label((info.get_description() || 'Application').slice(0, 24), 'app-description'), false, false, 0);
            row.pack_start(icon, false, false, 0); row.pack_start(text, true, true, 0); button.add(row);
            button.connect('clicked', () => { try { info.launch([], null); popover.popdown(); } catch(e) { this.notify('Could not launch', e.message); } });
            const pinned = this.pinnedIds.includes(info.get_id());
            const pin = new Gtk.ToggleButton({ label: pinned ? '−' : '+', active: pinned, sensitive: Boolean(info.get_id()), tooltip_text: pinned ? 'Unpin from dock' : 'Pin to dock' });
            pin.get_style_context().add_class('pin-button');
            pin.connect('toggled', () => { const active = pin.get_active(); pin.set_label(active ? '−' : '+'); pin.set_tooltip_text(active ? 'Unpin from dock' : 'Pin to dock'); this.setPinned(info.get_id(), active); });
            const appRow = new Gtk.Box({ spacing: 4 }); appRow.pack_start(button, true, true, 0); appRow.pack_end(pin, false, false, 0);
            list.add(appRow);
            appRow.get_parent()._appName = info.get_display_name();
            return { info, button: appRow, pin };
        });
        search.connect('search-changed', () => { const q = search.get_text().toLowerCase(); this.launcherApps.forEach(({info,button}) => button.get_parent().set_visible(info.get_display_name().toLowerCase().includes(q))); });
        scroll.add(list); box.pack_start(scroll, true, true, 0); popover.add(box);
        // Map the contents now, but leave the popover surface itself hidden
        // until the brand button explicitly calls popup().
        box.show_all();
        popover.set_no_show_all(true);
        popover.hide();
        return popover;
    }

    updateProfileImage() {
        if (!this.profileImage) return;
        const path = String(this.preferences.profile_picture || '');
        try {
            if (path && GLib.file_test(path, GLib.FileTest.IS_REGULAR)) {
                const pixbuf = GdkPixbuf.Pixbuf.new_from_file_at_scale(path, 44, 44, true);
                this.profileImage.set_from_pixbuf(pixbuf);
                return;
            }
        } catch (error) { logError(error); }
        this.profileImage.set_from_icon_name('avatar-default-symbolic', Gtk.IconSize.DIALOG);
        this.profileImage.set_pixel_size(44);
    }

    buildDock() {
        const dock = new Gtk.Box({ spacing: 3 }); dock.get_style_context().add_class('dock');
        this.pinnedBox = new Gtk.Box({ spacing: 3 }); dock.pack_start(this.pinnedBox, false, false, 0);
        this.renderPinnedApps();
        const separator = new Gtk.Separator({ orientation: Gtk.Orientation.VERTICAL }); separator.get_style_context().add_class('dock-separator'); dock.pack_start(separator, false, false, 0);
        this.taskBox = new Gtk.Box({ spacing: 3 }); dock.pack_start(this.taskBox, false, false, 0);
        this.taskWindows = new Map();
        this.updateTasks();
        GLib.timeout_add_seconds(GLib.PRIORITY_DEFAULT, 1, () => { this.updateTasks(); return GLib.SOURCE_CONTINUE; });
        return dock;
    }

    renderPinnedApps() {
        if (!this.pinnedBox || !this.availableApps) return;
        this.pinnedBox.get_children().forEach(child => this.pinnedBox.remove(child));
        for (const id of this.pinnedIds) {
            const info = this.availableApps.find(app => app.get_id() === id);
            if (!info) continue;
            const button = new Gtk.Button({ relief: Gtk.ReliefStyle.NONE, tooltip_text: `${info.get_display_name()} · right-click to unpin` });
            button.get_style_context().add_class('dock-button');
            button.add(new Gtk.Image({ gicon: info.get_icon(), pixel_size: 32 }));
            button.connect('clicked', () => { try { info.launch([], null); } catch (error) { this.notify('Could not launch', error.message); } });
            button.connect('button-press-event', (_widget, event) => {
                const [, mouseButton] = event.get_button();
                if (mouseButton === 3) { this.setPinned(id, false); return true; }
                return false;
            });
            this.pinnedBox.pack_start(button, false, false, 0); button.show_all();
        }
    }

    commandOutput(command) {
        try {
            const [ok, out] = GLib.spawn_command_line_sync(command);
            return ok ? new TextDecoder().decode(out).trim() : '';
        } catch (_) { return ''; }
    }

    updateWorkspaces() {
        if (!this.workspaceButtons || !this.wnckScreen) return;
        this.wnckScreen.force_update();
        if (this.wnckScreen.get_workspace_count() < 4) this.wnckScreen.change_workspace_count(4);
        const workspace = this.wnckScreen.get_active_workspace();
        const active = workspace ? workspace.get_number() : 0;
        this.workspaceButtons.forEach((button, index) => {
            const context = button.get_style_context();
            if (index === active) context.add_class('workspace-active'); else context.remove_class('workspace-active');
        });
    }

    updateTasks() {
        if (!this.taskBox || !this.wnckScreen) return;
        this.wnckScreen.force_update();
        const activeWindow = this.wnckScreen.get_active_window();
        const activeId = activeWindow ? String(activeWindow.get_xid()) : '';
        const windows = this.wnckScreen.get_windows().filter(window => {
            const windowClass = window.get_class_group_name() || '';
            return !window.is_skip_tasklist() && !/emergentile/i.test(windowClass) && window.get_name();
        }).map(window => ({
            id: String(window.get_xid()),
            title: window.get_name(),
            window
        }));
        const ids = new Set(windows.map(window => window.id));
        for (const [id, button] of this.taskWindows) {
            if (!ids.has(id)) { this.taskBox.remove(button); this.taskWindows.delete(id); }
        }
        for (const window of windows) {
            let button = this.taskWindows.get(window.id);
            if (!button) {
                button = new Gtk.Button({ relief: Gtk.ReliefStyle.NONE, tooltip_text: window.title });
                button.get_style_context().add_class('task-button');
                const taskIcon = window.window.get_icon();
                const scaledIcon = taskIcon ? taskIcon.scale_simple(32, 32, GdkPixbuf.InterpType.BILINEAR) : null;
                const image = scaledIcon ? new Gtk.Image({ pixbuf: scaledIcon }) : new Gtk.Image({ icon_name: 'application-x-executable', pixel_size: 32 });
                image.set_size_request(32, 32);
                button.add(image);
                button.connect('clicked', () => window.window.activate(Gtk.get_current_event_time() || Gdk.CURRENT_TIME));
                this.taskBox.pack_start(button, false, false, 0); button.show_all(); this.taskWindows.set(window.id, button);
            }
            const context = button.get_style_context();
            if (window.id === activeId) context.add_class('task-button-active'); else context.remove_class('task-button-active');
        }
    }

    notify(title, body, force = false) {
        this.notification.get_children().forEach(child => this.notification.remove(child));
        this.notification.pack_start(label(`✦  ${title}`, 'notification-title'), false, false, 0);
        this.notification.pack_start(label(body, 'notification-body'), false, false, 0);
        this.notification.show_all();
        GLib.timeout_add_seconds(GLib.PRIORITY_DEFAULT, 4, () => { this.notification.hide(); return GLib.SOURCE_REMOVE; });
    }
});

new EmergentileShell().run([]);
