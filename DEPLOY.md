# 发布步骤

站点是纯静态文件，**没有构建命令、不需要环境变量、不需要任何服务端配置**。
下面两条路线都不依赖具体平台的菜单名称，按页面上的同类入口操作即可。

---

## 路线 A：EdgeOne Makers Drop（主用）

1. 登录 EdgeOne，进入 Makers / 静态站点托管，找到带 **Drop / 上传 ZIP / 拖拽上传** 字样的区域。
2. 把 `nev-chain-site.zip` 直接拖进去（ZIP 解压后根目录就是 `index.html`，不要再套一层文件夹）。
3. 按提示填一个项目前缀（例如 `nev-chain`）。
4. 点部署，等状态变为成功，拿到形如 `https://nev-chain.xxx.edgeone.dev` 的链接。
5. 打开链接，依次验证：首页、`#/node/up`、`#/routes`，以及直接在地址栏刷新二级链接（hash 路由不会 404）。

更新内容时：重新打包 ZIP → 覆盖上传 → 重新部署。

---

## 路线 B：GitHub Pages（备用，子路径部署）

1. 新建仓库，把站点文件**解压后**推到仓库根目录，确认根目录有 `index.html`（不要放的是 ZIP）。
2. 仓库 **Settings → Pages**，Source 选 **Deploy from a branch**，Branch 选 `main`，目录选 `/ (root)`，保存。
3. 等 1 分钟左右，访问 `https://<用户名>.github.io/<仓库名>/`。
4. 站点全部使用**相对路径 + hash 路由**，部署在 `/仓库名/` 子路径下无需任何改动；刷新与分享 `#/node/xxx` 都不会 404。
5. 更新内容：修改文件 → 提交推送 → Pages 自动重新发布。

---

## 常见问题

| 现象 | 原因与处理 |
|---|---|
| 页面空白、控制台报 CORS | 是通过 `file://` 打开但缺少 `data/chain.js`。补齐该文件即可（它是 `chain.json` + `faq.json` 的内联副本）。 |
| 改了 `chain.json` 线上没变化 | 线上优先读取 JSON，等待缓存或无痕刷新；若双击打开无变化，说明忘了同步 `data/chain.js`（见 README 4.1）。 |
| 直接访问 `/#/node/xxx` 显示首页 | 地址被截断，确认 `#` 之后的内容完整；hash 由浏览器本地解析，不会被服务器处理。 |
| 上传被拒 | 确认上传的是 ZIP 且小于 25 MB（本包 < 200 KB）；确认包内根目录就是 `index.html`。 |
