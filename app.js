const commands = `tar -xzf emergentilegui-1-source.tar.gz
cd Emergentile
sudo make install-system`;

document.querySelector('#copyCommand').addEventListener('click', async () => {
  try {
    await navigator.clipboard.writeText(commands);
    const toast = document.querySelector('#toast');
    toast.classList.add('show');
    setTimeout(() => toast.classList.remove('show'), 1800);
  } catch (_) {
    window.prompt('Copy these commands:', commands);
  }
});

function setAvailability(link, isAvailable) {
  link.classList.toggle('unavailable', !isAvailable);
  if (isAvailable) {
    link.removeAttribute('aria-disabled');
    link.removeAttribute('title');
  } else {
    link.setAttribute('aria-disabled', 'true');
    link.title = 'This image has not been built on this download server';
  }
}

// Disable artifact links cleanly until the packaging script has placed files.
document.querySelectorAll('.artifact-link').forEach(async link => {
  try {
    const response = await fetch(link.getAttribute('href'), { method: 'HEAD' });
    setAvailability(link, response.ok);
  } catch (_) {
    // file:// previews cannot perform HEAD requests; preserve links there.
  }
});

// The self-hosted server exposes its local artifact inventory here. This keeps
// the UI in sync without copying multi-gigabyte ISO/IMG files into the site.
fetch('/api/downloads').then(response => response.ok ? response.json() : null).then(manifest => {
  if (!manifest) return;
  const available = new Set(manifest.artifacts.map(item => item.name));
  document.querySelectorAll('.artifact-link').forEach(link => {
    const name = link.getAttribute('href').split('/').pop();
    setAvailability(link, available.has(name));
  });
}).catch(() => {});
