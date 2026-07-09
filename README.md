# picgo-plugin-imgroute

> ImgRoute 图床的 PicGo 上传插件。两步式上传：API 预签名 → 直传 IO 节点。

[![npm version](https://img.shields.io/npm/v/picgo-plugin-imgroute.svg)](https://www.npmjs.com/package/picgo-plugin-imgroute)
[![npm downloads](https://img.shields.io/npm/dm/picgo-plugin-imgroute.svg)](https://www.npmjs.com/package/picgo-plugin-imgroute)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
[![CI](https://github.com/imgroute/picgo-plugin-imgroute/actions/workflows/ci.yml/badge.svg)](https://github.com/imgroute/picgo-plugin-imgroute/actions)

---

## 安装

### PicGo 客户端（推荐）

打开 PicGo → 插件设置 → 搜索 `imgroute` → 安装

或 CLI：

```bash
picgo install imgroute
```

### 从源码构建

```bash
git clone https://github.com/imgroute/picgo-plugin-imgroute.git
cd picgo-plugin-imgroute
npm install
# 然后在 PicGo 插件设置里"本地插件"指向此目录
```

### 版本要求

| 组件 | 最低版本 |
|---|---|
| PicGo | **3.0.0**（2.x 也兼容） |
| Node.js | 18+（仅源码构建需要） |
| 套餐 | **付费版**（API 上传仅对付费用户开放） |

---

## 配置

进入 PicGo → 图床设置 → ImgRoute：

| 配置项 | 必填 | 说明 |
|---|---|---|
| `API Key` | ✅ | 格式 `sk-ir-xxxxxxxx`，在 ImgRoute 控制台 → 高级功能 → API Key 管理 生成 |

### 获取 API Key

1. 登录 [ImgRoute 控制台](https://imgroute.com)
2. 进入 **高级功能** → **API Key 管理**
3. 点击 **生成 Key**
4. 复制并粘贴到 PicGo 配置中

> 🔒 **安全提醒**：API Key 等同于密码，**不要**截图或贴到公开 issue 里。

---

## 支持的图片格式

| 格式 | 扩展名 |
|---|---|
| PNG | `.png` |
| JPEG | `.jpg`, `.jpeg` |
| GIF | `.gif` |
| WebP | `.webp` |
| BMP | `.bmp` |
| SVG | `.svg` |
| TIFF | `.tiff` |

> ICO 格式因 Slack 不支持公开共享，已从后端移除。

---

## 上传流程

```
┌─────────────┐    1. 预签名请求    ┌─────────────┐
│   PicGo     │ ──────────────────→│  ImgRoute   │
│   客户端     │  POST /api/v1/upload │   API       │
└─────────────┘                    └─────────────┘
       ↑                                  │
       │   返回 upload_url + cdn_url    │
       └──────────────────────────────────┘
       ↓
┌─────────────┐    2. 文件直传       ┌─────────────┐
│   PicGo     │ ──────────────────→│   IO 节点    │
│   客户端     │  POST upload_url   │  (高速通道)  │
└─────────────┘                    └─────────────┘
       ↑                                  │
       │      上传成功                    │
       └──────────────────────────────────┘
       ↓
   复制 CDN 链接到剪贴板
```

**为什么不直接 POST 给主 API？** 主 API 转发到 Slack，单节点限流。直传 IO 节点走专线，单文件速度提升 **3-5 倍**。

---

## 错误码

| 错误码 | 含义 | 解决方法 |
|---|---|---|
| `INVALID_API_KEY` | API Key 错或过期 | 控制台重新生成 |
| `MISSING_FILE_SIZE` / `MISSING_WIDTH` / `MISSING_HEIGHT` | 插件 bug 或图片损坏 | 升级到最新版（1.0.1+），仍出错请提 issue |
| `FILE_TOO_LARGE` | 文件超过套餐上限 | 压缩图片 / 升级套餐 |
| `DAILY_LIMIT_REACHED` | 24h 上传超限 | 等待重置 / 升级套餐 |
| `STORAGE_LIMIT_REACHED` | 总容量超限 | 清理旧图 / 升级套餐 |
| `PLAN_NOT_SUPPORTED` | 套餐不支持 API | 升级到付费版 |
| `NO_AVAILABLE_IO_NODE` | 暂无 IO 节点 | 稍后重试 |
| `MAINTENANCE_SCHEDULED` | 系统维护中 | 维护完成后重试 |
| `PLAN_EXPIRED_RESTRICTED` | 套餐到期 + 数量超限 | 续费 |

---

## 故障排查

### 上传失败怎么办

1. **打开 PicGo 日志面板**（设置 → 日志）
2. 找到 `[ImgRoute]` 开头的行
3. 查看错误码（`[INVALID_API_KEY]` 这种格式）

### 常见问题

**Q: 升级 PicGo 到 3.x 后上传失败？**
A: 升级插件到 **1.0.1+**（修复了 `ctx.request` 兼容问题）

**Q: 提示 `[INVALID_WIDTH] width 必须为正整数`？**
A: 1.0.1 已修复，升级即可

**Q: 多文件上传只有部分成功？**
A: 正常行为 — `Promise.allSettled` 并发上传，单个失败不影响其他

---

## 开发

### 调试

```bash
# 1) 修改 index.js
# 2) 跑 smoke test（不需要真 API Key）
node -e "
const fakeCtx = {
  helper: { uploader: { register: () => {} } },
  log: console,
  getConfig: () => ({ apiKey: 'sk-ir-FAKE' }),
  output: [{ fileName: 'test.png', extname: '.png',
    buffer: require('fs').readFileSync('test.png'),
    info: { width: 100, height: 100, type: 'png' } }],
  emit: (e, p) => console.log('NOTI', p)
};
const plugin = require('./index.js')(fakeCtx);
plugin.register();
"
```

### 测试

CI 在 Node 18/20/22 上跑：

- `node --check index.js`
- 注册检查（uploader id、handle、config、name）
- 包字段校验

### 发布

```bash
# 1) 改 version + changelog
# 2) 跑 npm pack 看 tarball
npm pack --dry-run
# 3) 发布
npm publish
```

---

## 贡献

欢迎 PR！请先看 [CONTRIBUTING.md](CONTRIBUTING.md)。

- 🐛 Bug report: [GitHub Issues](https://github.com/imgroute/picgo-plugin-imgroute/issues/new?template=bug_report.md)
- 💡 Feature request: [GitHub Issues](https://github.com/imgroute/picgo-plugin-imgroute/issues/new?template=feature_request.md)
- 💬 问答: [Discussions](https://github.com/imgroute/picgo-plugin-imgroute/discussions)

---

## 安全

发现安全漏洞请**不要**在公开 issue 提，邮件 `admin@imgroute.com`，详见 [SECURITY.md](SECURITY.md)。

---

## 许可证

[MIT](LICENSE) © 2026 ImgRoute
