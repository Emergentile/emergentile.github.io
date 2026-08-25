const commands = `tar -xzf emergentilegui-1-source.tar.gz
cd Emergentile
sudo make install-system`;

const themeToggle = document.querySelector('#themeToggle');

function updateThemeToggle() {
  const dark = document.documentElement.dataset.theme === 'dark';
  themeToggle.setAttribute('aria-label', dark ? 'Switch to light theme' : 'Switch to dark theme');
  themeToggle.setAttribute('aria-pressed', String(dark));
  themeToggle.querySelector('span').textContent = dark ? '☀' : '☾';
}

themeToggle.addEventListener('click', () => {
  const nextTheme = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark';
  document.documentElement.dataset.theme = nextTheme;
  localStorage.setItem('emergentile-theme', nextTheme);
  updateThemeToggle();
});

updateThemeToggle();

if (localStorage.getItem('emergentile-owner') !== 'true') {
  document.querySelectorAll('.visitor-counter[data-src]').forEach(counter => {
    counter.src = counter.dataset.src;
  });
}

document.querySelector('#contributeForm').addEventListener('submit', event => {
  event.preventDefault();
  const username = document.querySelector('#githubUsername').value.trim().replace(/^@/, '');
  if (!username) return;
  const title = encodeURIComponent(`Contributor request: @${username}`);
  const body = encodeURIComponent(`Hi, I am @${username}.\n\nI would like to contribute to Emergentile.\n\nWhat I would like to work on:\n`);
  window.open(`https://github.com/Emergentile/emergentile.github.io/issues/new?title=${title}&body=${body}`, '_blank', 'noopener,noreferrer');
});

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
