require("dotenv").config();
const mongoose = require("mongoose");

async function debugDocuments() {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI);
    console.log("✅ Connected to MongoDB");

    // Import Product model
    const Product = require("./models/ProductsModel");

    // Find products with documents
    const products = await Product.find({
      documents: { $exists: true, $ne: [] },
    }).limit(3);

    if (products.length > 0) {
      console.log("📦 Found products with documents:");

      products.forEach((product, index) => {
        console.log(`\n--- Product ${index + 1} ---`);
        console.log("Product ID:", product._id);
        console.log("Product name:", product.name);
        console.log("Documents:");

        product.documents.forEach((doc, docIndex) => {
          console.log(`  Document ${docIndex + 1}:`);
          console.log("    Name:", doc.name);
          console.log("    URL:", doc.url);
          console.log("    Type:", doc.fileType);

          // Parse the Cloudinary URL to understand the structure
          if (doc.url && doc.url.includes("cloudinary.com")) {
            try {
              const url = new URL(doc.url);
              console.log("    Cloudinary analysis:");
              console.log("    - Full path:", url.pathname);

              const pathParts = url.pathname.split("/");
              const uploadIndex = pathParts.findIndex(
                (part) => part === "upload"
              );
              if (uploadIndex !== -1) {
                const afterUpload = pathParts.slice(uploadIndex + 1);
                console.log("    - After upload:", afterUpload.join("/"));

                // Check if there's a version
                const versionMatch = afterUpload[0].match(/^v(\d+)$/);
                if (versionMatch) {
                  console.log("    - Version:", versionMatch[1]);
                  console.log(
                    "    - Public ID:",
                    afterUpload.slice(1).join("/")
                  );
                } else {
                  console.log("    - No version detected");
                  console.log("    - Public ID:", afterUpload.join("/"));
                }
              }
            } catch (err) {
              console.log("    - Error parsing URL:", err.message);
            }
          }
        });
      });
    } else {
      console.log("❌ No products with documents found");
    }

    // Also search for the specific document that's failing
    console.log("\n🔍 Searching for specific failing document...");
    const failingDocName = "1753257611537_EN-H1-G2-Datasheet-V1.9-20250411.pdf";

    const productWithFailingDoc = await Product.findOne({
      "documents.url": { $regex: failingDocName },
    });

    if (productWithFailingDoc) {
      console.log("📄 Found product with failing document:");
      console.log("Product:", productWithFailingDoc.name);

      const doc = productWithFailingDoc.documents.find((d) =>
        d.url.includes(failingDocName)
      );
      if (doc) {
        console.log("Full document URL:", doc.url);

        // Test the different URL variations we would generate
        const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
        const publicId = "products/documents/" + failingDocName;

        console.log("\nURLs we would try:");
        console.log(
          "1. No version:",
          `https://res.cloudinary.com/${cloudName}/raw/upload/${publicId}`
        );
        console.log(
          "2. With v1753257611:",
          `https://res.cloudinary.com/${cloudName}/raw/upload/v1753257611/${publicId}`
        );
        console.log(
          "3. With fl_attachment:",
          `https://res.cloudinary.com/${cloudName}/raw/upload/fl_attachment/${publicId}`
        );
      }
    } else {
      console.log("❌ Could not find product with failing document");
    }
  } catch (error) {
    console.error("❌ Error:", error);
  } finally {
    mongoose.disconnect();
    process.exit(0);
  }
}

debugDocuments();
