const puppeteer = require("puppeteer-extra");
const StealthPlugin = require("puppeteer-extra-plugin-stealth");
const dayjs = require("dayjs");

const logger = require("./logger");

puppeteer.use(StealthPlugin());

const CONFIGS = {
	"turnip-storage": {
		name: "btree",
		islandID: null,
		theme: null,
		turnipCode: "",
		hostedTurnipCode: null,
		hasSeenDisclaimer: true,
		lastDingSoundTurnipCode: "c67725a5",
		seenMerch: true,
		islander: "neither",
		category: "turnips",
		fee: "no",
		patreon: "all",
		patreonID: null,
		twitter: "",
		twitch: "",
		discord: "",
	},
};

const VISITED_COUNT_TABLE = new Map();
const MAX_VISITS = 3;
const ROLLING_JOIN = false;
const BAD_WORDS =
	"fake price|not real|fee is(\\s+)?(.+)?|leave a tip of(\\s+)?(.+)?|[3-9] nmt";

async function checkPrices({ browser, atPrice }) {
	try {
		const now = dayjs().format("MM/DD/YYYY hh:mm");
		// /img/turnip.0cf2478d.png
		const page = await browser.newPage();
		await page.goto("https://turnip.exchange/islands");
		await page.evaluate((values) => {
			for (const key in values) {
				localStorage.setItem(key, JSON.stringify(values[key]));
			}
		}, CONFIGS);
		await page.goto("https://turnip.exchange/islands");
		await page.waitForRequest("https://api.turnip.exchange/islands/");
		await page.waitFor(1000);
		await page.waitForSelector("div#app div.note");
		const children = await page.$$eval(
			"div#app div.note",
			(divs, atPrice) => {
				return divs.map((div) => {
					const code = div.getAttribute("data-turnip-code");
					if (!code) {
						return null;
					}
					const turnipImg = div.querySelector(
						'img[src="/img/turnip.0cf2478d.png"]'
					);
					const descTag = div.querySelector(
						"p.text-xs.p-4.pt-0.justify-self-start.overflow-hidden.text-justify"
					);
					const description = descTag ? descTag.textContent : "";
					const priceTag = turnipImg.nextSibling;
					const priceDesc = priceTag.textContent;
					const price = Number(priceDesc.split(" ")[0]);

					if (price > atPrice) {
						return {
							url: `https://turnip.exchange/island/${code}`,
							code,
							price,
							description,
						};
					}

					return null;
				});
			},
			atPrice
		);
		const listings = children.filter((c) => !!c);
		logger.green("\n");
		logger.green("====================================");
		logger.green(`New listings: ${now}`);
		logger.green("====================================");
		logger.green("\n");
		if (listings.length > 0) {
			listings.forEach((list) => {
				logger.green(`Come visit at ${list.url}`);
				logger.green(`Price: ${list.price}\n`);
			});
		} else {
			logger.red(`Bad price\n`);
		}
		await page.close();
		return listings;
	} catch (err) {
		await page.close();
		logger.red(err);
	}
}

function initCount(list) {
	VISITED_COUNT_TABLE.set(list.code, {
		url: list.url,
		id: list.code,
		price: list.price,
		trials: 0,
		joined: false,
	});
}

function increaseCount(list) {
	const stats = VISITED_COUNT_TABLE.get(list.code);
	if (stats) {
		VISITED_COUNT_TABLE.set(list.code, {
			...stats,
			trials: stats.trials + 1,
		});
	}
}

function toggleJoined(list, toggle = true) {
	const stats = VISITED_COUNT_TABLE.get(list.code);
	if (stats) {
		VISITED_COUNT_TABLE.set(list.code, {
			...stats,
			joined: toggle,
		});
	}
}

function removeVisit(list) {
	const stats = VISITED_COUNT_TABLE.get(list.code);
	if (stats) {
		VISITED_COUNT_TABLE.set(list.code, {
			...stats,
			removed: true,
		});
	}
}

async function waitForIsland({ list, browser }) {
	const page = await browser.newPage();
	await page.goto(list.url);
	await page.waitFor(1000);
	await page.waitForSelector("div#app div.grid button.bg-primary");

	page.on("close", () => {
		toggleJoined(list);
		clearInterval(timer);
		removeVisit(list);
		logger.red(`You have closed ${list.url}`);
	});

	const timer = setInterval(async () => {
		await page.evaluate(() => {
			const btn = document.evaluate(
				"//button[contains(., 'Join this queue')]",
				document,
				null,
				XPathResult.FIRST_ORDERED_NODE_TYPE,
				null
			).singleNodeValue;
			if (btn) {
				btn.click();
			}
		});
		const joined = await page.evaluate(() => {
			const btn = document.evaluate(
				"//button[text()=' Join ']",
				document,
				null,
				XPathResult.FIRST_ORDERED_NODE_TYPE,
				null
			).singleNodeValue;
			if (btn) {
				btn.click();
				return true;
			}
			return false;
		});
		increaseCount(list);
		if (joined) {
			logger.green(`You have joined ${list.url}`);
			toggleJoined(list);
			clearInterval(timer);
		}
	}, 100);
}

function checkIfCanJoinNewIsland() {
	if (ROLLING_JOIN) {
		if (VISITED_COUNT_TABLE.size <= MAX_VISITS) {
			return true;
		} else {
			return (
				Array.from(VISITED_COUNT_TABLE.values()).filter(
					(v) => v.joined === false
				).length <= MAX_VISITS
			);
		}
	} else {
		return (
			Array.from(VISITED_COUNT_TABLE.values()).filter((v) => !v.removed)
				.length <= MAX_VISITS
		);
	}
}

function normalizeLists(lists) {
	const normed = lists
		.filter((list) => {
			return !RegExp(BAD_WORDS, "i").test(list.description);
		})
		.sort((a, b) => b.price - a.price);
	console.log(normed);
	return normed;
}

async function batchWaitForIsland({ lists, browser }) {
	if (!lists) {
		return;
	}
	for (const list of normalizeLists(lists)) {
		if (!VISITED_COUNT_TABLE.get(list.code) && checkIfCanJoinNewIsland()) {
			initCount(list);
			waitForIsland({ list, browser });
		}
	}
}

async function listenForTurnipPrices(atPrice = 150) {
	const browser = await puppeteer.launch({ headless: false, devtools: true });
	const lists = await checkPrices({ atPrice, browser });
	batchWaitForIsland({ lists, browser });
	setInterval(async () => {
		if (!checkIfCanJoinNewIsland()) {
			logger.red(
				`You are currently waiting for ${
					Array.from(VISITED_COUNT_TABLE.values()).filter((v) => !v.removed)
						.length
				} simultaneously.`
			);
			return;
		}
		const lists = await checkPrices({ atPrice, browser });
		batchWaitForIsland({ lists, browser });
	}, 1000 * 10);
}

listenForTurnipPrices();
