const express = require("express");
const multer = require("multer");
const { cloudinaryUploadBuffer } = require("../utils/cloudinary");
const { authMiddleware, isAdmin } = require("../middlewares/authMiddleware");

const router = express.Router();

// Configure multer for memory storage
const storage = multer.memoryStorage();
const upload = multer({
  storage,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB limit
  },
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith("image/")) {
      cb(null, true);
    } else {
      cb(new Error("Only image files are allowed!"), false);
    }
  },
});

// Upload home promotion images
router.post(
  "/home-promotion",
  authMiddleware,
  isAdmin,
  upload.fields([
    { name: "desktopImage", maxCount: 1 },
    { name: "mobileImage", maxCount: 1 },
  ]),
  async (req, res) => {
    try {
      console.log("Home promotion image upload started");
      console.log("Files received:", req.files);

      const uploadPromises = [];
      const results = {};

      // Upload desktop image if provided
      if (req.files?.desktopImage?.[0]) {
        console.log("Uploading desktop image...");
        uploadPromises.push(
          cloudinaryUploadBuffer(
            req.files.desktopImage[0].buffer,
            `home-promotion/desktop-${Date.now()}`,
            "image"
          ).then((result) => {
            results.desktopImage = result.secure_url;
            console.log("Desktop image uploaded:", result.secure_url);
          })
        );
      }

      // Upload mobile image if provided
      if (req.files?.mobileImage?.[0]) {
        console.log("Uploading mobile image...");
        uploadPromises.push(
          cloudinaryUploadBuffer(
            req.files.mobileImage[0].buffer,
            `home-promotion/mobile-${Date.now()}`,
            "image"
          ).then((result) => {
            results.mobileImage = result.secure_url;
            console.log("Mobile image uploaded:", result.secure_url);
          })
        );
      }

      // Wait for all uploads to complete
      await Promise.all(uploadPromises);

      console.log("All uploads completed:", results);
      res.json({
        success: true,
        message: "Images uploaded successfully",
        images: results,
      });
    } catch (error) {
      console.error("Upload error:", error);
      res.status(500).json({
        success: false,
        message: "Failed to upload images",
        error: error.message,
      });
    }
  }
);

module.exports = router;
