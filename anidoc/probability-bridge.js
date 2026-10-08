import * as M from './math.js';
import {esc, fmt} from './ui.js';

const T = 40;
const SIGMA0 = .35;
const VARIANCE0 = SIGMA0 ** 2;
const CENTERS = [-2, 2];
const number = (value, places = 6) => esc(
  Number.isFinite(value) && value !== 0 && Math.abs(value) < .5 * 10 ** (-places)
    ? value.toExponential(2)
    : fmt(value, places)
);

function density(x, mean, variance) {
  return Math.exp(-((x - mean) ** 2) / (2 * variance)) / Math.sqrt(2 * Math.PI * variance);
}

function intervalMass(mean, sigma) {
  const steps = 400, a = mean - sigma, h = 2 * sigma / steps;
  let sum = density(a, mean, sigma ** 2) + density(a + steps * h, mean, sigma ** 2);
  for (let i = 1; i < steps; i++) sum += (i % 2 ? 4 : 2) * density(a + i * h, mean, sigma ** 2);
  return sum * h / 3;
}

/** Uses the same seeded trajectories and exact conditional distribution as the lab. */
export function probabilityBridgeData(s) {
  if (!s || !['forward', 'reverse'].includes(s.mode) || !Number.isInteger(s.step) || s.step < 0 || s.step > T || !Number.isInteger(s.seed) || s.seed < 1 || s.seed > 99999) {
    throw Error('概率桥需要有效的扩散方向、0到40整数步数与1到99999整数种子');
  }
  const path = s.mode === 'forward' ? M.forwardDiffusion(s.seed).path : M.reverseDiffusion(s.seed).path;
  const k = s.mode === 'forward' ? s.step : T - s.step;
  const x = path[s.step][0], alphaBar = M.alphaBar(k, T);
  const observationVariance = alphaBar * VARIANCE0 + 1 - alphaBar;
  const posterior = k > 0 ? M.posterior(x, k, T) : null;
  const logEvidence = CENTERS.map(mu => -((x - Math.sqrt(alphaBar) * mu) ** 2) / (2 * observationVariance));
  const commonShift = Math.max(...logEvidence);
  const scaledEvidence = logEvidence.map(value => Math.exp(value - commonShift));
  const unnormalized = scaledEvidence.map(value => .5 * value);
  const normalizer = unnormalized.reduce((sum, value) => sum + value, 0);
  const components = CENTERS.map((mu, index) => ({
    mu,
    prior: .5,
    observationMean: Math.sqrt(alphaBar) * mu,
    observationVariance,
    evidenceDensity: density(x, Math.sqrt(alphaBar) * mu, observationVariance),
    logEvidence: logEvidence[index],
    shiftedLogEvidence: logEvidence[index] - commonShift,
    scaledEvidence: scaledEvidence[index],
    unnormalized: unnormalized[index],
    weight: posterior ? posterior.weights[index] : unnormalized[index] / normalizer,
    conditionalMean: posterior ? posterior.means[index] : null
  }));
  const previousAlphaBar = k > 0 ? M.alphaBar(k - 1, T) : null;
  const previousVariance = k > 0 ? previousAlphaBar * VARIANCE0 + 1 - previousAlphaBar : null;
  const stepAlpha = k > 0 ? alphaBar / previousAlphaBar : null;
  const covariance = k > 0 ? Math.sqrt(stepAlpha) * previousVariance : null;
  return {
    mode: s.mode, seed: s.seed, step: s.step, T, k, x,
    sigma0: SIGMA0, variance0: VARIANCE0, alphaBar, observationVariance,
    components, commonShift, normalizer, posterior,
    previousAlphaBar, previousVariance, stepAlpha, covariance,
    conditionalVariance: posterior ? posterior.variance : null,
    densityExample: {mean: -2, sigma: SIGMA0, variance: VARIANCE0, heightAtMean: density(-2, -2, VARIANCE0), intervalMass: intervalMass(-2, SIGMA0)}
  };
}

function densityFigure() {
  const width = 620, height = 220, left = 48, top = 20, plotWidth = 544, plotHeight = 155;
  const xmin = -3.4, xmax = 3.4, ymax = 1.3;
  const px = x => left + (x - xmin) / (xmax - xmin) * plotWidth;
  const py = y => top + plotHeight - y / ymax * plotHeight;
  const curve = mu => Array.from({length: 241}, (_, i) => {
    const x = xmin + (xmax - xmin) * i / 240;
    return `${i ? 'L' : 'M'}${number(px(x), 3)},${number(py(density(x, mu, VARIANCE0)), 3)}`;
  }).join(' ');
  const interval = Array.from({length: 81}, (_, i) => {
    const x = -2 - SIGMA0 + 2 * SIGMA0 * i / 80;
    return `L${number(px(x), 3)},${number(py(density(x, -2, VARIANCE0)), 3)}`;
  }).join(' ');
  const area = `M${number(px(-2 - SIGMA0), 3)},${number(py(0), 3)} ${interval} L${number(px(-2 + SIGMA0), 3)},${number(py(0), 3)} Z`;
  return `<figure class="chart probability-density" role="group" aria-label="高斯密度图，可横向滚动" tabindex="0"><svg viewBox="0 0 ${width} ${height}" role="img" aria-labelledby="probability-density-title probability-density-desc"><title id="probability-density-title">两条标准差0.35的高斯密度；阴影是左分支均值附近一个标准差的区间面积</title><desc id="probability-density-desc">实线中心为负2，虚线中心为2。每条分支密度各自的总面积为1，中心高度约1.1398；左分支负2.35至负1.65的阴影面积约0.6827。图示单个分支密度，未乘混合权重0.5。</desc><path d="${area}" fill="#dceadd"/><path d="M${left},${py(0)} H${left + plotWidth} M${left},${py(0)} V${top}" fill="none" stroke="#7c8c7f"/><path d="${curve(-2)}" fill="none" stroke="#246449" stroke-width="2.5"/><path d="${curve(2)}" fill="none" stroke="#b56932" stroke-width="2.5" stroke-dasharray="6 4"/>${[-2, 0, 2].map(x => `<text x="${px(x)}" y="${py(0) + 18}" text-anchor="middle">${x}</text>`).join('')}<text x="${left - 8}" y="${py(0) + 3}" text-anchor="end">0</text><text x="${left - 8}" y="${py(1) + 3}" text-anchor="end">1</text><text x="${left}" y="12">密度高度</text><text x="${left + plotWidth}" y="210" text-anchor="end">数值 x →</text><text x="${px(-2)}" y="${top + 14}" text-anchor="middle">实线 μ=−2</text><text x="${px(2)}" y="${top + 14}" text-anchor="middle">虚线 μ=2</text></svg><figcaption>每条曲线分别表示一个分支的密度；阴影是左分支 [−2.35, −1.65] 的概率面积，非曲线高度。线型与文字也区分分支。</figcaption></figure>`;
}

export function probabilityPrimer() {
  return `<section id="probability-primer" class="knowledge-bridge" aria-labelledby="probability-primer-title"><h3 id="probability-primer-title">先补一小段概率：噪声值为何不能确定来源？</h3><p>先预测：两个分支起初各占一半，中心分别在 −2 和 2。加噪后观察到一个正数，更可能来自哪边？先保留你的判断，再到实验改变种子、方向和步数，看当前样本的两个分支权重。</p><p><strong>均值（mean, μ）</strong>表示中心；<strong>标准差（standard deviation, σ）</strong>表示散布宽度；<strong>方差（variance, σ²）</strong>是标准差的平方。本实验每个干净分支的 σ₀=0.35，σ₀²=0.1225，中心 μ∈{−2,2}。<strong>正态/高斯分布（normal/Gaussian distribution）N(μ,σ²)</strong>的第二个参数写方差，所以 N(−2,0.35²) 的宽度是0.35。<strong>标准正态（standard normal）N(0,1)</strong>是中心0、方差1的噪声 ε 分布；每次抽到的 ε 可正可负。</p><details><summary>用密度图区分“高度”和“概率”</summary>${densityFigure()}<p><strong>概率密度（probability density）</strong>是曲线高度。上图单分支中心的实际高度为 ${number(density(-2, -2, VARIANCE0), 4)}，可以大于1；它不是“恰好抽到 −2 的概率”。连续分布里单个点的概率为0，落在一个区间的概率是该区间下的面积。左分支 [−2.35,−1.65] 的面积用数值积分算得约 ${number(intervalMass(-2, SIGMA0), 4)}；每个单分支全曲线面积为1。图中两条是各自的分支密度，混合总密度还要各乘0.5再相加。</p></details><p><strong>条件概率（conditional probability, p(a|b)）</strong>读作“已知 b 时 a 的概率”。<strong>先验（prior）</strong>是观察前的分支权重，这里都是0.5；观察当前 xₖ 后，按“先验 × 该分支产生此观察值的密度”重新归一化，得到<strong>后验（posterior）</strong>权重，两边之和为1。较高权重表示较可能，仍不能确定来源。符号 <strong>∝</strong> 表示“成比例”，暂时省略两边共用的归一化常数。</p><p>这里的扩散步 <strong>k</strong> 控制噪声程度；视频帧 <strong>f</strong> 是同一视频里的第几帧。更新一个包含许多 f 的视频张量可以经历许多 k，二者不是同一个索引。</p><small>宽表和图可左右滚动；按 Tab 聚焦后可用左右方向键查看。</small><div class="inline-actions"><button type="button" class="quiet" data-scroll="operation">去实验验证预测</button><button type="button" class="quiet" data-scroll="exercises">去做概率迁移练习</button></div></section>`;
}

function weightsFigure(components) {
  return `<figure class="chart probability-weights" role="group" aria-label="当前分支权重图，可横向滚动" tabindex="0"><svg viewBox="0 0 500 116" role="img" aria-label="当前观察后的两个分支权重；条形长度及数值共同表示概率">${components.map((component, index) => {
    const y = 16 + index * 43;
    return `<text x="10" y="${y + 17}">${index ? '右分支 μ=2' : '左分支 μ=−2'}</text><rect x="130" y="${y}" width="250" height="25" fill="#edf0e8"/><rect x="130" y="${y}" width="${number(250 * component.weight, 5)}" height="25" fill="${index ? '#b56932' : '#246449'}"/><text x="391" y="${y + 17}">${number(component.weight, 5)}</text>`;
  }).join('')}<text x="130" y="110">0</text><text x="380" y="110" text-anchor="end">1（完整条宽）</text></svg><figcaption>观察同一个 xₖ 后的分支权重，左右分支用文字标明，长度和数值共同表示大小。</figcaption></figure>`;
}

export function probabilityWalkthrough(s) {
  const d = probabilityBridgeData(s);
  const current = `<p>与上方实验共用实际计算：当前样本1的 <strong>xₖ=<span data-bridge-value="current-x">${number(d.x)}</span></strong>，扩散步 <strong>k=<span data-bridge-value="current-k">${d.k}</span></strong>。${d.mode === 'forward' ? '前向模式：下面问“若从这个值做一步解析反向，会得到什么分布？”这项观察不会改变前向路径。' : '反向模式：下面解释当前路径下一次采样所使用的分布。'}</p>`;
  if (d.k === 0) {
    return `<section id="probability-walkthrough" class="calculation knowledge-bridge" aria-labelledby="probability-walkthrough-title"><h4 id="probability-walkthrough-title">把概率符号接到当前实验</h4>${current}<p data-bridge-value="reverse-finished">k=0 已在干净分布端。没有下一次 xₖ₋₁ 反向更新，也不计算不存在的 k=−1 后验。${d.mode === 'forward' ? '先把已执行步数调到1或更多，再观察一步反向条件分布。' : '当前40次解析反向采样已结束；重置或减少已执行步数可回看前面的条件分布。'}</p><p>固定种子使当前路径可复现；这里没有训练神经网络，也不是 AniDoc 的调度器。</p></section>`;
  }
  const components = d.components;
  return `<section id="probability-walkthrough" class="calculation knowledge-bridge" aria-labelledby="probability-walkthrough-title"><h4 id="probability-walkthrough-title">把概率符号接到当前实验</h4>${current}<p>观察之前左、右先验各0.5。观察之后：左分支权重 <strong data-bridge-value="weight-left">${number(components[0].weight, 5)}</strong>，右分支权重 <strong data-bridge-value="weight-right">${number(components[1].weight, 5)}</strong>，内部完整精度之和=${number(components.reduce((sum, component) => sum + component.weight, 0), 8)}。改步数或种子后，这些值与上方样本一起更新。显示四舍五入不会改变实际计算。</p>${weightsFigure(components)}<details><summary>逐步看：先验 × 证据密度 → 归一化权重 → 下一步分布</summary><p><strong>① 当前观察的分布。</strong>每个干净分支中心 μ 经过前向加噪变成 √ᾱₖμ；方差 v=ᾱₖσ₀²+1−ᾱₖ。当前 ᾱₖ=${number(d.alphaBar)}，所以 v=${number(d.alphaBar)}×0.1225+1−${number(d.alphaBar)}=${number(d.observationVariance)}。第一项来自缩放后的干净分支，第二项来自独立的标准正态噪声；独立项的方差可以相加。这描述“假设来自某分支，会如何分布”，不代表已知该样本的干净起点。</p><div class="table-scroll" role="region" aria-label="概率逐项计算表，可横向滚动" tabindex="0"><table><caption>同一个当前 xₖ 在两个分支下的证据</caption><thead><tr><th>假定分支</th><th>当前中心 √ᾱₖμ</th><th>方差 v</th><th>证据密度 p(xₖ|分支)</th><th>先验</th></tr></thead><tbody>${components.map(component => `<tr><th>${component.mu < 0 ? '左：μ=−2' : '右：μ=2'}</th><td>${number(component.observationMean)}</td><td>${number(component.observationVariance)}</td><td>${number(component.evidenceDensity, 8)}</td><td>0.5</td></tr>`).join('')}</tbody></table></div><p><strong>② 先重分权，再使和为1。</strong>权重 ∝ 0.5×证据密度。高斯密度两分支共用 1/√(2πv)，归一化时抵消，所以只保留指数 t=−(xₖ−√ᾱₖμ)²/(2v)。这里使用稳定的 exp(t−max(t))；减去同一个最大值只取消公共倍数，避免很小的指数同时下溢，并不改变权重。</p><div class="table-scroll" role="region" aria-label="概率逐项计算表，可横向滚动" tabindex="0"><table><caption>实际稳定归一化；这是计算中间量，不是概率密度表</caption><thead><tr><th>分支</th><th>指数 t</th><th>exp(t−max(t))</th><th>乘先验0.5</th><th>除以总和=${number(d.normalizer)}</th></tr></thead><tbody>${components.map(component => `<tr><th>${component.mu < 0 ? '左' : '右'}</th><td>${number(component.logEvidence)}</td><td>${number(component.scaledEvidence, 8)}</td><td>${number(component.unnormalized, 8)}</td><td>${number(component.weight, 8)}</td></tr>`).join('')}</tbody></table></div><p><strong>③ 分支内还有不确定性。</strong>固定分支后，给定当前 xₖ 的上一步仍是高斯条件分布。<strong>协方差（covariance, cov）</strong>在这里表示相邻两步在该分支内怎样共同变化；它不是当前噪声的已知值。取 a=ᾱₖ₋₁=${number(d.previousAlphaBar)}，b=ᾱₖ=${number(d.alphaBar)}，α=b/a=${number(d.stepAlpha)}；v_prev=aσ₀²+1−a=${number(d.previousVariance)}，cov=√α×v_prev=${number(d.covariance)}。</p><p>条件均值 m=√aμ+(cov/v)(xₖ−√bμ)，即本分支里给定观察后的下一步中心。左分支 m=${number(components[0].conditionalMean)}；右分支 m=${number(components[1].conditionalMean)}。条件方差 v_prev−cov²/v=<strong data-bridge-value="conditional-variance">${number(d.conditionalVariance, 8)}</strong>，标准差是它的平方根 ${number(Math.sqrt(d.conditionalVariance))}。</p><p><strong>④ 从分布产生一个值。</strong>输入是当前 xₖ 和 k，输出是下一步 xₖ₋₁：先按上面的权重随机选分支，再从该分支的 N(m,条件方差) 抽样。两个条件均值是分支中心，并非下一步一定出现的值；均值、分支权重和一条随机路径是三种不同读数。一般也不会精确找回前向时配对的同一个原样本。</p></details><p>这是固定一维高斯混合分布的解析教学模型，没有训练去噪神经网络，也不是 AniDoc 的调度器。<button type="button" class="quiet" data-scroll="exercises">用另一组数做迁移练习</button></p></section>`;
}
