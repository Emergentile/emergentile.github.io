#!/usr/bin/env -S gjs -m
import Gtk from 'gi://Gtk?version=3.0';
import Gdk from 'gi://Gdk?version=3.0';
import Gio from 'gi://Gio';
import GLib from 'gi://GLib';

const app = new Gtk.Application({ application_id: 'org.emergentile.Dev' });

function row(grid, position, title, widget) {
    const text = new Gtk.Label({ label: title, xalign: 0 });
    grid.attach(text, 0, position, 1, 1); grid.attach(widget, 1, position, 1, 1);
}

function slugify(value) {
    return value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'custom-emergentile';
}

function copyAsset(source, destinationDirectory, name) {
    if (!source) return '';
    const extensionMatch = source.match(/\.[a-zA-Z0-9]+$/);
    const extension = extensionMatch ? extensionMatch[0].toLowerCase() : '';
    const destination = GLib.build_filenamev([destinationDirectory, `${name}${extension}`]);
    Gio.File.new_for_path(source).copy(Gio.File.new_for_path(destination), Gio.FileCopyFlags.OVERWRITE, null, null);
    return destination;
}

function findProject() {
    const candidates = [GLib.getenv('EMERGENTILE_PROJECT_DIR'), GLib.build_filenamev([GLib.get_home_dir(), 'Emergentile']), GLib.build_filenamev([GLib.get_home_dir(), 'EmergentileGUI']), '/usr/local/src/emergentile'].filter(Boolean);
    return candidates.find(path => GLib.file_test(GLib.build_filenamev([path, 'image-build', 'build.sh']), GLib.FileTest.IS_REGULAR) && GLib.access(path, 2) === 0) || '';
}

app.connect('activate', () => {
    const win = new Gtk.ApplicationWindow({ application: app, title: 'Emergentile Dev', default_width: 760, default_height: 690, window_position: Gtk.WindowPosition.CENTER });
    const header = new Gtk.HeaderBar({ title: 'Emergentile Dev', subtitle: 'Design and build your own OS edition', show_close_button: true }); win.set_titlebar(header);
    const root = new Gtk.Box({ orientation: Gtk.Orientation.VERTICAL, spacing: 16, margin: 24 });
    const intro = new Gtk.Label({ label: 'Customize Emergentile branding and produce a bootable Debian-based ISO or IMG.', xalign: 0, wrap: true }); root.pack_start(intro, false, false, 0);

    const grid = new Gtk.Grid({ row_spacing: 12, column_spacing: 18, column_homogeneous: false });
    const osName = new Gtk.Entry({ text: 'EmergentileGUI', hexpand: true }); row(grid, 0, 'OS name', osName);
    const version = new Gtk.Entry({ text: '1' }); row(grid, 1, 'Version', version);
    const desktopTitle = new Gtk.Entry({ text: 'EmergentileGUI-1' }); row(grid, 2, 'Desktop title', desktopTitle);
    const accent = new Gtk.ColorButton({ use_alpha: false }); const initialColor = new Gdk.RGBA(); initialColor.parse('#dc7655'); accent.set_rgba(initialColor); row(grid, 3, 'Accent color', accent);
    const background = new Gtk.FileChooserButton({ title: 'Choose a wallpaper', action: Gtk.FileChooserAction.OPEN }); row(grid, 4, 'Wallpaper', background);
    const logo = new Gtk.FileChooserButton({ title: 'Choose a logo', action: Gtk.FileChooserAction.OPEN }); row(grid, 5, 'Logo', logo);
    const imageFilter = new Gtk.FileFilter(); imageFilter.set_name('Images'); imageFilter.add_mime_type('image/png'); imageFilter.add_mime_type('image/jpeg'); imageFilter.add_mime_type('image/svg+xml'); background.add_filter(imageFilter); logo.add_filter(imageFilter);
    const base = new Gtk.ComboBoxText(); base.append('trixie', 'Debian Trixie'); base.append('bookworm', 'Debian Bookworm'); base.set_active_id('trixie'); row(grid, 6, 'Linux base', base);
    const architecture = new Gtk.ComboBoxText(); architecture.append('amd64', 'AMD64 / Intel 64-bit'); architecture.append('arm64', 'ARM64'); architecture.set_active_id('amd64'); row(grid, 7, 'Architecture', architecture);
    const format = new Gtk.ComboBoxText(); format.append('iso', 'Bootable ISO'); format.append('img', 'Disk IMG'); format.set_active_id('iso'); row(grid, 8, 'Output format', format);
    root.pack_start(grid, false, false, 0);

    const status = new Gtk.Label({ label: 'Ready', xalign: 0, wrap: true }); root.pack_start(status, false, false, 0);
    const project = findProject();
    const projectText = new Gtk.Label({ label: project ? `Project: ${project}` : 'Writable Emergentile source project not found.', xalign: 0, selectable: true }); root.pack_start(projectText, false, false, 0);

    const profileData = (logoValue, backgroundValue) => {
        const color = accent.get_rgba();
        const hex = `#${[color.red,color.green,color.blue].map(channel => Math.round(channel * 255).toString(16).padStart(2,'0')).join('')}`;
        return { os_name: osName.get_text().trim() || 'EmergentileGUI', version: version.get_text().trim() || '1', desktop_title: desktopTitle.get_text().trim() || 'EmergentileGUI-1', accent: hex, base_distribution: base.get_active_id(), logo: logoValue, background: backgroundValue };
    };

    const saveProfile = target => {
        GLib.mkdir_with_parents(target, 0o755);
        const logoSource = logo.get_filename() || '';
        const backgroundSource = background.get_filename() || '';
        const logoTarget = copyAsset(logoSource, target, 'logo');
        const backgroundTarget = copyAsset(backgroundSource, target, 'background');
        const data = profileData(logoTarget ? GLib.path_get_basename(logoTarget) : '', backgroundTarget ? GLib.path_get_basename(backgroundTarget) : '');
        const profile = GLib.build_filenamev([target, 'edition.json']);
        GLib.file_set_contents(profile, JSON.stringify(data, null, 2) + '\n');
        return profile;
    };

    const buttons = new Gtk.Box({ spacing: 8, halign: Gtk.Align.END });
    const apply = new Gtk.Button({ label: 'Apply to this desktop' });
    apply.connect('clicked', () => {
        try {
            const target = GLib.build_filenamev([GLib.get_user_config_dir(), 'emergentile']);
            GLib.mkdir_with_parents(GLib.build_filenamev([target, 'assets']), 0o755);
            const logoTarget = copyAsset(logo.get_filename() || '', GLib.build_filenamev([target, 'assets']), 'logo');
            const backgroundTarget = copyAsset(background.get_filename() || '', GLib.build_filenamev([target, 'assets']), 'background');
            GLib.file_set_contents(GLib.build_filenamev([target, 'edition.json']), JSON.stringify(profileData(logoTarget, backgroundTarget), null, 2) + '\n');
            status.set_text('Branding saved. Log out and reopen Emergentile to apply it.');
        } catch (error) { status.set_text(`Could not apply edition: ${error.message}`); }
    });
    const save = new Gtk.Button({ label: 'Save edition' });
    save.set_sensitive(Boolean(project));
    save.connect('clicked', () => {
        try {
            const target = GLib.build_filenamev([project, 'editions', slugify(osName.get_text())]);
            const profile = saveProfile(target); status.set_text(`Edition saved: ${profile}`);
        } catch (error) { status.set_text(`Could not save edition: ${error.message}`); }
    });
    const build = new Gtk.Button({ label: 'Build ISO / IMG' }); build.get_style_context().add_class('suggested-action'); build.set_sensitive(Boolean(project));
    build.connect('clicked', () => {
        try {
            const target = GLib.build_filenamev([project, 'editions', slugify(osName.get_text())]);
            const profile = saveProfile(target);
            const command = `cd ${GLib.shell_quote(project)} && sudo image-build/build.sh --arch ${GLib.shell_quote(architecture.get_active_id())} --format ${GLib.shell_quote(format.get_active_id())} --edition ${GLib.shell_quote(profile)}; result=$?; echo; echo "Build finished with status $result"; echo "Press Enter to close"; read answer; exit $result`;
            GLib.spawn_async(null, ['x-terminal-emulator','-e','bash','-lc',command], null, GLib.SpawnFlags.SEARCH_PATH, null);
            status.set_text(`Build started. The final ${format.get_active_id().toUpperCase()} and checksum will appear in ${project}/dist.`);
        } catch (error) { status.set_text(`Could not start build: ${error.message}`); }
    });
    buttons.pack_start(apply, false, false, 0); buttons.pack_start(save, false, false, 0); buttons.pack_start(build, false, false, 0); root.pack_end(buttons, false, false, 0);
    win.add(root); win.show_all();
});

app.run([]);
