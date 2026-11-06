# Security policy

Please report security issues privately to **hola@screenshot.com.ar** (or through GitHub's "Report a vulnerability" in this repository's Security tab), not in public issues.

This package only calls the screenshot.com.ar API over HTTPS with the API key from your n8n credential. It has no runtime dependencies, does not read environment variables or files, and is published from GitHub Actions with npm provenance.
