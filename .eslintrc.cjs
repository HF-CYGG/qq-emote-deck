module.exports = {
  env: {
    browser: true,
    node: true,
    es2021: true
  },
  globals: {
    LiteLoader: "readonly",
    findCurAio: "readonly",
    __le_bfsFindPeer: "readonly"
  },
  extends: ["eslint:recommended"],
  parserOptions: {
    ecmaVersion: "latest",
    sourceType: "module"
  },
  rules: {
    "no-empty": "off",
    "no-unused-vars": "off",
    "no-unreachable": "off",
    "no-useless-escape": "off",
    "no-inner-declarations": "off"
  }
};
