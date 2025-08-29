const mongoose = require("mongoose");
require("dotenv").config();

async function setupBlogsForTesting() {
  try {
    // Connect to MongoDB
    const connection = await mongoose.connect(process.env.MONGODB_URI);
    console.log("✅ Connected to MongoDB");

    const Blog = require("./models/BlogModel");
    const BlogCategory = require("./models/BlogCategoryModel");

    // Check existing blogs
    const existingBlogs = await Blog.find({});
    console.log(`📄 Found ${existingBlogs.length} existing blogs`);

    if (existingBlogs.length > 0) {
      // Update all blogs to published status
      const result = await Blog.updateMany(
        { status: { $ne: "published" } },
        {
          status: "published",
          publishedAt: new Date(),
          isFeatured: true, // Make them featured for testing
        }
      );
      console.log(
        `✅ Updated ${result.modifiedCount} blogs to published status`
      );
    } else {
      // Create sample blogs if none exist
      console.log("📝 Creating sample blogs...");

      // First, get or create a category
      let category = await BlogCategory.findOne({});
      if (!category) {
        category = new BlogCategory({
          name: {
            en: "Solar Technology",
            ur: "سولر ٹیکنالوجی",
            ps: "د لمر ټیکنالوژۍ",
          },
          slug: "solar-technology",
          description: { en: "Latest in solar technology", ur: "", ps: "" },
          isActive: true,
        });
        await category.save();
        console.log("✅ Created sample category");
      }

      // Create sample blogs
      const sampleBlogs = [
        {
          title: {
            en: "The Future of Solar Energy",
            ur: "سولر انرجی کا مستقبل",
            ps: "د لمرۍ انرژۍ راتلونکې",
          },
          slug: "future-of-solar-energy",
          excerpt: {
            en: "Discover how solar energy is revolutionizing the way we power our homes and businesses.",
            ur: "دریافت کریں کہ سولر انرجی کیسے ہمارے گھروں اور کاروباروں کو طاقت دینے کے طریقے میں انقلاب لا رہی ہے۔",
            ps: "وموندئ چې سولر انرژي څنګه زموږ د کورونو او سوداګرۍ ځواکولو لاره بدلوي.",
          },
          content: {
            en: `# The Future of Solar Energy

Solar energy represents one of the most promising renewable energy sources available today. As technology continues to advance, we're seeing remarkable improvements in efficiency, affordability, and accessibility.

## Key Benefits

- **Environmental Impact**: Solar energy produces clean, renewable power without harmful emissions
- **Cost Savings**: Reduced electricity bills and long-term savings
- **Energy Independence**: Less reliance on traditional power grids
- **Low Maintenance**: Solar panels require minimal upkeep

## Recent Innovations

The solar industry has seen tremendous growth with new technologies like:

1. **Advanced Photovoltaic Cells**: Higher efficiency rates than ever before
2. **Smart Inverters**: Better energy management and grid integration
3. **Energy Storage**: Improved battery technology for 24/7 power
4. **IoT Integration**: Smart monitoring and maintenance systems

## Conclusion

The future of solar energy looks brighter than ever. With continued innovation and growing adoption, solar power is set to play a crucial role in our sustainable energy future.`,
            ur: "",
            ps: "",
          },
          featuredImage: {
            url: "https://images.unsplash.com/photo-1509391366360-2e959784a276?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&q=80",
            alt: { en: "Solar panels in a field", ur: "", ps: "" },
          },
          category: category._id,
          status: "published",
          publishedAt: new Date(),
          isFeatured: true,
          isSticky: false,
          allowComments: true,
          authorName: "Solar Expert",
          readingTime: 5,
          viewCount: 120,
        },
        {
          title: {
            en: "Solar Panel Installation Guide",
            ur: "سولر پینل انسٹالیشن گائیڈ",
            ps: "د سولر پینل د نصبولو لارښود",
          },
          slug: "solar-panel-installation-guide",
          excerpt: {
            en: "A comprehensive guide to installing solar panels for your home or business.",
            ur: "آپ کے گھر یا کاروبار کے لیے سولر پینل لگانے کی مکمل گائیڈ۔",
            ps: "ستاسو د کور یا سوداګرۍ لپاره د سولر پینل د نصبولو بشپړ لارښود.",
          },
          content: {
            en: `# Solar Panel Installation Guide

Installing solar panels is a significant investment that can provide long-term benefits. This guide will walk you through the essential steps and considerations.

## Before You Start

### Site Assessment
- **Roof Condition**: Ensure your roof is in good condition
- **Sun Exposure**: Assess daily sunlight hours
- **Shading**: Identify potential obstacles
- **Structural Integrity**: Verify roof can support panel weight

### Legal Requirements
- Check local building codes
- Obtain necessary permits
- Review HOA restrictions if applicable
- Contact utility company for grid-tie requirements

## Installation Process

### Step 1: Planning and Design
Create a detailed layout plan showing:
- Panel placement
- Wiring routes
- Inverter location
- Electrical connections

### Step 2: Equipment and Tools
Essential equipment includes:
- Solar panels
- Mounting rails and hardware
- Inverters
- DC and AC disconnect switches
- Monitoring system

### Step 3: Professional Installation
While DIY installation is possible, we recommend professional installation for:
- Safety compliance
- Warranty protection
- Proper electrical connections
- System optimization

## Maintenance Tips

- Regular cleaning
- Performance monitoring
- Annual inspections
- Prompt repairs

## Conclusion

Proper installation ensures maximum efficiency and longevity of your solar system. Consider working with certified professionals for best results.`,
            ur: "",
            ps: "",
          },
          featuredImage: {
            url: "https://images.unsplash.com/photo-1497440001374-f26997328c1b?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&q=80",
            alt: { en: "Solar panel installation on roof", ur: "", ps: "" },
          },
          category: category._id,
          status: "published",
          publishedAt: new Date(Date.now() - 24 * 60 * 60 * 1000), // Yesterday
          isFeatured: true,
          isSticky: false,
          allowComments: true,
          authorName: "Installation Expert",
          readingTime: 8,
          viewCount: 89,
        },
        {
          title: {
            en: "Benefits of Solar Energy for Businesses",
            ur: "کاروباروں کے لیے سولر انرجی کے فوائد",
            ps: "د سوداګرۍ لپاره د سولر انرژۍ ګټې",
          },
          slug: "benefits-solar-energy-businesses",
          excerpt: {
            en: "Discover how solar energy can reduce costs and improve sustainability for your business.",
            ur: "دریافت کریں کہ سولر انرجی آپ کے کاروبار کے لیے اخراجات کیسے کم کر سکتی ہے اور پائیداری کو بہتر بنا سکتی ہے۔",
            ps: "وموندئ چې سولر انرژي څنګه کولی شي ستاسو د سوداګرۍ لپاره لګښتونه کم کړي او پایښت ښه کړي.",
          },
          content: {
            en: `# Benefits of Solar Energy for Businesses

In today's competitive business environment, companies are constantly looking for ways to reduce costs and improve their environmental footprint. Solar energy offers an excellent solution that addresses both concerns.

## Financial Benefits

### Cost Reduction
- Significantly lower electricity bills
- Predictable energy costs
- Protection against rising utility rates
- Potential revenue from excess energy

### Tax Incentives
- Federal tax credits
- State and local incentives
- Accelerated depreciation benefits
- Grants and rebates

### Return on Investment
Most commercial solar installations pay for themselves within 5-7 years and continue providing savings for 25+ years.

## Environmental Impact

### Carbon Footprint Reduction
- Zero emissions during operation
- Significant reduction in greenhouse gases
- Contribution to sustainability goals
- Enhanced corporate social responsibility

### Brand Enhancement
- Positive public image
- Attraction of environmentally conscious customers
- Employee satisfaction and pride
- Marketing advantages

## Operational Benefits

### Energy Independence
- Reduced reliance on the grid
- Protection against power outages (with battery storage)
- Energy security and reliability
- Scalable solutions

### Low Maintenance
- Minimal ongoing costs
- Long-term reliability (25+ year warranties)
- Remote monitoring capabilities
- Professional maintenance services available

## Industry Applications

Solar energy works well for various business types:
- Manufacturing facilities
- Retail stores
- Office buildings
- Warehouses
- Agricultural operations
- Healthcare facilities

## Getting Started

### Assessment Phase
1. Energy audit
2. Site evaluation
3. Financial analysis
4. Proposal review

### Implementation
1. System design
2. Permit acquisition
3. Professional installation
4. Grid connection
5. System commissioning

## Conclusion

Solar energy represents a smart business investment that delivers both financial returns and environmental benefits. With various financing options available, there's never been a better time to make the switch to solar.`,
            ur: "",
            ps: "",
          },
          featuredImage: {
            url: "https://images.unsplash.com/photo-1466611653911-95081537e5b7?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&q=80",
            alt: {
              en: "Commercial solar installation on business building",
              ur: "",
              ps: "",
            },
          },
          category: category._id,
          status: "published",
          publishedAt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000), // Last week
          isFeatured: false,
          isSticky: false,
          allowComments: true,
          authorName: "Business Consultant",
          readingTime: 7,
          viewCount: 156,
        },
      ];

      for (const blogData of sampleBlogs) {
        const blog = new Blog(blogData);
        await blog.save();
        console.log(`✅ Created blog: ${blogData.title.en}`);
      }
    }

    // List all blogs
    const allBlogs = await Blog.find({}).select(
      "title slug status publishedAt isFeatured"
    );
    console.log("\n📋 Current blogs:");
    allBlogs.forEach((blog) => {
      console.log(
        `- ${blog.title?.en || "No title"} (${blog.slug}) - Status: ${
          blog.status
        } ${blog.isFeatured ? "⭐" : ""}`
      );
    });

    await mongoose.disconnect();
    console.log("\n✅ Done! Your blog should now display published articles.");
  } catch (error) {
    console.error("❌ Error:", error);
    process.exit(1);
  }
}

setupBlogsForTesting();
