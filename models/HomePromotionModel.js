const mongoose = require('mongoose')

const HomePromotionSchema = new mongoose.Schema(
  {
    title: { type: String, required: true },
    subtitle: { type: String, default: '' },
    redirectLink: { type: String, default: '' },
    isActive: { type: Boolean, default: true },
    selectedBrand: {
      value: String,
      label: String,
      brand: { type: mongoose.Schema.Types.ObjectId, ref: 'Brand' },
    },
    featuredProducts: [
      {
        value: String,
        label: String,
        product: { type: mongoose.Schema.Types.ObjectId, ref: 'Products' },
      },
    ],
    images: {
      desktop: { type: String },
      mobile: { type: String },
    },
    startDate: { type: Date, default: Date.now },
    endDate: { type: Date, default: () => new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true }
)

module.exports = mongoose.model('HomePromotion', HomePromotionSchema)
