# Econ Table Annotator (Local)

本项目提供一个本地运行的“回归表格标注站”，包含：

- **后端**：FastAPI，负责扫描 CSV/图片/Skeleton，读写文件并提供 JSON API。
- **前端**：Vite + React + TypeScript，提供列表页与基础预览（后续可扩展为完整标注 UI）。

## 快速开始

### 1) 后端

```bash
python -m venv .venv
.venv\Scripts\activate  # Windows
pip install -r requirements.txt
uvicorn backend.main:app --reload --port 8000
```

- 环境变量 `APP_ROOT_DIR` 可设置默认扫描目录，默认使用当前工作目录。
- API 文档：`http://localhost:8000/docs`

### 2) 前端

```bash
cd frontend
npm install
npm run dev
# 浏览器打开 http://localhost:5173
```

Vite dev server 已在 `vite.config.ts` 中将 `/api` 代理到 `http://localhost:8000`。

### 3) 立即可用的样例数据

- 已在 `sample_data/` 下放置 CSV 与配套图片（从 `./img` 拷贝而来）：
  - `mnsc_2023_03369_table1.csv` / `.png`（含示例 skeleton：`mnsc_2023_03369_table1.skeleton.json`）
  - `mnsc_2023_03369_table2.csv` / `.png`
  - `mnsc_2023_03369_table3.csv` / `.png`
- 前端页面填写 `root_dir` 为项目内的 `sample_data` 绝对路径即可加载示例。

## 目录结构

- `backend/`
  - `main.py`：FastAPI 应用与路由 (`/api/projects`, `/api/table/...`, 保存 CSV/Skeleton)。
  - `file_utils.py`：扫描目录、解析文件命名、读写 CSV/JSON。
  - `models.py`：Skeleton、表格元数据、Grid 数据模型。
- `frontend/`
  - `src/App.tsx`：列表页与表格预览的最小 UI。
  - `src/api.ts`：前后端 API 类型与调用封装。
  - 其余为 Vite/TS 配置。

## 已实现的后端能力

- `GET /api/projects?root_dir=...`：扫描目录下所有符合 `paper_id_tableX.csv` 的表格，返回 CSV/图片/Skeleton 路径与状态。
- `GET /api/table/{paper_id}/{table_id}`：返回 Grid 数据、Skeleton（若无则返回默认模板），以及元信息。
- `POST /api/table/{paper_id}/{table_id}/save_csv`：写回 CSV。
- `POST /api/table/{paper_id}/{table_id}/save_skeleton`：写入 `*.skeleton.json`（自动更新时间戳）。
- `GET /api/table/{paper_id}/{table_id}/image`：返回匹配的图片文件。
- `GET/POST /api/config`：读取/更新 `root_dir`（动态生效于 API 查找；如更换目录，推荐重启后端）。

命名约定：
- 文件命名解析基于：`{paper_id}_{table_id}.csv`，其中 `table_id` 形如 `table1` / `figure1`。
- Skeleton 优先写入 `{paper_id}_{table_id}.skeleton.json`，其次读取同名 `.json` 作为兼容。
- 图片自动匹配 `{paper_id}_{table_id}.png|jpg|jpeg`。

## 已实现的前端能力

- 在顶栏填写 `root_dir`，点击“加载项目”列出扫描结果。
- 点击任意表行可查看：
  - 图片预览（通过后端 `/image` 接口）。
  - CSV 网格的前几行预览。
  - Skeleton 基础信息（状态、括号默认值）。
- UI 采用深色、简洁布局，便于后续扩展标注交互。

## 下一步迭代建议

1. 标注模式页：可编辑 Grid，保存 CSV；列/行标注 UI，写入 Skeleton。
2. Skeleton 状态切换（完成/未完成）并同步列表。
3. 前端内置撤销/重做、未保存提示；Skeleton/CSV 保存前的本地 diff。
4. 后端增加简单备份（保存前写入 `.bak`）。
5. 支持可配置的命名模式与子目录过滤。
