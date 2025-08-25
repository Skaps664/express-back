// Test script to simulate frontend document request
const axios = require("axios");

async function testDocumentAccess() {
  try {
    console.log("🧪 Testing document access...");

    // Test the exact URL that's failing according to user
    const testPath =
      "products/documents/1753257611537_EN-H1-G2-Datasheet-V1.9-20250411.pdf";
    const backendUrl = `http://localhost:3000/api/products/document/${testPath}`;

    console.log("📍 Testing URL:", backendUrl);

    const response = await axios.get(backendUrl, {
      timeout: 30000, // 30 second timeout
      responseType: "stream", // Handle binary data
      headers: {
        "User-Agent": "Mozilla/5.0 (Test)",
      },
    });

    console.log("✅ SUCCESS!");
    console.log("📊 Status:", response.status);
    console.log("📋 Headers:", response.headers);

    return true;
  } catch (error) {
    console.log("❌ FAILED!");
    console.log("📊 Status:", error.response?.status);
    console.log("📄 Response:", error.response?.data);
    console.log("⚠️  Error:", error.message);

    return false;
  }
}

// Also test the test-document route
async function testRoute() {
  try {
    console.log("\n🧪 Testing test-document route...");

    const response = await axios.get(
      "http://localhost:3000/api/products/test-document",
      {
        timeout: 10000,
      }
    );

    console.log("✅ Test route SUCCESS!");
    console.log("📄 Response:", response.data);
  } catch (error) {
    console.log("❌ Test route FAILED!");
    console.log("⚠️  Error:", error.message);
  }
}

async function runTests() {
  await testRoute();
  await testDocumentAccess();
  process.exit(0);
}

runTests();
