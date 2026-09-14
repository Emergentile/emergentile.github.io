#!/usr/bin/env -S gjs -m
import Gtk from 'gi://Gtk?version=3.0';
import Gio from 'gi://Gio';
import GLib from 'gi://GLib';

const SETTINGS_DIR = GLib.build_filenamev([GLib.get_user_config_dir(), 'emergentile']);
const SETTINGS_FILE = GLib.build_filenamev([SETTINGS_DIR, 'settings.json']);

function readSettings() {
    const defaults = { background: '', background_text: 'EmergentileGUI-1', profile_picture: '', show_background_text: true, clock_popup: true, dock_autohide: true, theme: 'default' };
    try {
        const [, data] = GLib.file_get_contents(SETTINGS_FILE);
        return Object.assign(defaults, JSON.parse(new TextDecoder().decode(data)));
    } catch (_) { return defaults; }
}

function addRow(grid, row, title, widget) {
    grid.attach(new Gtk.Label({ label: title, xalign: 0, hexpand: true }), 0, row, 1, 1);
    grid.attach(widget, 1, row, 1, 1);
}

const app = new Gtk.Application({ application_id: 'org.emergentile.Settings', flags: Gio.ApplicationFlags.FLAGS_NONE });
app.connect('activate', () => {
    const settings = readSettings();
    const win = new Gtk.ApplicationWindow({ application: app, title: 'Emergentile Settings', default_width: 620, default_height: 520, window_position: Gtk.WindowPosition.CENTER });
    win.set_titlebar(new Gtk.HeaderBar({ title: 'Emergentile Settings', subtitle: 'Personalize your desktop', show_close_button: true }));
    const outer = new Gtk.Box({ orientation: Gtk.Orientation.VERTICAL, spacing: 18, margin: 24 });
    const grid = new Gtk.Grid({ row_spacing: 16, column_spacing: 24, hexpand: true });
    const wallpaper = new Gtk.FileChooserButton({ title: 'Choose a background image', action: Gtk.FileChooserAction.OPEN });
    const filter = new Gtk.FileFilter(); filter.set_name('Images'); filter.add_mime_type('image/png'); filter.add_mime_type('image/jpeg'); filter.add_mime_type('image/webp'); filter.add_mime_type('image/svg+xml'); wallpaper.add_filter(filter);
    if (settings.background && GLib.file_test(settings.background, GLib.FileTest.IS_REGULAR)) wallpaper.set_filename(settings.background);
    const text = new Gtk.Entry({ text: String(settings.background_text || ''), width_chars: 24 });
    const profilePicture = new Gtk.FileChooserButton({ title: 'Choose a profile picture', action: Gtk.FileChooserAction.OPEN });
    profilePicture.add_filter(filter);
    if (settings.profile_picture && GLib.file_test(settings.profile_picture, GLib.FileTest.IS_REGULAR)) profilePicture.set_filename(settings.profile_picture);
    const showText = new Gtk.Switch({ active: settings.show_background_text !== false, halign: Gtk.Align.END });
    const clockPopup = new Gtk.Switch({ active: settings.clock_popup !== false, halign: Gtk.Align.END });
    const dockAutohide = new Gtk.Switch({ active: settings.dock_autohide !== false, halign: Gtk.Align.END });
    const theme = new Gtk.ComboBoxText(); theme.append('default', 'Default'); theme.append('dark', 'Dark'); theme.set_active_id(settings.theme === 'dark' ? 'dark' : 'default');
    addRow(grid, 0, 'Profile picture', profilePicture); addRow(grid, 1, 'Background image', wallpaper); addRow(grid, 2, 'Background text', text);
    addRow(grid, 3, 'Show background text', showText); addRow(grid, 4, 'Show popup when clock is clicked', clockPopup);
    addRow(grid, 5, 'Intelligent dock auto-hide', dockAutohide); addRow(grid, 6, 'Appearance', theme);
    const hint = new Gtk.Label({ label: 'Changes apply to the Emergentile desktop automatically.', xalign: 0 });
    hint.get_style_context().add_class('dim-label');
    const actions = new Gtk.ButtonBox({ layout_style: Gtk.ButtonBoxStyle.END, spacing: 8 });
    const reset = new Gtk.Button({ label: 'Reset defaults' }); const apply = new Gtk.Button({ label: 'Apply' });
    apply.get_style_context().add_class('suggested-action'); actions.add(reset); actions.add(apply);
    const save = () => {
        GLib.mkdir_with_parents(SETTINGS_DIR, 0o755);
        const values = { profile_picture: profilePicture.get_filename() || '', background: wallpaper.get_filename() || '', background_text: text.get_text(), show_background_text: showText.get_active(), clock_popup: clockPopup.get_active(), dock_autohide: dockAutohide.get_active(), theme: theme.get_active_id() || 'default' };
        GLib.file_set_contents(SETTINGS_FILE, JSON.stringify(values, null, 2) + '\n');
        hint.set_text('Saved — the desktop will update within one second.');
    };
    apply.connect('clicked', save);
    reset.connect('clicked', () => { profilePicture.unselect_all(); wallpaper.unselect_all(); text.set_text('EmergentileGUI-1'); showText.set_active(true); clockPopup.set_active(true); dockAutohide.set_active(true); theme.set_active_id('default'); save(); });
    outer.pack_start(grid, true, true, 0); outer.pack_start(hint, false, false, 0); outer.pack_end(actions, false, false, 0);
    win.add(outer); win.show_all();
});
app.run([]);
