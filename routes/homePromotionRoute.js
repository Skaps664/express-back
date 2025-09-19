const express = require('express')
const router = express.Router()
const homePromotionController = require('../controller/homePromotionController')
const { authMiddleware, isAdmin } = require('../middlewares/authMiddleware')

// Public: get active home promotion
router.get('/active', homePromotionController.getHomePromotion)

// Admin: create and delete promotions
router.post('/', authMiddleware, isAdmin, homePromotionController.createHomePromotion)
router.delete('/:id', authMiddleware, isAdmin, homePromotionController.deleteHomePromotion)

module.exports = router
