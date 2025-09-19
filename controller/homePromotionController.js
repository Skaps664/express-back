const HomePromotion = require('../models/HomePromotionModel')
const { cache } = require('../utils/redisCache')

exports.getHomePromotion = async (req, res) => {
  try {
    // Fetch the most recent active promotion
    const now = new Date()
    const promo = await HomePromotion.findOne({ isActive: true, startDate: { $lte: now }, endDate: { $gte: now } })
      .populate('selectedBrand.brand', 'name slug logo')
      .populate('featuredProducts.product', 'name slug images price')

    return res.status(200).json({ success: true, promotion: promo })
  } catch (error) {
    console.error('Error fetching home promotion:', error)
    return res.status(500).json({ success: false, message: 'Failed to fetch home promotion' })
  }
}

exports.createHomePromotion = async (req, res) => {
  try {
    const { title, subtitle, redirectLink, isActive, selectedBrand, featuredProducts, images } = req.body

    const promotion = await HomePromotion.create({ title, subtitle, redirectLink, isActive, selectedBrand: JSON.parse(selectedBrand || '{}'), featuredProducts: JSON.parse(featuredProducts || '[]'), images: JSON.parse(images || '{}'), createdBy: req.user?._id })

    // Clear cache if used
    if (cache && cache.del) {
      try { await cache.del('home_promotion') } catch (e) { }
    }

    return res.status(201).json({ success: true, promotion })
  } catch (error) {
    console.error('Error creating home promotion:', error)
    return res.status(500).json({ success: false, message: 'Failed to create home promotion' })
  }
}

exports.deleteHomePromotion = async (req, res) => {
  try {
    const { id } = req.params
    await HomePromotion.deleteOne({ _id: id })
    if (cache && cache.del) {
      try { await cache.del('home_promotion') } catch (e) { }
    }
    return res.status(200).json({ success: true })
  } catch (error) {
    console.error('Error deleting home promotion:', error)
    return res.status(500).json({ success: false, message: 'Failed to delete home promotion' })
  }
}
