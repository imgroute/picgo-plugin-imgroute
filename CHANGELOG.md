# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.0.2] - 2026-07-09

### Security
- **API Key leak fix**: `DIAG-RESP str=...` log line printed `response.config.headers['X-API-Key']` to the PicGo log panel, exposing the user's full API Key. **All 1.0.1 users should upgrade.** Removed the offending log lines; remaining `DIAG` lines only print non-sensitive metadata (type, keys, status).

## [1.0.1] - 2026-07-09

### Fixed
- **PicGo 3.x compatibility**: `ctx.request` no longer accepts `data: object` + `json: true` (axios-style); now uses `Buffer.from(JSON.stringify(...))` for explicit body serialization
- **PicGo 3.x response unwrapping**: response shape varies (axios wrapper / electron-net / fetch Response / string / plain object) — added `unwrapResponse()` helper to handle all cases
- **PicGo 3.x image dimensions**: `img.info.width / img.info.height` is the canonical location in 3.x; added 3-tier fallback (`img.info` → `img.width` → `image-size` lib)
- **`image-size@2.0.2` API change**: v1.x exported `sizeOf` function, v2.x exports `{ imageSize, ... }` object; fixed `const sizeOf = require('image-size')` to destructure properly
- **Error message preservation**: `throw new Error('所有图片上传失败')` swallowed the real cause; now appends the first failure's `error.message` so users see e.g. `[INVALID_API_KEY] 无效的 API Key`
- **Filename 200-char truncation** to stay within header size limits

### Added
- `icon` field in `package.json` pointing to https://cn.imgroute1.com/i/x4l54vye41sy
- `package-lock.json` for reproducible builds
- `Content-Length` header on both presign and upload requests

### Changed
- Removed `.ico` from supported formats (ICO disabled in backend Slack delivery)

## [1.0.0] - 2026-04-11

### Added
- Initial public release
- Two-step upload: presign via `/api/v1/upload`, direct upload to IO node
- HTTPS-only upload URL validation
- Multipart upload with cryptographically random boundary
- Exponential-backoff retry (2 retries, 1s base delay)
- Filename sanitization (control chars, path traversal, header injection chars)
- 4xx non-retry (except 429), 5xx + 429 retry
- Concurrency via `Promise.allSettled` for batch uploads
- Mature error code mapping (`FILE_TOO_LARGE`, `DAILY_LIMIT_REACHED`, `STORAGE_LIMIT_REACHED`, `PLAN_NOT_SUPPORTED`, `NO_AVAILABLE_IO_NODE`, `INVALID_API_KEY`)

[1.0.2]: https://github.com/imgroute/picgo-plugin-imgroute/releases/tag/v1.0.2
[1.0.1]: https://github.com/imgroute/picgo-plugin-imgroute/releases/tag/v1.0.1
[1.0.0]: https://github.com/imgroute/picgo-plugin-imgroute/releases/tag/v1.0.0
