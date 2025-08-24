const asyncHandler = require("express-async-handler");
const Blog = require("../models/BlogModel");
const BlogCategory = require("../models/BlogCategoryModel");
const Products = require("../models/ProductsModel");
const Brand = require("../models/BrandModel");
const { getFromCache, setCache } = require("../utils/redisCache");
const {
  cloudinaryUploadImage,
  cloudinaryDeleteFile,
} = require("../utils/cloudinary");

// Utility function to generate slug
const generateSlug = (title) => {
  return title
    .toLowerCase()
    .replace(/[^\w\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .trim();
};

// Create a new blog
const createBlog = asyncHandler(async (req, res) => {
  try {
    console.log("🔍 Blog creation request received");
    console.log("📋 Request body:", JSON.stringify(req.body, null, 2));
    console.log("👤 User:", req.user ? req.user._id : "No user");

    const {
      title,
      excerpt,
      content,
      seo,
      featuredImage,
      gallery,
      category,
      tags,
      relatedProducts,
      relatedBrands,
      primaryProduct,
      primaryBrand,
      authorName,
      authorBio,
      authorImage,
      status,
      scheduledAt,
      primaryLanguage,
      availableLanguages,
      isFeatured,
      isSticky,
      allowComments,
    } = req.body;

    // Validate required fields
    if (!title || !title.en) {
      console.log("❌ Missing title.en");
      return res.status(400).json({
        success: false,
        message: "English title is required",
      });
    }

    if (!content || !content.en) {
      console.log("❌ Missing content.en");
      return res.status(400).json({
        success: false,
        message: "English content is required",
      });
    }

    if (!category) {
      console.log("❌ Missing category");
      return res.status(400).json({
        success: false,
        message: "Category is required",
      });
    }

    // Provide defaults for optional fields
    const blogData = {
      title: title,
      excerpt: excerpt || {
        en: title.en.substring(0, 150) + "...",
        ur: "",
        ps: "",
      },
      content: content,
      seo: seo || {},
      featuredImage: featuredImage || {
        url: "https://via.placeholder.com/800x400/1a1a1a/ffffff?text=Featured+Image",
        alt: { en: title.en, ur: "", ps: "" },
        caption: { en: "", ur: "", ps: "" },
      },
      gallery: gallery || [],
      category: category,
      tags: tags || [],
      relatedProducts: relatedProducts || [],
      relatedBrands: relatedBrands || [],
      primaryProduct: primaryProduct,
      primaryBrand: primaryBrand,
      author: req.user._id,
      authorName: authorName || req.user.name || "Admin",
      authorBio: authorBio,
      authorImage: authorImage,
      status: status || "draft",
      scheduledAt: scheduledAt,
      primaryLanguage: primaryLanguage || "en",
      availableLanguages: availableLanguages || ["en"],
      isFeatured: isFeatured || false,
      isSticky: isSticky || false,
      allowComments: allowComments !== false, // Default to true
    };

    // Generate slug from English title
    const slug = generateSlug(blogData.title.en);
    blogData.slug = slug;

    // Check if slug already exists
    const existingBlog = await Blog.findOne({ slug });
    if (existingBlog) {
      return res.status(400).json({
        success: false,
        message: "Blog with this title already exists",
      });
    }

    // Validate category
    const blogCategory = await BlogCategory.findById(blogData.category);
    if (!blogCategory) {
      return res.status(400).json({
        success: false,
        message: "Invalid blog category",
      });
    }

    // Validate related products and brands if provided
    if (blogData.relatedProducts?.length) {
      const validProducts = await Products.find({
        _id: { $in: blogData.relatedProducts },
      });
      if (validProducts.length !== blogData.relatedProducts.length) {
        return res.status(400).json({
          success: false,
          message: "Some related products are invalid",
        });
      }
    }

    if (blogData.relatedBrands?.length) {
      const validBrands = await Brand.find({
        _id: { $in: blogData.relatedBrands },
      });
      if (validBrands.length !== blogData.relatedBrands.length) {
        return res.status(400).json({
          success: false,
          message: "Some related brands are invalid",
        });
      }
    }

    const blog = new Blog(blogData);

    const savedBlog = await blog.save();

    // Update category blog count
    await blogCategory.updateBlogCount();

    // Add blog reference to related products
    if (blogData.relatedProducts?.length) {
      await Products.updateMany(
        { _id: { $in: blogData.relatedProducts } },
        { $addToSet: { relatedBlogs: savedBlog._id } }
      );
    }

    // Add blog reference to related brands
    if (blogData.relatedBrands?.length) {
      await Brand.updateMany(
        { _id: { $in: blogData.relatedBrands } },
        { $addToSet: { relatedBlogs: savedBlog._id } }
      );
    }

    // Clear all blog-related cache
    await Promise.all([
      setCache("blogs:all", null, 0),
      setCache(
        `blogs:${JSON.stringify({
          isActive: true,
          status: "all",
        })}:1:12:publishedAt:desc:en`,
        null,
        0
      ),
      setCache(
        `blogs:${JSON.stringify({
          isActive: true,
          status: "published",
        })}:1:12:publishedAt:desc:en`,
        null,
        0
      ),
      setCache("blogs:featured", null, 0),
    ]);

    res.status(201).json({
      success: true,
      message: "Blog created successfully",
      blog: savedBlog,
    });
  } catch (error) {
    console.error("❌ Blog creation error:", error);
    console.error("📋 Error details:", {
      message: error.message,
      stack: error.stack,
      body: req.body,
    });
    throw error;
  }
});

// Get all blogs with filters and pagination
const getAllBlogs = asyncHandler(async (req, res) => {
  const {
    page = 1,
    limit = 12,
    category,
    author,
    status = "published",
    language = "en",
    featured,
    search,
    sortBy = "publishedAt",
    sortOrder = "desc",
  } = req.query;

  const skip = (parseInt(page) - 1) * parseInt(limit);

  // Build query
  const query = { isActive: true };

  if (status && status !== "all") query.status = status;
  if (category) query.category = category;
  if (author) query.author = author;
  if (featured !== undefined) query.isFeatured = featured === "true";

  // Search functionality
  if (search) {
    query.$text = { $search: search };
  }

  // Cache key
  const cacheKey = `blogs:${JSON.stringify(
    query
  )}:${page}:${limit}:${sortBy}:${sortOrder}:${language}`;

  // Skip cache for admin requests (status=all)
  if (status !== "all") {
    // Check cache
    const cached = await getFromCache(cacheKey);
    if (cached) {
      return res.json(cached);
    }
  }

  // Sort configuration
  const sortConfig = {};
  if (sortBy === "publishedAt") {
    sortConfig.publishedAt = sortOrder === "desc" ? -1 : 1;
  } else if (sortBy === "viewCount") {
    sortConfig.viewCount = sortOrder === "desc" ? -1 : 1;
  } else if (sortBy === "title") {
    sortConfig[`title.${language}`] = sortOrder === "desc" ? -1 : 1;
  } else {
    sortConfig.createdAt = -1;
  }

  const [blogs, total] = await Promise.all([
    Blog.find(query)
      .populate("category", "name slug")
      .populate("author", "name email")
      .populate("relatedProducts", "name slug images price")
      .populate("relatedBrands", "name slug logo")
      .select(
        status === "all"
          ? "" // Return all fields for admin
          : `
        title.${language} 
        title.en 
        excerpt.${language} 
        excerpt.en 
        slug 
        featuredImage 
        category 
        author 
        authorName 
        authorImage 
        publishedAt 
        readingTime 
        viewCount 
        likes 
        isFeatured 
        isSticky 
        tags
      `
      )
      .sort(sortConfig)
      .skip(skip)
      .limit(parseInt(limit))
      .lean(),
    Blog.countDocuments(query),
  ]);

  const result = {
    success: true,
    blogs,
    pagination: {
      page: parseInt(page),
      limit: parseInt(limit),
      total,
      pages: Math.ceil(total / parseInt(limit)),
      hasNext: parseInt(page) * parseInt(limit) < total,
      hasPrev: parseInt(page) > 1,
    },
  };

  // Only cache public requests, not admin requests
  if (status !== "all") {
    // Cache for 5 minutes
    await setCache(cacheKey, result, 300);
  }

  res.json(result);
});

// Get single blog by slug
const getBlogBySlug = asyncHandler(async (req, res) => {
  const { slug } = req.params;
  const { language = "en" } = req.query;

  // Check cache first
  const cacheKey = `blog:${slug}:${language}`;
  const cached = await getFromCache(cacheKey);
  if (cached) {
    return res.json(cached);
  }

  const blog = await Blog.findOne({ slug, isActive: true })
    .populate("category", "name slug")
    .populate("author", "name email avatar")
    .populate(
      "relatedProducts",
      "name slug images price originalPrice discountPercentage brand"
    )
    .populate("relatedBrands", "name slug logo description")
    .populate(
      "primaryProduct",
      "name slug images price originalPrice discountPercentage"
    )
    .populate("primaryBrand", "name slug logo description");

  if (!blog) {
    return res.status(404).json({
      success: false,
      message: "Blog not found",
    });
  }

  // Increment view count
  blog.viewCount += 1;
  await blog.save();

  // Get related blogs from same category
  const relatedBlogs = await Blog.find({
    category: blog.category._id,
    _id: { $ne: blog._id },
    status: "published",
    isActive: true,
  })
    .select(
      `title.${language} title.en excerpt.${language} excerpt.en slug featuredImage publishedAt readingTime`
    )
    .sort({ publishedAt: -1 })
    .limit(4)
    .lean();

  const result = {
    success: true,
    blog,
    relatedBlogs,
  };

  // Cache for 10 minutes
  await setCache(cacheKey, result, 600);

  res.json(result);
});

// Update blog
const updateBlog = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const updateData = req.body;

  const blog = await Blog.findById(id);
  if (!blog) {
    return res.status(404).json({
      success: false,
      message: "Blog not found",
    });
  }

  // If title is updated, regenerate slug
  if (updateData.title?.en && updateData.title.en !== blog.title.en) {
    const newSlug = generateSlug(updateData.title.en);
    const existingBlog = await Blog.findOne({
      slug: newSlug,
      _id: { $ne: id },
    });
    if (existingBlog) {
      return res.status(400).json({
        success: false,
        message: "Blog with this title already exists",
      });
    }
    updateData.slug = newSlug;
  }

  // Handle product/brand relations
  if (updateData.relatedProducts) {
    // Remove blog from old products
    await Products.updateMany(
      { relatedBlogs: blog._id },
      { $pull: { relatedBlogs: blog._id } }
    );
    // Add blog to new products
    if (updateData.relatedProducts.length) {
      await Products.updateMany(
        { _id: { $in: updateData.relatedProducts } },
        { $addToSet: { relatedBlogs: blog._id } }
      );
    }
  }

  if (updateData.relatedBrands) {
    // Remove blog from old brands
    await Brand.updateMany(
      { relatedBlogs: blog._id },
      { $pull: { relatedBlogs: blog._id } }
    );
    // Add blog to new brands
    if (updateData.relatedBrands.length) {
      await Brand.updateMany(
        { _id: { $in: updateData.relatedBrands } },
        { $addToSet: { relatedBlogs: blog._id } }
      );
    }
  }

  const updatedBlog = await Blog.findByIdAndUpdate(id, updateData, {
    new: true,
    runValidators: true,
  });

  // Clear all blog-related cache
  await Promise.all([
    setCache("blogs:all", null, 0),
    setCache(
      `blogs:${JSON.stringify({
        isActive: true,
        status: "all",
      })}:1:12:publishedAt:desc:en`,
      null,
      0
    ),
    setCache(
      `blogs:${JSON.stringify({
        isActive: true,
        status: "published",
      })}:1:12:publishedAt:desc:en`,
      null,
      0
    ),
    setCache("blogs:featured", null, 0),
    setCache(`blog:${blog.slug}`, null, 0),
    setCache(`blog:${updatedBlog.slug}`, null, 0),
  ]);

  res.json({
    success: true,
    message: "Blog updated successfully",
    blog: updatedBlog,
  });
});

// Delete blog
const deleteBlog = asyncHandler(async (req, res) => {
  const { id } = req.params;

  const blog = await Blog.findById(id);
  if (!blog) {
    return res.status(404).json({
      success: false,
      message: "Blog not found",
    });
  }

  // Remove blog references from products and brands
  await Products.updateMany(
    { relatedBlogs: blog._id },
    { $pull: { relatedBlogs: blog._id } }
  );

  await Brand.updateMany(
    { relatedBlogs: blog._id },
    { $pull: { relatedBlogs: blog._id } }
  );

  // Update category blog count
  const category = await BlogCategory.findById(blog.category);
  if (category) {
    await category.updateBlogCount();
  }

  await Blog.findByIdAndDelete(id);

  // Clear all blog-related cache
  await Promise.all([
    setCache("blogs:all", null, 0),
    setCache(
      `blogs:${JSON.stringify({
        isActive: true,
        status: "all",
      })}:1:12:publishedAt:desc:en`,
      null,
      0
    ),
    setCache(
      `blogs:${JSON.stringify({
        isActive: true,
        status: "published",
      })}:1:12:publishedAt:desc:en`,
      null,
      0
    ),
    setCache("blogs:featured", null, 0),
    setCache(`blog:${blog.slug}`, null, 0),
  ]);

  res.json({
    success: true,
    message: "Blog deleted successfully",
  });
});

// Get featured blogs
const getFeaturedBlogs = asyncHandler(async (req, res) => {
  const { limit = 6, language = "en" } = req.query;

  const cacheKey = `blogs:featured:${limit}:${language}`;
  const cached = await getFromCache(cacheKey);
  if (cached) {
    return res.json(cached);
  }

  const blogs = await Blog.find({
    isFeatured: true,
    status: "published",
    isActive: true,
  })
    .populate("category", "name slug")
    .populate("author", "name")
    .select(
      `title.${language} title.en excerpt.${language} excerpt.en slug featuredImage publishedAt readingTime viewCount`
    )
    .sort({ priority: -1, publishedAt: -1 })
    .limit(parseInt(limit))
    .lean();

  const result = {
    success: true,
    blogs,
  };

  // Cache for 15 minutes
  await setCache(cacheKey, result, 900);

  res.json(result);
});

// Get blogs by category
const getBlogsByCategory = asyncHandler(async (req, res) => {
  const { slug } = req.params;
  const {
    page = 1,
    limit = 12,
    language = "en",
    sortBy = "publishedAt",
    sortOrder = "desc",
  } = req.query;

  const category = await BlogCategory.findOne({ slug, isActive: true });
  if (!category) {
    return res.status(404).json({
      success: false,
      message: "Category not found",
    });
  }

  const skip = (parseInt(page) - 1) * parseInt(limit);

  const cacheKey = `blogs:category:${slug}:${page}:${limit}:${language}:${sortBy}:${sortOrder}`;
  const cached = await getFromCache(cacheKey);
  if (cached) {
    return res.json(cached);
  }

  const sortConfig = {};
  if (sortBy === "publishedAt") {
    sortConfig.publishedAt = sortOrder === "desc" ? -1 : 1;
  } else if (sortBy === "viewCount") {
    sortConfig.viewCount = sortOrder === "desc" ? -1 : 1;
  } else {
    sortConfig.createdAt = -1;
  }

  const [blogs, total] = await Promise.all([
    Blog.find({
      category: category._id,
      status: "published",
      isActive: true,
    })
      .populate("category", "name slug")
      .populate("author", "name")
      .select(
        `title.${language} title.en excerpt.${language} excerpt.en slug featuredImage publishedAt readingTime viewCount`
      )
      .sort(sortConfig)
      .skip(skip)
      .limit(parseInt(limit))
      .lean(),
    Blog.countDocuments({
      category: category._id,
      status: "published",
      isActive: true,
    }),
  ]);

  const result = {
    success: true,
    category,
    blogs,
    pagination: {
      page: parseInt(page),
      limit: parseInt(limit),
      total,
      pages: Math.ceil(total / parseInt(limit)),
      hasNext: parseInt(page) * parseInt(limit) < total,
      hasPrev: parseInt(page) > 1,
    },
  };

  // Cache for 10 minutes
  await setCache(cacheKey, result, 600);

  res.json(result);
});

// Search blogs
const searchBlogs = asyncHandler(async (req, res) => {
  const { q, page = 1, limit = 12, language = "en" } = req.query;

  if (!q) {
    return res.status(400).json({
      success: false,
      message: "Search query is required",
    });
  }

  const skip = (parseInt(page) - 1) * parseInt(limit);

  const [blogs, total] = await Promise.all([
    Blog.find({
      $text: { $search: q },
      status: "published",
      isActive: true,
    })
      .populate("category", "name slug")
      .populate("author", "name")
      .select(
        `title.${language} title.en excerpt.${language} excerpt.en slug featuredImage publishedAt readingTime`
      )
      .sort({ score: { $meta: "textScore" } })
      .skip(skip)
      .limit(parseInt(limit))
      .lean(),
    Blog.countDocuments({
      $text: { $search: q },
      status: "published",
      isActive: true,
    }),
  ]);

  res.json({
    success: true,
    query: q,
    blogs,
    pagination: {
      page: parseInt(page),
      limit: parseInt(limit),
      total,
      pages: Math.ceil(total / parseInt(limit)),
      hasNext: parseInt(page) * parseInt(limit) < total,
      hasPrev: parseInt(page) > 1,
    },
  });
});

// Add comment to blog
const addComment = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { name, email, content, language = "en" } = req.body;

  const blog = await Blog.findById(id);
  if (!blog) {
    return res.status(404).json({
      success: false,
      message: "Blog not found",
    });
  }

  if (!blog.allowComments) {
    return res.status(400).json({
      success: false,
      message: "Comments are disabled for this blog",
    });
  }

  const comment = {
    user: req.user?._id,
    name,
    email,
    content,
    language,
    status: "pending", // Admin approval required
  };

  blog.comments.push(comment);
  await blog.save();

  res.json({
    success: true,
    message: "Comment added successfully and is pending approval",
    comment,
  });
});

// Get blog analytics (Admin only)
const getBlogAnalytics = asyncHandler(async (req, res) => {
  const { period = "30" } = req.query;
  const days = parseInt(period);
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);

  const analytics = await Blog.aggregate([
    {
      $match: {
        createdAt: { $gte: startDate },
        isActive: true,
      },
    },
    {
      $group: {
        _id: null,
        totalBlogs: { $sum: 1 },
        publishedBlogs: {
          $sum: { $cond: [{ $eq: ["$status", "published"] }, 1, 0] },
        },
        draftBlogs: {
          $sum: { $cond: [{ $eq: ["$status", "draft"] }, 1, 0] },
        },
        totalViews: { $sum: "$viewCount" },
        totalLikes: { $sum: "$likes" },
        averageReadingTime: { $avg: "$readingTime" },
      },
    },
  ]);

  const topBlogs = await Blog.find({ isActive: true })
    .select("title slug viewCount likes publishedAt")
    .sort({ viewCount: -1 })
    .limit(10)
    .lean();

  const categoriesStats = await Blog.aggregate([
    {
      $match: { isActive: true, status: "published" },
    },
    {
      $group: {
        _id: "$category",
        count: { $sum: 1 },
        totalViews: { $sum: "$viewCount" },
      },
    },
    {
      $lookup: {
        from: "blogcategories",
        localField: "_id",
        foreignField: "_id",
        as: "category",
      },
    },
    {
      $unwind: "$category",
    },
    {
      $project: {
        name: "$category.name.en",
        slug: "$category.slug",
        count: 1,
        totalViews: 1,
      },
    },
    {
      $sort: { count: -1 },
    },
  ]);

  res.json({
    success: true,
    analytics: analytics[0] || {},
    topBlogs,
    categoriesStats,
  });
});

// Upload blog thumbnail
const uploadBlogThumbnail = asyncHandler(async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: "No image file provided",
      });
    }

    console.log("📷 Uploading blog thumbnail:", {
      filename: req.file.filename,
      mimetype: req.file.mimetype,
      size: req.file.size,
    });

    // Upload to Cloudinary
    const uploadResult = await cloudinaryUploadImage(
      req.file.path,
      "blog-thumbnails",
      "image"
    );

    // Clean up local file
    const fs = require("fs");
    if (fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }

    res.json({
      success: true,
      message: "Thumbnail uploaded successfully",
      image: {
        url: uploadResult.url,
        public_id: uploadResult.public_id,
      },
    });
  } catch (error) {
    console.error("❌ Thumbnail upload error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to upload thumbnail",
      error: error.message,
    });
  }
});

// Upload blog content images
const uploadBlogContentImage = asyncHandler(async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: "No image file provided",
      });
    }

    console.log("📸 Uploading blog content image:", {
      filename: req.file.filename,
      mimetype: req.file.mimetype,
      size: req.file.size,
    });

    // Upload to Cloudinary
    const uploadResult = await cloudinaryUploadImage(
      req.file.path,
      "blog-content",
      "image"
    );

    // Clean up local file
    const fs = require("fs");
    if (fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }

    res.json({
      success: true,
      message: "Content image uploaded successfully",
      image: {
        url: uploadResult.url,
        public_id: uploadResult.public_id,
        markdown: `![Alt text](${uploadResult.url})`,
      },
    });
  } catch (error) {
    console.error("❌ Content image upload error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to upload content image",
      error: error.message,
    });
  }
});

module.exports = {
  createBlog,
  getAllBlogs,
  getBlogBySlug,
  updateBlog,
  deleteBlog,
  getFeaturedBlogs,
  getBlogsByCategory,
  searchBlogs,
  addComment,
  getBlogAnalytics,
  uploadBlogThumbnail,
  uploadBlogContentImage,
};
