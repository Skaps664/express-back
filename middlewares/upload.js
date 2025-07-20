const multer = require("multer");
const path = require("path");
const fs = require("fs");

// Ensure directories exist
const ensureUploadDirs = () => {
  const dirs = ["uploads/images", "uploads/docs"];
  dirs.forEach(dir => {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  });
};

ensureUploadDirs();

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    if (file.fieldname === "images") {
      cb(null, "uploads/images");
    } else if (file.fieldname === "brochure" || file.fieldname === "instructions") {
      cb(null, "uploads/docs");
    } else {
      cb(null, "uploads/others");
    }
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    cb(null, uniqueSuffix + path.extname(file.originalname));
  },
});

const fileFilter = (req, file, cb) => {
  const allowedImageTypes = ["image/jpeg", "image/png", "image/webp"];
  const allowedPdfTypes = ["application/pdf"];

  if (
    (file.fieldname === "images" && allowedImageTypes.includes(file.mimetype)) ||
    ((file.fieldname === "brochure" || file.fieldname === "instructions") &&
      allowedPdfTypes.includes(file.mimetype))
  ) {
    cb(null, true);
  } else {
    cb(new Error("Invalid file type"), false);
  }
};

const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB max size
  },
});

module.exports = upload;
