# qiandao-unicom-worker

联通 Token 获取工具的 Cloudflare Worker 版本。

前端页面和后端接口都已经改写为 Worker，可直接部署到 Cloudflare。

## 主要文件

- Worker 入口：[src/worker.js](src/worker.js)
- 前端页面：[src/page.js](/storage/emulated/0/Download/qiandao/src/page.js#L1)
- Cloudflare 配置：[wrangler.jsonc](/storage/emulated/0/Download/qiandao/wrangler.jsonc#L1)
- 基础部署文档：[DEPLOY_CF_WORKER.md](/storage/emulated/0/Download/qiandao/DEPLOY_CF_WORKER.md#L1)
- GitHub 自动部署文档：[GITHUB_CLOUDFLARE_DEPLOY.md](/storage/emulated/0/Download/qiandao/GITHUB_CLOUDFLARE_DEPLOY.md#L1)

## 本地运行

```bash
npm install
cp .dev.vars.example .dev.vars
npm run dev
```

## GitHub + Cloudflare

如果你想上传 GitHub 后直接让 Cloudflare 自动部署，优先看：

[GITHUB_CLOUDFLARE_DEPLOY.md](/storage/emulated/0/Download/qiandao/GITHUB_CLOUDFLARE_DEPLOY.md#L1)

如果你想做公开仓库的一键部署，可使用这种链接格式：

```text
https://deploy.workers.cloudflare.com/?url=https://github.com/你的用户名/你的仓库名
```
