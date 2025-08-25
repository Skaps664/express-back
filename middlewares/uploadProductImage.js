const multer = require("multer");
const cloudinary = require("cloudinary").v2;

// Configure Cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

// Multer storage configuration
const multerStorage = multer.memoryStorage();

const multerFilter = (req, file, cb) => {
  if (
    file.mimetype.startsWith("image/") ||
    file.mimetype === "application/pdf"
  ) {
    cb(null, true);
  } else {
    cb(new Error("Only images and PDFs are allowed!"), false);
  }
};

const uploadProductFiles = multer({
  storage: multerStorage,
  fileFilter: multerFilter,
  limits: { fileSize: 20 * 1024 * 1024 }, // 20MB max
}).fields([{ name: "images" }, { name: "documents" }]);

// Middleware to upload files to Cloudinary
const uploadToCloudinary = async (req, res, next) => {
  try {
    console.log("Starting file upload process...");
    console.log("Request files object:", req.files);
    console.log("Request body keys:", Object.keys(req.body));

    if (!req.files) {
      console.log("No files to upload");
      return next();
    }

    console.log("Files received:", {
      images: req.files.images?.length || 0,
      documents: req.files.documents?.length || 0,
    });

    // Log all field names in req.files
    console.log("All file field names:", Object.keys(req.files));

    // Upload images
    if (req.files.images) {
      req.body.images = [];
      console.log("Uploading", req.files.images.length, "images");

      for (const file of req.files.images) {
        const uploadResult = await new Promise((resolve, reject) => {
          cloudinary.uploader
            .upload_stream(
              {
                folder: "products",
                resource_type: "image",
                transformation: [{ quality: "auto" }, { fetch_format: "auto" }],
              },
              (error, result) => {
                if (error) {
                  console.error("Image upload error:", error);
                  reject(error);
                } else {
                  resolve(result);
                }
              }
            )
            .end(file.buffer);
        });

        if (uploadResult && uploadResult.secure_url) {
          req.body.images.push(uploadResult.secure_url);
          console.log("Image uploaded:", uploadResult.secure_url);
        }
      }
    }

    // Upload documents
    if (req.files.documents && req.files.documents.length > 0) {
      console.log("Uploading", req.files.documents.length, "documents");
      req.body.documents = []; // Initialize empty array for document objects

      for (const file of req.files.documents) {
        try {
          console.log(
            "Processing document:",
            file.originalname,
            "Size:",
            file.size,
            "Type:",
            file.mimetype
          );

          const uploadResult = await new Promise((resolve, reject) => {
            cloudinary.uploader
              .upload_stream(
                {
                  folder: "products/documents",
                  resource_type: "raw",
                  public_id: `${Date.now()}_${file.originalname.replace(
                    /\s+/g,
                    "_"
                  )}`,
                  access_mode: "public",
                  flags: "attachment",
                },
                (error, result) => {
                  if (error) {
                    console.error("Document upload error:", error);
                    reject(error);
                  } else {
                    console.log(
                      "Cloudinary upload success for:",
                      file.originalname
                    );
                    resolve(result);
                  }
                }
              )
              .end(file.buffer);
          });

          if (!uploadResult || !uploadResult.secure_url) {
            console.error("Missing secure_url in upload result:", uploadResult);
            continue;
          }

          let documentTypes = [];
          try {
            documentTypes = req.body.documentTypes
              ? JSON.parse(req.body.documentTypes)
              : [];
            console.log("Document types from frontend:", documentTypes);
          } catch (parseError) {
            console.error("Error parsing documentTypes:", parseError);
          }

          const docTypeInfo = documentTypes.find(
            (dt) => dt.name === file.originalname
          );
          console.log(
            "Found type info for",
            file.originalname,
            ":",
            docTypeInfo
          );

          const docObject = {
            id: `doc_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            name: file.originalname,
            type: docTypeInfo?.type || "other",
            url: uploadResult.secure_url,
            size: Math.round(file.size / 1024),
            uploadedAt: new Date(),
            fileType: file.mimetype.split("/")[1] || "pdf",
          };

          console.log("Created document object:", docObject);
          req.body.documents.push(docObject);
          console.log(
            "Document added to array. Current count:",
            req.body.documents.length
          );
        } catch (docError) {
          console.error("Error processing document:", docError);
        }
      }
      console.log(
        "Finished processing all documents. Final array length:",
        req.body.documents.length
      );
      console.log(
        "Final documents array:",
        JSON.stringify(req.body.documents, null, 2)
      );
    } else {
      console.log("No documents to upload or documents array is empty");
    }
    next();
  } catch (error) {
    console.error("Cloudinary upload error:", error);
    return res.status(500).json({
      success: false,
      message: "File upload failed",
      error: error.message,
    });
  }
};

module.exports = { uploadProductFiles, uploadToCloudinary };
