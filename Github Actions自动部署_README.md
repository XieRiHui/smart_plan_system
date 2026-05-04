## CI/CD（GitHub Actions 自动部署到 GitHub Pages）

GitHub Actions 工作流： `./.github/workflows/deploy-pages.yml`

项目的github仓库：https://github.com/XieRiHui/smart_plan_system

### 1) 在 GitHub 仓库启用 Pages

进入仓库：

- Settings → Pages
- Build and deployment → Source 选择 GitHub Actions

### 2) 触发部署

将代码 push 到 `main` 分支后会自动触发：

- 安装依赖（frontend/package-lock.json）
- 执行 `npm run build`
- 部署 `frontend/dist` 到 GitHub Pages

部署完成后，Actions 日志里会给出访问地址（也可在 Settings → Pages 查看）。
