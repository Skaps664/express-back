const mongoose = require("mongoose");

// OrderItem sub-schema for storing product details at time of order
const orderItemSchema = new mongoose.Schema(
  {
    product: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Products",
      required: true,
    },
    name: {
      type: String, // Store product name at time of order
      required: true,
    },
    slug: {
      type: String, // Store product slug at time of order
    },
    quantity: {
      type: Number,
      required: true,
      min: 1,
    },
    price: {
      type: Number, // Store product price at time of order
      required: true,
    },
    selectedVariant: {
      type: String, // e.g., "Red, 256GB" or "500W"
    },
    image: {
      type: String, // Store product image URL at time of order
    },
  },
  { _id: true }
);

// Order schema
const orderSchema = new mongoose.Schema(
  {
    orderNumber: {
      type: String,
      unique: true,
    },
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    items: [orderItemSchema],
    totalAmount: {
      type: Number,
      required: true,
    },
    shippingAddress: {
      fullName: String,
      phoneNumber: String,
      street: String,
      city: String,
      state: String,
      postalCode: String,
      country: String,
    },
    status: {
      type: String,
      enum: [
        "Pending",
        "Confirmed",
        "Processing",
        "Shipped",
        "Delivered",
        "Cancelled",
      ],
      default: "Pending",
    },
    paymentStatus: {
      type: String,
      enum: ["Pending", "Paid", "Failed"],
      default: "Pending",
    },
    paymentMethod: {
      type: String,
      enum: [
        "Bank Transfer",
        "Cash on Delivery",
        "Digital Wallet",
        "WhatsApp",
        "Other",
      ],
      default: "Bank Transfer",
    },
    orderNotes: {
      type: String,
    },
    whatsappSent: {
      type: Boolean,
      default: false,
    },
    whatsappMessageId: {
      type: String,
    },
    whatsappMessageContent: {
      type: String,
    },
    whatsappPhoneNumber: {
      type: String,
    },
    directPurchase: {
      type: Boolean,
      default: false,
    },
  },
  { timestamps: true }
);

// Generate order number before saving
orderSchema.pre("save", function (next) {
  if (!this.orderNumber) {
    const timestamp = Math.floor(Date.now() / 1000).toString(); // Unix timestamp
    const randomDigits = Math.floor(Math.random() * 1000)
      .toString()
      .padStart(3, "0");
    this.orderNumber = `ORD-${timestamp}-${randomDigits}`;
  }
  next();
});

module.exports = mongoose.model("Order", orderSchema);
