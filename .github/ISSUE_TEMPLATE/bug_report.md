---
name: Bug report
about: Something is broken with the plugin
title: "[Bug] "
labels: bug
assignees: ''
---

## Describe the bug

A clear and concise description of what went wrong.

## To reproduce

Steps to reproduce the behavior:

1. Open PicGo version `___`
2. Go to '...'
3. Click on '...'
4. See error

**Image format and size:** (e.g. PNG 1024x768, 200KB)

## Expected behavior

A clear and concise description of what you expected to happen.

## Actual behavior

What actually happened. Include the **exact error message** from the PicGo notification popup.

## Logs

Open PicGo → 设置 → 日志 and find the `[ImgRoute]` lines from the failed upload:

```
[INFO] [ImgRoute] ...
[INFO] [ImgRoute] ...
[ERR ] [ImgRoute] ...
```

> **⚠️ Mask your `X-API-Key` value** in the logs before pasting.

## Environment

- **PicGo version**: (设置 → 关于)
- **Plugin version**: (run `npm view picgo-plugin-imgroute version`)
- **OS**: (e.g. Windows 11 23H2, macOS 14.3, Ubuntu 22.04)
- **Image source**: (剪贴板 / 拖拽 / 选择文件)

## Additional context

Any other context (screenshot, related issue link, etc.).
