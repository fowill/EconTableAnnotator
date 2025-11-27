# 预标注工具（pre_annotator）

CLI 用 LLM 将回归表图片转成 CSV + skeleton，并尝试自动填充 `data_var_name`（结合 pdf 文本、数据列名、代码变量名做匹配）。

## 准备
- 依赖：`pip install -r requirements.txt`
- 配置密钥：复制 `pre_annotator/config.example.json` 为 `pre_annotator/config.local.json`，填入 `api_key` / `base_url`（或用环境变量 `OPENAI_API_KEY` / `OPENAI_BASE_URL`）。
- 输入：论文根目录（含 `nomask_*.pdf`、数据、代码），表格图片目录（png/jpg），输出目录。

## 运行示例
```bash
python -m pre_annotator.pipeline ^
  --paper-dir "D:\Data\15.Data_Econ2Code\Dataset_raw\mnsc_2023_03369" ^
  --images-dir "sample_data" ^
  --output-dir "pre_annotator/output_temp" ^
  --paper-id mnsc_2023_03369
```
默认模型 gpt-4o，可用 `--model` 覆盖。若同名 csv+skeleton 已存在会跳过。输出命名：`{paper_id}_{table_id}.csv` / `.skeleton.json`。

### 提示内容给 LLM 的组成
- PDF：读取 `nomask_*.pdf`（或首个 pdf）文本前若干字符。
- 数据：扫描常见数据格式的列名列表（截断至上限）。
- 代码：扫描常见脚本文件中的标识符变量名（去掉日志文件）。
- 参考示例：从 `--examples-dir`（默认 `sample_data`）抽取若干现有 csv+skeleton 片段，拼成示例提示给 LLM。
- 面板支持：若图片包含 Panel A/B/C 等，LLM 会返回 panels 列表，输出分别写入 `{table_id}_{panel}` 的 csv/skeleton。
- data_var_name：LLM 会根据列名/代码变量名（及部分正文）为 y_columns 和 x_rows 填写 data_var_name（无法判断时再留空）。
