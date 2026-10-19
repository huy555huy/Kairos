# Signal 实现决策与开工方案

版本 0.8 · 2026-10-19。**第一版选择 OpenNARS for Applications（ONA）的非公理逻辑推理内核，配合 SQLite 的近期证据状态、AIRI 感知和 pi Personal Agent。** 累积、关联、反证和触发的实现约定在本文固定；开工后的工作是集成与验证真实体验，不再从几个引擎中重新选型。

BGE-M3 从未是用户要求的核心。它与其他 embedding 一样，仅可用于补充检索，**不进入第一版必需依赖，不要求安装 Ollama**。此前的向量实验保留为附件，不能证明 Signal 成立。

本次交付了可复跑的 ONA 机制探针，尚未交付桌面产品。合成结构化事实、宿主策略与上游例子的 17 项检查通过；真实画面抽取、自然语言关系解释、帮助价值和 pi 执行仍需在集成中验证。memory 毕业论文的算法与长期组织仍不处理。

阅读导航：[选型](#1-复用什么) · [矩阵与来源](#2-观察怎样进入矩阵) · [累积](#3-累积采用-nal-证据修订) · [关联](#4-关联由现成推理内核产生) · [时机](#5-触发分为理解可用与主动参与) · [接入](#6-内核接入与持久化契约) · [实测](#7-本次实际跑通的机制) · [开工顺序](#8-按这个顺序实现)。完整产品与验收见[工程 Spec](<桌面陪伴宠物工程 Spec.md>)。

## 1. 复用什么

| 职责 | 第一版决定 | 自己需要写的连接代码 |
| - | - | - |
| 活动来源 | ActivityWatch window / web / AFK | 增量拉取、前台身份对齐、经历归并 |
| 画面语义 | AIRI 底层窗口捕获及已配置的视觉模型 | 脱离开发页面运行；输出有引用的事实和实体，不直接发言 |
| 累积、关联、反证 | **ONA C 内核：NAL revision、induction、deduction、comparison 及 evidence stamps** | 事实序列化、有限推理包、结果解析、来源与版本核对 |
| 持续状态与矩阵 | SQLite，`better-sqlite3@13.0.3` | X、证据根、R/H、修订、表达记录、outbox；宿主单一写入 |
| 语义桥与参与评价 | 宿主已配置模型，经 `@earendil-works/pi-ai@1.3.0` | 有限的结构化 completion；解释事实、提出待检验关系、判断具体帮助，不另起工具 Agent |
| 回答与执行 | `@earendil-works/pi-coding-agent@1.3.0` | 同一个 AgentSession 接收当前 H 或有效候选，执行已有请求 |
| 可选语义检索 | embedding 适配器，首版可完全不启用 | 只扩大候选证据覆盖；不提供真值、不决定开口 |

ONA 固定到 `dc4efd0abd520cdb79bf53bfa3c285ebb24f2e8a`，MIT。直接编译现有 C 代码，不另写一套 NAL。版本与三个容量配置在 [engine-lock.json](research/signal-engine-spike/engine-lock.json)。该仓库不是快速发布的桌面 SDK，需由本项目维护打包适配；此次核对的上游最后推送为 2025-05-30。Node 驱动要求 Node ≥22；Electron 原生模块与 C 可执行文件的打包由 P0 验证，不能以本机编译替代。

[ONA 源码与构建说明](https://github.com/opennars/OpenNARS-for-Applications/tree/dc4efd0abd520cdb79bf53bfa3c285ebb24f2e8a) · [原始架构论文](https://agi-conf.org/2020/wp-content/uploads/2020/06/AGI-20_paper_52.pdf) · [SQLite 驱动](https://github.com/WiseLibs/better-sqlite3) · [pi SDK](https://pi.dev/docs/latest/sdk)。

### 为什么选择这一组合

| 项目 / 算法 | 查到的实际能力与限制 | 决定 |
| - | - | - |
| [Nexis / Nexus Signal Engine](https://github.com/Raiff1982/Nexus-signal-engine/tree/3814c17455c1ac18b89e25fa04ba8c7479e67eca) | GitHub 的 BehaviorDetector 有 24 小时活动窗口与行为检测，PatternCorrelator 有时间、内容和复合关联；主流程仍是安全风险分析，不能直接形成私人助理认识 | 保留“多路分析、持续状态、关联、决策”的方向，不搬整套安全产品 |
| ONA | 有证据来源的判断修订、归纳与类比、有限资源推理；本机运行验证了独立证据、重复、反证与关联差异 | **采用现有推理内核**，不采用其完整自主操作循环 |
| [OpenCog ECAN](https://github.com/opencog/attention) | 已实现注意力分配与扩散，但依赖 cogutil、AtomSpace、CogServer；注意力强不等于判断有证据 | 不同时引入第二套认知平台。许可证为 AGPL 加 linking exception，具体文件仍需按自身许可处理 |
| [NARS-GPT](https://github.com/opennars/NARS-GPT) | ONA 的 GPT 语言通道，说明自然语言与符号推理可分工；不是本项目画面事实契约 | 参考通道分工，复用现有 pi 模型接入，不运行另一套聊天系统 |
| [NetworkX Personalized PageRank](https://networkx.org/documentation/stable/reference/algorithms/generated/networkx.algorithms.link_analysis.pagerank_alg.pagerank.html) | 现成的图上相关性传播，结果是排序，不是支持/反证修订 | 首版不增加；有据关系和当前锚点已能完成有限工作集选择 |
| [River DBSTREAM](https://riverml.xyz/latest/api/cluster/DBSTREAM/) / [BERTopic online](https://maartengr.github.io/BERTopic/getting_started/online/online.html) | 在线聚类/主题发现不直接处理“同一解释被用户推翻” | 不作为 Signal 内核 |
| [ProactiveAgent](https://github.com/thunlp/ProactiveAgent/tree/3fcf9beebe256b86871659fbb12541c41c9381b9) | 已有 AW 观察与主动任务预测路径 | 参考采集和评价，不复用其独立执行器 |
| [Graphiti](https://github.com/getzep/graphiti/tree/7b0182f94d27075db488636cd5456981ee10b987) | 时间事实图、更新与检索 | 当前不搬完整记忆/图服务，避免侵入论文范围 |

Nexis 的不同发布不能混为一谈。GitHub 主核心做字符旋转、邻位组合和字符 FFT，并有少量近期重复输入处理；HF 增强演示还使用随机复向量、固定矩阵及结果存储。它们不是学到的用户语义矩阵。GitHub 的行为窗口、关联器确实有持续状态，但 RandomForest 威胁检测需训练，不能当成开箱即用的私人助理模型。此前做了静态源码审查，没有运行 Nexis 全栈。

对应源码：[主核心](https://github.com/Raiff1982/Nexus-signal-engine/blob/3814c17455c1ac18b89e25fa04ba8c7479e67eca/nexus_signal_engine/core/engine.py)、[行为状态](https://github.com/Raiff1982/Nexus-signal-engine/blob/3814c17455c1ac18b89e25fa04ba8c7479e67eca/nexus_signal_engine/detection/behavior.py)、[关联器](https://github.com/Raiff1982/Nexus-signal-engine/blob/3814c17455c1ac18b89e25fa04ba8c7479e67eca/nexus_signal_engine/detection/correlator.py)、[HF 演示](https://huggingface.co/spaces/Raiff1982/Nexus-signal-engine/blob/f99ee2ca5a2ae805a01571f655d07d4225732e6f/nexis_signal_engine_enhanced.py)。

## 2. 观察怎样进入矩阵

### 活动与画面属于同一段经历

AW 每 5 秒增量读取，稳定前台 15 秒进入当前资源；60 秒内返回同一资源先归并为同一 episode。持续 duration 用区间并集更新；window、web、AFK 和画面不能分别增加一次经历。屏幕变化检查间隔 15 秒，内容未变复用提取结果。用户要求看当前画面可以即时采样。AIRI 的 Vision 开发页面生命周期不能直接作为后台服务。

感知默认关注当前项目/资料、正在看的内容、可见错误、进展，以及与已有任务的联系。只得到窗口标题时保存资源事实，不编造页面正文。看到食谱支持“看过食谱”，不能直接支持喜欢、食用或购买。普通对话直接进入 pi，更正通过正常工具循环中的 `record_signal_feedback(signalIds, messageId, quote, kind)` 写回；不为每轮聊天增加一个前置分类模型。

近期工作集限定为 7 天、最多 2048 个 episode。这是当前 Signal 的工作范围，不是论文 memory。保存的原始依据、已表达记录、任务与明确更正不因信号降温被删除；过期观察只退出当前推理工作集。

### 矩阵保留，并明确每一块怎样计算

| 表示 | 行 / 列与更新方式 | 在引擎中的作用 |
| - | - | - |
| **X：对象 × 多维特征** | 资源/主题/项目动态行；经历数、前台/活跃时长、最后出现、当前锚点、可见错误/进展、反馈与覆盖状态 | 表示真实活动，秒数不直接加进真值 |
| **B：证据根 × 原子陈述** | 来源、episode、原文、发生时间、极性、替代关系；同源修订只有一个有效版本 | 追踪独立性，编译成带 stamp 的 NAL 输入 |
| **R：对象/类别之间的稀疏关系** | 每条边保存关系类型、`frequency`、`confidence`、来源 stamp 和推断版本 | 有据联系由 ONA 归纳、修订；不把余弦相似度当成边的可信度 |
| **H：可表达的局部判断** | 稳定 ID、形式化命题、限定范围、自然语言释义、支持/反证、未知与修订 | 将引擎结果交给 Agent，原结论可以被推翻 |
| **q：当前情境** | 当前资源、已确认实体、用户回合、任务阶段、锚点版本 | 决定哪个 H 此时有用，不参与伪造新证据 |
| Z：可选语义向量 | 只有启用 embedding 才存在，维度由适配器决定 | 召回可能相关的事实；缺少 Z 不阻断主路径 |

SQLite 稀疏表即可，不需要新增图数据库。状态矩阵与推理机制都有实际责任：X/B 保存证据，NAL 更新 R/H，q 与帮助价值决定参与。不是在特征表上写“矩阵”两个字就算实现引擎。

### 语义桥的输出边界

感知调用同时返回结构化可见事实、现有实体 ID 或新实体提议、证据引用。宿主提供当前项目、任务和最多 12 个相关实体的词表，减少“TLS”和“证书握手”被拆成无关对象。可靠资源/项目 ID、显式引用和已确认别名优先；模糊同义关系由有限语义调用提出，保存为 tentative 并附来源，不由字符串近似直接确认。

模型可以提出“这段日志可能在描述证书错误”，不能直接输出一个“喜欢概率”或“现在必须发言”绕过引擎。语义桥可提出复杂解释 H，但其原始依据、推测关系和已观察事实分开保存；同一模型改写十次仍是同一份证据。复杂意图不会凭空从 NAL 符号里产生，冷启动仍依赖模型的语言常识和可核对观察。

## 3. 累积采用 NAL 证据修订

每个判断有二元真值 `(f,c)`：`f` 表示当前支持方向，`c` 表示证据充足程度。它们不是经过用户数据校准的心理概率。取 ONA 的证据尺度 `k=1`：

```text
w = c / (1-c)
w+ = w*f;  w- = w*(1-f)
f_new = (w1*f1 + w2*f2) / (w1+w2)
c_new = (w1+w2) / (w1+w2+1)
E = c*(f-0.5)+0.5
```

实际计算复用 [Truth.c](https://github.com/opennars/OpenNARS-for-Applications/blob/dc4efd0abd520cdb79bf53bfa3c285ebb24f2e8a/src/Truth.c) 的 revision 等函数及 [Inference.c](https://github.com/opennars/OpenNARS-for-Applications/blob/dc4efd0abd520cdb79bf53bfa3c285ebb24f2e8a/src/Inference.c) 的来源重叠检查，包含上游置信度上限，不另写一个打分引擎。三份 `(1,0.3)` 独立证据得到 `(1,0.5625)`；同一 stamp 重送不增加 c。两份弱支持加一份 `(0,0.9)` 反证得到约 `(0.087,0.908)`：证据充分地反对原判断。

### 第一版证据等级固定为配置

| 依据 | 初始 c | 含义 |
| - | - | - |
| 可核对的直接陈述、可靠资源身份、实际工具回执 | 0.9 | 对该具体事实较强；不是所有延伸解释都同样强 |
| 有摘录/位置的画面语义事实 | 0.6 | 提取可能有误，可以被更正 |
| 有引用但尚未确认的语义解释或关系提议 | 0.3 | 只是一份弱依据，不能伪装成传感器事实 |
| 未观察到、没有回应、模型自己的历史总结 | 不输入 | 未知不是否定，也不是新增支持 |

这是可回放的首版工程参数，不声称已经学习了个人偏好。肯定用 `f=1`，明确相反依据用 `f=0`；不要让模型任意自报小数。对“我不是在排障，是在写报告”这样的**明确更正**，先撤销/替代原解释并使旧候选失效，再重算；不能让一百条浏览行为投票压过用户的解释。事实冲突与更正不是同一个操作。

### 去重、相关来源和撤回

证据根键由 `episode + canonicalAssertion + sourceRevision` 形成，supersedes 只保留有效版本。同一次浏览的截图、AW 和网页文本若支持同一陈述，只留一个有效支持，保留其多种出处。NAL 推导出的结论不能再次作为新的独立输入。

不同原子事实可有不同根，但不是独立用户经历。针对同一待检验关系，每个 episode 只编译一组规范的“所属范围 + 观察属性”，不把同一画面产生的多个同义标签各编译一组。相关的模型解释保留相同来源依赖，不能靠改写制造新根。stamp 防止循环推导重复计证，不自动解决所有统计相关性；本版 c 仍是 NAL 的证据量指标。

撤回、归并、更正均从有效 B 重建受影响推理包，不依赖 ONA 在全局状态里精确删除一条旧推导。旧 R/H 在重建完成前标记 `pendingRevision`，不再交给 Agent 当有效结论。

### 时间采用真实时间的证据折扣

ONA 原生周期时钟不是墙钟，默认事件投影衰减为每周期 0.8，不能把运行频率当成用户生活的流逝。本版向内核输入一个**当前工作集快照的无时态判断**；宿主按发生时间折扣当前相关证据的权重：

```text
w(t) = w0 * 2^(-(now - occurredAt)/halfLife)
c(t) = w(t)/(1+w(t))
```

近期关注关联的半衰期为 24 小时；“当前可见错误尚存在”的证据为 10 分钟，且已解决事件立即替代它。历史“曾经显示错误”的事实不改写。明确用户更正不按这些半衰期消失，直至被后续说明替代；工作集之外仍保留更正屏障，不能重新采用被否定的旧解释。

衰减在新证据、相关查询、焦点变化或每 60 秒的本地维护中重算，不调用语言模型，不生成新的生活事件。纯衰减只更新/撤销资格，不制造新的主动表达。7 天工作集与 24 小时权重是不同参数。

## 4. 关联由现成推理内核产生

关系不靠预设“菠萝出现四次”一类脚本产生。语义桥把观察转成有类型的属性，ONA 从共同属性归纳关系，也可以用已知关系推导当前结果。

下面是可运行探针采用的结构，`p_kairos` 与 `t_tls` 都是**经历类别**：前者是 Kairos 项目相关经历，后者是可见 TLS 内容的经历。三份不同资源的事实里没有提前输入最终关系。

```text
<r1 --> p_kairos>. {1.0 0.9}
<r1 --> t_tls>.    {1.0 0.6}
<r2 --> p_kairos>. {1.0 0.9}
<r2 --> t_tls>.    {1.0 0.6}
<r3 --> p_kairos>. {1.0 0.9}
<r3 --> t_tls>.    {1.0 0.6}
```

查询 `<p_kairos --> t_tls>?`，内核归纳出 `(f=1,c≈0.6183)`，来源含六个事实根。换成购物/旅行等不同类别，同样的时间和条数只得到约 `c=0.3506`。关系强度的差异在进入 pi 前已经存在。探针省略在这里的 stamp 与固定推理步数见 [replay.py](research/signal-engine-spike/replay.py)。

其安全的释义是“近期 Kairos 活动与 TLS 内容有关”，不是“用户一定卡住了”，更不是“获准修复项目”。要解释成排障，还需可见错误、修改与尝试等依据；“只是写比较报告”的更正会使排障解释失效，同时可以保留确实看过 TLS 内容的事实。支持方向与因果、意图、授权分别建模。

NAL 归纳与一般逻辑规则可以复用，它不意味着不需要事实表示。第一版不训练个体模型，不把 ONA 的自主操作学习、motor babbling 或“未达成预期就自动产生负反馈”接到用户身上；只使用声明式事实与查询，禁止操作和目标输入。时间先后在 B 中保存为事实，暂不启用 ONA 的时序程序学习。

## 5. 触发分为理解可用与主动参与

### 用户当前在说话：直接使用已形成的 H

按资源、实体、当前任务或直接回复的 claim，附加最多 3 个有效 H、支持/反证和原文引用。试探性判断明确标注。没有达到主动表达门槛的弱关系也可以作为有边界的上下文，不能变成确定事实。普通对话不等待一轮参与评价；正好有候选则并入这一回合。

### 后台：先有证据资格，再判断具体价值

1. 新语义证据按 10 秒合并，最长等待 60 秒；明确更正先同步使旧状态失效。根据受影响的实体/任务关系选包并运行 NAL。**不再要求先有三次访问才能开始推理。** duration 增长、同内容重送不产生新的语义版本。
2. 对推断型 H，初始主动评估资格为 `c ≥ 0.5 && E ≥ 0.75`；同时需要有效支持、无待处理更正和真实当前锚点。达到资格只表示值得评估，不直接发言。明确任务委托走任务路径，不受此门槛阻挡。
3. 仅在首次取得资格、出现未表达的实质事实/解释、或任务阶段带来新的帮助机会时，运行一次有限的参与评价。键为 `signalId + meaningRevision + opportunityRevision`；数值增长、页面再次打开或换一种措辞不生成新的 meaningRevision。
4. 参与评价返回 `hold | context_only | offer`，必须引用当前依据和可完成的具体帮助。纯粹宣布“我发现你又看了它”不能算新增帮助；可以自然回应共同经历，但要有本次值得表达的内容。没有明确价值就保留为回答上下文。
5. 宿主再核对依据版本、锚点、相同认识的表达/hold 记录，写入 outbox。无用户回合时才独立调用同一个 pi；pi 仍可决定无需表达。实际显示回执才更新 expressed，生成完成不等于说过。

参与评价使用宿主模型配置，一次 completion，无文件或系统工具。输出契约：

```ts
type Participation = {
  signalId: string;
  basisRevision: number;
  opportunityRevision: string;
  decision: "hold" | "context_only" | "offer";
  evidenceIds: string[];
  anchorRef: string;
  newInformation: string;  // 必须相对已表达/已评估内容说明变化
  concreteHelp?: string;
  mandateRef?: string;    // 提出执行已有任务时必需
};
```

自由文本理由只是提议；无效引用、过期版本、没有新内容或缺少所需委托会被拒绝。复杂帮助价值仍由模型判断，这一环节尚未实测其真实质量，不能用确定性资格检查冒充。没有每日配额或机械发言冷却；不重复来自认识和机会去重。

默认表达候选 TTL 为 120 秒，当前资源/任务锚点仍必须有效。过期只取消这次派发，不删除 H。用户提问使用 H 不受气泡 TTL 限制。

### 明确委托独立于主动推断

“每新增三份会议记录整理一次”已有精确条件，不需要推断用户是否想要。按委托版本、独立输入 ID 原子封存批次，形成稳定 triggerKey，交给同一个 pi 执行；排除自身输出，保留取消、修订和崩溃后的结果核对。这条路径不经参与模型，不因为无新认识或表达 TTL 到期而丢任务。

## 6. 内核接入与持久化契约

### 一个有限快照对应一次 C 推理进程

先采用 `child_process.spawn` 运行固定 NAR 可执行文件，标准输入/输出传递经宿主生成的 Narsese；不经 shell 拼接。一个宿主串行调度，最多一个推理子进程。SQLite 保存连续状态，子进程为可重建计算，重启不丢失积累。无需长期运行的第二个 Agent 或 Python 服务；探针里的 Python 仅用于开发验证。

原版 `STAMP_SIZE=10` 会截短来源，不能直接承诺完整去重。本版改为 64，同时将 `CONCEPTS_MAX=512`、`TABLE_SIZE=16`，其余逻辑不修改。构建后的上游 C 测试已通过。

| 接入参数 | 第一版约定 |
| - | - |
| 每个关系/解释的活动证据包 | 近 7 天内最多 24 个相关 episode；当前事实、有效更正/反证优先，再按相关性与发生时间填充 |
| 输入上限 | 总计最多 64 个不同证据根（含关系提议与更正），最多 200 个原子符号 |
| 证据独立性 | 同一关系每 episode 最多一组规范属性；跨源同义事实归并；推导结果不回灌为新证据 |
| 推理步数 | 按固定事实排序，每组两条事实后 50 cycles，包末 100 cycles；显式额外预算最多 1700 cycles，另有上游每条 belief 自动推进的 1 cycle |
| 输入形式 | 无时态 belief 和 question；`motorbabbling=false`，不注册操作，不接受 goal / operation / 任意 shell 指令 |
| 查询范围 | 受影响的已知 H 与观察产生的范围/属性对；每包最多 12 个问题，按稳定顺序 |
| 超限处理 | 按关系/解释拆包；同一 H 的结果不跨包当独立证据相加。必要反证不能装下时该 H 标记 incomplete，只提供事实，不主动断言 |
| 超时 | 单包 2 秒停止该计算，H 保持 pending/incomplete，普通对话使用原始有效事实；不回退为伪造结论 |
| 复现 | 同证据、配置、固定排序与固定查询得到同快照；生产需覆盖该排序/多查询契约 |

最近 24 个相关经历是明确的计算范围，不能宣称代表所有历史。H 保存实际 included/excluded IDs 和 coverage。不同观点的反证不因排在 top-k 外而被省略；明确更正作为覆盖屏障独立检查。有限概念/关联表仍可能淘汰推导，查不到答案表示本次不确定，不表示反证。

事实用宿主生成的 ASCII ID 映射，原文不直接写入 Narsese；只允许类型化 AST 序列化。原子符号、输出命题和 stamp 都映射回本包词表。不得把页面文字或模型自由文本当作 C 内核命令。

### 保存哪些字段

```ts
type SignalHypothesis = {
  signalId: string;
  revision: number;          // 数值/证据状态修订
  meaningRevision: number;   // 实际认识变化，不能仅因 c 增加而变动
  formalTerm: string;
  statement: string;
  scope: { from: string; to: string; includedEpisodeIds: string[] };
  truth: { frequency: number; confidence: number; expectation: number };
  relatedPatternKeys: string[];
  supportEvidenceRefs: string[];
  counterEvidenceRefs: string[];
  unresolved: string[];
  status: "tentative" | "supported" | "refuted";
  coverage: "complete_for_scope" | "incomplete";
  pendingRevision: boolean;
  basisStateVersions: Record<string, number>;
  basisSemanticVersions: Record<string, number>;
  methodRef: string;         // 引擎 commit、profile、语义桥与配置版本
};
```

`status` 是应用层解释：达到支持资格且无未处理反证为 supported，显式替代/否定或 `E≤0.25,c≥0.5` 可标 refuted，其余 tentative。支持/反证可并存；语义桥解释错误时即使数值高也必须撤回。`meaningRevision` 由形式化命题、限定范围与具体解释的变化维护，不取模型句子文本 hash；工作集滚动本身不算新发现。

SQLite 表为 observations、episodes、assertions、assertion_sources、features、relations、hypotheses、feedback、participation_decisions、candidates/outbox、mandates/batches。每个字段保持来源引用；原始内容与派生矩阵分离。

事务一写入观察/B/X、相关 semanticVersion 与待推断标记；模型和 C 计算都在事务外；事务二校验版本，提交 R/H 与候选。普通 duration 增长只改 stateVersion，不让语义推断永远过期；涉及时长的条件在提交时读最新 X。更正立即提升语义版本并使旧候选失效，晚到结果不得覆盖。

pi 会话仍是另一事实源，以 candidateId/triggerKey 核对运行和交付。生成、显示、消费之间用 outbox 及回执恢复；不宣称两个存储与外部工具天然具备 exactly-once。

## 7. 本次实际跑通的机制

代码、锁定版本、原始数字与复跑命令见 [signal-engine-spike](research/signal-engine-spike/README.md)。所有输入都是合成的结构化事实，没有让模型预写目标答案；关联用例只输入资源属性。置信度使用本版工程参数。

| 检查 | 实际观察 |
| - | - |
| 三份独立弱证据 | c 从 0.3 增至 0.5625 |
| 同根原样重送 100 次 | c 仍为 0.3 |
| 两份弱支持 + 一份强反证 | f≈0.087，c≈0.908，停止取得主动评估资格 |
| 三个共同属性资源 / 相同条数无关资源 | 归纳关系 c≈0.6183 / 0.3506；前者取得评估资格，后者没有 |
| 同一事实的多来源副本 | 宿主归并后与原始结果一致 |
| 真实时间经过 24 小时 | 三份弱证据 c 降至约 0.3913，退出主动评估资格 |
| 撤回一份支持 | 重建后只保留另外两份 stamp，c 下降 |
| 重启与不同到达顺序 | 固定排序重放的真值和 stamp 相同 |
| 无相关锚点 / 更正处理中 / 已表达 / 同情境 hold | 宿主资格选择器均不重复送审 |
| 64 根与 65 根 | 64 根的 stamp 完整；65 根在输入前拒绝 |
| 上游诊断例子 | 有标注经验后的类比查询通过；不冒充冷启动意图理解 |

17 项检查全部通过，包含 NAL 实跑和宿主小探针；不是 17 个完整产品场景。限定配置与原版的上游 C 测试均通过。一次限定配置的关系用例进程峰值 RSS 约 71.6 MiB；热缓存批量探针的启动加计算耗时中位数见 results.json，独立 time 启动测得约 60 ms，测量口径不同。均不含视觉模型、Electron、AW 或 Agent，不能据此宣布整机轻量。

尚未测：真实窗口权限与采集、语义桥是否正确区分研究/排障/偏好、参与模型的误打扰率、真实 pi 任务、多小时资源、复杂事实图在有限表中的召回。架构选择已作出，这些是实现与效果验收，不以失败时一律 hold 掩盖缺失能力。

## 8. 按这个顺序实现

以下是进入 AIRI fork 后要新增的生产模块，目前仓库中只有文档和研究探针。

| 顺序 | 目标模块 | 完成标准 |
| - | - | - |
| 1 | `store/`、`sources/activitywatch.ts`、`episodes.ts` | 真实 AW 事件进入 X/B；持续时长、重复读取、重启不多计经历 |
| 2 | `perception.ts`、`semantic-bridge.ts` | 当前窗口有出处的事实与动态实体；相关/无关/明确更正样本不被混成同一事实 |
| 3 | `nal/compiler.ts`、`nal/runner.ts`、`beliefs.ts` | 固定 C 内核进入宿主打包；真实事实形成 R/H；容量、来源、更正与墙钟回放成立 |
| 4 | `participation.ts`、`candidates.ts`、`pi-adapter.ts` | 用户提问直接用 H；后台具体帮助走一次评价与同一 pi；同认识不反复宣布 |
| 5 | `mandates.ts`、文件 watcher 适配 | 三份新记录产生真实摘要；输出排除、取消、封存批次与恢复核对成立 |

第 3 步就用真实采集检验“多个不同资源的弱证据产生关联”，不能等 UI 做完才发现符号映射无效。至少采 6 组三联样本：相关资源、同次数无关内容、加入反证/更正；语义桥与参与模型固定版本各跑 3 次，报告所有结果与引用错误，不能只展示最好的一次。加入未见过的项目/主题，检查没有为具体主题写触发规则。

第 4 步测两条不同路径：相同提问在不同历史证据下的回答差异，以及没有提问时具体帮助的时机。第 5 步继续完成工程 Spec 中资料整理、指定测试项目修改和条件委托的实际交付。最终做一次至少 8 小时全进程试用，分别计量感知、语义桥、NAL、参与评价和 pi 的资源与调用；纯机械维护为零生成调用。

### 之前的 embedding 实验放在哪里

[E5/BGE 探针](research/signal-spike/README.md)及结果保留。16 条人工样本中，BGE 的多语种召回较好，但肯定与否定仍可能接近；E5 + AGNES 的主题聚类表现也不能作为 Signal 真假门槛。这些结果只用于以后需要扩展召回时的参考。第一版先靠可靠实体、项目/任务关系与有引用的语义桥跑通核心闭环，没有 BGE 也必须通过验收。
