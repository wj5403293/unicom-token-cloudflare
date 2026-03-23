# GitHub + Cloudflare 一键部署

这个项目已经可以按 GitHub 仓库方式托管，并接入 Cloudflare 自动部署。

## 方案一：Cloudflare 面板直接导入 GitHub 仓库

这是最接近“一键部署”的方式。

### 1. 先把项目传到 GitHub

如果你还没有 Git 仓库，进入项目目录后执行：

```bash
cd /storage/emulated/0/Download/qiandao
git init
git add .
git commit -m "init worker project"
```

然后在 GitHub 新建一个仓库，把本地代码推上去。

示例：

```bash
git branch -M main
git remote add origin https://github.com/你的用户名/你的仓库名.git
git push -u origin main
```

### 2. 在 Cloudflare 里导入仓库

1. 打开 Cloudflare 控制台
2. 进入 `Workers & Pages`
3. 点击 `Create`
4. 选择 `Import a repository`
5. 授权 Cloudflare 访问你的 GitHub
6. 选择这个项目仓库

如果 Cloudflare 识别为 Worker 项目，直接继续创建即可。

### 3. 配置线上 Secret

导入后，在 Worker 项目设置里添加 Secret：

- 名称：`SESSION_SECRET`
- 值：一串至少 32 位的随机字符串

### 4. 触发部署

保存后执行首次部署。之后只要你往 `main` 分支推送代码，Cloudflare 就会自动重新构建和发布。

## 方案二：GitHub Actions 自动部署到 Cloudflare

项目里已经提供好了工作流文件：

[.github/workflows/deploy-worker.yml](/storage/emulated/0/Download/qiandao/.github/workflows/deploy-worker.yml#L1)

它会在 `main` 分支有新提交时自动执行：

1. 安装依赖
2. 执行 `npm run check`
3. 执行 `wrangler deploy`

### 1. 在 GitHub 仓库里配置 Secrets

打开 GitHub 仓库：

`Settings` -> `Secrets and variables` -> `Actions`

添加两个 Secret：

- `CLOUDFLARE_API_TOKEN`
- `CLOUDFLARE_ACCOUNT_ID`

### 2. 如何拿到 Cloudflare API Token

1. 打开 Cloudflare 控制台
2. 点击右上角头像
3. 进入 `My Profile`
4. 打开 `API Tokens`
5. 创建一个可用于 Workers 部署的 Token

建议最少包含：

- `Account` 下对 Workers 的编辑权限

### 3. 如何拿到 Account ID

Cloudflare 控制台右侧栏通常可以看到 `Account ID`，复制后填入 GitHub Secret。

### 4. 推送代码触发部署

当你 push 到 `main` 分支后，GitHub Actions 会自动部署到 Cloudflare。

## 方案三：公开仓库做 Deploy Button

如果你的仓库是公开的，可以用 Cloudflare 的部署链接：

```text
https://deploy.workers.cloudflare.com/?url=https://github.com/你的用户名/你的仓库名
```

把上面的仓库地址替换成你自己的 GitHub 地址，发给别人后，对方打开就可以快速把这个 Worker 部署到自己的 Cloudflare 账号。

## 推荐做法

如果你自己部署，推荐顺序是：

1. 先上传 GitHub
2. 优先使用 Cloudflare 面板导入 GitHub 仓库
3. 如果你更想要“每次 push 自动发布”，就使用仓库里的 GitHub Actions

## 这个项目里已经准备好的文件

- Git 忽略文件：[.gitignore](/storage/emulated/0/Download/qiandao/.gitignore#L1)
- Worker 自动部署工作流：[.github/workflows/deploy-worker.yml](/storage/emulated/0/Download/qiandao/.github/workflows/deploy-worker.yml#L1)
- Cloudflare Worker 配置：[wrangler.jsonc](/storage/emulated/0/Download/qiandao/wrangler.jsonc#L1)
- 项目脚本：[package.json](/storage/emulated/0/Download/qiandao/package.json#L1)
