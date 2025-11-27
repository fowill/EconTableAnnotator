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
