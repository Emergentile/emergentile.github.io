.PHONY: check install install-system uninstall preview image-amd64-iso image-amd64-img image-arm64-iso image-arm64-img image-all website-preview website-host website-downloads website-isos website-check

DOWNLOADS ?= dist

check:
	@gjs -c "imports.gi.versions.Gtk='3.0'; imports.gi.versions.Wnck='3.0'; void imports.gi.Gtk; void imports.gi.Wnck"
	@python3 -c "import xml.etree.ElementTree as E; E.parse('native/openbox/rc.xml')"
	@desktop-file-validate native/emergentile.desktop
	@desktop-file-validate native/emergentile-installer.desktop
	@desktop-file-validate native/emergentile-about.desktop
	@desktop-file-validate native/emergentile-help.desktop
	@desktop-file-validate native/emergentile-dev.desktop
	@desktop-file-validate native/emergentile-settings.desktop
	@sh -n native/emergentile-installer native/emergentile-about native/emergentile-help native/emergentile-dev native/emergentile-settings native/install-components
	@python3 -c "import ast, pathlib; [ast.parse(pathlib.Path(p).read_text()) for p in ('image-build/prepare-edition.py','image-build/apply-edition.py')]"
	@echo "Emergentile source checks passed"

install:
	@sh install.sh

install-system:
	@sudo sh install-system.sh

uninstall:
	@sh uninstall.sh

preview:
	@EMERGENTILE_DIR="$(CURDIR)/native" EMERGENTILE_PREVIEW=1 gjs -m native/shell/main.js

image-amd64-iso:
	@sudo image-build/build.sh --arch amd64 --format iso

image-amd64-img:
	@sudo image-build/build.sh --arch amd64 --format img

image-arm64-iso:
	@sudo image-build/build.sh --arch arm64 --format iso

image-arm64-img:
	@sudo image-build/build.sh --arch arm64 --format img

image-all:
	@sudo image-build/build-all.sh /mnt/emergentile-build/work /mnt/emergentile-build/dist

website-preview:
	@python3 -m http.server 8080 --directory website

website-host:
	@python3 website/server.py --host 0.0.0.0 --port 8080 --downloads "$(DOWNLOADS)"

website-downloads:
	@sh website/prepare-downloads.sh

website-isos: image-amd64-iso image-arm64-iso website-downloads
	@sh website/check-downloads.sh --require-isos

website-check:
	@sh website/check-downloads.sh
