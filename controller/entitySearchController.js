const asyncHandler = require("express-async-handler");
const Analytics = require("../models/AnalyticsModel");
const Product = require("../models/ProductsModel");
const Brand = require("../models/BrandModel");

// Search entities with analytics data
const searchEntities = asyncHandler(async (req, res) => {
  const { search, type = "product" } = req.query;

  if (!search) {
    return res.json({ success: true, data: [] });
  }

  try {
    // Split search query into individual words and create regex for each
    const searchWords = search.trim().split(/\s+/).filter(word => word.length > 0);
    
    // If no valid words, return empty
    if (searchWords.length === 0) {
      return res.json({ success: true, data: [] });
    }

    // Create regex patterns for each word
    const wordRegexes = searchWords.map(word => 
      new RegExp(word.replace(/[-[\]{}()*+?.,\\^$|#\s]/g, "\\$&"), "i")
    );

    // Get the Model based on type
    const Model = type === "product" ? Product : Brand;

    // Build search conditions that require ALL words to match somewhere
    const searchConditions = wordRegexes.map(regex => ({
      $or: [
        { name: regex },
        { slug: regex },
        ...(type === "product"
          ? [
              { description: regex },
              { tags: regex },
              { "specifications.items.value": regex },
            ]
          : []),
      ],
    }));

    // Search in the respective collection requiring ALL words to match
    const results = await Model.find({
      $and: searchConditions
    })
      .select("name slug brand category")
      .populate("brand", "name")
      .populate("category", "name")
      .limit(10);

    // Get analytics data for these entities
    const entityIds = results.map((result) => result._id);
    const analyticsData = await Analytics.aggregate([
      {
        $match: {
          entityId: { $in: entityIds },
          entityType: type,
        },
      },
      {
        $group: {
          _id: "$entityId",
          totalViews: { $sum: "$metrics.views" },
        },
      },
    ]);

    // Merge results with analytics data
    const enrichedResults = results.map((result) => {
      const analytics = analyticsData.find(
        (a) => a._id.toString() === result._id.toString()
      );

      return {
        _id: result._id,
        name: result.name,
        slug: result.slug,
        brand: result.brand?.name,
        category: result.category?.name,
        viewCount: analytics?.totalViews || 0,
      };
    });

    // Sort by view count
    enrichedResults.sort((a, b) => b.viewCount - a.viewCount);

    res.json({
      success: true,
      data: enrichedResults,
    });
  } catch (error) {
    console.error("Search entities error:", error);
    res.status(500).json({
      success: false,
      message: "Error searching entities",
    });
  }
});

module.exports = {
  searchEntities,
};
