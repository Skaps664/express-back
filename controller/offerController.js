const express = require("express");
const asyncHandler = require("express-async-handler");
const ProductOffer = require("../models/ProductOffersModel");
const Product = require("../models/ProductsModel");
const validateMongoId = require("../utils/validateMongoId");

// Get all offers
const getAllOffers = asyncHandler(async (req, res) => {
  const offers = await ProductOffer.find({})
    .populate("product", "name images price")
    .populate("appliedBy", "name");

  res.json(offers);
});

// Get offers for a specific product
const getProductOffers = asyncHandler(async (req, res) => {
  const { id } = req.params;
  validateMongoId(id);

  const offers = await ProductOffer.find({ product: id }).populate(
    "appliedBy",
    "name"
  );

  res.json(offers);
});

// Create a new offer
const createOffer = asyncHandler(async (req, res) => {
  const {
    product,
    name,
    description,
    discountType,
    discountValue,
    originalPrice,
    startDate,
    endDate,
  } = req.body;

  validateMongoId(product);

  // Calculate discounted price based on discount type
  let discountedPrice;
  if (discountType === "percentage") {
    discountedPrice = originalPrice - originalPrice * (discountValue / 100);
  } else {
    // fixed amount
    discountedPrice = originalPrice - discountValue;
  }

  // Ensure price doesn't go below zero
  discountedPrice = Math.max(discountedPrice, 0);

  // Round to 2 decimal places
  discountedPrice = Math.round(discountedPrice * 100) / 100;

  const offer = await ProductOffer.create({
    product,
    name,
    description,
    discountType,
    discountValue,
    originalPrice,
    discountedPrice,
    startDate,
    endDate,
    isActive: true,
    appliedBy: req.user ? req.user._id : null,
  });

  // Update product with the new offer
  await Product.findByIdAndUpdate(product, {
    originalPrice: originalPrice,
    price: discountedPrice,
  });

  res.status(201).json(offer);
});

// Update an offer
const updateOffer = asyncHandler(async (req, res) => {
  const { id } = req.params;
  validateMongoId(id);

  const {
    name,
    description,
    discountType,
    discountValue,
    originalPrice,
    startDate,
    endDate,
    isActive,
  } = req.body;

  // Calculate discounted price based on discount type
  let discountedPrice;
  if (discountType === "percentage") {
    discountedPrice = originalPrice - originalPrice * (discountValue / 100);
  } else {
    // fixed amount
    discountedPrice = originalPrice - discountValue;
  }

  // Ensure price doesn't go below zero
  discountedPrice = Math.max(discountedPrice, 0);

  // Round to 2 decimal places
  discountedPrice = Math.round(discountedPrice * 100) / 100;

  const updatedOffer = await ProductOffer.findByIdAndUpdate(
    id,
    {
      name,
      description,
      discountType,
      discountValue,
      originalPrice,
      discountedPrice,
      startDate,
      endDate,
      isActive,
      updatedAt: Date.now(),
    },
    { new: true }
  );

  // If the offer is active, update the product price
  if (isActive) {
    const offer = await ProductOffer.findById(id);
    await Product.findByIdAndUpdate(offer.product, {
      originalPrice: originalPrice,
      price: discountedPrice,
    });
  }

  res.json(updatedOffer);
});

// Delete an offer
const deleteOffer = asyncHandler(async (req, res) => {
  const { id } = req.params;
  validateMongoId(id);

  // Get the offer before deleting to get product ID
  const offer = await ProductOffer.findById(id);
  if (!offer) {
    res.status(404);
    throw new Error("Offer not found");
  }

  // Delete the offer
  await ProductOffer.findByIdAndDelete(id);

  // Reset the product price if this was an active offer
  if (offer.isActive) {
    // Find the next active offer for this product
    const nextOffer = await ProductOffer.findOne({
      product: offer.product,
      isActive: true,
      startDate: { $lte: new Date() },
      endDate: { $gte: new Date() },
    }).sort({ createdAt: -1 });

    if (nextOffer) {
      // Apply the next offer
      await Product.findByIdAndUpdate(offer.product, {
        price: nextOffer.discountedPrice,
        originalPrice: nextOffer.originalPrice,
      });
    } else {
      // Reset to original price with no discount
      const product = await Product.findById(offer.product);
      await Product.findByIdAndUpdate(offer.product, {
        price: offer.originalPrice,
        originalPrice: null,
      });
    }
  }

  res.json({ message: "Offer deleted successfully" });
});

module.exports = {
  getAllOffers,
  getProductOffers,
  createOffer,
  updateOffer,
  deleteOffer,
};
