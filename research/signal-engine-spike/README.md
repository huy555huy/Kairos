# Signal 引擎机制探针

第一版确定复用 OpenNARS for Applications（ONA）声明式推理内核。这里实际启动 C 引擎，验证证据累积、关联、反证与有限快照回放；另外用小型宿主函数验证时间折扣、撤回和参与评估资格。没有调用视觉/语言模型，没有接入真实 AW、AIRI 或 pi。

完整决策、参数及生产接入约定见 [Signal 实现决策与开工方案](<../../Signal 实现决策与开工方案.md>)。本目录的 Python 是测试和构建工具，产品接入计划是 TypeScript 宿主直接调用 C 可执行文件。

## 复跑

需要 Git、Python 3 和 C 编译工具链。macOS 本机已构建并运行；其他平台尚未验证。

```sh
cd research/signal-engine-spike
python3 prepare.py
python3 replay.py
.cache/ona/NAR > logs/upstream-c-tests.log 2>&1
```

`prepare.py` 下载固定 commit，在私有 `.cache/ona` 中只修改三个容量宏，然后执行上游 build.sh。已存在的 checkout 若 commit 不符会停止，不覆盖别的 checkout。`replay.py` 覆盖 results.json，逐项输出 PASS/FAIL；退出码非零表示失败。原始输入和完整引擎输出保存在忽略的 logs/。编译日志在 .cache/build.log。可用 `--ona /absolute/path/to/NAR` 测另一份相同 profile 的二进制；结果记录其 SHA256。

本次执行：17/17 检查通过，上游 C 测试通过。原版与限定配置均运行过 C 测试，但没有运行上游全部英文和 NAL 集成评测。

## 复用及容量修改

上游：[opennars/OpenNARS-for-Applications](https://github.com/opennars/OpenNARS-for-Applications/tree/dc4efd0abd520cdb79bf53bfa3c285ebb24f2e8a)，MIT；构建 checkout 内保留原许可，发布二进制时也须携带许可。精确版本及 profile 在 engine-lock.json。

- STAMP_SIZE：10 → 64。有限包最多 64 个输入证据根，避免在这一范围内截短来源。
- CONCEPTS_MAX：4096 → 512。
- TABLE_SIZE：120 → 16。

没有修改真值公式和推理规则。后两个值限制计算状态与内存，不承诺所有复杂推导都能被保留。64 根完整性测试只验证该证据边界，不代表任意复杂图的推断召回率。

## 测试说明

| 组别 | 验证什么 | 不证明什么 |
| - | - | - |
| 独立弱支持、同根重复、反证 | 实际 NAL revision、stamp 去重及反向判断 | 自然语言被正确理解 |
| 共同属性与无关对照 | 仅给资源属性，ONA 归纳出未输入的类别关系；同次数不同内容产生差异 | 已经理解人的意图或因果关系 |
| 去重、24 小时折扣、撤回、重启 | 宿主重建有效快照，再由真实引擎计算 | SQLite / AW / Electron 已集成 |
| 当前锚点、更正、已表达、同情境 hold | 确定性选择器控制“是否值得送参与评价” | 模型决定开口的质量、任务授权与实际成果 |
| 64 / 65 根 | 完整 stamp 及超容量输入拒绝 | 大规模长期 memory |
| 上游 diagnostic | 引擎从有标注经验做类比，查询两个预期答案 | 冷启动的私人助理行为 |

初始置信度与门槛是工程配置，不是学习或校准出的用户概率。关联例子把 `p_kairos`、`t_tls` 当成经历类别，允许的解释是“近期 Kairos 活动与 TLS 内容关联”；不能自动升级成“用户卡住、希望我修复”。

结果包含每次进程的启动与计算耗时；短样本受缓存和系统调度影响，不是产品延迟承诺。独立 `/usr/bin/time -l` 对限定配置关联用例测得峰值 RSS 75,087,872 bytes（约 71.6 MiB），elapsed 约 60 ms；上游 C 测试进程约 72.1 MiB。均不包含 Electron、感知模型或 Agent。

后续集成验收需要实际画面事实、固定版本语义桥/参与模型、相关/无关/反证三联样本，以及真实回答和工具交付。不能让“全都不说话”通过帮助效果验收。
