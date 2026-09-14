#!/usr/bin/env -S gjs -m
import Gtk from 'gi://Gtk?version=3.0';
import Gio from 'gi://Gio';

const app = new Gtk.Application({ application_id: 'org.emergentile.About' });

app.connect('activate', () => {
    const dialog = new Gtk.AboutDialog({
        application: app,
        program_name: 'EmergentileGUI-1',
        version: '1',
        comments: 'A calm, adaptive Linux desktop environment built with GTK and the XFCE window manager.',
        logo_icon_name: 'emergentile',
        authors: ['Avichu'],
        copyright: 'EmergentileGUI development release',
        website_label: 'EmergentileGUI project',
        modal: false,
        destroy_with_parent: true
    });
    dialog.set_title('About EmergentileGUI');
    dialog.connect('response', () => { dialog.destroy(); app.quit(); });
    dialog.connect('delete-event', () => { app.quit(); return false; });
    dialog.show_all();
});

app.run([]);
