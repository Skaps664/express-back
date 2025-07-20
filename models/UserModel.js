const mongoose = require("mongoose"); // Erase if already required
const bcrypt = require("bcrypt"); // For hashing passwords

// Address sub-schema
const addressSchema = new mongoose.Schema(
  {
    label: { type: String, enum: ["Home", "Work", "Other"], default: "Home" },
    fullName: { type: String, required: true },
    phoneNumber: { type: String, required: true },
    street: { type: String, required: true },
    city: { type: String, required: true },
    state: { type: String },
    postalCode: { type: String, required: true },
    country: { type: String, required: true },
    isDefault: { type: Boolean, default: false },
  },
  { _id: true, timestamps: true }
);

// Cart item sub-schema
const cartItemSchema = new mongoose.Schema(
  {
    product: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Products",
      required: true,
    },
    quantity: { type: Number, required: true, default: 1 },
    selectedVariant: { type: String }, // e.g., "Red, 256GB" or "500W"
    price: { type: Number }, // Store the price at the time the item is added to cart
    name: { type: String }, // Store the name at the time the item is added to cart
    image: { type: String }, // Store the product image URL
  },
  { _id: true, timestamps: true }
);

// Declare the Schema of the Mongo model
var userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    email: {
      type: String,
      required: true,
      unique: true,
    },
    mobile: {
      type: String,
      required: true,
      unique: true,
    },
    password: {
      type: String,
      required: true,
    },
    isAdmin: {
      type: Boolean,
      default: false,
    },
    isBlocked: {
      type: Boolean,
      default: false,
    }, // Blocked users cannot access certain features
    createdAt: {
      type: Date,
      default: Date.now,
    },
    updatedAt: {
      type: Date,
      default: Date.now,
    },
    adress: [addressSchema],
    wishlist: [{ type: mongoose.Schema.Types.ObjectId, ref: "Products" }],
    cart: [
      {
        product: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "Products",
          required: true,
        },
        quantity: { type: Number, required: true, default: 1 },
        selectedVariant: { type: String }, // e.g., "Red, 256GB" or "500W"
      },
    ],
    purchaseHistory: [
      {
        product: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "Products",
          required: true,
        },
        purchaseDate: {
          type: Date,
          default: Date.now,
        },
        quantity: {
          type: Number,
          required: true,
          default: 1,
        },
        variant: String,
        orderReference: String,
        price: Number,
        hasReviewed: {
          type: Boolean,
          default: false,
        },
      },
    ],

    refreshToken: {
      type: String,
      default: "",
    }, // For JWT refresh tokens
  },
  {
    timestamps: true, // handles createdAt and updatedAt automatically
  }
);

userSchema.pre("save", async function (next) {
  if (!this.isModified("password")) return next();
  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);
  next();
});

userSchema.methods.isPasswordMatched = async function (enteredPassword) {
  return await bcrypt.compare(enteredPassword, this.password);
};

// Hide password in output
userSchema.methods.toJSON = function () {
  const user = this.toObject();
  delete user.password;
  return user;
};

//Export the model
module.exports = mongoose.model("User", userSchema);
