# 蓝色牌桌 · 隔离审阅

从原版 `2fcaf2e` 开始，独立分支 `design/official-playmat-preview`。不合入 main，不替换正式站；存档键为 `VG_OFFICIAL_PREVIEW_V1`。

## 视觉依据

保留三列两排牌桌、蓝色底色。参考用户提供的牌桌图：中心蓝色 V 法阵、其他 R 法阵、细线环与醒目的窄体数字。`public/reference-playmat.jpg` 为用户提供的第二张图片；辅助 SVG 由代码绘制，不标称官方独立素材。

数值字体 Barlow Condensed 800，辅助数值 600，本地加载并附 OFL。中文使用系统黑体。长数字按实际字宽与容器宽度适配，字体加载和容器变化后重新计算；基础值、修正值分别显示，不在窄格内拼长公式。

## 操作结构

- 六格用于看力量、基础、修正、G、暴击与支援状态。保留支援切换，去除每格重复的加数银行。
- 常用回合开始、Ride、Persona Ride 位于一行。Persona 不再与一个相同文字的前列加数快捷键并列。
- 一个持续可见的单位编辑面板随所选格子切换。修正页含正负预设、五色判定、暴击、清修正与自定义数值/OT 开关；基础页含七个预设、自定义值、G0–G3 和任意 G；状态页含横置/站立、截击、双判、三判、支援/后排攻击和退场。没有遮罩或选择后的滚动跳转。
- EN 保留圆形轨道 0–10；可点击区域和可见圆点分开，不把圆点变成方形按钮。
- 防御计算保留并使用整行宽度。魂、伤和牌库计数作为收起的可选计数工具；语言、骰子、硬币、G 预设、多重支援与回合重置位于设置。
- 主界面不输出抽牌、魂区或治愈流程说明。判定只执行力量/暴击计算，不要求同步实体牌数或伤害区。暴击的力量与暴击默认给同一单位，仍可用各格修正与暴击调整拆分。

## 规则与验证边界

Persona 加成与单位的前列位置绑定，包括后来进入前列的单位；前判加成记录到判定处理时已有的前列单位。回合开始和回合重置清临时加成。OT 只记基础力量加成，卡片额外效果自行调整。

构建与实际编译产物的 DOM 回归覆盖编辑功能、连续操作、撤回、Persona/前判区别、存档恢复、PG、防御边界及长数字在宽备用字体与字体切换下的适配。DOM 测试不是手机浏览器像素验收。当前浏览器无法访问本地文件，Vercel 隔离部署有登录保护；不宣称已完成真机显示验收。

## 设计资料

- https://github.com/anthropics/skills/blob/main/skills/frontend-design/SKILL.md
- https://github.com/vercel-labs/agent-skills/blob/main/skills/web-design-guidelines/SKILL.md
- https://github.com/vercel-labs/web-interface-guidelines/blob/main/command.md
- https://github.com/google/fonts/tree/main/ofl/barlowcondensed
- https://en.cf-vanguard.com/howto/d-series/
- https://en.cf-vanguard.com/howto/v-series/

官方规则页搜索索引可查；当前环境直接读取返回 404。图片实际使用用户上传参考，不声称获得官方高清素材下载。
