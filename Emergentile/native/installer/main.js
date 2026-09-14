#!/usr/bin/env -S gjs -m
import Gtk from 'gi://Gtk?version=3.0';
import Gio from 'gi://Gio';
import GLib from 'gi://GLib';

const app = new Gtk.Application({ application_id: 'org.emergentile.Installer' });

function packageInstalled(name) {
    try {
        const [ok,,,status] = GLib.spawn_sync(null, ['dpkg-query','-W','-f=${Status}',name], null, GLib.SpawnFlags.SEARCH_PATH, null);
        return ok && GLib.spawn_check_wait_status(status);
    } catch (_) { return false; }
}

function applyAppearance() {
    for (const [channel, property, value] of [
        ['xsettings','/Net/ThemeName','Emergentile'],
        ['xsettings','/Net/IconThemeName','Adwaita'],
        ['xsettings','/Gtk/FontName','Baskervald ADF Std 11']
    ]) {
        try { GLib.spawn_command_line_async(`xfconf-query -c ${channel} -p ${property} -s '${value}'`); } catch (_) {}
    }
}

app.connect('activate', () => {
    const win = new Gtk.ApplicationWindow({ application: app, title: 'Emergentile Installer', default_width: 680, default_height: 720, window_position: Gtk.WindowPosition.CENTER });
    const root = new Gtk.Box({ orientation: Gtk.Orientation.VERTICAL, spacing: 16, margin: 28 });
    const title = new Gtk.Label({ label: 'Emergentile Installer', xalign: 0 }); title.set_markup('<span size="xx-large" weight="bold">Emergentile Installer</span>');
    const intro = new Gtk.Label({ label: 'Download and install XFCE tools, fonts, SuperTuxKart, and dependencies from Debian internet repositories. Emergentile theme assets are installed from the verified local bundle.', xalign: 0, wrap: true });
    root.pack_start(title, false, false, 0); root.pack_start(intro, false, false, 0);

    const packages = [['GTK shell','gjs'],['XFCE window manager','xfwm4'],['XFCE settings','xfce4-settings'],['Authorization agent','polkit-kde-agent-1'],['File manager','pcmanfm'],['Audio controls','pavucontrol'],['Network controls','network-manager-gnome'],['Bluetooth controls','blueman'],['Baskervald font','fonts-adf-baskervald'],['SuperTuxKart','supertuxkart'],['Live image builder','live-build'],['Debian bootstrap','debootstrap'],['ISO creation tools','xorriso'],['Cross-architecture builder','qemu-user-static']];
    const statusBox = new Gtk.ListBox({ selection_mode: Gtk.SelectionMode.NONE });
    const refresh = () => {
        statusBox.get_children().forEach(child => statusBox.remove(child));
        for (const [label, pkg] of packages) {
            const row = new Gtk.Box({ spacing: 12, margin: 9 });
            row.pack_start(new Gtk.Label({ label, xalign: 0 }), true, true, 0);
            const installed = packageInstalled(pkg);
            const state = new Gtk.Label({ label: installed ? '✓ Installed' : '• Missing', xalign: 1 });
            row.pack_end(state, false, false, 0); statusBox.add(row);
        }
        statusBox.show_all();
    };
    refresh();
    const statusScroll = new Gtk.ScrolledWindow({ min_content_height: 220, max_content_height: 280 }); statusScroll.add(statusBox);
    root.pack_start(statusScroll, true, true, 0);

    const progress = new Gtk.Label({ label: 'Ready', xalign: 0 }); root.pack_start(progress, false, false, 0);
    const progressBar = new Gtk.ProgressBar({ show_text: true, text: 'Ready' }); root.pack_start(progressBar, false, false, 0);
    const logBuffer = new Gtk.TextBuffer();
    const logView = new Gtk.TextView({ buffer: logBuffer, editable: false, cursor_visible: false, monospace: true, wrap_mode: Gtk.WrapMode.WORD_CHAR, left_margin: 8, right_margin: 8, top_margin: 8, bottom_margin: 8 });
    const logScroll = new Gtk.ScrolledWindow({ min_content_height: 150 }); logScroll.add(logView);
    const logExpander = new Gtk.Expander({ label: 'Installation log', expanded: true }); logExpander.add(logScroll); root.pack_start(logExpander, true, true, 0);
    const appendLog = line => {
        const end = logBuffer.get_end_iter();
        logBuffer.insert(end, `${line}\n`, -1);
        const mark = logBuffer.create_mark(null, logBuffer.get_end_iter(), false);
        logView.scroll_mark_onscreen(mark); logBuffer.delete_mark(mark);
    };
    const actions = new Gtk.Box({ spacing: 8, halign: Gtk.Align.END });
    const appearance = new Gtk.Button({ label: 'Apply appearance' }); appearance.connect('clicked', () => { applyAppearance(); progress.set_text('Emergentile appearance applied.'); });
    const install = new Gtk.Button({ label: 'Install / Repair' }); install.get_style_context().add_class('suggested-action');
    install.connect('clicked', () => {
        install.set_sensitive(false); appearance.set_sensitive(false);
        logBuffer.set_text('', -1); appendLog('Starting Emergentile installation…'); appendLog('Online source: configured Debian APT repositories');
        progress.set_text('Waiting for administrator authorization…');
        progressBar.set_fraction(0); progressBar.set_text('Starting installation…');
        let installing = true;
        GLib.timeout_add(GLib.PRIORITY_DEFAULT, 120, () => {
            if (!installing) return GLib.SOURCE_REMOVE;
            progressBar.pulse();
            return GLib.SOURCE_CONTINUE;
        });
        try {
            const proc = Gio.Subprocess.new(['pkexec','/usr/local/libexec/emergentile/install-components'], Gio.SubprocessFlags.STDOUT_PIPE | Gio.SubprocessFlags.STDERR_MERGE);
            const stream = new Gio.DataInputStream({ base_stream: proc.get_stdout_pipe(), close_base_stream: true });
            let lastLine = '';
            const finish = () => {
                proc.wait_async(null, (_process, waitResult) => {
                    try { proc.wait_finish(waitResult); } catch (error) { appendLog(error.message); }
                    if (proc.get_successful()) {
                        applyAppearance(); progress.set_text('Installation complete. Log out to apply every change.');
                        progressBar.set_fraction(1); progressBar.set_text('100% · Complete'); appendLog('Installation completed successfully.');
                    } else {
                        const message = lastLine || 'Installation failed. If no password dialog appeared, log out and reopen the Emergentile session.';
                        progress.set_text(message); progressBar.set_fraction(0); progressBar.set_text('Installation failed');
                        appendLog(`Installer exited with status ${proc.get_exit_status()}.`);
                    }
                    installing = false; install.set_sensitive(true); appearance.set_sensitive(true); refresh();
                });
            };
            const readNext = () => stream.read_line_async(GLib.PRIORITY_DEFAULT, null, (_stream, readResult) => {
                try {
                    const [line] = stream.read_line_finish_utf8(readResult);
                    if (line === null) { finish(); return; }
                    lastLine = line; appendLog(line); readNext();
                } catch (error) { appendLog(error.message); finish(); }
            });
            readNext();
            progress.set_text('Downloading and installing components…');
            progressBar.set_text('Working…');
        } catch (error) { installing = false; appendLog(error.message); progress.set_text(error.message); progressBar.set_fraction(0); progressBar.set_text('Could not start'); install.set_sensitive(true); appearance.set_sensitive(true); }
    });
    actions.pack_start(appearance, false, false, 0); actions.pack_start(install, false, false, 0); root.pack_end(actions, false, false, 0);
    win.add(root); win.show_all();
});

app.run([]);
