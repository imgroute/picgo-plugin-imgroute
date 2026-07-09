# Security Policy

## Supported versions

| Version | Supported          |
|---------|--------------------|
| 1.0.1   | ✅ Yes             |
| 1.0.0   | ⚠️ Upgrade to 1.0.1 (PicGo 3.x compatibility) |
| < 1.0   | ❌ No              |

## Reporting a vulnerability

**Please do not open a public GitHub issue for security vulnerabilities.**

Instead, email **admin@imgroute.com** with:
- Subject prefix: `[picgo-plugin-imgroute security]`
- A clear description of the vulnerability
- Steps to reproduce
- Potential impact

We will acknowledge receipt within **48 hours** and aim to ship a fix within **14 days** for critical issues.

## API Key safety

This plugin sends your API Key in an `X-API-Key` HTTP header to `https://imgroute.com`. To keep it safe:
- Never commit your API Key to version control
- Never share screenshots/logs containing your full API Key — mask it (`sk-ir-••••••••`)
- Rotate the key from your ImgRoute dashboard if you suspect it leaked
- The plugin itself never persists the key to disk (PicGo's config layer handles that)
