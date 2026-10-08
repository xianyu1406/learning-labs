import * as M from './math.js';
import {esc, fmt} from './ui.js';

const number = value => esc(Number.isFinite(value) && value !== 0 && Math.abs(value) < .5e-6
  ? value.toExponential(2) : fmt(value, 6));
const valueSpan = (name, value) => `<span data-foundation-value="${esc(name)}" data-value="${esc(String(value))}">${number(value)}</span>`;
const tableRegion = body => `<div class="table-scroll" role="region" aria-label="教材逐项计算表，可横向滚动" tabindex="0">${body}</div>`;
const readingLinks = (operation = true) => `<p>${operation?'<a href="#operation" data-scroll="operation">先预测，再到当前实验核对 →</a> · ':''}<a href="#exercises" data-scroll="exercises">换一组数做迁移练习 →</a></p>`;

function activationValue(name, z) {
  if (name === 'tanh') return Math.tanh(z);
  if (name === 'relu') return Math.max(0, z);
  if (name === 'linear') return z;
  throw Error('激活函数无效');
}
function activationSlope(name, z) {
  if (name === 'tanh') return 1 - Math.tanh(z) ** 2;
  if (name === 'relu') return z > 0 ? 1 : 0;
  if (name === 'linear') return 1;
  throw Error('激活函数无效');
}

/** Narrow prerequisite bridges; numerical examples are teaching examples. */
export function foundationsPrimer(id) {
  if (id === 3) return `<article id="foundations-primer-3" class="card" data-bridge="foundations-primer">
    <h3>先沿一条变化链走到损失</h3>
    <p>链式法则（chain rule）把多段局部变化率相乘。固定一个数据点 (x,y)，先算预测 ŷ=wx+b，再算残差 r=ŷ−y，最后算单样本平方损失 ℓ=r²。∂ℓ/∂w 读作“x、y、b 固定时，损失对 w 的变化率”；这不是把 ℓ 除以 w。</p>
    <p>先预测：若预测已经偏高，而 x 为负，略微增加 w 会让这一点的预测靠近还是远离目标？这里保持 b 不变，只看局部小幅变化。实验下方会选当前第 1 个数据点，逐段核对你的理由；一个点的结论不保证整组损失也下降。</p>
    <details data-bridge="foundations-chain-rule">
      <summary>回查一个可以手算的链式法则例子</summary>
      <p>独立小例：x=2、y=1、w=1、b=0 → ŷ=2 → r=1 → ℓ=1。沿链回看：∂ℓ/∂r=2r=2，∂r/∂ŷ=1，∂ŷ/∂w=x=2。因此 ∂ℓ/∂w=2×1×2=4；对 b 的最后一段为 1，所以 ∂ℓ/∂b=2。</p>
      <p>训练用的是 n 个样本的平均 L=(1/n)Σℓᵢ，故 ∂L/∂w=(1/n)Σ2rᵢxᵢ。Σ 是逐项相加，i 是样本编号，n 是样本数。当前回归实验 n=5；不能把上面一个点的 4 直接拿来更新整组数据。</p>
    </details>${readingLinks()}
  </article>`;
  if (id === 4) return `<article id="foundations-primer-4" class="card" data-bridge="foundations-primer">
    <h3>从一条直线到一项真实网络梯度</h3>
    <p>仿射变换（affine transformation）u=ax+b 包含乘法与偏置（bias）。严格的线性变换（linear transformation）没有额外常数项；深度学习常把带偏置的仿射层也叫“线性层”。激活函数（activation function）φ 再把 u 变成 h；本实验可选非线性 tanh、ReLU，也可选恒等（identity）激活 linear。</p>
    <p>先预测：选择 linear 后，把隐藏单元从 1 增到 12，预测会变成弯曲的线吗？再切换到 tanh 或 ReLU，单步训练并观察下方第 1 个训练样本、第 1 个隐藏单元的实际变化链。</p>
    <details data-bridge="foundations-affine-activation">
      <summary>回查：偏置、激活取值与变化率</summary>
      <p>两层无非线性仍是仿射：u=3x+1、ŷ=2u−4 → ŷ=6x−2。增加层数、单元数会改变系数，却不能使它弯曲。独立代入 x=2，两种写法都得到 10。</p>
      ${tableRegion(`<table><thead><tr><th>本实验激活 φ(u)</th><th>输入 → 输出</th><th>对 u 的局部变化率 φ′(u)</th></tr></thead><tbody>
        <tr><td>linear：φ(u)=u</td><td>任意有限实数 → 原数</td><td>1</td></tr>
        <tr><td>双曲正切（hyperbolic tangent, tanh）</td><td>任意有限实数 → 数学上在 (−1,1) 内</td><td>1−tanh²(u)</td></tr>
        <tr><td>修正线性单元（rectified linear unit, ReLU）：max(0,u)</td><td>负数 → 0；非负数 → 原数</td><td>u&gt;0 时为 1；u&lt;0 时为 0</td></tr>
      </tbody></table>`)}
      <p>ReLU 在 u=0 处不可导，本实现选择变化率 0 作为更新约定；不能用这个约定声称该点有普通导数。tanh 在有限精度中可能显示成 ±1，局部变化率很小；不要把显示舍入当作数学取值范围改变。</p>
      <p>链式法则（chain rule）沿 aⱼ → uⱼ → hⱼ → ŷ → ℓ 回传：∂ℓ/∂aⱼ = [2(ŷ−y)] × cⱼ × φ′(uⱼ) × x。j 是隐藏单元编号；本实现从 0 开始。其他隐藏单元也参与完整预测 ŷ，不能只用 cⱼhⱼ 代替整个输出。</p>
    </details>${readingLinks()}
  </article>`;
  if (id === 9) return `<article id="foundations-primer-9" class="card" data-bridge="foundations-primer">
    <h3>先把 θ 与平方范数接回平方误差</h3>
    <p>参数集合（parameter set）θ 是网络所有可训练权重、偏置的统称。线性回归可写 θ=(w,b)，本站小网络则包含 a、b、c、d。fθ(x) 表示“由这些参数决定的预测函数”，不是 θ 乘 x；改变 θ 会改变预测，输入 x 和目标 y 本身不是 θ。</p>
    <p>平方欧氏范数（squared Euclidean norm）‖e‖² = Σⱼeⱼ²，表示误差向量的各分量平方后求和。竖线不是绝对值符号重复两次，下标 j 遍历向量分量。</p>
    <p>先预测：把误差 (2,−1) 的符号全部翻转，平方和会改变吗？这只是两维教学误差，不是已经算出的 AniDoc 潜变量（latent variable）或其训练损失。</p>
    <details data-bridge="foundations-norm">
      <summary>回查：平方和、平均与公式的抽样范围</summary>
      <p>两维例 e=(2,−1)：‖e‖² = 2²+(−1)² = ${valueSpan('norm-square', 5)}。若规则明确要求按 2 个分量取均方误差，再除以 2 得 ${valueSpan('norm-average', 2.5)}。平方范数自身不含这次平均；阅读真实公式、实现时先查 reduction（求和/平均约定）。</p>
      <p>本站回归与小网络每个样本只有一个标量误差，L=(1/n)Σᵢ(ŷᵢ−yᵢ)² 是按 n 个样本平均。高维误差还有分量轴，应分清“对分量求和”与“对样本平均”。E 是期望（expectation）：按公式指定的样本、时间步或噪声抽样规则取平均，不是按变量名字猜平均哪些轴。</p>
      <p>论文里的 θ、干净目标、参考图潜变量与时间步各有定义。下方固定版本公式/代码导读会指出输入、输出、拼接轴和更新对象；这个代数小例只补读公式所需的符号，没有运行 AniDoc 训练。</p>
    </details>${readingLinks(false)}
  </article>`;
  return '';
}

/** Current values share the calculation and data used by the existing labs. */
export function foundationsData(id, s, model) {
  if (id === 3) {
    const path = M.descent(s.w, s.b, s.lr, s.steps), point = path.at(-1);
    const regression = M.regression(point.w, point.b), sample = regression.points[0];
    const lossSlope = 2 * sample.residual, sampleGradient = lossSlope * sample.x;
    return {point, regression, sample, n: regression.points.length, lossSlope,
      sampleGradient, sampleContribution: sampleGradient / regression.points.length,
      fullGradient: regression.gradient[0]};
  }
  if (id === 4) {
    if (!model || model.seed !== s.seed || model.activation !== s.activation || model.width !== s.width)
      throw Error('模型与当前实验配置不一致');
    const data = M.makeData(s.seed), [x,y] = data.train[0], j = 0;
    const a = model.a[j], b = model.b[j], c = model.c[j], z = a * x + b;
    const h = activationValue(model.activation, z), prediction = M.predict(model, x);
    const residual = prediction - y, lossSlope = 2 * residual;
    const activationDerivative = activationSlope(model.activation, z);
    const sampleGradient = lossSlope * c * activationDerivative * x;
    const fullGradient = M.nnGrad(model, data.train).a[j];
    return {x,y,j,a,b,c,z,h,prediction,residual,loss:residual**2,lossSlope,
      activationDerivative,sampleGradient,sampleContribution:sampleGradient / data.train.length,
      fullGradient,n:data.train.length,epoch:model.epoch,activation:model.activation};
  }
  return null;
}

export function foundationsWalkthrough(id, s, model) {
  const d = foundationsData(id, s, model);
  if (!d) return '';
  if (id === 3) return `<section id="foundations-walkthrough-3" class="calculation" data-bridge="foundations-walkthrough">
    <h4>沿当前第 1 个回归数据点求一项梯度</h4>
    <p>这是屏幕已计算 ${esc(String(s.steps))} 步后的参数，不是起点滑块值：w=${valueSpan('current-w', d.point.w)}，b=${valueSpan('current-b', d.point.b)}。输入 x=${valueSpan('input-x', d.sample.x)}，目标 y=${valueSpan('target-y', d.sample.y)}；残差 r=${valueSpan('residual', d.sample.residual)}。</p>
    <details data-bridge="foundations-steps-3">
      <summary>展开当前点：单样本乘积怎样汇成平均梯度</summary>
      <p>ŷ=wx+b=${number(d.point.w)}×(${number(d.sample.x)})+(${number(d.point.b)})=${number(d.sample.pred)}；r=ŷ−y=${number(d.sample.residual)}；ℓ=r²=${number(d.sample.residual**2)}。</p>
      <p>从损失往回乘：∂ℓ/∂w = (2r)×1×x = (${number(d.lossSlope)})×1×(${number(d.sample.x)}) = ${valueSpan('sample-gradient', d.sampleGradient)}。对 b 则用最后一段 1，得到 ${number(d.lossSlope)}。</p>
      ${tableRegion(`<table><thead><tr><th>训练点 i</th><th>xᵢ</th><th>rᵢ</th><th>2rᵢxᵢ</th><th>对平均梯度的贡献 2rᵢxᵢ/${d.n}</th></tr></thead><tbody>${d.regression.points.map((p,i)=>`<tr><th>${i+1}</th><td>${number(p.x)}</td><td>${number(p.residual)}</td><td>${number(2*p.residual*p.x)}</td><td>${number(2*p.residual*p.x/d.n)}</td></tr>`).join('')}</tbody></table>`)}
      <p>上表最后一列相加，得到 ∂L/∂w=${valueSpan('full-gradient', d.fullGradient)}，与上方 dw 卡片相同。第 1 个点只是五项之一；真实更新使用所有 5 点的平均梯度。单步后这里会跟随新参数重算。</p>
      <small>读数最多显示 6 位小数，内部计算保留完整精度；非零极小值用科学记数法。</small>
    </details>${readingLinks(false)}
  </section>`;
  return `<section id="foundations-walkthrough-4" class="calculation" data-bridge="foundations-walkthrough" data-epoch="${esc(String(d.epoch))}" data-activation="${esc(d.activation)}">
    <h4>沿当前网络的一条真实权重路径回传</h4>
    <p>当前已更新 ${esc(String(d.epoch))} 轮。固定第 1 个训练样本：x=${valueSpan('input-x', d.x)}，目标 y=${valueSpan('target-y', d.y)}；当前完整网络预测 ŷ=${valueSpan('prediction', d.prediction)}。选第 1 个隐藏单元（代码 j=0），它的仿射结果 u₀=${valueSpan('hidden-z', d.z)}、激活 h₀=${valueSpan('hidden-h', d.h)}；激活类型与上方下拉框相同。</p>
    <details data-bridge="foundations-steps-4">
      <summary>展开当前路径：a₀ → u₀ → h₀ → ŷ → ℓ</summary>
      <p>① 当前权重 a₀=${number(d.a)}、偏置 b₀=${number(d.b)}，u₀=a₀x+b₀=${number(d.a)}×(${number(d.x)})+(${number(d.b)})=${number(d.z)}。h₀=φ(u₀)=${number(d.h)}；输出权重 c₀=${number(d.c)}。</p>
      <p>② ŷ=d+Σⱼcⱼhⱼ=${number(d.prediction)}，这里使用所有 ${esc(String(s.width))} 个隐藏单元，不只第 1 个。残差 ŷ−y=${number(d.residual)}；该样本平方损失 ℓ=(ŷ−y)²=${number(d.loss)}。</p>
      ${tableRegion(`<table><thead><tr><th>回传一段</th><th>当前变化率</th><th>这段怎样影响下一段</th></tr></thead><tbody>
        <tr><td>ℓ 对 ŷ：2(ŷ−y)</td><td>${valueSpan('loss-slope', d.lossSlope)}</td><td>预测误差进入平方损失</td></tr>
        <tr><td>ŷ 对 h₀：c₀</td><td>${number(d.c)}</td><td>隐单元以 c₀ 加权进入完整输出</td></tr>
        <tr><td>h₀ 对 u₀：φ′(u₀)</td><td>${valueSpan('activation-slope', d.activationDerivative)}</td><td>${d.activation==='linear'?'恒等激活，变化率为 1':d.activation==='tanh'?'1−tanh²(u₀)，与当前 h₀ 对应':d.z===0?'u₀=0 不可导；实现选择 0 作为更新约定':d.z>0?'ReLU 正侧，变化率为 1':'ReLU 负侧，变化率为 0'}</td></tr>
        <tr><td>u₀ 对 a₀：x</td><td>${number(d.x)}</td><td>这一项输入把 a₀ 的变化带到 u₀</td></tr>
      </tbody></table>`)}
      <p>四段相乘：∂ℓ/∂a₀ = (${number(d.lossSlope)})×(${number(d.c)})×(${number(d.activationDerivative)})×(${number(d.x)}) = ${valueSpan('sample-gradient', d.sampleGradient)}。这是一个训练样本的导数。</p>
      <p>本实验按 ${d.n} 个训练样本平均：第 1 个样本仅贡献 ${valueSpan('sample-contribution', d.sampleContribution)}；实际 ∂L训练/∂a₀=${valueSpan('full-gradient', d.fullGradient)} 是全部 ${d.n} 项贡献的和。真实更新使用这个平均梯度，a₀新=a₀旧−η∂L训练/∂a₀；验证集不参与它。训练一轮或切换激活后，这里的参数、预测与乘积一起重算。</p>
      <small>此处复核本站标量小网络的解析反向传播，没有运行 AniDoc。读数四舍五入，内部保留完整精度；例如 1.2e-6 表示 1.2×10⁻⁶，此处 e 是十次幂记法，不是指数函数的底数。</small>
    </details>${readingLinks(false)}
  </section>`;
}
