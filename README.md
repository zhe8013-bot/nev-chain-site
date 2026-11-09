# 链上透视 · 新能源汽车产业链智能体

一个**纯静态**的产业链下钻站点：总览 → 上/中/下游 → 细分赛道 → 企业/技术/指标，四层可点透；
配关键词检索、22 条本地预设问答、上下游关系图与横向关联跳转。

- 技术栈：HTML + CSS + 原生 JavaScript。**没有 Node 运行时依赖、没有构建步骤、没有 npm 包、没有 CDN**。
- 入口：根目录 `index.html`，双击即可打开；也可直接扔进任意静态托管。
- 数据：`data/chain.json`（56 个节点）+ `data/faq.json`（22 条问答），由 `data/chain.js` 内联一份副本。

---

## 1. 目录结构

```
index.html              入口页（页面骨架 + 静态文案）
assets/
  css/styles.css        全部样式（深色主题、栅格、响应式）
  js/app.js             全部逻辑（hash 路由、渲染、检索、问答）
data/
  chain.json            产业链节点树（可替换的源文件）
  faq.json              预设问答库（可替换的源文件）
  chain.js              上面两份 JSON 的内联副本，供 file:// 双击时使用
README.md               本文件
DEPLOY.md               公网部署步骤（EdgeOne / GitHub Pages）
```

体积：整包 < 200 KB，无图片资源（图标用内联 SVG / CSS 绘制），远低于 25 MB 限制。

---

## 2. 怎么打开

| 方式 | 操作 | 说明 |
|---|---|---|
| 双击 | 直接双击 `index.html` | `file://` 下浏览器会拦截 `fetch`，站点自动改用 `data/chain.js` 里的内联副本，功能完整 |
| 本地服务器 | `python -m http.server 8000`，访问 `http://localhost:8000/` | 优先读取 `data/chain.json` / `faq.json`，改完 JSON 刷新即可生效 |
| 线上 | 见 `DEPLOY.md` | 建议直接上传 ZIP |

> 两种方式都不需要安装任何依赖。窗口宽度 ≥ 960px 为桌面布局，≤ 620px 自动切为单列移动布局。

### 路由

全部使用 **hash 路由**，静态托管不需要任何服务端重写，刷新与分享二级链接都不会 404：

| 地址 | 页面 |
|---|---|
| `#/node/ov` | 产业链总览（L1） |
| `#/node/up` | 上游：资源与材料（L2） |
| `#/node/up-li` | 锂资源（L3） |
| `#/node/up-li-sl` | 盐湖提锂（L4） |
| `#/routes` | 5 条推荐路径总览 |

浏览器前进 / 后退、面包屑逐级回退都可用。

---

## 3. `chain.json` 数据结构

### 3.1 顶层

```json
{
  "meta": {
    "title": "链上透视 · 新能源汽车产业链",
    "version": "1.0",
    "updatedAt": "2026-11",
    "nodeCount": 56,
    "structure": "4 层：总览(1) → 上/中/下游(3) → 细分赛道(15) → 企业/技术/指标(37)",
    "dataPolicy": "所有价格、产能、市占率、销量类数字均为数量级参考……",
    "disclaimer": "本数据仅用于产业链科普与结构性理解，不构成投资建议。"
  },
  "segments": [ { "id": "up", "title": "上游 · 资源与材料", "color": "#C08A3E" } ],
  "routes":  [ { "id": "route-tech", "title": "技术派……", "desc": "……", "trail": ["ov","mid","mid-bat","mid-bat-catl"] } ],
  "nodes":   [ { ...节点... } ]
}
```

| 字段 | 类型 | 含义 | 前端怎么用 |
|---|---|---|---|
| `meta.title` | string | 站点标题 | 浏览器标题、页脚 |
| `meta.version` / `updatedAt` | string | 版本与更新时点 | 页脚展示 |
| `meta.nodeCount` | number | 节点总数（改数据时同步） | 仅作声明，界面用实际数组长度 |
| `meta.dataPolicy` | string | 数据口径声明 | 每个节点页"来源与口径"、页脚 |
| `meta.disclaimer` | string | 免责声明 | 页脚 |
| `segments[].id` | string | `up` / `mid` / `down` | 与节点的 `segment` 对应 |
| `segments[].title` | string | 板块标题 | 关系图的列标题 |
| `segments[].color` | string | 十六进制色值 | 该板块所有节点的主题色（卡片左边条、徽标、指标卡） |
| `routes[].id` / `title` / `desc` | string | 推荐路径的名称与说明 | `#/routes` 页面与总览页的路径卡 |
| `routes[].trail` | string[] | 有序节点 id，必须严格 L1→L2→L3→L4 | 渲染成可点击的路径步骤条 |

### 3.2 节点

```json
{
  "id": "mid-bat-catl",
  "title": "宁德时代",
  "subtitle": "全球装机第一",
  "level": 4,
  "parentId": "mid-bat",
  "segment": "mid",
  "type": "company",
  "summary": "全球动力电池装机份额约三成半，靠麒麟/神行等产品迭代与海外建厂维持领先。",
  "points": ["……", "……"],
  "metrics": [
    { "name": "全球装机份额", "value": "约35%–38%",
      "caliber": "SNE Research全球装机量", "asOf": "2024", "verify": true }
  ],
  "children": [],
  "related": ["mid-bat-byd", "mid-bat-data"],
  "sources": ["公司年报", "SNE Research"]
}
```

| 字段 | 必需 | 含义 | 前端渲染位置 |
|---|---|---|---|
| `id` | ✅ | 全局唯一，同时是 URL 片段 | 路由 key `#/node/<id>` |
| `title` | ✅ | 节点标题 | 卡片标题、`<h1>`、面包屑 |
| `level` | ✅ | 1–4 | 层级徽章、层级条、`L4` 标记 |
| `parentId` | ✅ | 父节点 id，根节点为 `null` | **向上透视**：面包屑由它逐级回溯 |
| `summary` | ✅ | 一句话结论 | 一句话结论块、卡片摘要、搜索摘要 |
| `points` | ✅ | 3–6 条要点 | "要点"列表 |
| `children` | ✅ | 下一层 id 数组，**空数组也要写** | **向下透视**：卡片组与"继续深入" |
| `subtitle` | 建议 | 副标题 | 标题下方强调行、卡片 |
| `segment` | 建议 | `up`/`mid`/`down`/`none` | 取 `segments[].color` 着色 |
| `type` | 建议 | `overview`/`segment`/`track`/`company`/`tech`/`metric`/`comparison`/`policy` | 类型徽章（总览/板块/细分赛道/企业/技术/指标/对比/政策） |
| `metrics` | 建议 | 关键数据数组 | 页面顶部"关键数据"卡片 |
| `related` | 可选 | 横向关联节点 id（不构成父子关系） | **横向透视**："横向透视"区块 |
| `sources` | 可选 | 来源类型 | 页面底部"来源与口径" |

`metrics` 子字段（**每一项都会显示在界面上**）：

| 字段 | 含义 | 界面表现 |
|---|---|---|
| `name` | 指标名 | 卡片左上标题 |
| `value` | 数量级或区间 | 卡片主数值 |
| `caliber` | 统计口径 | 小字「口径 xxx」 |
| `asOf` | 时点 | 小字「时点 xxx」 |
| `verify` | 是否需复核（布尔） | `true` 时右上角显示黄色「需复核」角标 |

> 另外，`points` / `summary` 里出现的 `【需复核】` 标记会被渲染成同款黄色小旗标。

### 3.3 `faq.json`

```json
{
  "meta": { "title": "链条问答 · 预设问答库", "version": "1.0", "itemCount": 22 },
  "items": [
    {
      "id": "q01",
      "question": "碳酸锂为什么从60万跌到10万以内？",
      "keywords": ["碳酸锂", "锂价", "锂", "价格", "跌", "60万", "10万"],
      "answer": "……150–250 字……",
      "drill": [ { "nodeId": "up-li-price", "label": "看价格周期与观察指标" } ],
      "related": ["q02", "q04"]
    }
  ]
}
```

| 字段 | 必需 | 说明 |
|---|---|---|
| `id` | ✅ | 问答唯一 id |
| `question` | ✅ | 展示用问题（也是抽屉里的推荐按钮文案） |
| `keywords` | ✅ | 命中词，支持口语与英文缩写 |
| `answer` | ✅ | 答案正文 |
| `drill[].nodeId` | ✅ | 必须存在于 `chain.json`；点击跳到该节点 |
| `drill[].label` | ✅ | 按钮文案，写"看什么" |
| `related` | 可选 | 关联问答 id，渲染成"你还可以问" |

**匹配规则**（本地、无 API）：把输入转小写，统计每条问答的 `keywords` 命中数，命中 ≥ 1 即进入候选，
按「命中数 → 关键词长度权重」排序取最高分；全不命中则展示兜底话术 + 3 条热门问答 + 检索到的相关节点。

---

## 4. 替换内容

### 4.1 只改数据（推荐）

1. 编辑 `data/chain.json` / `data/faq.json`。
2. **同步内联副本**（`file://` 双击时用的是它）。在站点根目录执行：

```powershell
$header = "/* 自动生成，请勿手工编辑 */`r`n"
$c = Get-Content -Raw -Encoding UTF8 "data\chain.json"
$f = Get-Content -Raw -Encoding UTF8 "data\faq.json"
$out = $header + "window.CHAIN_DATA = " + $c + ";`r`nwindow.FAQ_DATA = " + $f + ";`r`n"
[System.IO.File]::WriteAllText((Join-Path (Get-Location) "data\chain.js"), $out, (New-Object System.Text.UTF8Encoding($false)))
```

3. 刷新页面即可。用本地服务器访问时，前两步可以只改 JSON（站点会优先 `fetch` JSON）。

### 4.2 改完建议跑一遍自检

```powershell
$j = Get-Content -Raw -Encoding UTF8 data\chain.json | ConvertFrom-Json
$ids = @{}; $j.nodes | ForEach-Object { $ids[$_.id] = $true }
$j.nodes | ForEach-Object { $_.children } | Where-Object { -not $ids.ContainsKey($_) }   # 应无输出
$j.nodes | Where-Object { $_.level -lt 4 -and $_.children.Count -eq 0 }                  # 应无输出（无断头枝）
$j.nodes | Where-Object { $_.related } | ForEach-Object { $_.related } | Where-Object { -not $ids.ContainsKey($_) }  # 应无输出
$j.nodes | Group-Object level | Select-Object Name, Count                                 # 期望 1/3/15/37
```

### 4.3 改界面

- 颜色 / 间距 / 断点：`assets/css/styles.css` 顶部 `:root` 变量，板块色来自数据里的 `segments[].color`。
- 新增节点类型文案：`assets/js/app.js` 里的 `TYPE_LABEL`。
- 层级名称：`LEVEL_LABEL`、`renderDepthBar()`。

---

## 5. 内容规模与示例路径

- 节点 **56 个**：L1 = 1、L2 = 3、L3 = 15、L4 = 37，**无断头枝**，所有 L4 均为叶子。
- 问答 **22 条**，每条含若干 `drill` 下钻入口。
- 推荐路径 **5 条**，均为严格的四跳父子链。

最深路径示例（4 层，逐跳父子关系）：

```
#/node/ov          新能源汽车产业链总览      L1
 → #/node/up       上游：资源与材料          L2
   → #/node/up-li  锂资源                    L3
     → #/node/up-li-sl  盐湖提锂             L4
         ↳ 横向：related → 碳酸锂价格周期
```

`related` 的横向跳转是故意**不进** `trail` 的：它不属于父子层级，只做"横向透视"。

---

## 6. 数据校正说明

上游产出的 `chain.json` 中有 4 处 `related` 指向了不存在的节点 `down-route-bev`
（位于 `mid-edrive`、`mid-thm`、`down-chg`、`mid-thm-tech`），已删除这 4 个引用，
避免出现点击后落到"找不到环节"的死链。其余内容未改动。

---

## 7. 已知限制

- 问答是**关键词包含匹配**，不做语义理解；问法差异过大时会走兜底话术。
- 指标数值只到数量级/区间，`verify: true` 的条目需要按 `caliber` 自行复核后再引用。
- `level` 字段由数据显式声明，前端不重新推导；改父子关系时请同步改 `level`。
- 不支持 IE；需要支持 `fetch` / `:focus-visible` 的现代浏览器（Chrome、Edge、Safari、Firefox 近三年版本）。
