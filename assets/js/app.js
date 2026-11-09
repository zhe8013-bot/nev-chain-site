/* =========================================================
   链上透视 · 新能源汽车产业链智能体
   纯原生 JS：hash 路由 + 数据驱动渲染 + 本地检索 / 问答
   路由：#/node/<节点id>  |  #/routes（推荐路径）
   ========================================================= */
(function () {
  'use strict';

  var TYPE_LABEL = {
    overview: '总览', segment: '板块', track: '细分赛道',
    company: '企业', tech: '技术', metric: '指标',
    comparison: '对比', policy: '政策'
  };
  var LEVEL_LABEL = { 1: '产业链总览', 2: '板块', 3: '细分赛道', 4: '企业 / 技术 / 指标' };
  var SEGMENT_ORDER = ['up', 'mid', 'down'];

  var state = {
    chain: null,
    faq: null,
    byId: Object.create(null),
    faqById: Object.create(null),
    segColor: Object.create(null),
    searchIndex: []
  };

  var $ = function (s, r) { return (r || document).querySelector(s); };

  function esc(v) {
    return String(v == null ? '' : v).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  /* 把十六进制色与白色混合，得到适合深色背景的文字色 */
  function lighten(hex, amt) {
    var h = String(hex || '#7c8db5').replace('#', '');
    if (h.length === 3) h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2];
    var n = parseInt(h, 16);
    var r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
    r = Math.round(r + (255 - r) * amt);
    g = Math.round(g + (255 - g) * amt);
    b = Math.round(b + (255 - b) * amt);
    return '#' + ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1);
  }

  function segOf(node) {
    var s = node && node.segment;
    return s && s !== 'none' ? s : 'none';
  }
  function segColor(seg) {
    return state.segColor[seg] || '#7c8db5';
  }
  function layerVars(seg) {
    var c = segColor(seg);
    return '--layer:' + c + ';--layer-ink:' + lighten(c, 0.42) +
      ';--layer-soft:' + c + '24;--layer-line:' + c + '66';
  }
  function nodeVars(node) { return layerVars(segOf(node)); }

  /* ---------------- 数据装载 ---------------- */
  function loadData() {
    if (location.protocol === 'file:') {
      if (window.CHAIN_DATA && window.FAQ_DATA) {
        return Promise.resolve({ chain: window.CHAIN_DATA, faq: window.FAQ_DATA });
      }
      return Promise.reject(new Error('未找到内联数据 data/chain.js'));
    }
    var inline = (window.CHAIN_DATA && window.FAQ_DATA)
      ? { chain: window.CHAIN_DATA, faq: window.FAQ_DATA } : null;

    function getJSON(path) {
      return fetch(path, { cache: 'no-store' }).then(function (r) {
        if (!r.ok) throw new Error('HTTP ' + r.status + ' ' + path);
        return r.json();
      });
    }
    return Promise.all([getJSON('./data/chain.json'), getJSON('./data/faq.json')])
      .then(function (res) { return { chain: res[0], faq: res[1] }; })
      .catch(function (err) {
        if (inline) {
          console.warn('[数据] fetch 失败，改用内联副本：', err.message);
          return inline;
        }
        throw err;
      });
  }

  function buildIndex(chain, faq) {
    if (!chain || !Array.isArray(chain.nodes) || !chain.nodes.length) {
      throw new Error('chain.json 结构不合法：缺少 nodes 数组');
    }
    state.chain = chain;
    state.faq = faq || { items: [] };
    state.byId = Object.create(null);
    state.faqById = Object.create(null);
    state.segColor = Object.create(null);

    (chain.segments || []).forEach(function (s) { state.segColor[s.id] = s.color; });
    chain.nodes.forEach(function (n) { state.byId[n.id] = n; });
    (state.faq.items || []).forEach(function (q) { state.faqById[q.id] = q; });

    // 校验（开发期提示，不阻断渲染）
    chain.nodes.forEach(function (n) {
      (n.children || []).forEach(function (cid) {
        if (!state.byId[cid]) console.warn('[数据警告] ' + n.id + ' 的 children 指向不存在的 ' + cid);
      });
      if (n.parentId && !state.byId[n.parentId]) {
        console.warn('[数据警告] ' + n.id + ' 的 parentId 不存在：' + n.parentId);
      }
    });

    state.searchIndex = chain.nodes.map(function (n) {
      var crumbs = pathTo(n.id).map(function (x) { return x.title; }).join(' ');
      var metricNames = (n.metrics || []).map(function (m) { return m.name + ' ' + m.value; }).join(' ');
      return {
        id: n.id,
        node: n,
        title: n.title,
        level: n.level,
        segment: segOf(n),
        type: n.type,
        crumb: pathTo(n.id).slice(0, -1).map(function (x) { return x.title; }).join(' › '),
        haystack: [n.title, n.subtitle, n.summary, (n.points || []).join(' '), metricNames, crumbs]
          .filter(Boolean).join(' ').toLowerCase()
      };
    });
  }

  function pathTo(id) {
    var out = [], cur = state.byId[id], guard = 0;
    while (cur && guard++ < 16) {
      out.unshift(cur);
      cur = cur.parentId ? state.byId[cur.parentId] : null;
    }
    return out;
  }
  function kidsOf(node) {
    return (node.children || []).map(function (id) { return state.byId[id]; }).filter(Boolean);
  }
  function siblingsOf(node) {
    if (!node.parentId) return [];
    var p = state.byId[node.parentId];
    if (!p) return [];
    return (p.children || []).map(function (id) { return state.byId[id]; })
      .filter(function (x) { return x && x.id !== node.id; });
  }

  /* ---------------- 路由 ---------------- */
  function parseRoute() {
    var h = location.hash || '';
    if (/^#\/routes\b/.test(h)) return { type: 'routes' };
    var m = /^#\/node\/([A-Za-z0-9_-]+)/.exec(h);
    if (m) return { type: 'node', id: m[1] };
    return null;
  }
  function go(hash) {
    if (location.hash === hash) render();
    else location.hash = hash;
  }
  function goNode(id) { go('#/node/' + id); }

  /* ---------------- 文本工具 ---------------- */
  function withVerifyBadge(text) {
    // 数据里用【需复核】标注的句子，渲染成醒目徽标
    return esc(text).replace(/【需复核】/g, '<em class="vflag">需复核</em>');
  }

  function markTokens(text, tokens) {
    var safe = esc(text);
    tokens.forEach(function (t) {
      if (!t) return;
      var re = new RegExp('(' + t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + ')', 'gi');
      safe = safe.replace(re, '<mark>$1</mark>');
    });
    return safe;
  }

  /* ---------------- 渲染：面包屑 ---------------- */
  function renderCrumbs(node) {
    var trail = pathTo(node.id);
    var html = trail.map(function (n, i) {
      var last = i === trail.length - 1;
      return '<a href="#/node/' + esc(n.id) + '"' + (last ? ' aria-current="page"' : '') + '>' +
        esc(n.title) + '</a>' + (last ? '' : '<span class="crumbs__sep" aria-hidden="true">›</span>');
    }).join('');
    return '<nav class="crumbs" aria-label="面包屑导航">' + html + '</nav>';
  }

  /* ---------------- 渲染：指标卡 ---------------- */
  function renderMetrics(node) {
    if (!node.metrics || !node.metrics.length) return '';
    var cards = node.metrics.map(function (m) {
      var verify = m.verify
        ? '<span class="stat__verify" title="该数值需按口径复核">需复核</span>' : '';
      return '<div class="stat">' +
        '<div class="stat__head"><span class="stat__label">' + esc(m.name) + '</span>' + verify + '</div>' +
        '<div class="stat__value">' + esc(m.value) + '</div>' +
        '<div class="stat__meta"><span>口径</span>' + esc(m.caliber || '—') + '</div>' +
        '<div class="stat__meta"><span>时点</span>' + esc(m.asOf || '—') + '</div>' +
        '</div>';
    }).join('');
    return '<section class="section">' +
      '<div class="section__head"><h2>关键数据</h2>' +
      '<span class="section__note">数值为数量级参考，务必按口径复核</span></div>' +
      '<div class="stats">' + cards + '</div></section>';
  }

  /* ---------------- 渲染：节点卡片 ---------------- */
  function renderCard(node, i) {
    var kids = kidsOf(node);
    var isLeaf = kids.length === 0;
    var kind = TYPE_LABEL[node.type] || '环节';
    var summary = node.summary || node.subtitle || '';
    return '<a class="card' + (isLeaf ? ' card--leaf' : '') + '" href="#/node/' + esc(node.id) + '" style="' + nodeVars(node) + '">' +
      '<div class="card__top">' +
        '<span class="card__idx">' + String(i + 1).padStart(2, '0') + '</span>' +
        '<span class="card__kind">L' + esc(node.level) + ' · ' + esc(kind) + '</span>' +
      '</div>' +
      '<h3 class="card__title">' + esc(node.title) + '</h3>' +
      '<p class="card__desc">' + esc(summary) + '</p>' +
      '<div class="card__foot">' +
        '<span class="card__count">' + (isLeaf ? '末端环节 · 查看详情' : '含 <b>' + kids.length + '</b> 个子环节') + '</span>' +
        '<span class="card__arrow" aria-hidden="true">›</span>' +
      '</div>' +
    '</a>';
  }

  /* ---------------- 渲染：层级条 ---------------- */
  function renderDepthBar(level, seg) {
    var names = ['总览', '上 / 中 / 下游', '细分赛道', '企业 / 技术 / 指标'];
    var html = names.map(function (name, i) {
      var lv = i + 1;
      return '<span class="depth__step" data-on="' + (lv === level) + '" data-done="' + (lv < level) + '">' +
        '<i></i>L' + lv + ' ' + esc(name) + '</span>';
    }).join('');
    return '<div class="depth" style="' + layerVars(seg) + '" aria-label="当前层级">' + html + '</div>';
  }

  /* ---------------- 渲染：产业链关系图 ---------------- */
  function renderChainMap() {
    var cols = SEGMENT_ORDER.map(function (segId, i) {
      var segNode = state.chain.nodes.filter(function (n) {
        return n.segment === segId && n.level === 2;
      })[0];
      if (!segNode) return '';
      var tracks = kidsOf(segNode);
      var list = tracks.map(function (t) {
        var n = kidsOf(t).length;
        return '<a href="#/node/' + esc(t.id) + '">' +
          '<span>' + esc(t.title) + '</span>' +
          '<em>' + (n ? n + ' 项' : '—') + '</em></a>';
      }).join('');
      var col = '<div class="cmcol" style="' + layerVars(segId) + '">' +
        '<div class="cmcol__head">' +
          '<span class="cmcol__dot" aria-hidden="true"></span>' +
          '<span class="cmcol__name">' + esc(segNode.title) + '</span>' +
          '<span class="cmcol__sub">' + tracks.length + ' 个赛道</span>' +
        '</div>' +
        '<div class="cmcol__list">' + list + '</div>' +
      '</div>';
      var arrow = i < SEGMENT_ORDER.length - 1
        ? '<div class="cmarrow" aria-hidden="true"><span>→</span></div>' : '';
      return col + arrow;
    }).join('');

    return '<section class="chainmap" aria-label="产业链上下游关系">' +
      '<div class="chainmap__head">' +
        '<h2>产业链上下游关系</h2>' +
        '<p>上游决定成本地板，中游决定性能与体验，下游决定需求节奏；回收环节把链条闭环回上游。点击任一赛道可直接下钻。</p>' +
      '</div>' +
      '<div class="chainmap__grid">' + cols + '</div>' +
    '</section>';
  }

  /* ---------------- 渲染：推荐路径 ---------------- */
  function renderRoutes(compact) {
    var routes = state.chain.routes || [];
    if (!routes.length) return '';
    var cards = routes.map(function (r, i) {
      var steps = (r.trail || []).map(function (id, si) {
        var n = state.byId[id];
        if (!n) return '';
        var last = si === r.trail.length - 1;
        return '<a class="rstep" href="#/node/' + esc(n.id) + '" style="' + nodeVars(n) + '">' +
          '<span class="rstep__lv">L' + n.level + '</span>' +
          '<span class="rstep__title">' + esc(n.title) + '</span>' +
          (last ? '' : '<span class="rstep__arrow" aria-hidden="true">›</span>') +
        '</a>';
      }).join('');
      var lastNode = state.byId[(r.trail || [])[(r.trail || []).length - 1]];
      return '<article class="routecard">' +
        '<div class="routecard__top">' +
          '<span class="routecard__idx">0' + (i + 1) + '</span>' +
          '<span class="routecard__tag">' + (r.trail || []).length + ' 跳</span>' +
        '</div>' +
        '<h3 class="routecard__title">' + esc(r.title) + '</h3>' +
        '<p class="routecard__desc">' + esc(r.desc || '') + '</p>' +
        '<div class="rsteps">' + steps + '</div>' +
        (lastNode
          ? '<a class="routecard__go" href="#/node/' + esc(lastNode.id) + '">走到终点：' + esc(lastNode.title) + ' <span aria-hidden="true">→</span></a>'
          : '') +
      '</article>';
    }).join('');

    if (compact) {
      return '<section class="section">' +
        '<div class="section__head"><h2>推荐路径</h2>' +
        '<a class="section__more" href="#/routes">查看全部 ' + routes.length + ' 条 →</a></div>' +
        '<div class="routelist">' + routes.map(function (r) {
          var last = state.byId[(r.trail || [])[(r.trail || []).length - 1]];
          return '<a class="routelist__item" href="#/node/' + esc(last ? last.id : state.chain.nodes[0].id) + '">' +
            '<span class="routelist__title">' + esc(r.title) + '</span>' +
            '<span class="routelist__desc">' + esc(r.desc || '') + '</span>' +
            '<span class="routelist__arrow" aria-hidden="true">→</span></a>';
        }).join('') + '</div>' +
      '</section>';
    }
    return '<section class="routes">' +
      '<div class="routes__head"><h2>5 条推荐路径</h2>' +
      '<p>每条路径都是严格的 L1 → L2 → L3 → L4 父子链，可当作导览走一遍。</p></div>' +
      '<div class="routes__grid">' + cards + '</div></section>';
  }

  /* ---------------- 渲染：节点页 ---------------- */
  function renderNodePage(node) {
    var seg = segOf(node);
    var kids = kidsOf(node);
    var typeLabel = TYPE_LABEL[node.type] || '环节';
    var html = renderCrumbs(node);

    html += '<section class="hero" style="' + layerVars(seg) + '">';
    html += '<div class="hero__top">' +
      '<span class="pill">L' + esc(node.level) + ' · ' + esc(LEVEL_LABEL[node.level] || '环节') + '</span>' +
      '<span class="pill pill--plain">' + esc(typeLabel) + '</span>' +
      (node.level < 4
        ? '<span class="pill pill--plain">' + kids.length + ' 个下层环节</span>'
        : '<span class="pill pill--plain">末端节点</span>') +
      '</div>';
    html += '<h1>' + esc(node.title) + '</h1>';
    if (node.subtitle) html += '<p class="hero__sub">' + esc(node.subtitle) + '</p>';
    if (node.summary) {
      html += '<div class="conclusion"><span class="conclusion__tag">一句话结论</span>' +
        '<p>' + withVerifyBadge(node.summary) + '</p></div>';
    }
    html += renderDepthBar(node.level, seg);
    html += '</section>';

    html += renderMetrics(node);

    if (node.points && node.points.length) {
      html += '<section class="section">' +
        '<div class="section__head"><h2>要点</h2><span class="section__note">' + node.points.length + ' 条</span></div>' +
        '<div class="points">' + node.points.map(function (p, i) {
          return '<div class="point"><span class="point__n">' + String(i + 1).padStart(2, '0') + '</span>' +
            '<span>' + withVerifyBadge(p) + '</span></div>';
        }).join('') + '</div></section>';
    }

    if (kids.length) {
      html += '<section class="section">' +
        '<div class="section__head"><h2>继续深入</h2>' +
        '<span class="section__note">共 ' + kids.length + ' 个下层环节，点击卡片下钻</span></div>' +
        '<div class="cards">' + kids.map(renderCard).join('') + '</div></section>';
    } else {
      html += '<section class="section">' +
        '<div class="leafnote"><span class="leafnote__icon" aria-hidden="true">✓</span>' +
        '<span><strong>已到第 ' + node.level + ' 层（最底层）。</strong>' +
        '本节点没有下一层，可以沿面包屑逐级回退，或用下面的「横向透视」跳到相邻环节。</span></div></section>';
    }

    var related = (node.related || []).map(function (id) { return state.byId[id]; }).filter(Boolean);
    if (related.length) {
      html += '<section class="section">' +
        '<div class="section__head"><h2>横向透视</h2>' +
        '<span class="section__note">related：不构成上下层级的关联环节</span></div>' +
        '<div class="related-links">' + related.map(function (r) {
          return '<a class="rellink" href="#/node/' + esc(r.id) + '" style="' + nodeVars(r) + '">' +
            '<span class="rellink__dot" aria-hidden="true"></span>' +
            '<span class="rellink__body">' +
              '<span class="rellink__title">' + esc(r.title) + '</span>' +
              '<span class="rellink__sub">L' + r.level + ' · ' + esc(TYPE_LABEL[r.type] || '环节') +
                (r.subtitle ? ' · ' + esc(r.subtitle) : '') + '</span>' +
            '</span>' +
            '<span class="rellink__arrow" aria-hidden="true">→</span>' +
          '</a>';
        }).join('') + '</div></section>';
    }

    var sibs = siblingsOf(node);
    if (node.level === 4 && sibs.length) {
      html += '<section class="section">' +
        '<div class="section__head"><h2>同层环节</h2>' +
        '<span class="section__note">同一父节点下的兄弟节点</span></div>' +
        '<div class="chips">' + sibs.map(function (s) {
          return '<a class="chip chip--link" href="#/node/' + esc(s.id) + '">' + esc(s.title) + '</a>';
        }).join('') + '</div></section>';
    }

    if (node.level === 1) {
      html += renderRoutes(true);
      html += renderChainMap();
    }

    // 来源与口径
    var sources = node.sources || [];
    var policy = (state.chain.meta && state.chain.meta.dataPolicy) || '';
    if (sources.length || policy) {
      html += '<section class="section sources">' +
        '<div class="section__head"><h2>来源与口径</h2></div>' +
        (sources.length
          ? '<div class="chips">' + sources.map(function (s) {
              return '<span class="chip">' + esc(s) + '</span>';
            }).join('') + '</div>' : '') +
        (policy ? '<p class="sources__policy">数据口径：' + esc(policy) + '</p>' : '') +
      '</section>';
    }

    // 上一级 / 下一层
    html += '<nav class="pager" aria-label="层级导航">';
    if (node.parentId && state.byId[node.parentId]) {
      var p = state.byId[node.parentId];
      html += '<a class="btn btn--ghost" href="#/node/' + esc(p.id) + '">← 返回上一层：' + esc(p.title) + '</a>';
    } else {
      html += '<span class="pager__hint">已位于产业链最顶层</span>';
    }
    if (kids.length) {
      html += '<a class="btn btn--primary" href="#/node/' + esc(kids[0].id) + '">继续下钻：' + esc(kids[0].title) + ' →</a>';
    }
    html += '</nav>';

    return html;
  }

  /* ---------------- 主渲染 ---------------- */
  function render() {
    if (!state.chain) return;
    var app = $('#app');
    var route = parseRoute();

    if (route && route.type === 'routes') {
      app.innerHTML = '<nav class="crumbs" aria-label="面包屑导航">' +
        '<a href="#/node/' + esc(state.chain.nodes[0].id) + '">' + esc(state.chain.meta.title) + '</a>' +
        '<span class="crumbs__sep" aria-hidden="true">›</span>' +
        '<a href="#/routes" aria-current="page">推荐路径</a></nav>' + renderRoutes(false);
      document.title = '推荐路径 · ' + state.chain.meta.title;
      window.scrollTo(0, 0);
      return;
    }

    var id = route && route.id;
    if (!id) { goNode(state.chain.nodes[0].id); return; }

    var node = state.byId[id];
    if (!node) {
      var root = state.chain.nodes[0];
      app.innerHTML = '<div class="hero" style="--layer:#e06a6a;--layer-ink:#ff9b9b;--layer-soft:#e06a6a22;--layer-line:#e06a6a55">' +
        '<h1>找不到这个环节</h1>' +
        '<p class="hero__summary">节点「' + esc(id) + '」不存在，可能是链接里的 ID 拼错了。</p>' +
        '<div class="tags"><a class="btn btn--primary" href="#/node/' + esc(root.id) + '">返回总览</a></div></div>';
      document.title = '页面不存在 · ' + state.chain.meta.title;
      return;
    }

    app.innerHTML = renderNodePage(node);
    document.title = node.title + ' · ' + state.chain.meta.title;
    window.scrollTo(0, 0);
  }

  /* ---------------- 检索 ---------------- */
  function searchNodes(query) {
    var tokens = String(query).trim().toLowerCase().split(/\s+/).filter(Boolean);
    if (!tokens.length) return [];
    var out = [];
    state.searchIndex.forEach(function (item) {
      var score = 0;
      for (var i = 0; i < tokens.length; i++) {
        var t = tokens[i];
        if (item.haystack.indexOf(t) === -1) return;
        score += 2;
        if (item.title.toLowerCase().indexOf(t) !== -1) score += 8;
        var n = item.node;
        if ((n.subtitle || '').toLowerCase().indexOf(t) !== -1) score += 4;
        if ((n.summary || '').toLowerCase().indexOf(t) !== -1) score += 3;
      }
      score -= item.level * 0.2;
      out.push({ item: item, score: score });
    });
    out.sort(function (a, b) { return b.score - a.score; });
    return out.slice(0, 10).map(function (x) { return x.item; });
  }

  function initSearch() {
    var input = $('#search-input');
    var panel = $('#search-results');
    var clearBtn = $('#search-clear');
    var active = -1;
    var lastTokens = [];

    function close() {
      panel.hidden = true;
      input.setAttribute('aria-expanded', 'false');
      active = -1;
    }

    function paint(list, q) {
      if (!q.trim()) { close(); return; }
      lastTokens = q.trim().toLowerCase().split(/\s+/).filter(Boolean);
      if (!list.length) {
        panel.innerHTML = '<div class="sr-empty">没有匹配到「' + esc(q) + '」<br>换个更短的关键词试试，例如「锂」「电池」「SiC」「回收」。</div>';
      } else {
        panel.innerHTML = list.map(function (it, i) {
          var n = it.node;
          return '<a class="sr-item" role="option" data-i="' + i + '" data-id="' + esc(it.id) + '"' +
            ' href="#/node/' + esc(it.id) + '" style="' + nodeVars(n) + '">' +
            '<span class="sr-item__title"><span class="sr-dot" aria-hidden="true"></span>' +
              esc(it.title) +
              '<span class="sr-badge">L' + it.level + ' · ' + esc(TYPE_LABEL[it.type] || '环节') + '</span>' +
            '</span>' +
            '<span class="sr-item__path">' + esc(it.crumb || '产业链总览') + '</span>' +
            '<span class="sr-item__snippet">' + markTokens(n.summary || '', lastTokens) + '</span>' +
          '</a>';
        }).join('');
      }
      panel.hidden = false;
      input.setAttribute('aria-expanded', 'true');
      active = -1;
    }

    function setActive(i) {
      var items = panel.querySelectorAll('.sr-item');
      if (!items.length) return;
      if (i < 0) i = items.length - 1;
      if (i >= items.length) i = 0;
      Array.prototype.forEach.call(items, function (el) { el.removeAttribute('data-active'); });
      items[i].setAttribute('data-active', 'true');
      active = i;
      if (items[i].scrollIntoView) items[i].scrollIntoView({ block: 'nearest' });
    }

    input.addEventListener('input', function () {
      var q = input.value;
      clearBtn.hidden = !q;
      paint(searchNodes(q), q);
    });

    input.addEventListener('keydown', function (e) {
      if (e.key === 'ArrowDown') { e.preventDefault(); setActive(active + 1); }
      else if (e.key === 'ArrowUp') { e.preventDefault(); setActive(active - 1); }
      else if (e.key === 'Enter') {
        var items = panel.querySelectorAll('.sr-item');
        if (active >= 0 && items[active]) {
          e.preventDefault();
          goNode(items[active].getAttribute('data-id'));
          close(); input.blur();
        }
      } else if (e.key === 'Escape') { close(); input.blur(); }
    });

    panel.addEventListener('mousedown', function (e) { e.preventDefault(); });
    panel.addEventListener('click', function (e) {
      var a = e.target.closest('.sr-item');
      if (!a) return;
      e.preventDefault();
      goNode(a.getAttribute('data-id'));
      close(); input.blur();
    });

    clearBtn.addEventListener('click', function () {
      input.value = ''; clearBtn.hidden = true; close(); input.focus();
    });

    document.addEventListener('click', function (e) {
      if (!e.target.closest('.search')) close();
    });
    document.addEventListener('keydown', function (e) {
      if (e.key === '/' && !/input|textarea/i.test(document.activeElement.tagName)) {
        e.preventDefault(); input.focus(); input.select();
      }
    });
  }

  /* ---------------- 问答 ---------------- */
  function matchFaq(text) {
    var q = String(text).toLowerCase().trim();
    if (!q) return null;
    var scored = [];
    (state.faq.items || []).forEach(function (item) {
      var hits = 0, weight = 0;
      (item.keywords || []).forEach(function (k) {
        var kk = String(k).toLowerCase();
        if (kk && q.indexOf(kk) !== -1) { hits++; weight += Math.min(kk.length, 6) / 6; }
      });
      if (hits > 0) {
        scored.push({ item: item, hits: hits, score: hits * 2 + weight });
      }
    });
    if (!scored.length) return null;
    scored.sort(function (a, b) {
      if (b.hits !== a.hits) return b.hits - a.hits;
      return b.score - a.score;
    });
    return scored[0];
  }

  function initQa() {
    var drawer = $('#qa');
    var openBtn = $('#qa-open');
    var closeBtn = $('#qa-close');
    var mask = $('#qa-mask');
    var form = $('#qa-form');
    var input = $('#qa-input');
    var body = $('#qa-body');
    var chips = $('#qa-chips');
    var items = state.faq.items || [];

    function open() {
      drawer.setAttribute('data-open', 'true');
      document.body.style.overflow = 'hidden';
      setTimeout(function () { input.focus(); }, 220);
    }
    function close() {
      drawer.setAttribute('data-open', 'false');
      document.body.style.overflow = '';
      openBtn.focus();
    }

    openBtn.addEventListener('click', open);
    closeBtn.addEventListener('click', close);
    mask.addEventListener('click', close);
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && drawer.getAttribute('data-open') === 'true') close();
    });

    chips.innerHTML = items.slice(0, 8).map(function (f) {
      return '<button type="button" class="qa__chip" data-id="' + esc(f.id) + '">' + esc(f.question) + '</button>';
    }).join('');

    chips.addEventListener('click', function (e) {
      var b = e.target.closest('.qa__chip');
      if (!b) return;
      var item = state.faqById[b.getAttribute('data-id')];
      if (item) { input.value = item.question; showAnswer(item, item.question); }
    });

    function drillButtons(item) {
      var drills = (item.drill || []).map(function (d) {
        var n = state.byId[d.nodeId];
        if (!n) return '';
        return '<a class="drill" href="#/node/' + esc(n.id) + '" data-goto="' + esc(n.id) + '" style="' + nodeVars(n) + '">' +
          '<span class="drill__label">' + esc(d.label) + '</span>' +
          '<span class="drill__node">' + esc(n.title) + ' · L' + n.level + '</span>' +
          '<span class="drill__arrow" aria-hidden="true">→</span>' +
        '</a>';
      }).join('');
      return drills ? '<div class="qa__drills"><div class="qa__drills-title">继续深入</div>' + drills + '</div>' : '';
    }

    function relatedBlock(item) {
      var rel = (item.related || []).map(function (id) { return state.faqById[id]; }).filter(Boolean);
      if (!rel.length) return '';
      return '<div class="qa__related"><div class="qa__related-title">你还可以问</div>' +
        rel.map(function (r) {
          return '<button type="button" class="qa__more-btn" data-rel="' + esc(r.id) + '">' + esc(r.question) + '</button>';
        }).join('') + '</div>';
    }

    function showAnswer(item, raw) {
      body.innerHTML = '<div class="qa__card">' +
        '<div class="qa__q">你的问题：' + esc(raw) + '</div>' +
        '<div class="qa__match">匹配问题：' + esc(item.question) + '</div>' +
        '<div class="qa__a">' + esc(item.answer) + '</div>' +
        drillButtons(item) +
        relatedBlock(item) +
      '</div>';
    }

    function ask(text) {
      if (!text || !text.trim()) return;
      var best = matchFaq(text);
      if (best) {
        showAnswer(best.item, text);
        return;
      }
      var sug = searchNodes(text).slice(0, 3);
      body.innerHTML = '<div class="qa__card">' +
        '<div class="qa__q">你的问题：' + esc(text) + '</div>' +
        '<div class="qa__a">本地问答库（22 条）暂时没有覆盖这个问题。可以换个更短的关键词再试，或直接点下面的推荐问题继续下钻。</div>' +
        '<div class="qa__related"><div class="qa__related-title">换这些问题试试</div>' +
          items.slice(0, 3).map(function (r) {
            return '<button type="button" class="qa__more-btn" data-rel="' + esc(r.id) + '">' + esc(r.question) + '</button>';
          }).join('') +
        '</div>' +
        (sug.length
          ? '<div class="qa__drills"><div class="qa__drills-title">相关环节</div>' + sug.map(function (s) {
              return '<a class="drill" href="#/node/' + esc(s.id) + '" data-goto="' + esc(s.id) + '" style="' + nodeVars(s.node) + '">' +
                '<span class="drill__label">' + esc(s.node.summary || s.node.title) + '</span>' +
                '<span class="drill__node">' + esc(s.title) + ' · L' + s.level + '</span>' +
                '<span class="drill__arrow" aria-hidden="true">→</span></a>';
            }).join('') + '</div>'
          : '') +
      '</div>';
    }

    form.addEventListener('submit', function (e) {
      e.preventDefault();
      ask(input.value);
    });

    body.addEventListener('click', function (e) {
      var relBtn = e.target.closest('[data-rel]');
      if (relBtn) {
        var item = state.faqById[relBtn.getAttribute('data-rel')];
        if (item) { input.value = item.question; showAnswer(item, item.question); }
        return;
      }
      var a = e.target.closest('a[data-goto]');
      if (a) {
        e.preventDefault();
        goNode(a.getAttribute('data-goto'));
        close();
      }
    });
  }

  /* ---------------- 启动 ---------------- */
  function boot() {
    loadData().then(function (res) {
      buildIndex(res.chain, res.faq);
      render();
      initSearch();
      initQa();

      var meta = $('#footer-meta');
      if (meta) {
        var c = state.chain;
        var faqCount = (state.faq.items || []).length;
        meta.textContent = (c.meta.title || '') + ' · 版本 v' + (c.meta.version || '1.0') +
          ' · 更新 ' + (c.meta.updatedAt || '') + ' · 节点 ' + c.nodes.length +
          ' 个 · 预设问答 ' + faqCount + ' 条';
      }
      var policyEl = $('#footer-policy');
      if (policyEl && state.chain.meta.dataPolicy) {
        policyEl.textContent = state.chain.meta.dataPolicy + ' ' + (state.chain.meta.disclaimer || '');
      }

      window.addEventListener('hashchange', render);

      if (!parseRoute()) {
        // file:// 下部分浏览器禁止 replaceState（origin 为 null），失败就退回普通 hash 赋值
        try { history.replaceState(null, '', '#/node/' + state.chain.nodes[0].id); }
        catch (e) { /* ignore */ }
        render();
      }
    }).catch(function (err) {
      var app = $('#app');
      app.innerHTML = '<div class="hero" style="--layer:#e06a6a;--layer-ink:#ff9b9b;--layer-soft:#e06a6a22;--layer-line:#e06a6a55">' +
        '<h1>数据加载失败</h1>' +
        '<p class="hero__summary">' + esc(err.message) + '</p>' +
        '<p class="hero__summary">请确认 <code>data/chain.js</code>、<code>data/chain.json</code>、<code>data/faq.json</code> 都在站点目录下。</p></div>';
      console.error(err);
    });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
