// ── Theme constants ────────────────────────────────────────────────────────────
const C = {
  accent:  '#8B7CF0',
  blue:    '#4DE3F0',
  green:   '#34D399',
  red:     '#F87171',
  yellow:  '#FBBF24',
  slate:   '#6E737D',
  light:   '#D6D9DF',
  grid:    'rgba(255,255,255,.06)',
  font:    "'Inter', sans-serif",
  mono:    "'Fira Code', monospace"
};

const tooltip = {
  backgroundColor: '#18181E',
  borderColor: C.accent,
  borderWidth: 1,
  titleColor: C.light,
  bodyColor: C.slate,
  padding: 10,
  cornerRadius: 6
};

const axes = (yCallback) => ({
  x: { grid: { color: C.grid }, ticks: { color: C.slate, font: { family: C.font, size: 11 } } },
  y: { grid: { color: C.grid }, ticks: { color: C.slate, font: { family: C.font, size: 11 }, callback: yCallback || (v => v) } }
});

// Chart registry - destroy before re-rendering
const registry = {};
function mk(id, config) {
  if (registry[id]) { registry[id].destroy(); }
  const ctx = document.getElementById(id);
  if (!ctx) return;
  registry[id] = new Chart(ctx, config);
}

// prefers-reduced-motion (named distinctly to avoid clashing with main.js global)
const reduceMotionDB = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

// ── Count-up numbers ─────────────────────────────────────────────────────────────
// Parse a metric while preserving its formatting: currency ($), percent (%),
// thousands commas, M/K suffix, and leading +/− sign. Non-numeric labels
// (e.g. "9:12am", "Crypto", "FOMC") return null and are left untouched.
function parseMetric(text) {
  const m = text.trim().match(/^([$+\-−]?)\s*(\d[\d,]*(?:\.\d+)?)\s*([%MK]?)$/);
  if (!m) return null;
  const numStr = m[2];
  return {
    prefix:   m[1],
    suffix:   m[3],
    value:    parseFloat(numStr.replace(/,/g, '')),
    decimals: numStr.includes('.') ? numStr.split('.')[1].length : 0,
    hasComma: numStr.includes(',')
  };
}
function formatMetric(v, info) {
  let s = v.toFixed(info.decimals);
  if (info.hasComma) {
    const parts = s.split('.');
    parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ',');
    s = parts.join('.');
  }
  return info.prefix + s + info.suffix;
}
function countUpKpis(modal) {
  modal.querySelectorAll('.kpi-num').forEach(el => {
    if (!el.dataset.countTarget) el.dataset.countTarget = el.textContent.trim();
    const target = el.dataset.countTarget;
    const info = parseMetric(target);
    if (!info || reduceMotionDB) { el.textContent = target; return; }

    const DURATION = 1100;
    const start = performance.now();
    el.textContent = formatMetric(0, info);
    (function step(now) {
      const p = Math.min((now - start) / DURATION, 1);
      const eased = 1 - Math.pow(1 - p, 3);     // easeOutCubic
      el.textContent = formatMetric(info.value * eased, info);
      if (p < 1) requestAnimationFrame(step);
      else el.textContent = target;             // exact original formatting at the end
    })(performance.now());
  });
}

// ── Modal system ───────────────────────────────────────────────────────────────
document.querySelectorAll('[data-modal]').forEach(btn =>
  btn.addEventListener('click', () => open(btn.dataset.modal))
);
document.querySelectorAll('[data-close]').forEach(el =>
  el.addEventListener('click', () => close(el.dataset.close))
);
document.addEventListener('keydown', e => {
  if (e.key === 'Escape')
    document.querySelectorAll('.db-modal.open').forEach(m => close(m.id));
});

function open(id) {
  const m = document.getElementById(id);
  if (!m) return;
  m.classList.add('open');
  document.body.style.overflow = 'hidden';

  // Animate the KPI numbers up as the modal appears
  countUpKpis(m);

  // Loading state: shimmer over chart boxes, then draw the charts
  const chartBoxes = [...m.querySelectorAll('.db-box')].filter(b => b.querySelector('canvas'));
  chartBoxes.forEach(b => b.classList.add('is-loading'));
  const delay = (reduceMotionDB || chartBoxes.length === 0) ? 0 : 320;
  setTimeout(() => {
    render(id);   // canvas has real dimensions now that the panel is laid out
    requestAnimationFrame(() => chartBoxes.forEach(b => b.classList.remove('is-loading')));
  }, delay);
}
function close(id) {
  const m = document.getElementById(id);
  if (!m) return;
  m.classList.remove('open');
  document.body.style.overflow = '';
}

function render(id) {
  if (id === 'modal-market')    renderMarket();
  if (id === 'modal-ai')        renderAI();
  if (id === 'modal-sltp')      renderSLTP();
  if (id === 'modal-hedge')     renderHedge();
  if (id === 'modal-pnl')       renderPnl();
}

// ── Flagship 1: Pre-Market Order Monitoring ────────────────────────────────────
function renderSLTP() {
  // Hedge-book P&L by stock at open ($K), sorted most-negative first.
  // Clients are net long: down + under-hedged = company profit, down + over-hedged = loss,
  // up + under-hedged = loss, up + over-hedged = profit.
  const hedge = [
    ['GME', -640], ['TSLA', -560], ['MRNA', -320], ['COIN', -280], ['INTC', -190],
    ['NFLX', -140], ['AAPL', -15], ['JPM', 10], ['XOM', 80], ['DIS', 90],
    ['AMD', 140], ['PLTR', 180], ['NVDA', 260], ['META', 300], ['BA', 360]
  ];
  mk('ch-sltp-hedge', {
    type: 'bar',
    data: {
      labels: hedge.map(h => h[0]),
      datasets: [{
        label: 'Hedge P&L ($K)',
        data: hedge.map(h => h[1]),
        backgroundColor: hedge.map(h => h[1] < 0 ? 'rgba(248,113,113,.75)' : 'rgba(52,211,153,.75)'),
        borderColor: hedge.map(h => h[1] < 0 ? C.red : C.green),
        borderWidth: 1, borderRadius: 3, borderSkipped: false
      }]
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: { legend: { display: false }, tooltip },
      scales: {
        x: { grid: { color: C.grid }, ticks: { color: C.light, font: { family: C.mono, size: 10 } } },
        y: { grid: { color: C.grid }, ticks: { color: C.slate, callback: v => '$' + v + 'K' } }
      }
    }
  });

  // Stop-loss vs take-profit orders firing at open, for the biggest movers.
  const tickers = ['TSLA', 'META', 'BA', 'PLTR', 'NVDA', 'AMD', 'GME'];
  const sl = [1240, 880, 720, 540, 70, 65, 15];
  const tp = [75, 90, 60, 60, 985, 540, 690];
  mk('ch-sltp-triggers', {
    type: 'bar',
    data: {
      labels: tickers,
      datasets: [
        { label: 'Stop-loss', data: sl, backgroundColor: 'rgba(248,113,113,.8)', borderRadius: 3, borderSkipped: false },
        { label: 'Take-profit', data: tp, backgroundColor: 'rgba(52,211,153,.8)', borderRadius: 3, borderSkipped: false }
      ]
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      indexAxis: 'y',
      plugins: { legend: { labels: { color: C.light, font: { family: C.font }, boxWidth: 12 } }, tooltip },
      scales: {
        x: { grid: { color: C.grid }, ticks: { color: C.slate } },
        y: { grid: { display: false }, ticks: { color: C.light, font: { family: C.mono, size: 11 } } }
      }
    }
  });

  // Pre-order queue load: orders queued vs system capacity (%). Red = over capacity.
  const loadLabels = ['GME', 'AMC', 'PLTR', 'COIN', 'MRNA', 'NVDA'];
  const util = [142, 137, 105, 85, 76, 71];
  mk('ch-sltp-load', {
    type: 'bar',
    data: {
      labels: loadLabels,
      datasets: [{
        label: 'Queue load %',
        data: util,
        backgroundColor: util.map(v => v > 100 ? 'rgba(248,113,113,.8)' : v >= 70 ? 'rgba(251,191,36,.8)' : 'rgba(52,211,153,.8)'),
        borderRadius: 3, borderSkipped: false
      }]
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      indexAxis: 'y',
      plugins: { legend: { display: false }, tooltip },
      scales: {
        x: { grid: { color: C.grid }, ticks: { color: C.slate, callback: v => v + '%' }, suggestedMax: 160 },
        y: { grid: { display: false }, ticks: { color: C.light, font: { family: C.mono, size: 11 } } }
      }
    }
  });
}

// ── Flagship 2: Hedge Execution Fail Monitor ───────────────────────────────────
function renderHedge() {
  const days = Array.from({ length: 30 }, (_, i) => 'D' + (i + 1));
  const ratio = [0.6,0.5,0.7,0.8,0.6,0.5,0.4,0.7,0.9,1.1,0.8,0.7,0.6,0.9,1.0,1.2,1.4,2.6,1.3,0.9,0.8,0.7,0.9,1.0,1.1,0.9,0.8,1.0,1.1,1.1];
  const threshold = Array(30).fill(1.5);

  mk('ch-hedge-trend', {
    type: 'line',
    data: {
      labels: days,
      datasets: [
        {
          label: 'Fail ratio %',
          data: ratio,
          borderColor: C.accent,
          backgroundColor: 'rgba(139,124,240,.08)',
          fill: true, tension: 0.35,
          pointRadius: ratio.map(v => v > 1.5 ? 5 : 0),
          pointBackgroundColor: ratio.map(v => v > 1.5 ? C.red : C.accent),
          pointHoverRadius: 5
        },
        {
          label: 'Alert threshold',
          data: threshold,
          borderColor: C.red,
          borderDash: [6, 4],
          borderWidth: 1.5,
          pointRadius: 0, fill: false
        }
      ]
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: {
        legend: { labels: { color: C.light, font: { family: C.font }, boxWidth: 14 } },
        tooltip: { ...tooltip, callbacks: { label: ctx => ` ${ctx.dataset.label}: ${ctx.parsed.y}%` } }
      },
      scales: {
        x: { grid: { color: C.grid }, ticks: { color: C.slate, maxTicksLimit: 10, font: { size: 10 } } },
        y: { grid: { color: C.grid }, min: 0, max: 3, ticks: { color: C.slate, callback: v => v + '%' } }
      }
    }
  });

  const groups = ['Crypto', 'Commodities', 'Indices', 'Stocks', 'FX'];
  const gRatio = [1.9, 1.1, 0.7, 0.5, 0.3];
  mk('ch-hedge-seg', {
    type: 'bar',
    data: {
      labels: groups,
      datasets: [{
        label: 'Fail ratio %',
        data: gRatio,
        backgroundColor: gRatio.map(v => v > 1.5 ? 'rgba(248,113,113,.75)' : 'rgba(139,124,240,.7)'),
        borderRadius: 5, borderSkipped: false
      }]
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      indexAxis: 'y',
      plugins: { legend: { display: false }, tooltip: { ...tooltip, callbacks: { label: ctx => ` ${ctx.parsed.x}%` } } },
      scales: {
        x: { grid: { color: C.grid }, ticks: { color: C.slate, callback: v => v + '%' } },
        y: { grid: { display: false }, ticks: { color: C.light, font: { family: C.font, size: 11 } } }
      }
    }
  });
}

// ── Flagship 3: Trading Revenue & PnL ──────────────────────────────────────────
function renderPnl() {
  const days  = ['Mon','Tue','Wed','Thu','Fri','Mon','Tue','Wed','Thu','Fri','Mon','Tue','Wed','Thu'];
  const daily = [118, 132, 124, 141, 156, 109, 127, 138, 119, 148, 131, 142, 125, 134];
  const cumulative = [];
  daily.reduce((acc, v, i) => cumulative[i] = acc + v, 0);

  mk('ch-pnl-daily', {
    type: 'bar',
    data: {
      labels: days,
      datasets: [
        {
          type: 'bar',
          label: 'Daily revenue ($K)',
          data: daily,
          backgroundColor: 'rgba(139,124,240,.65)',
          borderRadius: 4, borderSkipped: false,
          yAxisID: 'y'
        },
        {
          type: 'line',
          label: 'Cumulative ($K)',
          data: cumulative,
          borderColor: C.green,
          backgroundColor: 'transparent',
          tension: 0.3, pointRadius: 0,
          borderWidth: 2,
          yAxisID: 'y1'
        }
      ]
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: {
        legend: { labels: { color: C.light, font: { family: C.font }, boxWidth: 14 } },
        tooltip: { ...tooltip, callbacks: { label: ctx => ` ${ctx.dataset.label.replace(' ($K)','')}: $${ctx.parsed.y}K` } }
      },
      scales: {
        x:  { grid: { color: C.grid }, ticks: { color: C.slate, font: { size: 10 } } },
        y:  { position: 'left', grid: { color: C.grid }, ticks: { color: C.slate, callback: v => '$' + v + 'K' } },
        y1: { position: 'right', grid: { drawOnChartArea: false }, ticks: { color: C.green, callback: v => '$' + (v/1000).toFixed(1) + 'M' } }
      }
    }
  });

  mk('ch-pnl-class', {
    type: 'doughnut',
    data: {
      labels: ['Stocks', 'Crypto', 'Indices', 'Commodities', 'FX'],
      datasets: [{
        data: [38, 27, 16, 11, 8],
        backgroundColor: ['#8B7CF0', '#4DE3F0', '#34D399', '#FBBF24', '#6E737D'],
        borderColor: '#18181E',
        borderWidth: 3
      }]
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      cutout: '62%',
      plugins: {
        legend: { position: 'right', labels: { color: C.light, font: { family: C.font, size: 11 }, boxWidth: 12, padding: 10 } },
        tooltip: { ...tooltip, callbacks: { label: ctx => ` ${ctx.label}: ${ctx.parsed}%` } }
      }
    }
  });
}

// ── Dashboard 2: Market Briefing ───────────────────────────────────────────────
function renderMarket() {
  // ── SaaS Revenue Analysis ──
  const months = ['Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec', 'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun'];

  // MRR growth over 12 months (ARR = MRR × 12). Smooth gradient area chart.
  const mrr = [1.48, 1.52, 1.56, 1.61, 1.66, 1.71, 1.76, 1.81, 1.86, 1.91, 1.96, 2.00];
  mk('ch-saas-mrr', {
    type: 'line',
    data: {
      labels: months,
      datasets: [{
        label: 'MRR ($M)',
        data: mrr,
        borderColor: C.accent,
        borderWidth: 2.5,
        tension: 0.4,
        fill: true,
        pointRadius: mrr.map((_, i) => i === mrr.length - 1 ? 4 : 0),
        pointBackgroundColor: C.accent,
        backgroundColor: (ctx) => {
          const { chart } = ctx;
          const { ctx: c, chartArea } = chart;
          if (!chartArea) return 'rgba(139,124,240,.25)';
          const g = c.createLinearGradient(0, chartArea.top, 0, chartArea.bottom);
          g.addColorStop(0, 'rgba(139,124,240,.45)');
          g.addColorStop(1, 'rgba(139,124,240,0)');
          return g;
        }
      }]
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: Object.assign({}, tooltip, { callbacks: {
          label: c => 'MRR $' + c.parsed.y.toFixed(2) + 'M   ·   ARR $' + (c.parsed.y * 12).toFixed(1) + 'M'
        } })
      },
      scales: {
        x: { grid: { color: C.grid }, ticks: { color: C.slate, font: { family: C.font, size: 11 } } },
        y: { grid: { color: C.grid }, ticks: { color: C.slate, callback: v => '$' + v.toFixed(1) + 'M' } }
      }
    }
  });

  // Churn (left axis) vs trial→paid conversion (right axis), monthly %.
  const churn = [1.3, 1.2, 1.2, 1.1, 1.1, 1.1, 1.0, 1.1, 1.0, 1.0, 1.0, 1.0];
  const conv  = [9.0, 9.5, 9.8, 10.2, 10.5, 10.8, 11.0, 11.3, 11.5, 11.7, 11.9, 12.0];
  mk('ch-saas-cc', {
    type: 'line',
    data: {
      labels: months,
      datasets: [
        { label: 'Monthly churn',          data: churn, borderColor: C.red,   backgroundColor: 'rgba(248,113,113,.08)', fill: true, tension: .35, pointRadius: 0, yAxisID: 'y' },
        { label: 'Trial → paid conversion', data: conv,  borderColor: C.green, backgroundColor: 'rgba(52,211,153,.08)',  fill: true, tension: .35, pointRadius: 0, yAxisID: 'y1' }
      ]
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: { legend: { labels: { color: C.light, font: { family: C.font }, boxWidth: 12 } }, tooltip },
      scales: {
        x:  { grid: { color: C.grid }, ticks: { color: C.slate, font: { size: 11 } } },
        y:  { position: 'left',  grid: { color: C.grid }, ticks: { color: C.red, callback: v => v + '%' }, title: { display: true, text: 'Churn', color: C.red, font: { size: 10 } }, suggestedMin: 0, suggestedMax: 2 },
        y1: { position: 'right', grid: { drawOnChartArea: false }, ticks: { color: C.green, callback: v => v + '%' }, title: { display: true, text: 'Conversion', color: C.green, font: { size: 10 } }, suggestedMin: 0, suggestedMax: 15 }
      }
    }
  });
}

// ── Dashboard 4: Genie AI Chat ─────────────────────────────────────────────────
const genieResponses = {
  'top-stocks': {
    q: 'What were the top 10 stocks by trade volume yesterday?',
    html: `<p>Here are yesterday's top 10 most traded instruments on the platform:</p>
      <table>
        <thead><tr><th>#</th><th>Ticker</th><th>Trades</th><th>Share</th><th>1d Change</th></tr></thead>
        <tbody>
          <tr><td>1</td><td class="hl">NVDA</td><td>284,124</td><td>8.3%</td><td class="pos">+4.2%</td></tr>
          <tr><td>2</td><td class="hl">AAPL</td><td>231,870</td><td>6.8%</td><td class="pos">+1.1%</td></tr>
          <tr><td>3</td><td class="hl">TSLA</td><td>198,441</td><td>5.8%</td><td class="neg">−2.3%</td></tr>
          <tr><td>4</td><td class="hl">META</td><td>176,320</td><td>5.2%</td><td class="pos">+3.1%</td></tr>
          <tr><td>5</td><td class="hl">AMZN</td><td>154,890</td><td>4.5%</td><td class="pos">+0.8%</td></tr>
          <tr><td>6</td><td class="hl">MSFT</td><td>142,100</td><td>4.2%</td><td class="pos">+0.5%</td></tr>
          <tr><td>7</td><td class="hl">GOOGL</td><td>128,340</td><td>3.8%</td><td class="neg">−0.4%</td></tr>
          <tr><td>8</td><td class="hl">AMD</td><td>119,200</td><td>3.5%</td><td class="pos">+2.7%</td></tr>
          <tr><td>9</td><td class="hl">BTC/USD</td><td>108,760</td><td>3.2%</td><td class="pos">+1.9%</td></tr>
          <tr><td>10</td><td class="hl">SPY</td><td>97,430</td><td>2.9%</td><td class="pos">+0.3%</td></tr>
        </tbody>
      </table>
      <p style="margin-top:.55rem;font-size:.79rem;color:#64748B">Total platform trades yesterday: 3,415,824</p>`
  },
  'fees': {
    q: 'Where did we earn the most fees this week?',
    html: `<p>This week's fee revenue breakdown by asset class:</p>
      <div class="genie-kv">
        <div class="genie-kv-item"><div class="genie-kv-label">Crypto</div><div class="genie-kv-value pos">$184,320</div></div>
        <div class="genie-kv-item"><div class="genie-kv-label">Stocks</div><div class="genie-kv-value">$142,870</div></div>
        <div class="genie-kv-item"><div class="genie-kv-label">ETFs</div><div class="genie-kv-value">$67,410</div></div>
        <div class="genie-kv-item"><div class="genie-kv-label">Commodities</div><div class="genie-kv-value warn">$38,920</div></div>
      </div>
      <p style="margin-top:.65rem"><strong>Top earner:</strong> BTC/USD spread - $52,140 (28% of crypto fees). Volumes spiked Mon–Tue on ETF news, driving an extra <strong>$31K</strong> vs the prior week.</p>`
  },
  'latency': {
    q: 'What was average order execution latency yesterday?',
    html: `<p>Yesterday's order execution latency report:</p>
      <div class="genie-kv">
        <div class="genie-kv-item"><div class="genie-kv-label">Avg Latency</div><div class="genie-kv-value pos">38ms</div></div>
        <div class="genie-kv-item"><div class="genie-kv-label">P99 Latency</div><div class="genie-kv-value warn">142ms</div></div>
        <div class="genie-kv-item"><div class="genie-kv-label">Peak Hour</div><div class="genie-kv-value">9:30am EST</div></div>
        <div class="genie-kv-item"><div class="genie-kv-label">vs Prior Day</div><div class="genie-kv-value pos">−4ms</div></div>
      </div>
      <p style="margin-top:.65rem">Spike to <strong style="color:#FBBF24">214ms</strong> at 9:31am EST - market open surge (47K concurrent orders). Resolved in 90s. All executions completed within SLA.</p>`
  },
  'risk': {
    q: 'Show me clients with large withdrawals in the last 5 days',
    html: `<p>5-day risk scan - clients flagged for large withdrawals after negative P&amp;L:</p>
      <table>
        <thead><tr><th>Client ID</th><th>5d P&amp;L</th><th>Withdrawal</th><th>Signal</th></tr></thead>
        <tbody>
          <tr><td class="hl">USR-8841</td><td class="neg">−$18,420</td><td>$22,000</td><td class="neg">⚠ High</td></tr>
          <tr><td class="hl">USR-3392</td><td class="neg">−$9,870</td><td>$15,000</td><td class="neg">⚠ High</td></tr>
          <tr><td class="hl">USR-6107</td><td class="neg">−$4,210</td><td>$8,500</td><td style="color:#FBBF24">~ Medium</td></tr>
          <tr><td class="hl">USR-2954</td><td class="neg">−$2,100</td><td>$5,000</td><td style="color:#FBBF24">~ Medium</td></tr>
          <tr><td class="hl">USR-9013</td><td class="neg">−$1,450</td><td>$3,200</td><td>Monitor</td></tr>
        </tbody>
      </table>
      <p style="margin-top:.55rem;font-size:.79rem;color:#64748B">Recommendation: flag USR-8841 and USR-3392 for retention team outreach.</p>`
  },
  'hours': {
    q: 'Compare pre-market vs regular hours fee rates',
    html: `<p>Fee rate structure by trading session (dealing room config):</p>
      <table>
        <thead><tr><th>Session</th><th>Hours (EST)</th><th>Spread</th><th>Volume %</th><th>Revenue %</th></tr></thead>
        <tbody>
          <tr><td class="hl">Pre-market</td><td>4:00 – 9:30</td><td style="color:#FBBF24">1.5×</td><td>12%</td><td class="pos">21%</td></tr>
          <tr><td class="hl">Regular</td><td>9:30 – 16:00</td><td class="pos">1.0×</td><td>71%</td><td>64%</td></tr>
          <tr><td class="hl">After-hours</td><td>16:00 – 20:00</td><td style="color:#FBBF24">1.5×</td><td>17%</td><td class="pos">15%</td></tr>
        </tbody>
      </table>
      <p style="margin-top:.65rem">Pre/after-market carry a <strong>1.5× spread multiplier</strong> for lower liquidity. Despite 29% of volume, extended sessions generate <strong>36% of spread revenue</strong>.</p>`
  }
};

function renderAI() {
  const chat = document.getElementById('genie-chat');
  if (!chat) return;

  chat.innerHTML = `
    <div class="genie-msg genie-ai">
      <div class="genie-avatar">G</div>
      <div class="genie-bubble">
        <p>Hi! I'm <strong>Genie</strong>, an AI analyst trained on trading data - table structures, fee rules, KPI definitions, and business logic.</p>
        <p>Click a question below to see how managers used a tool like me every day.</p>
      </div>
    </div>`;

  document.querySelectorAll('.genie-btn').forEach(btn => {
    btn.disabled = false;
    btn.addEventListener('click', () => askGenie(btn.dataset.q));
  });
}

function askGenie(qKey) {
  const resp = genieResponses[qKey];
  if (!resp) return;
  const chat = document.getElementById('genie-chat');
  if (!chat) return;

  document.querySelectorAll('.genie-btn').forEach(b => b.disabled = true);

  chat.insertAdjacentHTML('beforeend', `
    <div class="genie-msg genie-user">
      <div class="genie-avatar user-av">Me</div>
      <div class="genie-bubble">${resp.q}</div>
    </div>`);

  const thinkId = 'gt' + Date.now();
  chat.insertAdjacentHTML('beforeend', `
    <div class="genie-msg genie-ai" id="${thinkId}">
      <div class="genie-avatar">G</div>
      <div class="genie-thinking">
        <div class="genie-dot"></div><div class="genie-dot"></div><div class="genie-dot"></div>
      </div>
    </div>`);
  chat.scrollTop = chat.scrollHeight;

  setTimeout(() => {
    const el = document.getElementById(thinkId);
    if (el) el.remove();
    chat.insertAdjacentHTML('beforeend', `
      <div class="genie-msg genie-ai">
        <div class="genie-avatar">G</div>
        <div class="genie-bubble">${resp.html}</div>
      </div>`);
    chat.scrollTop = chat.scrollHeight;
    document.querySelectorAll('.genie-btn').forEach(b => b.disabled = false);
  }, 1500);
}
