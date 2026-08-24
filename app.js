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

const eventLabels = {
  PushEvent: 'Pushed code to',
  CreateEvent: 'Created something in',
  IssuesEvent: 'Updated an issue in',
  IssueCommentEvent: 'Commented in',
  PullRequestEvent: 'Updated a pull request in',
  ReleaseEvent: 'Published a release in',
  WatchEvent: 'Starred'
};

function relativeTime(date) {
  const seconds = Math.max(1, Math.round((Date.now() - date.getTime()) / 1000));
  const units = [['year', 31536000], ['month', 2592000], ['day', 86400], ['hour', 3600], ['minute', 60]];
  for (const [unit, size] of units) {
    if (seconds >= size) return `${Math.floor(seconds / size)} ${unit}${seconds >= size * 2 ? 's' : ''} ago`;
  }
  return 'just now';
}

fetch('https://api.github.com/users/Emergentile/events/public?per_page=1', {
  headers: { Accept: 'application/vnd.github+json' }
}).then(response => {
  if (!response.ok) throw new Error('GitHub activity unavailable');
  return response.json();
}).then(([event]) => {
  if (!event) throw new Error('No public activity');
  const repository = event.repo.name;
  const date = new Date(event.created_at);
  document.querySelector('#githubAction').textContent = `${eventLabels[event.type] || 'Active in'} ${repository.split('/').pop()}`;
  document.querySelector('#githubDetails').textContent = repository;
  const time = document.querySelector('#githubTime');
  time.textContent = relativeTime(date);
  time.dateTime = event.created_at;
  document.querySelector('#githubStatus').href = `https://github.com/${repository}`;
}).catch(() => {
  document.querySelector('#githubAction').textContent = 'Building Emergentile';
  document.querySelector('#githubDetails').textContent = 'View public work on GitHub';
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
