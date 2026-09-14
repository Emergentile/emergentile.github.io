#!/usr/bin/env -S gjs -m
import Gtk from 'gi://Gtk?version=3.0';

const app = new Gtk.Application({ application_id: 'org.emergentile.Help' });

function page(title, intro, sections) {
    const box = new Gtk.Box({ orientation: Gtk.Orientation.VERTICAL, spacing: 14, margin: 28 });
    const heading = new Gtk.Label({ xalign: 0 }); heading.set_markup(`<span size="xx-large" weight="bold">${title}</span>`);
    const summary = new Gtk.Label({ label: intro, xalign: 0, wrap: true, max_width_chars: 68 });
    box.pack_start(heading, false, false, 0); box.pack_start(summary, false, false, 0);
    for (const [name, text] of sections) {
        const section = new Gtk.Label({ xalign: 0, wrap: true, selectable: true, max_width_chars: 68 });
        section.set_markup(`<b>${name}</b>\n${text}`);
        box.pack_start(section, false, false, 0);
    }
    const viewport = new Gtk.Viewport(); viewport.add(box);
    const scroll = new Gtk.ScrolledWindow(); scroll.add(viewport);
    return scroll;
}

app.connect('activate', () => {
    const win = new Gtk.ApplicationWindow({ application: app, title: 'Emergentile Help', default_width: 880, default_height: 620, window_position: Gtk.WindowPosition.CENTER });
    const header = new Gtk.HeaderBar({ title: 'Emergentile Help', subtitle: 'EmergentileGUI-1', show_close_button: true }); win.set_titlebar(header);
    const layout = new Gtk.Box({ orientation: Gtk.Orientation.HORIZONTAL });
    const stack = new Gtk.Stack({ transition_type: Gtk.StackTransitionType.CROSSFADE, transition_duration: 180 });
    const sidebar = new Gtk.StackSidebar({ stack }); sidebar.set_size_request(210, -1);

    stack.add_titled(page('Welcome', 'Learn the essentials of your Emergentile desktop.', [
        ['Application menu', 'Select Emergentile in the top-left corner to browse or search every installed application.'],
        ['Clock', 'The top-right clock updates automatically and is display-only.'],
        ['Session startup', 'A ten-second welcome screen appears after login while the desktop session prepares itself.']
    ]), 'welcome', 'Welcome');
    stack.add_titled(page('Dock and tasks', 'Launch favorites and manage running windows from the bottom dock.', [
        ['Pin an application', 'Open the application menu and select + beside an application. The pin is saved for future sessions.'],
        ['Unpin an application', 'Select − in the menu, or right-click its pinned dock icon.'],
        ['Running tasks', 'Each running window appears as a 32 px icon. Select an icon to focus its window; hover to see the title.'],
        ['Intelligent auto-hide', 'The dock hides when a maximized, fullscreen, or overlapping window needs the space. Move the pointer to the bottom-center edge to reveal it.']
    ]), 'dock', 'Dock and tasks');
    stack.add_titled(page('Workspaces', 'Use four independent work areas to organize applications.', [
        ['Workspace indicators', 'The black rectangle is active; white rectangles are inactive. Select a rectangle to switch.'],
        ['Keyboard navigation', 'Press Ctrl+Alt+Left or Ctrl+Alt+Right to move between adjacent workspaces.']
    ]), 'workspaces', 'Workspaces');
    stack.add_titled(page('Keyboard shortcuts', 'Common window and application actions.', [
        ['Super+Return', 'Open the terminal.'], ['Super+E', 'Open the file manager.'], ['Super+Q', 'Close the active window.'],
        ['Super+Left / Super+Right', 'Tile the active window to one side.'], ['Super+D', 'Show the desktop.']
    ]), 'shortcuts', 'Shortcuts');
    stack.add_titled(page('Appearance', 'Choose the visual style from the application menu.', [
        ['Default mode', 'Uses the warm Emergentile palette and light surfaces.'],
        ['Dark mode', 'Uses dark shell surfaces, menus, tooltips, and notifications.'],
        ['Persistence', 'Your selection is stored in ~/.config/emergentile/theme.']
    ]), 'appearance', 'Appearance');
    stack.add_titled(page('Installer', 'Use Emergentile Installer to install or repair desktop components.', [
        ['Install / Repair', 'Downloads XFCE tools, dependencies, fonts, utilities, and SuperTuxKart from configured Debian repositories.'],
        ['Progress and logs', 'The progress bar and expandable live log show downloads, package operations, and errors.'],
        ['Authorization', 'Enter the administrator password when the PolicyKit dialog appears.']
    ]), 'installer', 'Installer');
    stack.add_titled(page('Troubleshooting', 'Quick recovery steps for common issues.', [
        ['Apply source changes', 'Run sudo make install-system from the Emergentile project folder, then log out completely and reopen the session.'],
        ['An application is missing', 'The menu lists every registered desktop application. Use search, or install the missing package through Emergentile Installer.'],
        ['Installer authorization fails', 'Restart the Emergentile session so its PolicyKit agent starts, then try Install / Repair again.'],
        ['Desktop does not start', 'At GDM, choose another session from the gear menu, log in, and run make check in the project folder.']
    ]), 'troubleshooting', 'Troubleshooting');

    layout.pack_start(sidebar, false, false, 0); layout.pack_start(new Gtk.Separator({ orientation: Gtk.Orientation.VERTICAL }), false, false, 0); layout.pack_start(stack, true, true, 0);
    win.add(layout); win.show_all();
});

app.run([]);
