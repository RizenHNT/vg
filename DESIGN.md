# 官方牌桌风格 · 隔离预览

本分支从已恢复的原版 `2fcaf2e` 创建。未修改 main，未替换正式站。

## 视觉依据

使用用户提供的官方牌桌参考：三列两排单位，中心蓝色 V 法阵，五个黄绿色 R 法阵；黑色底、细线环形几何、紧凑而醒目的粗数字。`public/reference-playmat.jpg` 是用户提供的第二张图片，保持原始内容，通过 CSS 定位显示法阵；两个 SVG 是参照图片绘制的辅助线条，非官方独立素材。

颜色：底色 #050b15；面板 #0b192b；边框 #34526b；蓝色 #89d3ff；黄色 #f3de86；辅助字 #a3b3c3。

字体：数值用 Barlow Condensed 800，按钮数值用 600，本地加载并附 OFL；中文用系统黑体（PingFang SC / Microsoft YaHei / system-ui）。对比过 Rajdhani，最终选择更接近参考图数值比例的 Barlow Condensed。不把装饰字体用于中文操作说明。

## 技能与素材来源

- Frontend Design：https://github.com/anthropics/skills/blob/main/skills/frontend-design/SKILL.md
- Web Design Guidelines：https://github.com/vercel-labs/agent-skills/blob/main/skills/web-design-guidelines/SKILL.md
- 审查规范：https://github.com/vercel-labs/web-interface-guidelines/blob/main/command.md
- 字体及许可证：https://github.com/google/fonts/tree/main/ofl/barlowcondensed
- 官方牌桌说明：https://cf-vanguard.com/howto/first_guide/menu02/
- 官方 First Guide：https://en.cf-vanguard.com/wordpress/wp-content/uploads/VGD-First-Guide.pdf

官方页面在本次环境中下载返回 404，未伪称已取得高清原始法阵。实际使用的是用户上传的参考图，辅助 SVG 由代码绘制。

## 操作层级

常用：六格直接选择；每格 +5k / +10k、−5k；空位 8k / 10k 呼叫；横置与竖置；攻击与撤回；E 能量；Persona Ride；五种判定。

偶尔使用：G 等级、基础值、自定义数值、暴击分配、状态标记。点击格子的 G 按钮，在场地下方展开编辑，不覆盖单位。

低频：语言、骰子、硬币、等级预设、自定义计数器，保留在设置中，使用正常文档流。

## 预览隔离

独立分支和预览部署。使用 `VG_OFFICIAL_PREVIEW_V1` 存档键。预览不写入原版存档，不切换生产域名。用户明确认可后才可以合入。

## 规则边界

Persona Ride 的前列加成包括本回合后来呼叫的单位，并在回合开始/状态重置时清除；实体抽牌通过提示处理。前触发仅处理当时已有的前列单位。治愈先确认伤害条件，不满足仍加力量。暴击的力量和暴击默认给当前单位，可以通过编辑分别调整。OT 的力量被记录，卡片追加效果仍需按卡文处理。
