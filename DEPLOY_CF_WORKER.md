# Cloudflare Worker 部署说明

## 1. 前置要求

- 已有 Cloudflare 账号
- 本机已安装 Node.js 18 及以上版本
- 本机可以执行 `npm`

## 2. 安装依赖

项目根目录执行：

```bash
npm install
```

这会安装 `wrangler`，用于本地调试和部署 Worker。

## 3. 配置本地开发环境

1. 复制示例变量文件：

```bash
cp .dev.vars.example .dev.vars
```

2. 编辑 `.dev.vars`，设置一个足够长的随机字符串：

```env
SESSION_SECRET=请替换成至少32位的随机字符串
```

这个值用于签名 Cookie，会影响设备指纹和滑块会话状态的保存。

## 4. 本地调试

执行：

```bash
npm run dev
```

Wrangler 会启动本地调试服务。默认会输出一个本地访问地址，打开后即可访问页面。

如果只想做基础语法检查，可以执行：

```bash
npm run check
```

## 5. 登录 Cloudflare

首次部署前执行：

```bash
npx wrangler login
```

浏览器完成授权后即可继续。

## 6. 设置线上 Secret

部署前必须把 `SESSION_SECRET` 写入 Cloudflare Worker Secret：

```bash
npx wrangler secret put SESSION_SECRET
```

终端提示后粘贴一个强随机字符串并回车保存。

## 7. 修改 Worker 名称

如需自定义服务名，编辑根目录的 `wrangler.jsonc`：

```jsonc
{
  "name": "你的-worker-名称"
}
```

部署后的默认访问地址通常是：

```text
https://你的-worker-名称.你的子域.workers.dev
```

## 8. 正式部署

执行：

```bash
npm run deploy
```

部署成功后，Wrangler 会输出 Worker 地址。

## 9. 绑定自定义域名（可选）

如果你要使用自己的域名，可以在 Cloudflare Dashboard 中：

1. 打开 `Workers & Pages`
2. 进入当前 Worker
3. 打开 `Triggers` 或 `Domains & Routes`
4. 绑定一个自定义域名或路由

绑定后等待 DNS 生效即可。

## 10. 使用说明

- 页面入口是 `/`
- 后端接口是 `/api`
- 页面会通过签名 Cookie 保存 `deviceId` 和滑块验证所需的 `mobileHex`
- 不依赖 KV、D1、R2 等额外 Cloudflare 组件

## 11. 风险与注意事项

- 本项目已从 Flask 改写为 Cloudflare Worker，但上游联通接口存在风控策略，是否允许 Cloudflare 出口 IP 访问，取决于实时风控情况。
- 如果上游返回 HTML 或异常页面，前端会显示类似 “HTML响应(IP被风控)” 的错误。
- 如果后续页面或接口参数发生变化，需要同步更新 `src/worker.js` 内的请求参数与请求头。

## 12. GitHub 自动部署

如果你想把项目放到 GitHub 后，让 Cloudflare 或 GitHub 自动部署，可以继续看：

[GITHUB_CLOUDFLARE_DEPLOY.md](/storage/emulated/0/Download/qiandao/GITHUB_CLOUDFLARE_DEPLOY.md#L1)
