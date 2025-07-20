const mongoose = require("mongoose");

const FAQSchema = new mongoose.Schema({
  question: {
    type: String,
    required: true,
  },
  answer: {
    type: String,
    required: true,
  },
});

const WhyChooseReasonSchema = new mongoose.Schema({
  title: {
    type: String,
    required: true,
  },
  description: {
    type: String,
    required: true,
  },
});

const WarrantyDocumentSchema = new mongoose.Schema({
  title: {
    type: String,
    required: true,
  },
  documentUrl: {
    type: String,
    required: true,
  },
  documentPublicId: {
    type: String,
    required: true,
  },
});

const BrandPagePromotionSchema = new mongoose.Schema({
  title: {
    type: String,
    required: true,
  },
  description: {
    type: String,
    required: true,
  },
  imageUrl: {
    type: String,
    required: true,
  },
  imagePublicId: {
    type: String,
    required: true,
  },
  displayTab: {
    type: String,
    enum: ["all", "featured", "about", "support"],
    default: "all",
  },
  startDate: {
    type: Date,
    required: true,
  },
  endDate: {
    type: Date,
    required: true,
  },
  isActive: {
    type: Boolean,
    default: true,
  },
});

const BrandPageSettingsSchema = new mongoose.Schema(
  {
    brand: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Brand",
      required: true,
      unique: true,
    },
    aboutContent: {
      type: String,
      default: "",
    },
    whyChooseReasons: [WhyChooseReasonSchema],
    featuredProducts: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Products",
      },
    ],
    warrantyInformation: {
      type: String,
      default: "",
    },
    warrantyDocuments: [WarrantyDocumentSchema],
    technicalSupportInfo: {
      type: String,
      default: "",
    },
    faqs: [FAQSchema],
    promotions: [BrandPagePromotionSchema],
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model("BrandPageSettings", BrandPageSettingsSchema);
