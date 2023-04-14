"use strict";

if (process.env.NODE_ENV === "production") {
	module.exports = require("./react-promise-cache.production.js");
} else {
	module.exports = require("./react-promise-cache.development.js");
}
