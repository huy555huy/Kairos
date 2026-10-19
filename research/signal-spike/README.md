# Signal 编码与检索探针

此目录是可选 embedding 的历史选型实验，不是第一版运行依赖。核心已选 ONA，见 [引擎机制探针](../signal-engine-spike/README.md)。本目录配合[Signal 实现决策与开工方案](<../../Signal 实现决策与开工方案.md>)使用。它运行真实的编码模型与聚类库；没有接入屏幕、用户活动、生成式融合或 Agent，不是完整 Signal 实现。

## 复跑

原始测量环境：Apple M5、macOS arm64、Node 26.8.2。安装的 JavaScript 依赖由 package-lock.json 固定。

```sh
cd research/signal-spike
npm ci
# 下载固定修订的 E5 q8 模型到本目录 .cache，执行对照实验
npm run replay
# 要求本机 127.0.0.1:11434 已运行 Ollama 并已装下述 BGE 模型
npm run replay:bge
```

BGE 脚本不会启动 Ollama 或下载模型。它核对现有 `bge-m3:latest` 的 digest：

```text
7907646426070047a77226ac3e684fbbe8410524f7b4a74d02837e43f2146bab
```

实测版本为 Ollama 0.34.2 / F16。首次模型加载与后续编码时间不同，脚本分别记录可获得的时间。实验会将模型留在 Ollama 默认加载周期内；没有修改用户的模型或服务配置。

## 文件与解释

| 文件 | 内容 |
| - | - |
| fixtures.json | 16 条人工开发样本，含 5 对中英对应内容及相反陈述；label 只参与事后评价 |
| replay.mjs | Transformers.js 4.3.1、真实 E5 q8 编码、ml-hclust 4.0.0 average-link 聚类与阈值敏感性 |
| results.json | E5 原始测量；模型修订、样本 hash、环境、耗时、资源、排名和聚类指标 |
| compare-bge.mjs | 复用现有 Ollama `/api/embed`，比较 BGE 检索排名、相反陈述、聚类敏感性及检索运算量 |
| bge-results.json | BGE 原始测量，含模型 digest、磁盘大小及 `/api/ps` 口径的运行占用 |

两条命令分别覆盖自己的结果 JSON。向量写入忽略的 `.cache`；依赖和模型不纳入 Git。E5 对称相似度使用原模型要求的 `query: ` 前缀，BGE 不加前缀。E5 固定修订为 `761b726dd34fb83930e26aab4e9ac3899aa1fa78`，由 Xenova 转换，原 `intfloat/multilingual-e5-small` 模型许可为 MIT。

检索排名在同一批 16 条样本上计算，并非独立评测集。聚类 pair precision/recall 是“是否同人工主题”的比较，不能衡量真正的跨主题帮助价值；相反陈述也属于同话题。256 向量聚类与 2048 向量检索性能测试会重复已有向量，只能说明运行开销，不能说明该规模的语义准确率。

本实验支持将 BGE-M3 作为可替换的证据检索候选；它不代表完整 Signal Engine 的选型。AGNES 不进入生产 Signal 路径。探针没有验证支持/反证判断、主动时机、真实采集、Electron 打包或 8 小时资源占用。语义桥、NAL 集成与参与评价按实现决策中的三联样本和真实来源继续验收。

依据：[BGE-M3 模型](https://huggingface.co/BAAI/bge-m3)、[E5 原模型](https://huggingface.co/intfloat/multilingual-e5-small)、[E5 ONNX 转换](https://huggingface.co/Xenova/multilingual-e5-small)、[Transformers.js](https://huggingface.co/docs/transformers.js/en/index)、[ml-hclust](https://github.com/mljs/hclust)、[Ollama embed API](https://docs.ollama.com/api/embed)。
