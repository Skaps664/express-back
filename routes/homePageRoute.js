const express = require("express");
const router = express.Router();

const { homePage } = require("../controller/homePageController");

router.get("/", homePage);

module.exports = router;
