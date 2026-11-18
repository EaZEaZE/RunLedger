export default function Home() {
  return (
    <main className="product-chooser">
      <div className="chooser-head">
        <div className="chooser-kicker">RUNLEDGER / TWO PRODUCTS, ONE EVIDENCE STANDARD</div>
        <h1>同一套证据标准，两个独立产品</h1>
        <p>都从真实记录出发，都先看差异与波动，再决定是否继续。区别在于使用场景、数据口径和能做的事。</p>
      </div>
      <div className="chooser-grid">
        <a className="product-card card-life" href="/life">
          <div className="card-tag">PERSONAL DECISION</div>
          <h2>RunLedger Life</h2>
          <span className="card-sub">个人生活决策记录</span>
          <p>记录两种生活条件下的真实数值，判断差异是否只是波动，决定还要不要继续测。</p>
          <ul>
            <li>两份 CC0 公开生活演示，可切换查看</li>
            <li>逐条录入或 CSV 导入，只追加不覆盖</li>
            <li>本地统计与复测优先级，记录留在浏览器</li>
          </ul>
          <span className="card-enter">进入生活版 →</span>
        </a>
        <a className="product-card card-lab" href="/lab">
          <div className="card-tag">EXPERIMENT RERUN</div>
          <h2>RunLedger Lab</h2>
          <span className="card-sub">通用实验复测工具</span>
          <p>对基线与候选配置做真实重复运行，识别差异、波动和收敛问题，保留可复现证据。</p>
          <ul>
            <li>真实训练准确率与本地计时两类记录</li>
            <li>按种子或重复轮次配对比较</li>
            <li>原始运行哈希与证据 JSON 导出</li>
          </ul>
          <span className="card-enter">进入实验版 →</span>
        </a>
      </div>
      <div className="chooser-flow">
        <div className="flow-step"><span>01</span><strong>记录真实数值</strong><p>逐条录入或 CSV 导入，只追加不覆盖；空白就是空白，系统不会替你生成示例结果。</p></div>
        <div className="flow-arrow">→</div>
        <div className="flow-step"><span>02</span><strong>看差异与波动</strong><p>条件均值、样本标准差、配对差值和信号噪声比都在本地算；SNR 只用于排序，不是 p 值。</p></div>
        <div className="flow-arrow">→</div>
        <div className="flow-step"><span>03</span><strong>决定是否复测</strong><p>诊断告诉你覆盖够不够、差异是否落入波动、下一步该补哪一组；证据 JSON 和 HTML 报告可随时导出。</p></div>
      </div>
      <div className="chooser-foot">
        <span>信号噪声比不是 p 值</span>
        <span>重复运行不等于随机试验</span>
        <span>关联不等于因果</span>
      </div>
    </main>
  );
}
