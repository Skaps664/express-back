const express = require('express')
const router = express.Router()
const partnershipController = require('../controller/partnershipController')

// Public endpoint to submit partnership application
router.post('/submit', partnershipController.submitPartnership)

module.exports = router
