# 《末法仙途》项目约定

2D 单机网页游戏 · 自由移动探索 + 回合制战斗 + 角色模拟养成 · 末法时代修仙（封神 + 西游 + 聊斋 + 僵尸）
技术栈与版本要求的唯一定义处：[doc/13-技术架构与工程约定.md](doc/13-技术架构与工程约定.md) §1。

> **全部设计文档在 [`doc/`](doc/00-文档索引.md)。本文件只保留约定入口，不重复设计正文。**
> 需要改设计时，改 `doc/` 下的对应文档，不要改本文件（除约定本身）。

---

## 一、文档地图

| 要做什么 | 读哪份 |
|---|---|
| 了解游戏与世界观 | [doc/01-世界观与设定.md](doc/01-世界观与设定.md) |
| 查系统规则 | [doc/02-核心玩法系统.md](doc/02-核心玩法系统.md) |
| 主线任务（90 条） | [doc/03-主线任务.md](doc/03-主线任务.md) |
| 支线任务（104 条） | [doc/04-支线任务.md](doc/04-支线任务.md) |
| 每日/季节/随机/宗门周期事件 | [doc/05-日常与随机事件.md](doc/05-日常与随机事件.md) |
| NPC、好感度、同伴、道侣 | [doc/06-NPC与关系系统.md](doc/06-NPC与关系系统.md) |
| 敌人、词缀、Boss、心魔、天劫 | [doc/07-敌人与战斗设计.md](doc/07-敌人与战斗设计.md) |
| 物品、丹药、法宝、配方 | [doc/08-物品丹药与法宝.md](doc/08-物品丹药与法宝.md) |
| 功法、技能、神通 | [doc/09-功法与技能体系.md](doc/09-功法与技能体系.md) |
| 地图与区域规划 | [doc/10-地图与区域规划.md](doc/10-地图与区域规划.md) |
| **写配置表前必读**（ID/字段真源） | [doc/11-数据表规范.md](doc/11-数据表规范.md) |
| 存档、时间、周目 | [doc/12-存档与时间系统.md](doc/12-存档与时间系统.md) |
| **写代码前必读**（架构/通信/runtime） | [doc/13-技术架构与工程约定.md](doc/13-技术架构与工程约定.md) |
| 美术、音频、AI 素材管线 | [doc/14-美术与音频规范.md](doc/14-美术与音频规范.md) |
| 下一步做什么、验收标准 | [doc/15-开发路线图与里程碑.md](doc/15-开发路线图与里程碑.md) |
| 数值曲线、平衡 | [doc/16-数值设计.md](doc/16-数值设计.md) |

---

## 二、硬约束（违反即为错误）

1. **数据驱动**：所有游戏内容写在 `src/data/*.json`，代码只读表。禁止在代码里硬编码物品名、敌人属性、任务文本。
2. **末法三大铁律不可被玩法绕过**（[doc/01](doc/01-世界观与设定.md) §3）：没有真正的飞升；妖修永不成仙；符箓永远不消耗灵力。
3. **Phaser 与 Vue 不互相 `import`**，一切跨层通信走 `src/core/bus.js`（事件清单见 [doc/13](doc/13-技术架构与工程约定.md) §3）。
4. **`runtime/` 只放临时产物**：临时文件、校验脚本、模拟脚本、报告全部写 `runtime/`，**永不提交**（见 §四）。
5. **唯一定义处**：存档结构以 [doc/12](doc/12-存档与时间系统.md) 为准；ID 与字段以 [doc/11](doc/11-数据表规范.md) 为准；结局以 [doc/03](doc/03-主线任务.md) §10 为准；世界标记登记在 [doc/03](doc/03-主线任务.md) / [doc/04](doc/04-支线任务.md) 附录 A。
6. **ID 一经发布不改名**：只能弃用并新建。ID 一律 ASCII 小写 kebab-case，禁止中文 ID。
7. **先改 `doc/`，再改代码**：设计变更先落到文档，PR 描述引用对应章节。
8. **`effects` / `conditions` 白名单**：未在 [doc/11](doc/11-数据表规范.md) §3.2/§3.3 登记的 `type` 一律视为配置错误，不得临时发明。

---

## 三、编码约定

- **JavaScript（ES2022）+ JSDoc**，不引入 TypeScript（决策见 [doc/13](doc/13-技术架构与工程约定.md) §9 ADR-001）。
- 文件：类 `PascalCase.js`，模块 `camelCase.js`；变量/函数 `camelCase`；常量 `SCREAMING_SNAKE`。
- 2 空格缩进、单引号、无分号（除非必要）；异步统一 `async/await`。
- 代码与注释用英文；**面向玩家的文案一律来自 JSON 表**，不硬编码中文到代码。
- 注释解释"为什么"，引用规范时写 `// 见 doc/11 §3.2`。
- 目录与分层依赖见 [doc/13](doc/13-技术架构与工程约定.md) §2：`vue/` 与 `phaser/` 均只依赖 `core/`。
- **禁止**：在 store 中保存 Phaser 对象（Sprite/Tween/物理体）；绕过 `saveManager` 直接操作 IndexedDB；把临时文件写到 `runtime/` 之外。

---

## 四、`runtime/` 目录约定 ❗

**`runtime/` 是所有临时文件、测试工具、脚本产物的存放目录，整体被 `.gitignore` 忽略，不提交 git。**

| 子目录 | 用途 |
|---|---|
| `runtime/tmp/` | 一次性草稿、导出中间件、抓取结果（随时可删） |
| `runtime/tools/` | 尚未稳定的本地脚本；配置表校验器的本地入口 `validate.js`（规则在 `src/core/validate.js`，不入库） |
| `runtime/reports/` | 脚本输出（校验报告、成长曲线、平衡数据） |
| `runtime/fixtures/` | 测试用存档样本、配置表快照 |

规则：`runtime/` 可以 `import` `src/`，`src/` **绝不能** `import` `runtime/`；`runtime/` 下的文件不得被 `src/` 或 `public/` 引用。详见 [doc/13](doc/13-技术架构与工程约定.md) §7。

---

## 五、常用命令（工程初始化后生效）

```bash
pnpm install       # 安装依赖
pnpm dev           # 开发服务器
pnpm build         # 生产构建
pnpm preview       # 预览构建产物
pnpm validate      # 校验配置表（规则在 src/core/validate.js，本地入口 runtime/tools/validate.js，见 doc/11 §7）
pnpm assets        # 重建素材并校验（scripts/build-assets.mjs，见 doc/14 §4）
pnpm assets:check  # 只校验素材、不重新生成（CI 用）
```

> 工程已在 M0 初始化（Vite 5 + Vue 3 + Phaser 3.80，见 doc/15 §2.1），上述 pnpm 命令均可直接使用。
> 素材生产线本身零第三方依赖，也可不经 pnpm 直接运行：
> `node scripts/build-assets.mjs`（重建 + 校验）、`node scripts/build-assets.mjs --check`（只校验）、
> `node scripts/inspect-png.mjs <文件> --crop x,y,w,h`（打印 ASCII 预览与接缝指标）。
> 见 [doc/15](doc/15-开发路线图与里程碑.md)。

---

## 六、开发顺序

先跑通**最小可玩循环**，再加内容：

```
移动 → 遇敌 → 战斗 → 获得修为 → 存档
```

- **存档先做**：M1 就落地基础 IndexedDB 三槽位存档，避免后期重构。
- 上述循环跑通前，不要开始做主线内容。
- 阶段划分、验收标准与降级方案见 [doc/15](doc/15-开发路线图与里程碑.md)。

---

## 七、术语与文案

术语表（含定义与反例）的唯一定义处是 [doc/01](doc/01-世界观与设定.md) §9。**一切面向玩家的文案必须使用该表的用词**，禁止自造同义词（如"经验值""金币""蓝""理智"）。

---

## 八、协作约定

| 项 | 约定 |
|---|---|
| 分支 | `main` 稳定可玩；`feat/*`、`fix/*`、`docs/*`、`content/*` |
| 提交信息 | `<type>(<scope>): <subject>`，type ∈ `feat`/`fix`/`docs`/`content`/`refactor`/`chore`/`balance` |
| 一次提交 | 只做一件事；文档改动与代码改动尽量分开 |
| 禁止提交 | `runtime/`、`node_modules/`、`dist/`、`.env*`、大于 5MB 的原始素材 |
| 许可证 | MIT，见 [LICENSE](LICENSE) |

**文档集入口**：[doc/00-文档索引.md](doc/00-文档索引.md)
