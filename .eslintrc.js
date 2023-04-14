module.exports = {
	env: {
		browser: true,
		es2021: true,
	},
	extends: ["google", "prettier"],
	parser: "@typescript-eslint/parser",
	parserOptions: {
		ecmaVersion: "latest",
		sourceType: "module",
	},
	plugins: ["@typescript-eslint"],
	rules: {
		"no-unused-vars": "warn",
		"no-console": "off",
		"func-names": "off",
		"no-process-exit": "off",
		"object-shorthand": "off",
		"class-methods-use-this": "off",
		"require-jsdoc": "off",
	},
};
