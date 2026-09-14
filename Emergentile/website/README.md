# Emergentile website

Preview locally from the project root:

```bash
make website-preview
```

Host the website on the local network while streaming ISO/IMG files directly
from `dist/` with resumable downloads:

```bash
make website-host
```

Other devices can open `http://HOST-IP:8080`. Public internet access requires a
router/firewall rule or reverse proxy. Use HTTPS before exposing it publicly.

Prepare the downloadable source archive and copy built ISO/IMG artifacts:

```bash
make website-downloads
```

Build both website ISOs, package them, and verify every download link:

```bash
make website-isos
```

This requires a build machine with at least 20 GB free. Check which artifacts
are currently ready without building anything:

```bash
make website-check
```

Then deploy the contents of `website/` to any static host. Links for images that
have not been built yet are marked as unavailable when served over HTTP.
