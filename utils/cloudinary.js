const cloudinary = require("cloudinary").v2;
const fs = require("fs");

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

// Upload image/file directly from path
const cloudinaryUploadImage = async (
  fileToUpload,
  folder = "images",
  resource_type = "auto"
) => {
  return new Promise((resolve, reject) => {
    cloudinary.uploader.upload(
      fileToUpload,
      { folder, resource_type },
      (error, result) => {
        if (error) {
          console.error("Cloudinary upload error:", error);
          reject(error);
        } else {
          console.log("Cloudinary upload success:", {
            url: result.secure_url,
            public_id: result.public_id,
            resource_type: result.resource_type
          });
          resolve({
            url: result.secure_url,
            public_id: result.public_id,
          });
        }
      }
    );
  });
};

// Upload file from path (for files stored temporarily on disk)
const cloudinaryUploadFile = async (filePath, folder = "files") => {
  try {
    const result = await cloudinary.uploader.upload(filePath, {
      folder,
      resource_type: "auto",
    });

    return {
      secure_url: result.secure_url,
      public_id: result.public_id,
    };
  } catch (error) {
    throw new Error(`Error uploading file to Cloudinary: ${error.message}`);
  }
};

// Upload file from buffer (for files stored in memory)
const cloudinaryUploadBuffer = async (buffer, folder = "files", fileType) => {
  console.log("Cloudinary upload buffer called:", { folder, fileType, bufferSize: buffer?.length });
  
  if (!buffer) {
    throw new Error("No buffer provided for upload");
  }
  
  return new Promise((resolve, reject) => {
    const uploadStream = cloudinary.uploader.upload_stream(
      {
        folder,
        resource_type:
          fileType === "application/pdf" ||
          fileType === "application/msword" ||
          fileType ===
            "application/vnd.openxmlformats-officedocument.wordprocessingml.document" ||
          fileType === "text/plain"
            ? "raw"
            : "auto",
      },
      (error, result) => {
        if (error) {
          reject(error);
        } else {
          resolve({
            secure_url: result.secure_url,
            public_id: result.public_id,
          });
        }
      }
    );

    uploadStream.end(buffer);
  });
};

// Delete file from Cloudinary
const cloudinaryDeleteFile = async (publicId, resource_type = "image") => {
  try {
    const result = await cloudinary.uploader.destroy(publicId, {
      resource_type,
    });
    return result;
  } catch (error) {
    throw new Error(`Error deleting file from Cloudinary: ${error.message}`);
  }
};

module.exports = {
  cloudinaryUploadImage,
  cloudinaryUploadFile,
  cloudinaryUploadBuffer,
  cloudinaryDeleteFile,
};
