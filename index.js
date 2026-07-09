/**
 * PicGo 上传插件 - ImgRoute 图床
 * 支持两步式上传：预签名获取上传URL -> 上传文件到IO节点
 */

const imageSizeModule = require('image-size')
const sizeOf = imageSizeModule.imageSize || imageSizeModule.default || imageSizeModule
const crypto = require('crypto')

// MIME 类型映射表
const MIME_MAP = {
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.bmp': 'image/bmp',
  '.svg': 'image/svg+xml',
  '.tiff': 'image/tiff',
}

// 固定服务器地址
const SERVER = 'https://imgroute.com'

// 请求超时（毫秒）
const REQUEST_TIMEOUT = 30000

// 最大重试次数
const MAX_RETRIES = 2

// 重试延迟基数（毫秒）
const RETRY_BASE_DELAY = 1000

/**
 * 获取文件的 MIME 类型
 * @param {string} extname - 文件扩展名（如 '.png'）
 * @returns {string} MIME 类型
 */
function getMimeType(extname) {
  const mime = MIME_MAP[extname.toLowerCase()]
  return mime || 'application/octet-stream'
}

/**
 * 清理文件名，移除危险字符
 * @param {string} fileName - 原始文件名
 * @returns {string} 清理后的安全文件名
 */
function sanitizeFileName(fileName) {
  if (!fileName) return 'image'
  
  // 提取文件名（移除路径）
  let safeName = fileName.split('\\').pop().split('/').pop()
  
  // 替换控制字符和危险字符
  safeName = safeName.replace(/[\x00-\x1f]/g, '')
  
  // 替换可能导致 header 注入的字符
  safeName = safeName.replace(/["\r\n]/g, '_')
  
  // 替换其他危险字符
  safeName = safeName.replace(/[<>:\\/|?*]/g, '_')
  
  // 长度限制
  if (safeName.length > 200) {
    safeName = safeName.substring(0, 200)
  }
  
  return safeName || 'image'
}

/**
 * 构造 multipart/form-data 请求体
 * @param {string} boundary - 分隔符
 * @param {string} fileName - 文件名
 * @param {string} mimeType - MIME 类型
 * @param {Buffer} buffer - 文件内容
 * @returns {Buffer} 构造好的请求体
 */
function buildMultipartBody(boundary, fileName, mimeType, buffer) {
  const safeFileName = sanitizeFileName(fileName)
  const prefix = Buffer.from(
    `--${boundary}\r\n` +
    `Content-Disposition: form-data; name="file"; filename="${safeFileName}"\r\n` +
    `Content-Type: ${mimeType}\r\n\r\n`
  )
  const suffix = Buffer.from(`\r\n--${boundary}--\r\n`)
  return Buffer.concat([prefix, buffer, suffix])
}

/**
 * 统一解析不同 HTTP 客户端返回的 response：
 *   - axios:     { data, status, headers }
 *   - electron-net: { body, statusCode }
 *   - fetch Response: { json(), text(), status, ok }
 *   - 字符串（部分客户端直接返回 body 文本）
 *   - 已经是 plain JSON object
 * @param {*} response
 * @returns {Promise<Object|null>}
 */
async function unwrapResponse(response) {
  if (response == null) return null
  if (typeof response === 'string') {
    try { return JSON.parse(response) } catch (e) { return { _raw: response } }
  }
  if (typeof response !== 'object') return null

  const isAxiosWrapper = response.data != null && (response.status != null || response.config != null || response.headers != null)
  if (isAxiosWrapper) {
    if (response.status >= 400) {
      return await unwrapResponse(response.data)
    }
    return response.data
  }

  const isHttpWrapper = response.body != null && (response.statusCode != null || response.status != null)
  if (isHttpWrapper) {
    if ((response.statusCode != null ? response.statusCode : response.status) >= 400) {
      return await unwrapResponse(response.body)
    }
    return response.body
  }

  if (typeof response.json === 'function') {
    try { return await response.json() } catch (e) { return null }
  }
  if (typeof response.text === 'function') {
    try {
      const t = await response.text()
      try { return JSON.parse(t) } catch (e) { return { _raw: t } }
    } catch (e) { return null }
  }

  return response
}

/**
 * 带重试的请求包装器
 * @param {Object} ctx - PicGo 上下文
 * @param {Object} options - 请求选项
 * @param {string} operation - 操作名称（用于日志）
 * @returns {Object} 响应数据
 */
async function requestWithRetry(ctx, options, operation) {
  let lastError = null
  
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      if (attempt > 0) {
        const delay = RETRY_BASE_DELAY * Math.pow(2, attempt - 1)
        ctx.log.info(`[ImgRoute] ${operation} 重试第 ${attempt} 次，等待 ${delay}ms`)
        await new Promise(resolve => setTimeout(resolve, delay))
      }
      
      const response = await ctx.request({
        ...options,
        timeout: REQUEST_TIMEOUT
      })
      
      return response
    } catch (error) {
      lastError = error
      
      // 某些错误不应该重试
      if (error.response) {
        const status = error.response.status
        // 4xx 客户端错误（除 429 外）不重试
        if (status >= 400 && status < 500 && status !== 429) {
          throw error
        }
      }
      
      ctx.log.warn(`[ImgRoute] ${operation} 失败 (attempt ${attempt + 1}/${MAX_RETRIES + 1}): ${error.message}`)
    }
  }
  
  throw lastError
}

/**
 * 预签名请求 - 获取上传URL
 * @param {Object} ctx - PicGo 上下文
 * @param {string} apiKey - API Key
 * @param {string} fileName - 文件名
 * @param {number} fileSize - 文件大小（字节）
 * @param {string} mimeType - MIME 类型
 * @param {number} width - 图片宽度
 * @param {number} height - 图片高度
 * @returns {Object} 预签名响应数据
 */
async function getPresignUrl(ctx, apiKey, fileName, fileSize, mimeType, width, height) {
  const url = `${SERVER}/api/v1/upload`
  const safeFileName = sanitizeFileName(fileName)
  ctx.log.info(`[ImgRoute] 请求预签名: ${safeFileName}`)

  const payload = Buffer.from(JSON.stringify({
    file_name: safeFileName,
    file_size: fileSize,
    mime_type: mimeType,
    width: width,
    height: height
  }))

  try {
    const response = await requestWithRetry(ctx, {
      method: 'POST',
      url: url,
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': apiKey,
        'Content-Length': payload.length
      },
      data: payload,
      responseType: 'json'
    }, '预签名请求')

    ctx.log.info(`[ImgRoute] DIAG-RESP type=${typeof response} ctor=${response && response.constructor && response.constructor.name} keys=${response && typeof response === 'object' ? Object.keys(response).slice(0,12).join(',') : 'N/A'} isPromise=${response instanceof Promise} hasJson=${response && typeof response.json === 'function'} hasText=${response && typeof response.text === 'function'} hasData=${response && 'data' in response} hasBody=${response && 'body' in response}`)

    const body = await unwrapResponse(response)
    ctx.log.info(`[ImgRoute] DIAG-BODY type=${typeof body} success=${body && body.success} keys=${body && typeof body === 'object' ? Object.keys(body).join(',') : 'N/A'}`)
    if (!body || typeof body !== 'object') {
      throw new Error('预签名响应解析失败')
    }
    if (body.success === false) {
      throw new Error(`[${body.code || 'ERROR'}] ${body.error || body.message || body.detail || '预签名被拒'}`)
    }

    let data = null
    if (body.data && typeof body.data === 'object') {
      data = body.data
    } else if (body.upload_url && body.cdn_url) {
      data = body
    }

    if (!data || !data.upload_url || !data.cdn_url) {
      throw new Error(`预签名响应格式错误: keys=${Object.keys(body).join(',')} success=${body.success}`)
    }

    if (!data.upload_url.startsWith('https://')) {
      throw new Error('upload_url 必须使用 HTTPS 协议')
    }

    ctx.log.info(`[ImgRoute] 预签名成功`)
    return data
  } catch (error) {
    let errorMsg = error.message || '未知错误'
    let errorCode = ''

    const errBody = await unwrapResponse(error.response || error)
    if (errBody && typeof errBody === 'object') {
      errorCode = errBody.code || ''
      if (errBody.error || errBody.message || errBody.detail) {
        errorMsg = errBody.error || errBody.message || errBody.detail
      }
    }

    ctx.log.error(`[ImgRoute] 预签名失败: ${errorCode ? `[${errorCode}] ` : ''}${errorMsg}`)
    throw new Error(`预签名失败: ${errorCode ? `[${errorCode}] ` : ''}${errorMsg}`)
  }
}

/**
 * 上传文件到预签名URL
 * @param {Object} ctx - PicGo 上下文
 * @param {string} uploadUrl - 预签名上传URL
 * @param {string} fileName - 文件名
 * @param {string} mimeType - MIME 类型
 * @param {Buffer} buffer - 文件内容
 * @returns {boolean} 是否上传成功
 */
async function uploadFile(ctx, uploadUrl, fileName, mimeType, buffer) {
  // 使用加密随机数生成 boundary
  const boundary = '----PicGo' + crypto.randomBytes(16).toString('hex')
  const payload = buildMultipartBody(boundary, fileName, mimeType, buffer)

  const safeFileName = sanitizeFileName(fileName)
  ctx.log.info(`[ImgRoute] 开始上传: ${safeFileName} (${buffer.length} bytes)`)

  try {
    const response = await requestWithRetry(ctx, {
      method: 'POST',
      url: uploadUrl,
      headers: {
        'Content-Type': `multipart/form-data; boundary=${boundary}`,
        'Content-Length': payload.length
      },
      data: payload,
      responseType: 'json'
    }, '文件上传')

    const body = await unwrapResponse(response)
    if (body && body.success === true) {
      ctx.log.info(`[ImgRoute] 上传成功: ${safeFileName}`)
      return true
    }
    if (body && body.success === false) {
      throw new Error(`[${body.code || 'ERROR'}] ${body.error || body.message || body.detail || '上传被拒'}`)
    }

    throw new Error('上传响应中 success 不为 true')
  } catch (error) {
    let errorMsg = error.message || '未知错误'
    const errBody = await unwrapResponse(error.response || error)
    if (errBody && typeof errBody === 'object') {
      errorMsg = errBody.message || errBody.detail || errBody.error || errorMsg
    }
    ctx.log.error(`[ImgRoute] 上传失败: ${errorMsg}`)
    throw new Error(`文件上传失败: ${errorMsg}`)
  }
}

/**
 * 处理单张图片上传
 * @param {Object} ctx - PicGo 上下文
 * @param {Object} img - 图片对象
 * @param {string} apiKey - API Key
 */
async function handleSingleImage(ctx, img, apiKey) {
  const fileName = img.fileName
  const extname = img.extname || ''

  // 获取文件 buffer
  let buffer = img.buffer
  if (!buffer && img.base64Image) {
    buffer = Buffer.from(img.base64Image, 'base64')
    ctx.log.info(`[ImgRoute] 从 base64 转换`)
  } else if (!buffer && img.data) {
    if (Buffer.isBuffer(img.data)) {
      buffer = img.data
    } else if (img.data instanceof ArrayBuffer) {
      buffer = Buffer.from(img.data)
    } else if (ArrayBuffer.isView(img.data)) {
      buffer = Buffer.from(img.data.buffer, img.data.byteOffset, img.data.byteLength)
    } else if (typeof img.data === 'string') {
      buffer = Buffer.from(img.data, 'base64')
    }
    if (buffer) ctx.log.info(`[ImgRoute] 从 data 转换`)
  }

  ctx.log.info(`[ImgRoute] DIAG keys=${Object.keys(img).join(',')} | buffer=${!!img.buffer} base64=${!!img.base64Image} data=${!!img.data} info=${!!img.info} w=${img.info && img.info.width} h=${img.info && img.info.height} | ext=${extname} bufLen=${buffer ? buffer.length : 0}`)

  if (!buffer || buffer.length === 0) {
    throw new Error(`无法获取文件内容`)
  }

  const mimeType = getMimeType(extname)

  let width = 0
  let height = 0
  let sizeSource = ''
  if (img.info && typeof img.info.width === 'number' && img.info.width > 0 && typeof img.info.height === 'number' && img.info.height > 0) {
    width = img.info.width
    height = img.info.height
    sizeSource = 'img.info'
  } else if (typeof img.width === 'number' && img.width > 0 && typeof img.height === 'number' && img.height > 0) {
    width = img.width
    height = img.height
    sizeSource = 'img.width/height'
  } else {
    try {
      const dimensions = sizeOf(buffer)
      width = dimensions.width || 0
      height = dimensions.height || 0
      sizeSource = 'sizeOf'
    } catch (e) {
      ctx.log.warn(`[ImgRoute] 无法获取图片尺寸: ${e.message}`)
    }
  }
  ctx.log.info(`[ImgRoute] 尺寸 source=${sizeSource} ${width}x${height}`)

  const presignData = await getPresignUrl(
    ctx,
    apiKey,
    fileName,
    buffer.length,
    mimeType,
    width,
    height
  )

  const { upload_url, cdn_url } = presignData

  if (!upload_url || !cdn_url) {
    throw new Error('预签名响应缺少必要字段 (upload_url 或 cdn_url)')
  }

  // Step 2: 上传文件
  await uploadFile(ctx, upload_url, fileName, mimeType, buffer)

  // 设置返回的 URL
  img.imgUrl = cdn_url
  img.url = cdn_url

  ctx.log.info(`[ImgRoute] 图片地址已设置`)
}

/**
 * 上传处理函数
 * @param {Object} ctx - PicGo 上下文
 * @returns {Object} 返回 ctx
 */
async function handle(ctx) {
  // 获取用户配置
  const userConfig = ctx.getConfig('picBed.imgroute') || {}
  const { apiKey } = userConfig

  if (!apiKey) {
    const msg = '未配置 API Key'
    ctx.log.error(`[ImgRoute] ${msg}`)
    ctx.emit('notification', {
      title: 'ImgRoute 配置错误',
      body: msg
    })
    throw new Error(msg)
  }

  // 确保输出数组存在
  if (!ctx.output || !Array.isArray(ctx.output) || ctx.output.length === 0) {
    const msg = '没有待上传的图片'
    ctx.log.error(`[ImgRoute] ${msg}`)
    throw new Error(msg)
  }

  ctx.log.info(`[ImgRoute] 开始上传 ${ctx.output.length} 张图片`)

  // 遍历上传每张图片
  const results = await Promise.allSettled(
    ctx.output.map(async (img) => {
      try {
        await handleSingleImage(ctx, img, apiKey)
        return { success: true, fileName: img.fileName }
      } catch (error) {
        ctx.log.error(`[ImgRoute] 上传失败: ${error.message}`)
        // 发送通知
        ctx.emit('notification', {
          title: 'ImgRoute 上传失败',
          body: error.message
        })
        return { success: false, fileName: img.fileName, error: error.message }
      }
    })
  )

  // 检查是否有成功上传的图片
  const successCount = results.filter(r => r.status === 'fulfilled' && r.value.success).length
  const failCount = results.length - successCount

  ctx.log.info(`[ImgRoute] 上传完成: 成功 ${successCount} 张, 失败 ${failCount} 张`)

  if (successCount === 0) {
    const firstFail = results.find(r =>
      (r.status === 'fulfilled' && r.value && r.value.error) ||
      r.status === 'rejected'
    )
    let detail = ''
    if (firstFail) {
      if (firstFail.status === 'rejected') {
        detail = firstFail.reason && firstFail.reason.message
      } else {
        detail = firstFail.value.error
      }
    }
    throw new Error(detail ? `所有图片上传失败：${detail}` : '所有图片上传失败')
  }

  if (failCount > 0) {
    ctx.emit('notification', {
      title: 'ImgRoute 上传完成',
      body: `成功 ${successCount} 张, 失败 ${failCount} 张`
    })
  }

  return ctx
}

/**
 * 配置项定义
 * @returns {Array} inquirer 格式的配置数组
 */
function config() {
  return [
    {
      name: 'apiKey',
      type: 'input',
      default: '',
      required: true,
      alias: 'API Key'
    }
  ]
}

/**
 * 插件入口
 * @param {Object} ctx - PicGo 上下文
 * @returns {Object} 插件对象
 */
module.exports = (ctx) => {
  const register = () => {
    ctx.helper.uploader.register('imgroute', {
      handle,
      config,
      name: 'ImgRoute 图床'
    })
    ctx.log.info('[ImgRoute] 插件已注册')
  }

  return {
    register,
    uploader: 'imgroute'
  }
}
