# 06 · NPC与关系系统

> 本文档展开 [01-世界观与设定](01-世界观与设定.md) §7 的 **28 名主要 NPC 正典名录**，定义好感度、势力声望、同伴、道侣、对话树与日程系统。
> **NPC 的 ID、姓名、身份、初始好感以 [01-世界观与设定](01-世界观与设定.md) §7 为唯一真源，本文档不得增删、改名、改 ID。** 所有 `role` 取值来自 [11-数据表规范](11-数据表规范.md) §5.5，所有对话节点 ID 遵守 `dlg-{拼音}-root` 约定。
> 术语统一用 [01-世界观与设定](01-世界观与设定.md) §9 术语表（修为 / 灵石 / 心境 / 灵力 / 神识 / 悟性 / 根骨 / 洞府 / 机缘 / 世界标记）。
>
> 相关文档：[00-文档索引](00-文档索引.md) · [01-世界观与设定](01-世界观与设定.md) · [02-核心玩法系统](02-核心玩法系统.md) · [04-支线任务](04-支线任务.md) · [05-日常与随机事件](05-日常与随机事件.md) · [10-地图与区域规划](10-地图与区域规划.md) · [11-数据表规范](11-数据表规范.md) · [12-存档与时间系统](12-存档与时间系统.md)

---

## 一、NPC 全集（28 名）

### 1.1 字段说明

每条 NPC 条目对应 `npcs.json` 中的一条记录（结构见 [11-数据表规范](11-数据表规范.md) §5.5）：

| 字段 | 含义 |
|---|---|
| **ID** | `npc-{拼音}`，正典，不可变更 |
| **姓名** | 面向玩家的显示名 |
| **势力** | `fac-*`，决定声望联动与互斥 |
| **常驻地图** | `home`，日程表中的基准位置 |
| **职能标签** | `role` 数组，取值仅限 `guide` / `shop` / `quest` / `trainer` / `inn` / `save` / `healer` / `info` / `companion` / `lover` / `story` |
| **初始好感** | `favorInit`，`-100 ~ +100` |
| **25 / 50 / 75 / 100** | 四档好感解锁内容，对应 `favorTiers` 中的事件 ID |
| **对话根节点** | `dialogRoot`，格式 `dlg-{拼音}-root` |
| **同伴 / 道侣** | 是否可作为同伴（`companion`）、是否可作为道侣（`lover`） |

### 1.2 青云镇（`map-qingyun`，7 名）

#### `npc-xuan-yang` · 玄阳子

| 项 | 内容 |
|---|---|
| 势力 | `fac-maoshan` |
| 常驻地图 | `map-qingyun`（白天：镇口石碑旁；夜：悦来客栈） |
| 职能标签 | `guide` `shop` `quest` `trainer` |
| 初始好感 | `+10` |
| 好感 25 | 开放符箓绘制教学，赠 `tal-qixie`×3；解锁 `evt-xy-25`「一张画了三十年的符」 |
| 好感 50 | 开放`shop-qingyun-xuanyang` 驱邪符专卖，售价 -10%；解锁 `evt-xy-50`「他为什么留在末法时代」 |
| 好感 75 | 传授 `skill-fu-zhenhun`；解锁 `evt-xy-75`「茅山旧事」并透露镇口残碑的第二句读法 |
| 好感 100 | 赠 `item-fabao-xuanyang-fubi`（符笔）；解锁 `evt-xy-100`「游方人的最后一站」，可在终章请其助战一次 |
| 对话根节点 | `dlg-xuanyang-root` |
| 同伴 / 道侣 | 否 / 否（剧情导师位，不入队） |

#### `npc-liu-shen` · 柳三婶

| 项 | 内容 |
|---|---|
| 势力 | `fac-court` |
| 常驻地图 | `map-qingyun`（悦来客栈，全天） |
| 职能标签 | `inn` `save` `info` `quest` |
| 初始好感 | `+5` |
| 好感 25 | 住宿费 -20%；每次住宿额外恢复心境 +3；解锁 `evt-liushen-25`「二十年前那场雪」 |
| 好感 50 | 解锁客栈二楼雅间（存档点，附带 1 格储物）；免费获得一次"等天气"重掷 |
| 好感 75 | 解锁 `evt-liushen-75`「她记得每个住过店的人」；每章节首次住宿免费 |
| 好感 100 | 赠 `item-dan-huiqi-shang`×5；解锁 `evt-liushen-100`「留一盏灯」，终章回镇时心境 +20 |
| 对话根节点 | `dlg-liushen-root` |
| 同伴 / 道侣 | 否 / 否 |

#### `npc-zhang-tie` · 张铁牛

| 项 | 内容 |
|---|---|
| 势力 | `fac-court` |
| 常驻地图 | `map-qingyun`（铁匠铺，昼；夜归家） |
| 职能标签 | `shop` `quest` `trainer` |
| 初始好感 | `0` |
| 好感 25 | 法宝修理费 -25%；解锁 `craft-qingfeng-jian` 图纸出售 |
| 好感 50 | 开放炼器委托（可定制武器前缀）；`shop-qingyun-tie` 全部商品 -10% |
| 好感 75 | 解锁 `craft-yintie-jia` 图纸；可代为熔炼重复法宝返还 50% 材料 |
| 好感 100 | 免费打造一件 `rare` 品质武器；解锁 `evt-zhangtie-100`「一把没送出去的刀」 |
| 对话根节点 | `dlg-zhangtie-root` |
| 同伴 / 道侣 | 否 / 否 |

#### `npc-wang-yao` · 王药师

| 项 | 内容 |
|---|---|
| 势力 | `fac-court` |
| 常驻地图 | `map-qingyun`（药铺，昼；夜在后院晾药） |
| 职能标签 | `shop` `healer` `quest` `trainer` |
| 初始好感 | `0` |
| 好感 25 | 丹药售价 -10%；开放 `alch-huiqi-dan` 配方教学 |
| 好感 50 | 开放 `alch-jiedu-dan` 与 `alch-ningqi-dan` 配方；炼丹失败可半价重来一次 |
| 好感 75 | 代售稀有药材；解锁 `evt-wangyao-75`「药铺账本上少了一味药」 |
| 好感 100 | 赠 `item-fabao-yaolu`（药炉，炼丹成功率 +5%）；解锁 `evt-wangyao-100`「医者不自医」 |
| 对话根节点 | `dlg-wangyao-root` |
| 同伴 / 道侣 | 否 / 否 |

#### `npc-chen-xia` · 陈瞎子

| 项 | 内容 |
|---|---|
| 势力 | `fac-sanxiu`（身份隐藏，名义无势力） |
| 常驻地图 | `map-qingyun`（镇东桥头，昼；夜收摊） |
| 职能标签 | `info` `quest` `story` |
| 初始好感 | `-10` |
| 好感 25 | 开始正经给机缘线索（每次 1 条，灵石 50）；解锁 `evt-chenxia-25`「他其实看得见」 |
| 好感 50 | 可花费灵石推算"今日宜往何方"（指引当日高收益区域）；解锁 `evt-chenxia-50`「退隐之前」 |
| 好感 75 | 开放占卜：揭示当前周目已错过的 1 条支线；解锁 `evt-chenxia-75`「他数过多少次劫」 |
| 好感 100 | 赠 `item-misc-tianjipan`（天机盘，随机事件稀有度 +1 档概率 10%）；解锁 `evt-chenxia-100`「瞎子的最后一眼」 |
| 对话根节点 | `dlg-chenxia-root` |
| 同伴 / 道侣 | 否 / 否 |

#### `npc-zhao-bu` · 赵捕头

| 项 | 内容 |
|---|---|
| 势力 | `fac-court` |
| 常驻地图 | `map-qingyun`（衙门，昼；夜巡街） |
| 职能标签 | `quest` `info` |
| 初始好感 | `0` |
| 好感 25 | 每日委托上板数由 3 增至 4；解锁 `evt-zhaobu-25`「衙门里的旧卷宗」 |
| 好感 50 | 通缉等级可花钱洗白一次；解锁 `sq-bw-01`「乱葬岗悬赏」 |
| 好感 75 | 开放官府资源：可调用 2 名捕快协战一次/章；解锁 `evt-zhaobu-75`「他也想修仙」 |
| 好感 100 | 赠 `item-fabao-bukuai`（捕快腰牌，`fac-court` 声望 +5/章）；解锁 `evt-zhaobu-100`「守夜人的交班」 |
| 对话根节点 | `dlg-zhaobu-root` |
| 同伴 / 道侣 | 否 / 否 |

#### `npc-xiao-man` · 小蛮 ★道侣候选 A

| 项 | 内容 |
|---|---|
| 势力 | `fac-court` |
| 常驻地图 | `map-qingyun`（药铺，昼；夜在河边） |
| 职能标签 | `shop` `healer` `quest` `lover` `story` |
| 初始好感 | `+15` |
| 好感 25 | 协助炼丹（同场炼丹成功率 +5%）；解锁 `evt-xiaoman-25`「她认得出每味药」 |
| 好感 50 | 解锁道侣支线 `sq-lv-01`「凡人与修士之别」；赠 `item-dan-huiqi`×5 |
| 好感 75 | 解锁 `sq-lv-02`「她要不要走上修行路」；开放灵根检测，可选择为其引气入体 |
| 好感 100 | 可结为道侣（需完成 `sq-lv-01` 与 `sq-lv-02`）；炼丹成功率 +10%、心境恢复 +20%（共修加成） |
| 对话根节点 | `dlg-xiaoman-root` |
| 同伴 / 道侣 | 否（作道侣后可在洞府协助炼丹，不入战斗队） / **是** |

### 1.3 茅山（`map-maoshan`，5 名）

#### `npc-zhang-shouyi` · 张守一

| 项 | 内容 |
|---|---|
| 势力 | `fac-maoshan` |
| 常驻地图 | `map-maoshan`（天师殿，昼；夜在静室） |
| 职能标签 | `guide` `quest` `trainer` `story` |
| 初始好感 | `+5` |
| 好感 25 | 开放 `gongfa-maoshan-fulu`（茅山符箓真诀，见 [09-功法与技能体系](09-功法与技能体系.md) §2.8）传授；`fac-maoshan` 声望获取 +10% |
| 好感 50 | 授 `skill-fu-jinguang`；开放茅山专属商店 `shop-maoshan-zhang` |
| 好感 75 | 授 `skill-zhenshi-ding`（镇尸定身）；解锁 `evt-zhangshouyi-75`「天师印缺了一角」 |
| 好感 100 | 赐 `item-fabao-tianshiyin`（天师印）；终章可请茅山全派出战一次；解锁 `evt-zhangshouyi-100`「掌教的最后一课」 |
| 对话根节点 | `dlg-zhangshouyi-root` |
| 同伴 / 道侣 | 否 / 否 |

#### `npc-qing-xiao` · 青霄道人

| 项 | 内容 |
|---|---|
| 势力 | `fac-maoshan` |
| 常驻地图 | `map-maoshan`（演武场，昼；夜在后山巡行） |
| 职能标签 | `trainer` `quest` |
| 初始好感 | `0` |
| 好感 25 | 开放技能教学（`skill-fu-jingxin`、`skill-zhenfa-yin`）；每周可陪练一次（修为 +150） |
| 好感 50 | 开放阵法系统教学；赠 `item-mat-zhenpan`×2 |
| 好感 75 | 授 `skill-wuxing-zhen`；解锁 `evt-qingxiao-75`「他画的阵从不出错」 |
| 好感 100 | 赠 `item-fabao-zhenqi`（阵旗）；每周陪练产出翻倍；解锁 `evt-qingxiao-100`「师兄」 |
| 对话根节点 | `dlg-qingxiao-root` |
| 同伴 / 道侣 | 否 / 否 |

#### `npc-su-xin` · 素心师太

| 项 | 内容 |
|---|---|
| 势力 | `fac-maoshan` |
| 常驻地图 | `map-maoshan`（炼器堂，昼；夜在符房） |
| 职能标签 | `shop` `trainer` `quest` |
| 初始好感 | `0` |
| 好感 25 | 开放炼器堂使用（收使用费）；符笔制作教学 |
| 好感 50 | 开放法宝鉴定（免费 1 次/章）；`shop-maoshan-su` 炼器材料 -15% |
| 好感 75 | 授 `craft-fu-bi`（符笔图纸）；炼器品质浮动下限 +1 |
| 好感 100 | 赠 `item-fabao-suxin-chui`（素心锤，炼器品质 +1 档概率 15%）；解锁 `evt-suxin-100`「她造了一辈子别人的兵器」 |
| 对话根节点 | `dlg-suxin-root` |
| 同伴 / 道侣 | 否 / 否 |

#### `npc-lin-xiaoqi` · 林小七 ★同伴 ①

| 项 | 内容 |
|---|---|
| 势力 | `fac-maoshan` |
| 常驻地图 | `map-maoshan`（外门厢房，昼；夜在灶房偷吃） |
| 职能标签 | `companion` `quest` `story` |
| 初始好感 | `+20` |
| 好感 25 | 开放招募线 `sq-cp-01`；日常闲聊可获随机小礼（材料 ×1） |
| 好感 50 | 完成 `sq-cp-02` 后可入队；解锁 `evt-xiaoqi-50`「他为什么总在笑」 |
| 好感 75 | 队伍中时全体符箓效果 +10%；解锁 `evt-xiaoqi-75`「他怕的东西」 |
| 好感 100 | 解锁 `skill-fu-wanxiang`（符阵·万象）；离队条件失效（永久入队）；解锁 `evt-xiaoqi-100`「小七的道」 |
| 对话根节点 | `dlg-xiaoqi-root` |
| 同伴 / 道侣 | **是** / 否 |

#### `npc-hua-popo` · 花婆婆

| 项 | 内容 |
|---|---|
| 势力 | `fac-maoshan` |
| 常驻地图 | `map-maoshan`（镇尸塔，全天；月圆夜登塔顶） |
| 职能标签 | `info` `quest` `story` `shop` |
| 初始好感 | `-5` |
| 好感 25 | 开放尸傀材料交易；解锁 `evt-huapopo-25`「塔里数得清的有多少」 |
| 好感 50 | 开放僵尸线隐藏支线 `sq-ms-07`「塔底的第七层」 |
| 好感 75 | 授 `skill-zhenshi-zhou`（镇尸咒，对僵尸 +30% 伤害） |
| 好感 100 | 赠 `item-mat-shixiong-jing`（尸王精核，炼器极品材料）；解锁 `evt-huapopo-100`「她守的不是塔」 |
| 对话根节点 | `dlg-huapopo-root` |
| 同伴 / 道侣 | 否 / 否 |

### 1.4 昆仑残脉（`map-kunlun`，4 名）

#### `npc-yu-xuzi` · 玉虚子

| 项 | 内容 |
|---|---|
| 势力 | `fac-kunlun` |
| 常驻地图 | `map-kunlun`（讲经堂，昼；夜在断壁观星） |
| 职能标签 | `guide` `quest` `trainer` `story` |
| 初始好感 | `0` |
| 好感 25 | 开放 `gongfa-kunlun-zhengfa`；讲道每日 1 次（修为 = 打坐 ×1.5） |
| 好感 50 | 授 `skill-jianguang`；开放藏经阁权限（真相线索 +1 处） |
| 好感 75 | 授 `skill-yuxu-jianjue`；解锁 `evt-yuxuzi-75`「掌教不说的事」 |
| 好感 100 | 赐 `item-fabao-yuxu-jian`（玉虚剑）；终章讲道可抵一次心魔侵扰；解锁 `evt-yuxuzi-100`「他也曾信过飞升」 |
| 对话根节点 | `dlg-yuxuzi-root` |
| 同伴 / 道侣 | 否 / 否 |

#### `npc-leng-yue` · 冷月仙子 ★同伴 ② / 道侣候选 C

| 项 | 内容 |
|---|---|
| 势力 | `fac-kunlun` |
| 常驻地图 | `map-kunlun`（剑冢外围，晨；夜在雪线练剑） |
| 职能标签 | `companion` `trainer` `lover` `quest` `story` |
| 初始好感 | `-10` |
| 好感 25 | 开放剑修技能教学（`skill-jianqi-zhan`）；解锁 `evt-lengyue-25`「她的剑从不留活口」 |
| 好感 50 | 开放招募线 `sq-cp-03`；赠 `item-mat-yuntie`×3 |
| 好感 75 | 完成 `sq-cp-04` 后可入队；解锁道侣支线 `sq-lv-03`「剑心与情心不可两全」 |
| 好感 100 | 解锁 `sq-lv-04`；可结为道侣（暴击率 +8%、突破成功率 +5%）；解锁 `evt-lengyue-100`「她收了剑」 |
| 对话根节点 | `dlg-lengyue-root` |
| 同伴 / 道侣 | **是** / **是** |

#### `npc-mo-qi` · 墨麒

| 项 | 内容 |
|---|---|
| 势力 | `fac-kunlun` |
| 常驻地图 | `map-kunlun`（藏经阁，全天，极少外出） |
| 职能标签 | `info` `shop` `quest` |
| 初始好感 | `+5` |
| 好感 25 | 开放残卷拼合（3 张残页可合成 1 部残篇）；解锁 `evt-moqi-25`「阁里的书他全读过」 |
| 好感 50 | 开放考据问答（答对得修为 + 图鉴完成度）；`shop-kunlun-moqi` 残页出售 |
| 好感 75 | 分享「周天星斗大阵，以三千灵脉为薪」的出处（真相线索 +2） |
| 好感 100 | 赠 `item-book-residual-set`（残篇合集，直接凑齐 4 张）；解锁 `evt-moqi-100`「守书人的名字」 |
| 对话根节点 | `dlg-moqi-root` |
| 同伴 / 道侣 | 否 / 否 |

#### `npc-jiang-li` · 姜离

| 项 | 内容 |
|---|---|
| 势力 | `fac-kunlun` |
| 常驻地图 | `map-kunlun`（执法堂，昼；夜巡山） |
| 职能标签 | `quest` `story` |
| 初始好感 | `-20` |
| 好感 25 | 态度从敌视转为公事公办；解锁宗门周常 `sq-kl-04` |
| 好感 50 | 解锁 `evt-jiangli-50`「他罚的每个人他都记得」；可借用执法堂器械（装备租用） |
| 好感 75 | 转化为盟友，可在昆仑内部为你作保（1 次免罚）；解锁 `evt-jiangli-75`「他也想违一次戒」 |
| 好感 100 | 赠 `item-fabao-zhifa-suo`（执法锁）；终章可选择说服其倒戈；解锁 `evt-jiangli-100`「他放下了戒尺」 |
| 对话根节点 | `dlg-jiangli-root` |
| 同伴 / 道侣 | 否 / 否 |

### 1.5 散修与秘境（`fac-sanxiu`，4 名）

#### `npc-luo-sandao` · 洛三刀

| 项 | 内容 |
|---|---|
| 势力 | `fac-sanxiu` |
| 常驻地图 | `map-qingqiu`（鬼市，夜；白日在金陵城后巷） |
| 职能标签 | `shop` `quest` `info` |
| 初始好感 | `-5` |
| 好感 25 | 开放黑市（违禁品：禁术残页、赝品法宝、通缉洗白）；解锁鬼市月开 `evt-fullmoon-ghostmarket` |
| 好感 50 | 销赃价 +20%；可托其代售（离线自动售出） |
| 好感 75 | 开放"洗白"第二次；解锁 `evt-luosandao-75`「他背上的三刀」 |
| 好感 100 | 赠 `item-fabao-guimingdeng`（鬼明灯，鬼市全商品 -20%）；解锁 `evt-luosandao-100`「三刀之后他不再动刀」 |
| 对话根节点 | `dlg-luosandao-root` |
| 同伴 / 道侣 | 否 / 否 |

#### `npc-yun-ji` · 云姬 ★同伴 ③ / 道侣候选 B

| 项 | 内容 |
|---|---|
| 势力 | `fac-sanxiu` |
| 常驻地图 | `map-jinling`（茶楼二楼，昼；夜不定，随情报网移动） |
| 职能标签 | `info` `quest` `companion` `lover` `story` |
| 初始好感 | `0` |
| 好感 25 | 开放情报购买（区域敌情、宝箱位置、NPC 行踪）；解锁 `evt-yunji-25`「她的消息从不免费」 |
| 好感 50 | 开放招募线 `sq-cp-05`；情报价格 -30% |
| 好感 75 | 完成 `sq-cp-05` 后可入队；解锁道侣支线 `sq-lv-05`「情报贩子的秘密」 |
| 好感 100 | 解锁 `sq-lv-06`；可结为道侣（灵石收入 +15%，随机事件稀有度提升）；解锁 `evt-yunji-100`「她第一次说了真话」 |
| 对话根节点 | `dlg-yunji-root` |
| 同伴 / 道侣 | **是** / **是** |

#### `npc-wu-ya` · 无涯子

| 项 | 内容 |
|---|---|
| 势力 | `fac-sanxiu` |
| 常驻地图 | `map-houshan`（废弃山神庙，昼；月圆夜在乱葬岗） |
| 职能标签 | `quest` `info` `trainer` `story` |
| 初始好感 | `-15` |
| 好感 25 | 开始给神通残页线索（每次随机 1 张，可能为假）；解锁 `evt-wuya-25`「他念的经是倒着的」 |
| 好感 50 | 开放 `sq-mf-01` 与 `sq-mf-05`；残页真假鉴定（花费灵石） |
| 好感 75 | 授 `skill-wuya-zhang`（神通：无涯一掌）；解锁 `evt-wuya-75`「他到底疯没疯」 |
| 好感 100 | 赠 `item-book-shentong-set`（神通残页合集 3 张）；解锁 `evt-wuya-100`「最后一个问题」 |
| 对话根节点 | `dlg-wuya-root` |
| 同伴 / 道侣 | 否（剧情明确拒绝入队） / 否 |

#### `npc-jian-zhong` · 剑冢残魂 ★同伴 ④

| 项 | 内容 |
|---|---|
| 势力 | `fac-sanxiu`（依附 `fac-kunlun` 之地，立场独立） |
| 常驻地图 | `map-mf-jianzhong`（剑冢中央，全天；满月时浮于空中） |
| 职能标签 | `companion` `guide` `quest` `story` |
| 初始好感 | `+5` |
| 好感 25 | 开放剑冢秘境引导（地图内不再迷路）；解锁 `evt-jianzhong-25`「三千把剑，他还记得名字」 |
| 好感 50 | 开放招募线 `sq-cp-06`；可借其一缕剑意（单次战斗攻击 +10%） |
| 好感 75 | 完成 `sq-cp-06` 后可入队；解锁 `evt-jianzhong-75`「他为什么还在这里」 |
| 好感 100 | 解锁 `skill-jian-lingmie`（灵体：无视防御一击）；入队后每场战斗可复活一次；解锁 `evt-jianzhong-100`「剑归冢，人不归」 |
| 对话根节点 | `dlg-jianzhong-root` |
| 同伴 / 道侣 | **是** / 否 |

### 1.6 妖鬼势力（`fac-yao`，3 名）

#### `npc-xiao-wei` · 小唯 ★同伴 ⑤

| 项 | 内容 |
|---|---|
| 势力 | `fac-yao` |
| 常驻地图 | `map-qingqiu`（豆腐摊，昼；夜在槐树下） |
| 职能标签 | `companion` `quest` `shop` `story` |
| 初始好感 | `0` |
| 好感 25 | 开放妖修功法基础（`gongfa-yao-huaxing`）；解锁聊斋单元剧 `sq-lz-03`「画皮」 |
| 好感 50 | 开放招募线 `sq-cp-07`；赠 `item-dan-huaxing`×1 |
| 好感 75 | 完成 `sq-cp-07` 后可入队；解锁 `evt-xiaowei-75`「她想做人的原因」 |
| 好感 100 | 解锁 `skill-huan-yueying`（幻术：群体混乱）；在队时全队治疗效果 +15%；解锁 `evt-xiaowei-100`「她终究成不了人，那也没关系」 |
| 对话根节点 | `dlg-xiaowei-root` |
| 同伴 / 道侣 | **是** / 否（剧情明确：铁律二不可跨越，感情线止于知己） |

#### `npc-huai-niang` · 槐娘

| 项 | 内容 |
|---|---|
| 势力 | `fac-yao` |
| 常驻地图 | `map-qingqiu`（镇口老槐树，全天不可移动） |
| 职能标签 | `quest` `shop` `info` `story` |
| 初始好感 | `+5` |
| 好感 25 | 开放灵田加速（灵田生长时辰 -10%）；季节事件 `eq-summer-01` 解锁 |
| 好感 50 | 开放季节专属种子交易（当季全品类）；灵田生长 -20% |
| 好感 75 | 授 `skill-huaiyin-bi`（槐荫庇，全队减伤）；解锁 `evt-huainiang-75`「一棵树怎么记住一千年」 |
| 好感 100 | 洞府灵田永久 +2 格；解锁 `evt-huainiang-100`「她的年轮里有个人」 |
| 对话根节点 | `dlg-huainiang-root` |
| 同伴 / 道侣 | 否（本体绑定，不可移动） / 否 |

#### `npc-bai-ze` · 白泽

| 项 | 内容 |
|---|---|
| 势力 | `fac-yao` |
| 常驻地图 | `map-yaojie`（裂隙崖壁下，全天；月圆时在青丘） |
| 职能标签 | `info` `quest` `story` `trainer` |
| 初始好感 | `0` |
| 好感 25 | 开放知识问答（答对得修为 + 图鉴完成度）；解锁 `sq-qq-04` 妖盟考题 |
| 好感 50 | 开放妖盟主线推进与 `shop-yaojie-baize`；赠 `item-book-residual-05` |
| 好感 75 | 提供真相线关键证言（「大阵当年不是为了锁灵」）；真相线索 +2 |
| 好感 100 | 授 `skill-baize-zhiyan`（知言：战前显示敌方全部属性与弱点）；解锁 `evt-baize-100`「他知道所有事，除了自己的路」 |
| 对话根节点 | `dlg-baize-root` |
| 同伴 / 道侣 | 否 / 否 |

### 1.7 大梁王朝（`fac-court`，3 名）

#### `npc-xiao-yuanlang` · 萧元朗

| 项 | 内容 |
|---|---|
| 势力 | `fac-court` |
| 常驻地图 | `map-jinling`（三皇子府，昼；夜在城楼） |
| 职能标签 | `guide` `quest` `story` |
| 初始好感 | `0` |
| 好感 25 | 开放朝堂线；`fac-court` 声望获取 +15%；解锁 `evt-xiaoyuanlang-25`「他想当的那个皇帝」 |
| 好感 50 | 开放官府资源调用；赠 `item-misc-guanping`（官凭，城门免检） |
| 好感 75 | 解锁 `evt-xiaoyuanlang-75`「他知道了钦天监的秘密」；开放王朝阵营抉择前置 |
| 好感 100 | 终章可请大梁发兵一次；解锁 `evt-xiaoyuanlang-100`「他把国运押在你身上」 |
| 对话根节点 | `dlg-xiaoyuanlang-root` |
| 同伴 / 道侣 | 否 / 否 |

#### `npc-shen-qin` · 沈钦

| 项 | 内容 |
|---|---|
| 势力 | `fac-court` |
| 常驻地图 | `map-jinling`（钦天监观星台，夜；白日闭门推演） |
| 职能标签 | `info` `quest` `story` |
| 初始好感 | `-10` |
| 好感 25 | 开放星象情报（每章 1 条真相线索）；解锁 `evt-shenqin-25`「铜盘为什么一直在转」 |
| 好感 50 | 开放大阵情报（`flag-array-shard-found` 线索链的第二环） |
| 好感 75 | 承认大阵失序反噬；解锁 `evt-shenqin-75`「他算出的那个日子」 |
| 好感 100 | 赠 `item-fabao-qintian-pan`（钦天盘，揭示下一处机缘方向）；解锁 `evt-shenqin-100`「监正的最后一次上奏」 |
| 对话根节点 | `dlg-shenqin-root` |
| 同伴 / 道侣 | 否 / 否 |

#### `npc-pei-wujiu` · 裴无咎 ★同伴 ⑥

| 项 | 内容 |
|---|---|
| 势力 | `fac-court` |
| 常驻地图 | `map-jinling`（城南军营，昼；夜巡城墙） |
| 职能标签 | `companion` `quest` `trainer` `story` |
| 初始好感 | `+10` |
| 好感 25 | 开放军阵基础教学（`skill-junzhen-gu`）；`fac-court` 声望 +2/章 |
| 好感 50 | 开放招募线 `sq-cp-08`；可调用 3 名边军协战一次 |
| 好感 75 | 完成 `sq-cp-08` 后可入队；解锁 `evt-peiwujiu-75`「一个凡人为什么敢站在这里」 |
| 好感 100 | 解锁 `skill-junzhen-po`（军阵·破，全队攻击 +15%）；在队时全队防御 +10%；解锁 `evt-peiwujiu-100`「他守的从来不是城墙」 |
| 对话根节点 | `dlg-peiwujiu-root` |
| 同伴 / 道侣 | **是** / 否 |

### 1.8 截教遗支与真相（2 名）

#### `npc-hei-lian` · 黑莲圣母

| 项 | 内容 |
|---|---|
| 势力 | `fac-jiejiao` |
| 常驻地图 | `map-mf-dingong`（地宫最深层，三章起；五章后在 `map-tiangong`） |
| 职能标签 | `story` `quest` `trainer` |
| 初始好感 | `-50` |
| 好感 25 | 停止主动追杀；解锁 `evt-heilian-25`「她为什么不杀你」 |
| 好感 50 | 有限度交易：开放禁术目录（`skill-jin-*`，使用降心境） |
| 好感 75 | 开放截教遗支支线；解密"打碎大阵"的真实代价 |
| 好感 100 | 终章可结盟（解锁结局线"以末法之身成道"的分支）；解锁 `evt-heilian-100`「她也曾经是正统」 |
| 对话根节点 | `dlg-heilian-root` |
| 同伴 / 道侣 | 否 / 否 |

#### `npc-shang-yang` · 商羊（执阵仙官）

| 项 | 内容 |
|---|---|
| 势力 | 无（归墟中人，`faction: null`；不参与声望与互斥计算） |
| 常驻地图 | `map-mf-guixu`（阵眼之上，第五章首次出现） |
| 职能标签 | `story` `guide` |
| 初始好感 | `0`（五章首见，此前不可交互） |
| 好感 25 | 开放归墟表层通行；讲述"大阵以三千灵脉为薪" |
| 好感 50 | 开放归墟中层与阵图残片解读；解锁 `evt-shangyang-50`「他为什么还活着」 |
| 好感 75 | 承认自己是执行者，揭示"飞升无门"的真相 |
| 好感 100 | 终章可作为导师并肩（结局线"星斗重明"）或作为最终对手（结局线"归墟新主"）；解锁 `evt-shangyang-100`「赎罪与野心」 |
| 对话根节点 | `dlg-shangyang-root` |
| 同伴 / 道侣 | 否 / 否 |

> **计数核对**：`map-qingyun` 7 + `map-maoshan` 5 + `map-kunlun` 4 + `fac-sanxiu` 4 + `fac-yao` 3 + `fac-court` 3 + 截教与真相 2 = **28 名**，与 [01-世界观与设定](01-世界观与设定.md) §7 完全一致。
> **role 覆盖核对**：`guide`(玄阳子/张守一/玉虚子/萧元朗/剑冢残魂/商羊) · `shop`(玄阳子/张铁牛/王药师/小蛮/素心/花婆婆/洛三刀/墨麒/小唯/槐娘/白泽) · `quest`(全部有任务者) · `trainer`(玄阳子/张铁牛/王药师/青霄/素心/玉虚子/冷月/无涯子/白泽/裴无咎/黑莲) · `inn`(柳三婶) · `save`(柳三婶) · `healer`(王药师/小蛮) · `info`(陈瞎子/赵捕头/墨麒/洛三刀/云姬/无涯子/槐娘/白泽/沈钦) · `companion`(林小七/冷月仙子/云姬/剑冢残魂/小唯/裴无咎 共 6 名，与 §四 一致) · `lover`(小蛮/冷月/云姬) · `story`(全部剧情位)。

---

## 二、好感度规则

### 2.1 数值模型

- 范围 `-100 ~ +100`，初始值取 [01-世界观与设定](01-世界观与设定.md) §7 的 `favorInit`。
- 阈值：`25 / 50 / 75 / 100`，每档解锁一条内容（见 §一 各条目表），与 [02-核心玩法系统](02-核心玩法系统.md) §7 一致。
- 好感为负时**不解锁内容，只解锁"缓和"事件**：`-50 → -25 → 0` 各有一个缓和节点，让敌对 NPC 有转圜余地（如姜离、黑莲圣母、无涯子）。

### 2.2 增减途径

| 途径 | 变化 | 约束 |
|---|---|---|
| 完成该 NPC 发布的委托 | `+5` | 每条委托只计一次 |
| 完成该 NPC 的支线 | `+10 ~ +20` | 视支线 `level`：`common +10` / `rare +15` / `legend +20` |
| 对话选择（投其所好） | `+1 ~ +5` | 每 NPC 每日对话加成上限 `+5` |
| 对话选择（触其忌讳） | `-2 ~ -10` | 无下限保护，可致敌对 |
| 赠送喜好物品 | `+5 ~ +15` | 见 §2.4 送礼系统 |
| 赠送厌恶物品 | `-5 ~ -10` | — |
| 交心事件（25/50/75 档） | `+10` | 见 §2.5 |
| 突破至 75 → 100 | `+25` | 需完成专属事件链，见 §2.6 |
| 委托超时未完成 | `-3` | 见 [05-日常与随机事件](05-日常与随机事件.md) §2.1 |
| 攻击/击杀该 NPC 关联势力成员 | `-5 ~ -20` | 与该 NPC 的 `faction` 挂钩 |
| 主线关键抉择背离其立场 | `-15` | 一次性，不可挽回（写入 `flag-*`） |
| 势力声望突破 +50 | `+5`（该势力全部 NPC） | 一人一次 |

### 2.3 衰减规则

1. **衰减不按日结算**，**只在季节切换时结算一次**（每季一次，共 4 次/年），避免玩家因短暂离线被惩罚。
2. **触发条件**：某 NPC **连续 3 个游戏月（90 日）未发生任何互动**（对话、赠礼、任务、同图共处不计）。
3. **衰减值**：每次季节结算 `-2`；`favor > 75` 者 `-1`（高位更稳）；`favor < 0` 者不衰减（反正已经敌对）。
4. **衰减下限**：衰减至 `favorInit` 为止，**不会低于初始值**（保留角色设定基调）。
5. **豁免**：已结为道侣、已入队同伴、以及 `favor = 100` 的 NPC **永不衰减**。
6. **减速手段**：洞府「传音符」（`homestead.json` 二级升级）可对 3 名 NPC 免衰减；`item-misc-xinshu`（信符）可从任意地图发起一次"远途问候"，计为一次互动。

### 2.4 送礼系统

| 项 | 规则 |
|---|---|
| 频率 | 每 NPC **每日限 1 次**；全部 NPC 合计**每月限 5 次**（防刷） |
| 基础收益 | `common +5` / `fine +8` / `rare +10` / `epic +12` / `legend +15` |
| 喜好加成 | 喜好物品在基础值上 `+5`，并额外触发一句专属对话（写入 `flag-*`） |
| 厌恶惩罚 | 厌恶物品 `-5`；`legend` 级厌恶物 `-10`（如送槐娘"伐木斧"） |
| 已满好感 | `favor = 100` 时赠礼改为回赠物品（不浪费） |
| 道侣特权 | 结为道侣后，赠礼不再消耗每月 5 次配额 |

**NPC 喜好 / 厌恶物品表（示例，配置于 `npcs.json` 的 `giftLike` / `giftHate`）**：

| NPC | 喜好物品 | 厌恶物品 |
|---|---|---|
| `npc-xuan-yang` | `item-misc-hao-bi`（好笔）、`item-mat-zhusha` | `item-mat-shixiong`（尸傀材料） |
| `npc-liu-shen` | `item-mat-cao-yao`（草药）、`item-misc-meijiu` | `item-mat-gutou`（骨头） |
| `npc-zhang-tie` | `item-mat-yintie`、`item-mat-yuntie` | `item-misc-xiuhua`（绣花） |
| `npc-wang-yao` | `item-mat-lingzhi-1000`、`item-mat-bingli` | `item-dan-feidan`（废丹） |
| `npc-chen-xia` | `item-misc-tianjipan`、`item-mat-gutou` | `item-misc-guanping`（官凭） |
| `npc-zhao-bu` | `item-misc-guanping`、`item-mat-zhusha` | `item-mat-jiazhui`（假账） |
| `npc-xiao-man` | `item-mat-cao-yao`、`item-mat-seed-chunlan` | `item-mat-shixiong` |
| `npc-zhang-shouyi` | `item-fu-qixie`、古籍残页 | `item-mat-yaojin`（妖丹） |
| `npc-qing-xiao` | `item-mat-zhenpan`、`item-mat-zhusha` | `item-misc-meijiu`（他戒酒） |
| `npc-su-xin` | `item-mat-yuntie`、`item-mat-huowenshi` | `item-misc-xiuhua` |
| `npc-lin-xiaoqi` | `item-misc-lingguo`（零食）、`item-dan-huiqi` | `item-book-*`（他看不进去书） |
| `npc-hua-popo` | `item-mat-shixiong`、`item-mat-gutou` | `item-misc-xinshu`（信符，她不愿收信） |
| `npc-yu-xuzi` | 古籍残页、`item-mat-yuntie` | `item-mat-yaojin` |
| `npc-leng-yue` | `item-mat-duanjian`、`item-mat-yuntie` | `item-misc-xiuhua`、`item-mat-jiazhui` |
| `npc-mo-qi` | `item-book-residual-*`、`item-misc-kaoju` | `item-mat-huozhong`（怕火） |
| `npc-jiang-li` | `item-fabao-zhifa-suo`、`item-misc-kaoju` | `item-misc-jiazhui` |
| `npc-luo-sandao` | `item-misc-jiazhui`、`item-fabao-guimingdeng` | `item-fu-qixie`（他嫌晦气） |
| `npc-yun-ji` | `item-misc-ditu`、`item-misc-xinshu` | 无（她什么都收，但价值 -1 档） |
| `npc-wu-ya` | `item-book-residual-*`、`item-dan-feidan` | `item-dan-zhuji`（他嫌俗） |
| `npc-jian-zhong` | `item-mat-duanjian`、`item-mat-jianpo` | 无 |
| `npc-xiao-wei` | `item-mat-doufu`（豆腐）、`item-mat-huaishi` | `item-mat-langpi`（狼皮） |
| `npc-huai-niang` | `item-mat-seed-*`、清水 | `item-craft-fu-tou`（斧） |
| `npc-bai-ze` | `item-book-residual-*`、古籍残页 | `item-misc-jiazhui` |
| `npc-xiao-yuanlang` | `item-misc-guanping`、`item-mat-zhusha` | `item-mat-yaojin` |
| `npc-shen-qin` | `item-fabao-qintian-pan`、星图残页 | `item-misc-jiazhui` |
| `npc-pei-wujiu` | `item-misc-meijiu`、`item-mat-yintie` | `item-fu-qixie`（他不信这个） |
| `npc-hei-lian` | `item-mat-heilianzi`、禁术残页 | `item-fabao-tianshiyin` |
| `npc-shang-yang` | 阵图残片、`item-quest-array-shard` | 无 |

### 2.5 交心事件

交心事件是**好感档位的叙事兑现**，每条 NPC 的 25/50/75/100 档均对应一个事件（见 §一 各条目表，ID 形如 `evt-{拼音}-{档位}`，登记于 `events.json`）。

| 档位 | 形式 | 效果 | 条件 |
|---|---|---|---|
| 25 | 一次性对话，含 1 个选择 | `favor +10`，解锁该档功能 | `favor ≥ 25` 且未触发 |
| 50 | 2~3 步小任务（多为寻物/护送） | `favor +10`，赠物 | `favor ≥ 50`，前置 25 档事件 |
| 75 | 带战斗或探索的剧情段 | `favor +10`，解锁技能/权限 | `favor ≥ 75`，前置 50 档 |
| 100 | 角色弧光终点，含关键抉择 | `favor` 满值，写入 `flag-*`，影响结局 | `favor ≥ 100`，前置 75 档 + 该 NPC 相关支线完成 |

- **冷却**：交心事件本身无冷却，但同一 NPC 的两档之间需间隔 **≥ 3 游戏日**（避免一口气刷穿）。
- **选错惩罚**：75 与 100 档事件中含"伤其心"的选项，选错 `favor -10` 且该档事件**进入 10 日冷却**后可重试。

### 2.6 上限突破条件（75 → 100）

`favor` 达到 75 后**不会自动累积到 100**，必须满足以下**全部条件**才能突破上限：

1. 完成该 NPC 的 **75 档交心事件**。
2. 完成该 NPC 关联的**至少 1 条支线**（`sq-*`，`related.npcs` 含该 NPC）。
3. 该 NPC 所属势力声望 **≥ +25**（`faction` 为 `fac-sanxiu` 或无势力者免此项；`npc-shang-yang` 免）。
4. 玩家**心境 ≥ 60**（避免"心魔状态下交心"的逻辑荒谬）。
5. 未与该 NPC 存在 `conflicts` 中的道侣（道侣互斥见 §5.3）。

满足后，100 档事件自动出现在该 NPC 的对话根节点，选择"说出那句话"即触发，触发后写入 `flag-npc-{拼音}-max`。

---

## 三、势力声望规则

> 以下阈值与互斥规则**直接引用** [01-世界观与设定](01-世界观与设定.md) §4.1，本文档只补充**与 NPC 关系的联动**，不修改阈值。

### 3.1 阈值与互斥（不在此处定义）

势力声望的取值范围、四档阈值（入门 / 专属商店与功法 / 专属支线 / 结局加成）、六势力 ID 清单，以及**势力间的互斥与压制规则**的唯一定义处是 [01-世界观与设定](01-世界观与设定.md) §4.1。本节不复述具体阈值与倍率，只在下文 §3.3 补充**与 NPC 关系的联动**。

### 3.3 与 NPC 关系的联动

| 联动项 | 规则 |
|---|---|
| 入门门槛 | 势力声望 `< +25` 时，该势力 NPC 的 50 档以上内容**锁定**（面板提示"你还不算他们的人"） |
| 声望 → 好感 | 声望突破 `+50` 时，该势力**全部已知 NPC** 好感 `+5`（一人一次） |
| 好感 → 声望 | 某势力 NPC 好感达到 `100` 满值时，`+5` 该势力声望（一人一次） |
| 敌对惩罚 | 击杀该势力 NPC，声望 `-20`，该 NPC 永久敌对（`favor = -100`，不可恢复） |
| 压制传导 | 完成 `fac-kunlun` 任务致 `fac-jiejiao -5` 时，若 `favor npc-hei-lian > 0`，额外 `-3` |
| 双面人机制 | `fac-court` 与 `fac-yao` 声望**同时 ≥ +50** 时解锁隐藏对话，在 `npc-bai-ze` 与 `npc-xiao-yuanlang` 处各出现一条"两难"选项 |

---

## 四、同伴系统

### 4.1 总则

- 最多招募 **6 名**（[01-世界观与设定](01-世界观与设定.md) §7.8）。
- **上场 2 名**（主角 + 2 同伴，见 [02-核心玩法系统](02-核心玩法系统.md) §3.2）。
- 未上场的同伴留在洞府，提供**被动辅助**（见各条"在队加成"的"后备"行）。
- 同伴拥有独立好感、独立等级（跟随主角境界，最高为主角境界 -1）。

### 4.2 六名同伴明细

#### 4.2.1 林小七 `npc-lin-xiaoqi`

| 项 | 内容 |
|---|---|
| 招募条件 | 完成 `sq-cp-01`「外门师弟的请求」与 `sq-cp-02`「他想跟你走」，`favor ≥ 50`，`fac-maoshan ≥ 25` |
| 战斗定位 | 辅助 · 符箓（后排，低血中速） |
| 专属技能方向 | `skill-fu-wanxiang`（符阵·万象，全体减伤 + 群体驱邪） / `skill-fu-hufa`（护盾符阵，为我方单体加护盾） / `skill-fu-qingxin`（清心符，解除一名友方减益） |
| 在队加成 | 上场：全队符箓类道具效果 `+10%`，每场战斗开局自动为血量最低者加一层护盾；后备：洞府内每日自动产出 `tal-qixie`×1 |
| 好感联动 | 好感每 +25，护盾值 +5%；好感 100 时 `skill-fu-wanxiang` 额外附加一次群体驱邪 |
| 离队条件 | 心境 `< 20` 且连续 3 日未与其对话 → 触发 `evt-xiaoqi-leave`，回茅山；`favor ≥ 75` 后永不离队 |

#### 4.2.2 冷月仙子 `npc-leng-yue`

| 项 | 内容 |
|---|---|
| 招募条件 | 完成 `sq-cp-03`「雪线之约」与 `sq-cp-04`「剑心一问」，`favor ≥ 75`，`fac-kunlun ≥ 25` |
| 战斗定位 | 输出 · 剑修（前排，高攻高爆低防） |
| 专属技能方向 | `skill-yueying-zhan`（月影斩，单体高倍率 + 破防） / `skill-han-jianqi`（寒剑气，附加减速） / `skill-jianxin-tong`（剑心通明，本次攻击必暴击，冷却 4 回合） |
| 在队加成 | 上场：全队暴击率 `+5%`；后备：练剑场效果，主角每日首次打坐修为 `+10%` |
| 好感联动 | 好感 `≥ 75` 时 `skill-yueying-zhan` 附加"剑意"层数；若已结为道侣，暴击率额外 `+8%` 并解锁合击技 `skill-heji-yuejian` |
| 离队条件 | 主角与 `fac-jiejiao` 声望 `> +50` 时触发争执；选择"仍要结盟"则离队（`favor -30`），选择"断绝截教"则留队 |

#### 4.2.3 云姬 `npc-yun-ji`

| 项 | 内容 |
|---|---|
| 招募条件 | 完成 `sq-cp-05`「情报的价钱」，`favor ≥ 75`，`fac-sanxiu ≥ 25` |
| 战斗定位 | 控制 · 情报（中排，中血高速） |
| 专属技能方向 | `skill-yun-jiance`（弱点标记，使目标受到伤害 `+15%`） / `skill-yun-zhihuan`（迟缓之雾，群体降速） / `skill-yun-xinxi`（情报预判，本回合全队闪避 `+20%`） |
| 在队加成 | 上场：战斗开始时揭示敌方全部弱点；后备：探索时随机事件稀有度提升（见 [05-日常与随机事件](05-日常与随机事件.md) §8.2 权重右移 3%） |
| 好感联动 | 好感 `≥ 75` 时 `skill-yun-jiance` 可标记 2 个目标；道侣后灵石收入 `+15%` |
| 离队条件 | 无主动离队；但若玩家将其卖给第三方（`npc-luo-sandao` 的某条黑市选项），永久离队且 `favor = -100` |

#### 4.2.4 剑冢残魂 `npc-jian-zhong`

| 项 | 内容 |
|---|---|
| 招募条件 | 完成 `sq-cp-06`「一柄剑的重量」，`favor ≥ 75`，需先完成 `rq-mf-jianzhong-04` 或 `rq-mf-jianzhong-05` |
| 战斗定位 | 输出 · 灵体（前排，无视防御，血量低但有复活） |
| 专属技能方向 | `skill-jian-lingmie`（灵灭，无视防御一击） / `skill-jian-sanqian`（三千剑影，群体中等伤害） / `skill-lingti-huanhun`（灵体回魂，自身复活一次，整场限 1 次） |
| 在队加成 | 上场：对灵体/鬼魂类敌人伤害 `+20%`；后备：洞府剑架效果，主角攻击 `+3%` |
| 好感联动 | 好感 `≥ 100` 时 `skill-lingti-huanhun` 复活后恢复 50% 血量（否则 25%） |
| 离队条件 | 进入 `map-mf-jianzhong` 并完成剑冢主线后，有 1 次"归冢"抉择；选择让其归冢则永久离队但解锁 `cdx-lz-jianzhong`，选择挽留则留队（`favor +10`） |
| 特殊约束 | 灵体需灵力维持（[01-世界观与设定](01-世界观与设定.md) §8）：在 `map-mf-dingong` 内每回合额外消耗灵力 2 点 |

#### 4.2.5 小唯 `npc-xiao-wei`

| 项 | 内容 |
|---|---|
| 招募条件 | 完成 `sq-cp-07`「她想做人的原因」，`favor ≥ 75`，`fac-yao ≥ 25` |
| 战斗定位 | 治疗 · 幻术（后排，低防中速） |
| 专属技能方向 | `skill-huan-yueying`（幻术·月影，群体混乱） / `skill-liao-huqi`（狐息疗，群体治疗） / `skill-huan-yixin`（幻术·移心，与敌方交换一次行动顺序） |
| 在队加成 | 上场：全队治疗效果 `+15%`；后备：洞府内 `item-mat-doufu` 消耗品自动补充 |
| 好感联动 | 好感 `≥ 100` 时 `skill-liao-huqi` 附加解除中毒/尸毒 |
| 离队条件 | 若玩家在妖鬼相关主线中选"清除青丘"，永久离队（`favor -60`，`fac-yao -50`） |
| 特殊约束 | `fac-kunlun > +75` 时，其出场会引发昆仑非议：每次带其进入昆仑地图，`fac-kunlun -2` |

#### 4.2.6 裴无咎 `npc-pei-wujiu`

| 项 | 内容 |
|---|---|
| 招募条件 | 完成 `sq-cp-08`「凡人的位置」，`favor ≥ 75`，`fac-court ≥ 25` |
| 战斗定位 | 坦克 · 凡人（前排，高防高血，无灵力消耗） |
| 专属技能方向 | `skill-junzhen-chao`（军阵·嘲，强制敌方攻击自身） / `skill-junzhen-gu`（军阵·固，自身格挡 `+30%`） / `skill-junzhen-po`（军阵·破，全队攻击 `+15%`，3 回合） |
| 在队加成 | 上场：全队防御 `+10%`，主角受到的首次致命伤害由其代为承受（每场 1 次）；后备：金陵城内声望获取 `+10%` |
| 好感联动 | 好感 `≥ 100` 时"代为承受"每场可用 2 次 |
| 离队条件 | 若玩家在朝堂线中站队三皇子的对手，触发 `evt-peiwujiu-leave` 离队；`favor ≥ 75` 且 `fac-court ≥ 50` 时该分支不会出现 |
| 特殊约束 | **凡人无灵力**：不参与灵力相关的任何 buff；但其技能消耗为 0，是长线消耗战的最优解 |

### 4.3 同伴共性与管理

| 项 | 规则 |
|---|---|
| 招募任务线 | `sq-cp-01` ~ `sq-cp-08`，共 8 条，分布见 [04-支线任务](04-支线任务.md) |
| 队伍上限 | 上场 2 人；洞府可驻留全部 6 人 |
| 升级 | 同伴不单独攒修为，境界随主角自动同步（上限为主角境界 -1） |
| 装备 | 同伴可穿 1 件武器 + 1 件防具（不占主角背包，独立 2 格） |
| 好感独立 | 同伴好感与普通 NPC 好感共用同一套规则（§2），送礼与交心事件同样生效 |
| 遣散 | 可主动遣散，`favor -20`，10 日后可重新招募（`favor ≥ 50` 时无惩罚） |

---

## 五、道侣系统

### 5.1 三名候选

| 道侣 | NPC ID | 路线 | 主题 | 共修加成 |
|---|---|---|---|---|
| 小蛮 | `npc-xiao-man` | `sq-lv-01` / `sq-lv-02` | 凡人与修士之别：她要不要走上修行路 | 炼丹成功率 `+10%`，心境恢复 `+20%` |
| 冷月仙子 | `npc-leng-yue` | `sq-lv-03` / `sq-lv-04` | 剑心与情心不可两全 | 暴击率 `+8%`，突破成功率 `+5%` |
| 云姬 | `npc-yun-ji` | `sq-lv-05` / `sq-lv-06` | 情报贩子的秘密与信任 | 灵石收入 `+15%`，随机事件稀有度提升 |

### 5.2 六条道侣支线

**任务 ID、名称、前置、流程、战斗与奖励的唯一定义处是 [04-支线任务](04-支线任务.md) §八**（`sq-lv-01` ~ `sq-lv-06`）。本节只补充**每条的剧情内核**，名称与 04 保持一致，不另立标题。

| ID | 名称（以 04 §八 为准） | 关联 | 剧情内核 | 完成标志（已登记于 [04 附录 A](04-支线任务.md)） |
|---|---|---|---|---|
| `sq-lv-01` | 药炉边 | 小蛮 | 玩家受伤后由小蛮照料，她说起自己"看得见灵气却摸不到" | `flag-sq-lv-xiaoman-a` |
| `sq-lv-02` | 凡人与修士 | 小蛮 | 抉择：为她引气入体（她成为修士，但风险高）/ 让她继续做凡人 | `flag-sq-lv-xiaoman-b` |
| `sq-lv-03` | 剑上霜 | 冷月仙子 | 冷月在雪线问你"剑与情，你要哪个"，答案影响其剑意走向 | `flag-sq-lv-lengyue-a` |
| `sq-lv-04` | 剑心与情心 | 冷月仙子 | 为她挡下一次必杀，或让她为剑道斩情 | `flag-sq-lv-lengyue-b` |
| `sq-lv-05` | 价码 | 云姬 | 追查云姬为何从不透露过去；发现她曾出卖过一整个小镇 | `flag-sq-lv-yunji-a` |
| `sq-lv-06` | 信任 | 云姬 | 抉择：揭穿她 / 替她隐瞒 / 与她一起面对旧案苦主 | `flag-sq-lv-yunji-b` |

### 5.3 互斥规则

1. **同一周目只能结成一名道侣**（引用 [01-世界观与设定](01-世界观与设定.md) §7.9）。
2. 选择其一后，其余两条道侣线的**后续任务关闭**（互斥组见 [04-支线任务](04-支线任务.md) §十二 互斥矩阵：`sq-lv-01/02` ↔ `sq-lv-03/04` ↔ `sq-lv-05/06`），**已完成的奖励保留**。
3. 结为道侣的判定条件：完成该候选的两条 `sq-lv-*` 且 `favor = 100` 且玩家**未与他人结为道侣**。
4. 结为道侣后写入存档的 `lover` 字段（结构见 [12-存档与时间系统](12-存档与时间系统.md) §3），不再另设标记。
5. **不可解除**：道侣关系一旦成立即锁定至本周末（对应"共修"的世界观设定：一旦结契，灵力相通，强行解除将导致双方跌境）。
6. 若在结契前拒绝全部三人，终章判定为 `end-ember`（末法成道），后日谈为「独行」。

### 5.4 共修加成细则

| 加成 | 生效条件 | 数值 |
|---|---|---|
| 共修打坐 | 与道侣同在洞府打坐 | 修为收益 `+25%`，心境 `+2/次` |
| 共修战斗 | 道侣作为同伴上场 | 全队全属性 `+3%` |
| 专属合击 | 好感 `100` + 已结契 | 解锁 1 个合击技（`skill-heji-*`，每场 1 次） |
| 路线专属 | 见 §5.1 表 | 常驻被动 |
| 道侣赠礼 | 每日首次赠礼 | 额外 `+3` 好感（不消耗月度配额） |

### 5.5 道侣专属结局判定与后日谈

> 结局 ID 的唯一定义处是 [03-主线任务](03-主线任务.md) §十（共 7 个）。下表只说明**道侣状态如何影响判定与后日谈**，**不构成新结局**。

| 道侣 | 结局判定 | 后日谈（[03](03-主线任务.md) `mq-6-11`） |
|---|---|---|
| 小蛮 | `end-retire`（人间烟火） | 依 `sq-lv-02` 分支演出「凡人之诺」或「双修道途」 |
| 冷月仙子 | `end-retire` | 「双剑归鞘」：终章放弃阵营之争，退隐雪线 |
| 云姬 | `end-restore` 或 `end-retire` | 「最后一个秘密」：她交出情报网，指出归墟的唯一入口 |
| 无道侣 | `end-ember`（末法成道，其条件即要求未结道侣） | 「独行」 |

---

## 六、NPC 对话与日程

### 6.1 昼夜日程表规则

每名 NPC 的日程由 `npcs.json` 的 `schedule` 字段定义，格式为"时段 → 地图 + 落点"：

| 时段 | 覆盖时辰 | 行为基调 |
|---|---|---|
| 晨 | 卯~辰 | 上工、开铺、巡山 |
| 昼 | 巳~未 | 主要交易与任务窗口 |
| 暮 | 申~酉 | 收摊、归家、交接 |
| 夜 | 戌~寅 | 夜市/鬼市开放，妖鬼 NPC 活跃，凡人 NPC 归家 |

**日程表（关键 NPC，示例）**：

| NPC | 晨 | 昼 | 暮 | 夜 |
|---|---|---|---|---|
| `npc-xuan-yang` | 镇口石碑 | 游方摊位 | 客栈 | 客栈（饮酒） |
| `npc-liu-shen` | 客栈灶房 | 客栈柜台 | 客栈柜台 | 客栈（守夜） |
| `npc-zhang-tie` | 铁匠铺 | 铁匠铺 | 铁匠铺（收工） | 家中（不可交互） |
| `npc-wang-yao` | 后院晾药 | 药铺 | 药铺 | 后院（可交互） |
| `npc-chen-xia` | 桥头出摊 | 桥头 | 收摊 | 家中（不可交互） |
| `npc-zhao-bu` | 衙门 | 衙门 | 巡街 | 夜巡（可交互，可接驱邪委托） |
| `npc-xiao-man` | 药铺 | 药铺 | 河边 | 河边（可交心） |
| `npc-luo-sandao` | 金陵后巷 | 金陵后巷 | 前往青丘 | **青丘鬼市**（仅夜） |
| `npc-yun-ji` | 茶楼 | 茶楼二楼 | 不定 | 不定（随情报网移动，需情报解锁位置） |
| `npc-xiao-wei` | 豆腐摊 | 豆腐摊 | 槐树下 | 槐树下（可交心） |
| `npc-huai-niang` | 老槐树 | 老槐树 | 老槐树 | 老槐树（本体不可移动） |
| `npc-bai-ze` | 妖界崖壁 | 妖界崖壁 | 妖界崖壁 | 青丘（仅月圆） |
| `npc-shen-qin` | 观星台（闭门） | 观星台（闭门） | 观星台 | **观星台**（仅夜可交互） |
| `npc-pei-wujiu` | 军营 | 军营 | 城墙 | 城墙 |

**季节修正**：

| 季节 | 修正 |
|---|---|
| 春 | 全体凡人 NPC 出摊时辰提前 1 时辰；`npc-hua-popo` 在白日也登塔 |
| 夏 | 昼间（巳~未）野外 NPC 减少；`npc-xiao-wei` 夜间改在河边 |
| 秋 | `npc-huai-niang` 夜间可触发季节事件；`npc-mo-qi` 全天在藏经阁 |
| 冬 | 全体凡人 NPC 夜间不出门；`npc-leng-yue` 夜间在雪线（可交互）；骰子类地图遇敌率上升 |

**规则**：

1. NPC 不在其日程位置时，`interact` 层无交互体，玩家看到的是"门关着"或"人不在"。
2. 日程切换发生在时辰推进的边界（每时辰一次检查），切换过程中 NPC 沿预定路径移动，不与玩家碰撞。
3. 剧情事件可通过 `move` 效果**临时改写**某 NPC 的位置（如 `evt-*` 演出期间玄阳子固定在客栈）。
4. 若玩家在 NPC 移动途中交互，按"当前所在落点"判定。

### 6.2 对话节点树结构

对话树采用 `dialogues.json`，一条记录一个节点。风格与 [11-数据表规范](11-数据表规范.md) §4 一致（`id` / `name` / `trigger` / `branches` / `effects` / `conditions` 同构）。

```json
{
  "$schema": "../runtime/schema/dialogues.schema.json",
  "version": "1.0",
  "dialogues": [
    {
      "id": "dlg-xiaoman-root",
      "npc": "npc-xiao-man",
      "name": "小蛮 · 根节点",
      "next": "dlg-xiaoman-greet",
      "nodes": [
        {
          "id": "dlg-xiaoman-greet",
          "speaker": "npc-xiao-man",
          "text": "你来啦。今天的药我分好了，摆在外头那排的是你的。",
          "conditions": [],
          "choices": [
            {
              "text": "道谢",
              "next": "dlg-xiaoman-thanks",
              "effects": [{ "type": "favor", "npc": "npc-xiao-man", "value": 1 }]
            },
            {
              "text": "问她为什么认得这么多药",
              "conditions": [{ "type": "favor", "npc": "npc-xiao-man", "min": 25 }],
              "next": "dlg-xiaoman-herbs"
            },
            {
              "text": "【交心】你想过自己修行吗",
              "conditions": [
                { "type": "favor", "npc": "npc-xiao-man", "min": 75 },
                { "type": "questState", "quest": "sq-lv-01", "state": "completed" },
                { "type": "mind", "min": 60 }
              ],
              "effects": [
                { "type": "dialog", "npc": "npc-xiao-man", "node": "dlg-xiaoman-lv02" }
              ]
            },
            {
              "text": "【离开】",
              "next": null
            }
          ]
        },
        {
          "id": "dlg-xiaoman-thanks",
          "speaker": "npc-xiao-man",
          "text": "谢什么呀，我又不是白给你分的。",
          "conditions": [],
          "choices": [{ "text": "（笑）", "next": null }]
        },
        {
          "id": "dlg-xiaoman-herbs",
          "speaker": "npc-xiao-man",
          "text": "我闻得出来。爹说这是天赋，可我觉得……这跟你们说的灵根，好像有点像，又好像不是。",
          "conditions": [],
          "choices": [
            {
              "text": "告诉她那确实是灵根",
              "effects": [{ "type": "flag", "key": "flag-xiaoman-herb-sense", "value": true }],
              "next": null
            },
            {
              "text": "岔开话题",
              "effects": [{ "type": "favor", "npc": "npc-xiao-man", "value": -2 }],
              "next": null
            }
          ]
        }
      ]
    },
    {
      "id": "dlg-xuanyang-root",
      "npc": "npc-xuan-yang",
      "name": "玄阳子 · 根节点",
      "next": "dlg-xuanyang-greet",
      "nodes": []
    }
  ]
}
```

### 6.3 条件分支写法

1. **分支条件只用 [11-数据表规范](11-数据表规范.md) §3.3 白名单的 `conditions` 类型**，禁止自定义表达式。需要复合判断时用数组的**与**语义；需要"或"语义时写**两个并列选项**（避免引入未登记的 `or` 结构）。
2. **选项级条件**决定选项是否显示；**节点级条件**决定节点是否可直接进入（用于日程/剧情切换）。
3. 常用条件组合：

| 意图 | 写法 |
|---|---|
| 好感达标 | `{ "type": "favor", "npc": "npc-x", "min": 50 }` |
| 势力入门 | `{ "type": "faction", "faction": "fac-maoshan", "min": 25 }` |
| 境界要求 | `{ "type": "realm", "min": 2, "max": 4 }` |
| 昼夜限定 | `{ "type": "timeOfDay", "day": "night" }` |
| 前置任务 | `{ "type": "questState", "quest": "sq-cp-01", "state": "completed" }` |
| 世界标记 | `{ "type": "flag", "key": "flag-xiaoman-promise", "value": true }`（示例标记已登记于 [03 附录 A](03-主线任务.md)；未登记的标记视为配置错误，见 [11-数据表规范](11-数据表规范.md) §6） |
| 同伴在队 | `{ "type": "companion", "npc": "npc-leng-yue" }` |
| 概率分支 | `{ "type": "random", "chance": 0.5 }`（用于"他今天心情不好"类分支） |
| 二周目 | `{ "type": "newGamePlus", "min": 1 }` |

4. **效果写法只用 §3.2 白名单**：对话中最常用 `favor` / `flag` / `item` / `stone` / `exp` / `mind` / `quest` / `shop` / `unlockSkill` / `companion` / `lover` / `ending`。
5. **禁止**在对话中直接做数值计算（如"好感 ×2"）——需要此类效果时，先到 §3.2 登记新 `type`。
6. 每个根节点必须至少有一条**无条件可选项**（通常是"离开"或"打招呼"），保证玩家永远不会进入死胡同。

---

## 七、关系对结局的影响

> 结局 ID 前缀 `end-`。**7 个结局的唯一定义处是 [03-主线任务](03-主线任务.md) §十**：`end-restore`（星斗重明）/ `end-break`（天地自择）/ `end-ember`（末法成道）/ `end-retire`（人间烟火）/ `end-heaven`（新天庭）/ `end-fail`（轮回重来）/ `end-true`（布阵者的旨意）。
> 本节只列**关系状态如何改写终章判定**，**不得新增结局 ID**：只影响结局判定条件的，写在「对终章的影响」列；只影响收尾演出的，归入后日谈 `mq-6-11`，不构成新结局。

### 7.1 会被关系状态改写的结局判定

| 关系状态 | 判定条件 | 对终章的影响 |
|---|---|---|
| 道侣 · 小蛮 | `records.lover = npc-xiao-man` 且 `flag-sq-lv-xiaoman-b` | 终章新增选项「留在青云镇」→ 判定为 `end-retire`（人间烟火），后日谈追加"凡人之诺" |
| 道侣 · 小蛮（修士） | 同上，且其灵根改造已完成 | 终章天劫战可召唤其合击一次；`end-restore` 演出中追加"双修"尾声 |
| 道侣 · 冷月仙子 | `records.lover = npc-leng-yue` 且 `flag-sq-lv-lengyue-b` | 判定为 `end-retire`，后日谈为"双剑归鞘"；阵营抉择惩罚减半 |
| 道侣 · 云姬 | `records.lover = npc-yun-ji` 且 `flag-sq-lv-yunji-b` | 解锁归墟捷径（终章最终战前置减少 1 场）；`end-restore` 追加情报网尾声 |
| 无道侣 | `records.lover = null` 且三条 `sq-lv-*` 均未完成或均被拒 | 判定为 `end-ember`（末法成道，其条件即要求未结道侣） |
| 同伴 · 全员满好感 | 6 名同伴 `favor = 100` | 终章最终战全体出场助战；后日谈追加"同行"，**不构成新结局** |
| 同伴 · 剑冢残魂归冢 | `flag-sq-cp-jianzhong` 未达成 | `end-restore` 中剑冢余韵加强；失去其助战 |
| `npc-shang-yang` 好感 100 | `favor(npc-shang-yang) = 100` | 终章可走「赎罪」线（判定为 `end-restore`），并写入 `flag-shangyang-doubt` |
| `npc-shang-yang` 好感 < 50 | 未达 50 档 | 终章只能走「对抗」线，无导师协助，最终战难度 +30% |
| `npc-hei-lian` 好感 100 | `favor(npc-hei-lian) = 100` | 终章可结盟截教，判定为 `end-ember` 或 `end-break` |
| 势力 · `fac-kunlun ≥ 100` | 声望阈值 | `end-restore` 专属加成：终章全属性 +10% |
| 势力 · `fac-jiejiao ≥ 100` | 声望阈值 | `end-break` 专属加成 |
| 势力 · `fac-court` 与 `fac-yao` 同时 `≥ 100` | 双满 | 解锁隐藏对话与后日谈"人妖两立"，**不构成新结局**；作为 `end-true` 的一条线索 |
| 势力 · 全部势力 `≤ -50` | 全敌对 | 终章被围杀，强制判定为 `end-fail`（轮回重来） |
| NPC 敌对 · `npc-jiang-li` 敌对且未转为盟友 | `flag-jiangli-rival` 未达成 | 失去昆仑内部作保，终章昆仑线前提多 1 条 |
| NPC 敌对 · `npc-leng-yue` 好感 `≤ -50` | 关系破裂 | 剑修相关后日谈分支全部关闭 |
| 关键交心 · 玄阳子 100 | `favor(npc-xuan-yang) = 100` | 终章可请其助战一次（茅山符阵，免疫一次致命伤害） |
| 关键交心 · 墨麒 100 | `favor(npc-mo-qi) = 100` | 终章阵图解读无需额外线索，直接显示"修复大阵"的完整流程 |

### 7.2 判定优先级

终章结局判定按以下顺序（先命中先返回；7 个结局的唯一定义处是 [03-主线任务](03-主线任务.md) §十）：

```
1. 阵营抉择（修复 / 碎阵 / 另辟蹊径）→ 决定结局大类
2. 道侣状态 → 在大类下选择专属尾声
3. 势力声望与 NPC 满值 → 追加专属加成与演出
4. 同伴与关系存续 → 决定最终战的参战名单与难度
5. 世界标记（flag-*）→ 微调结局文本
```

### 7.3 关系状态的可视化提示

- 任务日志中设有**关系面板**：以环形图显示 28 名 NPC 的好感档位（25/50/75/100 四段），已满档者标金边。
- 势力面板显示六势力声望与**互斥警示**（当一方将因任务下降时，预先标红提示）。
- 终章前（进入 `map-mf-guixu` 前）弹出**关系结算预览**：列出"你已结下的关系"，并提示哪些选项会因关系状态改变。**不剧透具体结局名**。

---

**文档结束** · 变更记录见 [00-文档索引](00-文档索引.md)
