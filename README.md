## Before running

1. Change the name to yours in `configs` at `index.js` (line 11)

```js
const CONFIGS = {
	"turnip-storage": {
		name: YOUR_NAME_HERE,
        ...
	},
};
```

2. Custom options

```js
// LINE 31 - 33

// How many islands you want to wait for at most?
const MAX_VISITS = 3;

// Do you want to wait for a new island after joining one
const ROLLING_JOIN = false;

// Filter islands with these words in the description
const BAD_WORDS =
	"fake price|not real|fee is(\\s+)?(.+)?|leave a tip of(\\s+)?(.+)?|[3-9] nmt";
```

3. You can close a browser tab if you don't want to wait for that island. The script will not reopen a closed island, and will fill up the slot with a new island.

## How to run the script?

```bash
$ cd PROJECT_DIR
$ npm i
$ node index.js
```
