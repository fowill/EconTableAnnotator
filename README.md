# Econ Table Annotator（本地标注站）

左看回归表图片，右改 CSV / Skeleton，专为经济/金融论文表格人工标注设计。后端 FastAPI，前端 React + Vite + TypeScript，本地运行，无账号/鉴权。

## 快速开始

### 1) 后端
```bash
python -m venv .venv
.venv\Scripts\activate  # Windows
pip install -r requirements.txt
uvicorn backend.main:app --reload --port 8000
```
- 可通过环境变量 `APP_ROOT_DIR` 设定默认扫描目录。
- API 文档：`http://localhost:8000/docs`

### 2) 前端
```bash
cd frontend
npm install
npm run dev  # 访问 http://localhost:5173
```
Vite 已在 `vite.config.ts` 里把 `/api` 代理到 `http://localhost:8000`。

### 3) 样例数据
- `sample_data/` 下已放入 CSV / PNG / Skeleton 示例（已加入 .gitignore）。
- 进入页面后在输入框填入 `sample_data` 的绝对路径即可加载示例。

## 目录结构
- `backend/`
  - `main.py` 路由与静态文件，`/api/projects`、`/api/table/...`、保存 CSV/Skeleton。
  - `models.py` Skeleton / Grid 的 Pydantic 定义。
  - `file_utils.py` 扫描目录、读写 CSV/JSON。
- `frontend/`
  - `src/App.tsx` 入口，使用拆分组件（ProjectList、StatusRail、ImagePanel、EditTable）。
  - `src/components/` 组件。
  - `src/api.ts` 前端 API 封装。
  - `src/hooks/useDragScroll.ts` 表格拖拽滚动。
  - `src/styles.css` 基础样式。

## 主要功能
- 扫描 `root_dir` 下的 CSV，匹配同名图片与 skeleton，列表展示状态（未开始/进行中/完成）。
- 标注模式：
  - 图片预览、可编辑 CSV，支持行/列增删、X/核心X/FE/N 标记，Y 列标注（depvar/data var）。
  - 括号含义选择、LLM 自动补全草稿（可接受/拒绝）。
  - 一键保存全部或保存并跳转下一条，状态独立标记完成/未完成。
- 预览模式：仅查看 CSV，按标注高亮 X/FE/N。

## 命名约定
- 文件名：`{paper_id}_{table_id}.csv / .png / .skeleton.json`，如 `mnsc_2023_03369_table1.csv`。
- Skeleton 保存为同名 `.skeleton.json`。

## 后续可做
- 将更多逻辑拆分为自定义 hook，增加快捷键、撤销/重做。
- 增强 LLM 调用配置（模型名、超时时间）。
