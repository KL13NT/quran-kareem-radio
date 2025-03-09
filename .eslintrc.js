module.exports = {
	env: {
		browser: false,
		es2021: true,
		node: true,
	},
	extends: [
		"eslint:recommended",
		"plugin:@typescript-eslint/recommended",
		"prettier",
	],
	parser: "@typescript-eslint/parser",
	parserOptions: {
		ecmaVersion: "latest",
		sourceType: "module",
	},
	plugins: ["@typescript-eslint"],
	rules: {
		"no-unused-vars": "warn",
		"no-console": "off",
		"@typescript-eslint/no-non-null-assertion": "off",
		"func-names": "off",
		"no-process-exit": "off",
		"object-shorthand": "off",
		"class-methods-use-this": "off",
		"require-jsdoc": "off",
	},
};
