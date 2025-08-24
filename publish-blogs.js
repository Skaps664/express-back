const mongoose = require("mongoose");
require("dotenv").config({ path: "./config/config.env" });

async function publishBlogs() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log("Connected to MongoDB");

    const Blog = require("./models/BlogModel");

    // Update all draft blogs to published
    const result = await Blog.updateMany(
      { status: "draft" },
      {
        status: "published",
        publishedAt: new Date(),
      }
    );

    console.log(`Updated ${result.modifiedCount} blogs to published status`);

    // List all blogs
    const blogs = await Blog.find({}).select("title slug status publishedAt");
    console.log("\nCurrent blogs:");
    blogs.forEach((blog) => {
      console.log(
        `- ${blog.title?.en || "No title"} (${blog.slug}) - Status: ${
          blog.status
        }`
      );
    });

    await mongoose.disconnect();
    console.log("\nDone!");
  } catch (error) {
    console.error("Error:", error);
    process.exit(1);
  }
}

publishBlogs();
