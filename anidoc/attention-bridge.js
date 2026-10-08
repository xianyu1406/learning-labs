import * as M from './math.js';
import {esc, fmt} from './ui.js';

const number = value => esc(
  Number.isFinite(value) && value !== 0 && Math.abs(value) < .5e-6
    ? value.toExponential(2)
    : fmt(value, 6)
);
const valueSpan = (name, value) => `<span data-bridge-value="${esc(name)}" data-value="${esc(String(value))}">${number(value)}</span>`;
const termsText = terms => terms.map(({input, coefficient, product}) => `(${number(input)}) × (${number(coefficient)}) = ${number(product)}`).join('； ');
const sumText = values => values.map(value => `(${number(value)})`).join(' + ');

/** A short prerequisite bridge; the current lab values are rendered separately. */
export function attentionPrimer() {
  return `<article id="attention-primer" class="card" data-bridge="attention-primer">
    <h3>先把矩阵读成“行乘列”</h3>
    <p>矩阵乘法（matrix multiplication）不是把同一位置的数相乘。求输出的一格时，取左矩阵的一行、右矩阵的一列，逐项相乘再相加。行里有几项，列里就必须有几项。</p>
    <p>例如一行 [1, −1] 乘一列 [2, 3]ᵀ：1 × 2 + (−1) × 3 = −1。这里上标 ᵀ 是转置（transpose）：把行变成列，也把矩阵的行列互换。</p>
    <p>先预测：每个查询要比较 3 个键，一行分数应该有几格？<a href="#operation" data-scroll="operation">去实验选一行，逐项核对 →</a></p>
    <details data-bridge="attention-dimensions">
      <summary>随时回查：形状、指数与按行归一化</summary>
      <p>形状写成“行数 × 列数”。(m × d) × (d × n) → m × n：内侧的 d 必须相同，输出保留外侧的 m 和 n。Σ 表示把同一组项相加；下标从 0 开始，与本实验代码一致。</p>
      <div class="table-scroll" role="region" aria-label="注意力计算表，可横向滚动" tabindex="0"><table><thead><tr><th>屏幕符号</th><th>本实验形状</th><th>输入 → 输出</th></tr></thead><tbody>
        <tr><td>X</td><td>3 × 2</td><td>3 个位置，每个位置 2 维；这是你编辑的表</td></tr>
        <tr><td>WQ / WK / WV</td><td>各为 2 × 2</td><td>固定的教学投影（projection）参数；本实验不训练它们</td></tr>
        <tr><td>Q / K / V</td><td>各为 3 × 2</td><td>X 乘对应投影矩阵；角色不同，形状相同</td></tr>
        <tr><td>Kᵀ</td><td>2 × 3</td><td>K 的每一行，变成 Kᵀ 的一列</td></tr>
        <tr><td>S / A</td><td>各为 3 × 3</td><td>分数 S 比较 3 个查询与 3 个键；A 按每个查询行分配权重</td></tr>
        <tr><td>O = AV</td><td>3 × 2</td><td>每个查询的 3 个权重混合 3 行 V，得到 2 维输出</td></tr>
      </tbody></table></div>
      <p>指数函数（exponential function）exp(s) = eˢ 总是正数，e ≈ 2.718。softmax 归一化（softmax normalization）把一行分数变成相加为 1 的权重：A[r,j] = exp(S[r,j]) / Σₗ exp(S[r,l])。r 是所选查询行，j 是键的位置，Σₗ 只对这一行的 3 个键求和，不对整张表求和。</p>
      <p>手算一个独立小例：分数 [0, 1] → 指数 [1, 2.718…] → 除以总和 3.718… → 权重约 [0.2689, 0.7311]。大分数得到较大权重，但另一个权重仍大于 0。</p>
      <p>实际代码先减去这一行最大分数 m，再计算 exp(S[r,j] − m)。分子和分母都相当于除以 exp(m)，比值不变；这样可避免对很大的正数取指数。缩放开关改变分数：启用时除以 √dₖ，本例键维度 dₖ = 2；关闭时除数为 1。</p>
    </details>
    <small>宽表可左右滚动；按 Tab 聚焦表格后可用左右方向键查看。</small><p><a href="#exercises" data-scroll="exercises">用新的行、列与形状做迁移练习 →</a></p>
  </article>`;
}

/** All selected-row values come from the same attention calculation as the lab. */
export function attentionBridgeData(s) {
  const attention = M.attention(s.X, s.scale);
  const row = s.row;
  if (!Number.isInteger(row) || row < 0 || row >= attention.X.length) throw Error('查询行必须是 0、1 或 2');
  const projectionTerms = attention.X[row].map((input, i) => ({input, coefficient: attention.Wk[i][0], product: input * attention.Wk[i][0]}));
  const dotTerms = attention.Q[row].map((input, i) => ({input, coefficient: attention.K[0][i], product: input * attention.K[0][i]}));
  const scores = attention.scores[row];
  const maximum = Math.max(...scores);
  const shifts = scores.map(score => score - maximum);
  const exponentials = shifts.map(shift => Math.exp(shift));
  const exponentialSum = exponentials.reduce((sum, value) => sum + value, 0);
  const outputTerms = attention.weights[row].map((input, i) => ({input, coefficient: attention.V[i][0], product: input * attention.V[i][0]}));
  return {attention, row, projectionTerms, keyFirst: attention.K[row][0], dotTerms,
    dotFirst: dotTerms.reduce((sum, term) => sum + term.product, 0), divisor: s.scale ? Math.sqrt(2) : 1,
    scores, scoreFirst: scores[0], maximum, shifts, exponentials, exponentialSum,
    weights: attention.weights[row], weightFirst: attention.weights[row][0], outputTerms,
    outputFirst: attention.output[row][0]};
}

export function attentionWalkthrough(s) {
  const d = attentionBridgeData(s);
  const r = esc(String(d.row));
  const position = esc(String(d.row + 1));
  return `<section id="attention-walkthrough" class="calculation" data-bridge="attention-walkthrough" data-query-row="${r}">
    <h4>沿当前第 ${position} 行走一遍</h4>
    <p>输入是你编辑的 X 和屏幕上的固定投影矩阵。当前键的第一维 K[${r},0] = ${valueSpan('k-first', d.keyFirst)}；最终输出第一维 O[${r},0] = ${valueSpan('output-first', d.outputFirst)}。修改输入、查询行或缩放后，这里的值与上方表格一起重算。</p>
    <details data-bridge="attention-steps">
      <summary>展开当前行：乘加、缩放与权重逐项计算</summary>
      <p><strong>① 先做一次行乘列。</strong> X 的第 ${position} 行乘 WK 的第 1 列：[${d.attention.X[d.row].map(number).join(', ')}] 乘 [${d.attention.Wk.map(row => number(row[0])).join(', ')}]ᵀ。${termsText(d.projectionTerms)}；求和 ${sumText(d.projectionTerms.map(term => term.product))} = ${number(d.keyFirst)}，填入 K[${r},0]。Q 与 V 同样分别使用 WQ 与 WV。</p>
      <p><strong>② 查询与第 1 个键打分。</strong> Q[${r},:] = [${d.attention.Q[d.row].map(number).join(', ')}]；K[0,:] = [${d.attention.K[0].map(number).join(', ')}]。冒号 : 表示这一行的所有维度。点积逐项为 ${termsText(d.dotTerms)}，求和 ${number(d.dotFirst)}。再除以 ${s.scale?'√2':'1（缩放已关闭）'}，得到 S[${r},0] = ${valueSpan('score-first', d.scoreFirst)}。与另外两个键比较，会填满本行的 3 个分数。</p>
      <p><strong>③ 只在这一行做 softmax。</strong> 最大分数 m = ${valueSpan('row-maximum', d.maximum)}；先减 m，再取指数。下面三项指数相加为 ${valueSpan('exp-sum', d.exponentialSum)}，每项除以该总和。</p>
      <div class="table-scroll" role="region" aria-label="注意力计算表，可横向滚动" tabindex="0"><table><thead><tr><th>键位置（代码 j）</th><th>分数 S[${r},j]</th><th>分数 − m</th><th>exp(分数 − m)</th><th>权重 A[${r},j]</th></tr></thead><tbody>${d.scores.map((score, j) => `<tr><th>位置 ${esc(String(j + 1))}（${esc(String(j))}）</th><td>${number(score)}</td><td>${number(d.shifts[j])}</td><td>${number(d.exponentials[j])}</td><td>${j===0?valueSpan('weight-first', d.weightFirst):number(d.weights[j])}</td></tr>`).join('')}</tbody></table></div>
      <p>当前行权重和 = ${valueSpan('weight-sum', d.weights.reduce((sum, value) => sum + value, 0))}。这是混合比例，不是对输入像素求和的约束，也不代表一定只选中一个位置。</p>
      <p><strong>④ 用权重混合 V。</strong> 输出第 1 维的三项为 ${termsText(d.outputTerms)}。求和 ${sumText(d.outputTerms.map(term => term.product))} = ${number(d.outputFirst)}，填入 O[${r},0]。输出第 2 维用同样的权重，换成 V 的第 2 列。</p>
      <small>表格与逐项式四舍五入到最多 6 位小数；更小的非零值用科学记数法，内部计算保留完整精度。改变一行 X，可能同时改变查询、键和值，不能把一次变化只归因于某个权重。</small>
    </details>
    <p><a href="#exercises" data-scroll="exercises">换一组数与形状检验这套步骤 →</a></p>
  </section>`;
}
