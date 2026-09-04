import coreWebVitals from "eslint-config-next/core-web-vitals";
import typescript from "eslint-config-next/typescript";

const eslintConfig = [
  ...coreWebVitals,
  ...typescript,
  {
    rules: {
      "react-hooks/immutability": "off",
      "react-hooks/refs": "off",
      "react-hooks/set-state-in-effect": "off",
      "no-warning-comments": ["error", { terms: ["TODO", "FIXME", "XXX", "HACK"], location: "start" }],
      // 魔法值：报告级（warn，不阻断 check）。默认豁免 0/1/2、-1（indexOf/slice 哨兵）、
      // 数组索引、默认参数、类字段初始值、枚举。测试文件单独关闭（见下方 overrides）。
      "no-magic-numbers": [
        "warn",
        {
          ignore: [0, 1, 2, -1],
          ignoreArrayIndexes: true,
          ignoreDefaultValues: true,
          ignoreClassFieldInitialValues: true,
          ignoreEnums: true,
          ignoreTypeIndexes: true,
        },
      ],
    },
  },
  {
    files: ["**/*.test.mjs"],
    rules: { "no-magic-numbers": "off" },
  },
];

export default eslintConfig;
