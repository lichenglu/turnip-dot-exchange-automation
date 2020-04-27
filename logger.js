const chalk = require("chalk");

logger = {
	blue: (...args) => {
		console.log(chalk.blue(...args));
	},
	red: (...args) => {
		console.log(chalk.red(...args));
	},
	green: (...args) => {
		console.log(chalk.green(...args));
	},
};

module.exports = logger;
