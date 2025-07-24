const mongoose = require("mongoose");
const bcrypt = require("bcrypt");

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
      trim: true,
    },
    email: {
      type: String,
      required: true,
      unique: true,
      index: true,
      lowercase: true,
      trim: true,
    },
    mobile: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },
    password: {
      type: String,
      required: true,
    },
    role: {
      type: String,
      default: "user",
      enum: ["user", "admin"],
    },
    isAdmin: {
      type: Boolean,
      default: false,
      index: true,
    },
    isBlocked: {
      type: Boolean,
      default: false,
      index: true,
    }, // Blocked users cannot access certain features
    city: {
      type: String,
      trim: true,
    },
    postalCode: {
      type: String,
      trim: true,
    },
    createdAt: {
      type: Date,
      default: Date.now,
      index: true,
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

// Create compound indexes for better query performance at scale
userSchema.index({ email: 1, isBlocked: 1 }); // Primary login query
userSchema.index({ email: 1, password: 1 }); // Login optimization
userSchema.index({ refreshToken: 1 }, { sparse: true }); // Refresh token queries
userSchema.index({ isAdmin: 1, isBlocked: 1 }); // Admin queries
userSchema.index({ createdAt: -1 }); // Sorting by creation date
userSchema.index({ mobile: 1 }); // Mobile number lookups
userSchema.index({ "cart.product": 1 }); // Cart product lookups
userSchema.index({ wishlist: 1 }); // Wishlist queries
userSchema.index({ "purchaseHistory.product": 1 }); // Purchase history queries
userSchema.index({ isBlocked: 1, createdAt: -1 }); // Admin user management

// Add text index for search functionality
userSchema.index(
  {
    name: "text",
    email: "text",
  },
  {
    name: "user_search_index",
    background: true,
  }
);

// Optimize for high-scale queries
userSchema.pre(/^find/, function () {
  // Set timeout for all find operations
  this.maxTimeMS(8000); // 8 second timeout for complex queries

  // Add query optimization hints
  if (this.getQuery().email) {
    this.hint({ email: 1, isBlocked: 1 });
  } else if (this.getQuery().refreshToken) {
    this.hint({ refreshToken: 1 });
  }
});

// Add performance monitoring
userSchema.pre("save", function () {
  this.$__saveStartTime = Date.now();
});

userSchema.post("save", function () {
  const saveTime = Date.now() - this.$__saveStartTime;
  if (saveTime > 1000) {
    // Log slow saves
    console.log(`⚠️ Slow user save: ${saveTime}ms for user ${this._id}`);
  }
});

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
  delete user.refreshToken; // Also hide refresh token for security
  return user;
};

//Export the model
module.exports = mongoose.model("User", userSchema);
