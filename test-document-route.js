require("dotenv").config();

console.log("Environment variables:");
console.log("CLOUDINARY_CLOUD_NAME:", process.env.CLOUDINARY_CLOUD_NAME);
console.log("NODE_ENV:", process.env.NODE_ENV);

// Test the URL construction
const documentPath =
  "products/documents/1753257611537_EN-H1-G2-Datasheet-V1.9-20250411.pdf";
const cloudinaryUrls = [
  // Standard raw upload URL
  `https://res.cloudinary.com/${process.env.CLOUDINARY_CLOUD_NAME}/raw/upload/${documentPath}`,
  // URL with fl_attachment flag
  `https://res.cloudinary.com/${process.env.CLOUDINARY_CLOUD_NAME}/raw/upload/fl_attachment/${documentPath}`,
  // Auto upload URL
  `https://res.cloudinary.com/${process.env.CLOUDINARY_CLOUD_NAME}/auto/upload/${documentPath}`,
  // Image upload URL (sometimes works for PDFs)
  `https://res.cloudinary.com/${process.env.CLOUDINARY_CLOUD_NAME}/image/upload/${documentPath}`,
];

console.log("\nGenerated Cloudinary URLs:");
cloudinaryUrls.forEach((url, index) => {
  console.log(`${index + 1}. ${url}`);
});

// Test HTTP requests to these URLs
const https = require("https");

async function testUrl(url) {
  return new Promise((resolve) => {
    console.log(`\nTesting: ${url}`);

    const request = https.get(url, (res) => {
      console.log(`Status: ${res.statusCode}`);
      console.log(`Content-Type: ${res.headers["content-type"]}`);
      console.log(`Content-Length: ${res.headers["content-length"]}`);

      if (res.statusCode === 200) {
        console.log("✅ SUCCESS!");
      } else {
        console.log("❌ FAILED");
      }

      res.on("data", () => {}); // consume data
      res.on("end", () => resolve());
    });

    request.on("error", (err) => {
      console.log(`❌ Error: ${err.message}`);
      resolve();
    });

    request.setTimeout(5000, () => {
      request.destroy();
      console.log("❌ Timeout");
      resolve();
    });
  });
}

async function testAllUrls() {
  for (const url of cloudinaryUrls) {
    await testUrl(url);
  }
}

testAllUrls().then(() => {
  console.log("\nDone testing all URLs");
  process.exit(0);
});
