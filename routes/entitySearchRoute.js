const express = require("express");
const { searchEntities } = require("../controller/entitySearchController");
const { authMiddleware } = require("../middlewares/authMiddleware");
const router = express.Router();

// Protected routes
router.get("/search", authMiddleware, searchEntities);

module.exports = router;
