# 插件与技能

`/api/plugins` 使用 Pi 的 `SettingsManager` 与 `DefaultPackageManager` 管理全局和项目 package 的安装、移除、更新、启用与禁用。禁用时需将该 package entry 的 `extensions`、`skills`、`prompts`、`themes` 写为空数组。

`/api/skills` 必须通过 `DefaultResourceLoader` 枚举，确保 settings paths、package skills 和项目 `.agents/skills` 与运行时一致。切换技能状态时，仅手术式编辑目标 `SKILL.md` frontmatter 的 `disable-model-invocation`，不得破坏用户格式。

`/api/skills/install` 通过 `npx skills add ... --agent pi` 安装；项目安装在所选 cwd 中运行。