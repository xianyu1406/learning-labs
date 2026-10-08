import {esc} from './ui.js';

// Static reading of the fixed release. No AniDoc weights, tensors or sampler run here.
const commit = '77e0696cea9df7bb1cd2c254ba21639d3a6ab8f8';
const codeRoot = `https://github.com/robbyant-research/AniDoc/blob/${commit}/`;
const paper = 'https://arxiv.org/html/2412.14173v2#S3';
const source = (path, label) => `<a href="${codeRoot + path}" target="_blank" rel="noopener" data-reading-source="${esc(path)}">${esc(label)} ↗</a>`;
const paperLink = label => `<a href="${paper}" target="_blank" rel="noopener">${esc(label)} ↗</a>`;
const jump = (section, label) => `<a href="#${section}" data-scroll="${section}">${esc(label)}</a>`;

export function anidocReadingData(s) {
  const {frames: F, height: H, width: W} = s;
  if (!Number.isInteger(F) || F < 1 || F > 24 || ![160, 320, 640].includes(H) || ![256, 512, 1024].includes(W)) {
    throw new RangeError('架构教学尺寸超出已标明范围');
  }
  const B = 1, scale = 8, h = H / scale, w = W / scale;
  return {
    B, F, H, W, scale, h, w,
    controlShape: [B, F, 8, H, W],
    referenceShape: [B, F, 4, h, w],
    latentShape: [B, F, 8, h, w],
    updatedShape: [B, F, 4, h, w],
    latentElements: B * F * 8 * h * w,
    controlElements: B * F * 8 * H * W,
  };
}

function reading8() {
  return `<article id="anidoc-reading-8" class="card teaching-bridge" data-reading="8">
    <span class="badge warning">论文 → 固定代码 → 架构演示 · 未运行 AniDoc</span>
    <h3>先沿两种条件找代码，再读架构名称</h3>
    <p>拼接（concatenation）把已有通道排在一起，不是像素相加。这里按 <code>[B,F,C,H,W]</code> 读轴：批次、视频帧、通道、高度、宽度；Python 从 0 数起，所以 <code>dim=2</code> 是 C。论文中的帧索引 t 在本站写作 f，避免与扩散步 k 混淆。</p>
    <p><strong>先预测：</strong>参考潜变量只含一张图，把它重复到 F 帧后，再沿通道轴拼到带噪视频上，会增加帧数还是通道数？先 ${jump('prediction', '写下你的判断')}，再 ${jump('operation', '改变架构实验的 F/H/W')}；屏幕形状是实际整数计算，特征与颜色没有在这里生成。</p>
    <details data-reading-detail="paper-code-map"><summary>主动展开：论文 Eq.(4) 如何接到发布代码</summary>
      <p class="formula">{I_f} = D(I_ref, E({S_f}, {P_f}, I_ref))</p>
      <p>这是 arXiv v2 的 Eq.(4)，仅把视频索引 t 重命名为 f。I_ref 是参考彩图，S_f 是线稿，P_f 是对应点图。E 表示控制分支编码器（control branch encoder）；D 表示完整去噪生成过程（denoising process），不能只解释成 VAE 解码器。</p>
      <p><strong>发布代码观察：</strong>推理脚本把线稿、两张点图、参考 RGB 沿通道轴拼接为控制条件；管线另外重复参考潜变量，并与带噪视频潜变量拼接。前者接近 E 的输入；后者是 D 内部使用参考信息的一条路径。这是静态数据流对应，不声称每个代码调用与整条论文公式一一相等。</p>
      <p>${paperLink('论文 §3.2 / Eq.(4)')} · ${source('scripts_infer/anidoc_inference.py#L279-L286', '图像控制条件')} · ${source('pipelines/AniDoc.py#L524-L527', '参考潜变量重复')} · ${source('pipelines/AniDoc.py#L570-L580', '潜空间拼接与控制入口')}</p>
    </details>
    <p><strong>解释后迁移：</strong>先按轴读出“怎样拼”，再核对“拼的是什么、空间尺寸是多少”。${jump('exercises', '用新尺寸回答迁移题')}；参考解由你主动展开。</p>
  </article>`;
}

function reading9() {
  return `<article id="anidoc-reading-9" class="card teaching-bridge" data-reading="9">
    <span class="badge">固定代码观察 · 未运行 AniDoc</span>
    <h3>先分清训练目标、条件入口和采样更新</h3>
    <p>论文 Eq.(2) 的 θ 是可学习参数的集合，不是某个视频帧。‖ε−ε̂‖² 把噪声误差逐元素平方后求和；𝔼 再对随机训练样本求平均。它没有在公式中额外写“除以特征元素数”，不能不加说明地与前面 MSE 的平均规则互换。</p>
    <p><strong>先预测：</strong>论文写一个训练目标，能否据此断言发布推理代码中每一步直接执行 <code>z − ε̂</code>？${jump('prediction', '留下你的理由')}；下面按“条件 → 网络输出 → 引导 → 调度器”读四个入口。</p>
    <details data-reading-detail="loss-code"><summary>主动展开：论文 Eq.(2) 的符号与发布边界</summary>
      <p class="formula">L = 𝔼[‖ε − εᶜ_θ(z_k; k, z_ref, c_sketch, c_corr)‖²]</p>
      <p>这是论文目标的教学重命名：z_k 是带噪视频潜变量；k 是扩散噪声层级；z_ref 对应论文的上标 z⁰，特指参考图的 VAE 潜变量。c_sketch、c_corr 是线稿和对应关系控制信号；εᶜ_θ 表示去噪 U-Net 与控制分支的组合，输出所预测的噪声。</p>
      <p>本页只是把符号接回来源。固定 README 的训练发布项仍未勾选；本站没有执行 AniDoc 训练入口。因而这个论文目标不能被当作已复现的代码损失，也不能由 <code>noise_pred</code> 变量名推断调度器的输出参数化。</p>
      <p>${paperLink('论文 §3.1 / Eq.(2)')} · ${source('README.md#L61-L68', '固定版本训练发布状态')}</p>
    </details>
    <div class="knowledge-grid">
      <article class="card"><h4>1 · 条件送入网络</h4><p>管线把参考图嵌入作为 <code>encoder_hidden_states</code> 传入 ControlNet 与 U-Net；时空 Transformer 继续把条件传给空间与时间模块。它支持追踪条件入口，尚未追入底层注意力处理器，不能由此声称每层实际 Q/K/V 数值已核验。</p><p>${source('pipelines/AniDoc.py#L576-L596', '条件与残差入口')} · ${source('models_diffusers/transformer_temporal.py#L357-L369', '空间/时间条件入口')}</p></article>
      <article class="card"><h4>2 · 合成模型输出</h4><p>分类器自由引导（classifier-free guidance, CFG）的代码算术为 <code>m = m_u + g_f(m_c − m_u)</code>。m_u、m_c 是两份模型输出；g_f 是对应视频帧的引导系数。这不是条件概率，也不是另一个训练损失。</p><p>${source('pipelines/AniDoc.py#L598-L604', '引导后交给调度器')}</p></article>
      <article class="card"><h4>3 · 调度器更新整个视频</h4><p>采样器 / 调度器（scheduler）接收模型输出、当前扩散层级和旧 latents，返回更新的潜变量。这里没有展开或运行真实采样算法；必须继续查配置及实现，才能确认输出参数化。单次更新作用于视频潜变量张量，不能理解成只生成第 k 帧。</p><p>${source('pipelines/AniDoc.py#L603-L604', 'scheduler.step 调用')}</p></article>
    </div>
    <details data-reading-detail="guidance-example"><summary>主动展开：只手算一项引导输出</summary>
      <p>教学例选 m_u=1、m_c=3、g_f=2，则 m=1+2×(3−1)=5。这里只计算源码已明确写出的合成算术；5 仍是待交给调度器的模型输出，不能当成下一步视频像素或下一步 latent。</p>
      <p>若 g_f=1，就得到 m_c；若两份模型输出相等，引导系数不会改变这一元素。${jump('exercises', '换一组数做迁移题')}，再比较自己的解释。</p>
    </details>
    <p><strong>把公式接回屏幕：</strong><a href="#unit/8">打开单元 8 的架构演示</a>，选择“控制条件拼接”“带噪潜变量拼接”“ControlNet → U-Net → 调度器”三个节点，并改变 F。回来检查：帧轴在这些路径中都被保留，网络输入的通道数与待更新 latents 的通道数不同。这里只演示形状，未生成真实动画。</p>
  </article>`;
}

export function anidocReading(id) {
  return id === 8 ? reading8() : id === 9 ? reading9() : '';
}

const value = (name, x, text) => `<strong data-reading-value="${name}" data-value="${esc(typeof x === 'number' ? String(x) : JSON.stringify(x))}">${esc(text)}</strong>`;
const shape = x => `[${x.join(', ')}]`;

export function anidocShapeWalkthrough(s) {
  const d = anidocReadingData(s);
  return `<article id="anidoc-shape-walkthrough" class="card teaching-bridge" data-reading="shape">
    <span class="badge warning">架构演示 · 只计算形状 · 未运行模型</span>
    <h3>跟当前输入读 repeat、concat 和更新对象</h3>
    <p>当前 F=${value('current-frames', d.F, d.F)}，H=${value('current-height', d.H, d.H)}，W=${value('current-width', d.W, d.W)}；B=1，潜空间缩放 s=8 是本站教学假设。这里先忽略 CFG 的批次复制，只追踪一份视频的帧、通道和空间轴；不是完整推理张量的实测。</p>
    <div class="table-scroll" role="region" aria-label="当前两种条件与潜变量形状" tabindex="0"><table><thead><tr><th>信息流</th><th>轴序 [B,F,C,H,W]</th><th>通道来自哪里</th></tr></thead><tbody>
      <tr><th>图像空间控制条件 C</th><td>${value('control-shape', d.controlShape, shape(d.controlShape))}</td><td>3 线稿 + 1 参考点图 + 1 帧点图 + 3 参考 RGB</td></tr>
      <tr><th>沿帧轴重复的参考潜变量</th><td>${value('reference-shape', d.referenceShape, shape(d.referenceShape))}</td><td>单张参考图的 4 通道复制到 F 帧</td></tr>
      <tr><th>送入去噪网络的潜空间拼接</th><td>${value('latent-shape', d.latentShape, shape(d.latentShape))}</td><td>4 带噪视频 + 4 参考潜变量</td></tr>
      <tr><th>调度器待更新 / 返回的 latents</th><td>${value('updated-shape', d.updatedShape, shape(d.updatedShape))}</td><td>待生成视频本身仍是 4 通道</td></tr>
    </tbody></table></div>
    <p>两种条件都写 8 通道，但高度/宽度与内容不同。当前潜空间网络输入有 ${value('latent-elements', d.latentElements, d.latentElements)} 个标量位置（1×F×8×H/8×W/8），仅为形状计数，不是已计算的特征值。</p>
    <details data-reading-detail="shape-trace"><summary>主动展开：操作后解释每条变化</summary>
      <p>改变 F：复制的参考潜变量和视频都随帧轴变化；改变 H/W：图像条件按像素尺寸变化，潜空间按本演示的 s=8 缩小。<code>repeat</code> 复制参考内容，<code>concat</code> 排列通道；沿 C 拼接保持 F、H、W，沿 F 复制保持 C。</p>
      <p>代码先拼网络输入，后用网络输出更新旧 <code>latents</code>。不能把 8 通道的网络输入与 4 通道的待生成视频直接互换。${source('pipelines/AniDoc.py#L524-L527', '参考 repeat')} · ${source('pipelines/AniDoc.py#L570-L604', 'concat → 条件网络 → scheduler')}</p>
      <p>回到架构节点核对两条路径，再 ${jump('exercises', '提交单元 8 的新尺寸迁移题')}。题目的参考解默认收起。</p>
    </details>
  </article>`;
}
