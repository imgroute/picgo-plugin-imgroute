# Contributing to picgo-plugin-imgroute

Thanks for your interest in improving the ImgRoute PicGo plugin! 🎉

## Issues

### Bug reports
Before opening a bug, please:
1. Update to the **latest** plugin version (`npm view picgo-plugin-imgroute version`)
2. Update PicGo to the latest version
3. Open PicGo's log panel (设置 → 日志) and look for `[ImgRoute]` lines
4. Search [existing issues](https://github.com/imgroute/picgo-plugin-imgroute/issues) to avoid duplicates

When opening a bug report, include:
- PicGo version (设置 → 关于)
- Plugin version (npm: `picgo get-plugin-version imgroute`)
- Operating system
- Image format and size
- Relevant `[ImgRoute]` log lines (mask your `X-API-Key` value!)
- Steps to reproduce

### Feature requests
Open an issue with the `enhancement` label. Describe:
- The use case
- The proposed behavior
- Why existing behavior is insufficient

## Pull requests

1. **Fork** this repository
2. **Create a feature branch** from `main`:
   ```bash
   git checkout -b feat/my-improvement
   ```
3. **Make your change**. Follow the existing code style:
   - ES2017+ async/await (no callbacks)
   - 2-space indentation
   - JSDoc on every exported function
   - No comments inside function bodies (the code should be self-documenting)
4. **Test locally**:
   ```bash
   npm install
   node -c index.js     # syntax check
   node _smoke.js       # register + mock upload test (see CI workflow)
   ```
5. **Commit** with a descriptive message:
   - `fix: ...` for bug fixes
   - `feat: ...` for new features
   - `docs: ...` for documentation only
   - `chore: ...` for maintenance
6. **Open a PR** against `main`. Fill in the PR template.
7. **Wait for CI** to pass. A maintainer will review within a few days.

## Commit messages

- Use the imperative mood ("add feature", not "added feature")
- First line ≤ 72 characters
- Reference issues with `(#123)` suffix when applicable

## Code of conduct

This project follows the [Contributor Covenant](https://www.contributor-covenant.org/version/2/1/code_of_conduct/).
By participating, you agree to abide by its terms.

## Questions?

Open a [Discussion](https://github.com/imgroute/picgo-plugin-imgroute/discussions) (not an Issue) for general questions.
