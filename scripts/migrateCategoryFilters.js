/*
  Migration script: populate product.categoryFilters from existing specification fields
  Usage:
    node migrateCategoryFilters.js        # dry-run, prints report
    node migrateCategoryFilters.js --apply  # apply changes (will update products)
*/

const path = require('path');
const mongoose = require('mongoose');
const Products = require('../models/ProductsModel');
const Category = require('../models/CategoryModel');
const categoryFilters = require('../utils/categoryFilters');
// Load backend .env explicitly so script works when run from repo root
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

function parseArg(name) {
  const full = process.argv.find((a) => a.startsWith(`${name}=`));
  if (full) return full.split('=')[1];
  const idx = process.argv.indexOf(name);
  if (idx >= 0 && process.argv[idx + 1]) return process.argv[idx + 1];
  return undefined;
}

async function connect() {
  const cliMongo = parseArg('--mongo') || parseArg('--MONGO_URI');
  const mongoUri = process.env.MONGODB_URI || cliMongo;
  if (!mongoUri) {
    console.error('MONGODB_URI missing in env and no --mongo provided.');
    console.error('Use: MONGODB_URI="<uri>" node migrateCategoryFilters.js --dry-run');
    console.error('Or: node migrateCategoryFilters.js --mongo "<uri>" --dry-run');
    process.exit(1);
  }

  const dbName = parseArg('--db') || process.env.MONGODB_DB || undefined;
  const connectOpts = dbName ? { dbName } : {};
  await mongoose.connect(mongoUri, connectOpts);
}

function extractCategoryFiltersFromSpecs(product) {
  // Heuristic: look for specification groups/items that match known categoryFilters keys
  // We'll copy simple exact name/value pairs and boolean-like "Yes"/"No" into categoryFilters
  const out = {};
  if (!product.specifications || !Array.isArray(product.specifications)) return out;
  product.specifications.forEach(group => {
    if (!group || !Array.isArray(group.items)) return;
    group.items.forEach(item => {
      if (!item || !item.name) return;
      const key = item.name.trim();
      const val = item.value;
      if (val === undefined || val === null || String(val).trim() === '') return;

      // Normalize booleans
      if (typeof val === 'string') {
        const low = val.toLowerCase();
        if (low === 'yes' || low === 'true') {
          out[key] = true; return;
        }
        if (low === 'no' || low === 'false') {
          out[key] = false; return;
        }
      }

      // Numeric-looking values -> number
      if (typeof val === 'string' && /^\d+(?:\.\d+)?$/.test(val.replace(/,/g, ''))) {
        out[key] = Number(val.replace(/,/g, ''));
        return;
      }

      // Fallback: store raw value
      out[key] = val;
    });
  });

  return out;
}

function inferFromNameTags(product, resolvedFiltersDef) {
  const out = {};
  const name = (product.name || '').toString().toLowerCase();
  const slug = (product.slug || '').toString().toLowerCase();
  const tags = Array.isArray(product.tags) ? product.tags.map(t => t.toString().toLowerCase()) : [];

  resolvedFiltersDef.forEach((def) => {
    const field = def.field;
    if (!field) return;
    const keyLower = field.toString().toLowerCase();

    // For boolean filters: look for the label in name/slug/tags or spec values
    if (def.type === 'boolean') {
      if (name.includes(keyLower) || slug.includes(keyLower) || tags.includes(keyLower)) {
        out[field] = true;
        return;
      }
      // Also check specifications values for exact match
      if (Array.isArray(product.specifications)) {
        for (const g of product.specifications) {
          if (!g || !Array.isArray(g.items)) continue;
          for (const it of g.items) {
            if (!it || it.value === undefined || it.value === null) continue;
            const valStr = String(it.value).toLowerCase();
            if (valStr === keyLower || valStr.includes(keyLower)) {
              out[field] = true;
              return;
            }
          }
        }
      }
    }
    // For select fields: try to match an option value inside specs or name/slug
    if (def.type === 'select' && Array.isArray(def.options)) {
      for (const opt of def.options) {
        const optLower = String(opt).toLowerCase();
        if (name.includes(optLower) || slug.includes(optLower) || tags.includes(optLower)) {
          out[field] = opt;
          return;
        }
        if (Array.isArray(product.specifications)) {
          for (const g of product.specifications) {
            if (!g || !Array.isArray(g.items)) continue;
            for (const it of g.items) {
              if (!it || it.value === undefined || it.value === null) continue;
              const valStr = String(it.value).toLowerCase();
              if (valStr === optLower || valStr.includes(optLower)) {
                out[field] = opt;
                return;
              }
            }
          }
        }
      }
    }
  });

  return out;
}

async function run() {
  await connect();
  const apply = process.argv.includes('--apply');
  const sampleOnly = process.argv.includes('--sample');
  console.log('Migration: populate categoryFilters for products (apply=', apply, ', sampleOnly=', sampleOnly, ')');

  const total = await Products.countDocuments({});
  console.log('Total products:', total);

  const cursor = Products.find({}).cursor();
  let changed = 0;
  let processed = 0;

  for (let doc = await cursor.next(); doc != null; doc = await cursor.next()) {
    processed++;
    const existing = doc.categoryFilters || {};
    const inferred = extractCategoryFiltersFromSpecs(doc) || {};

    // Resolve category filters definition for this product's category
    let catKey = undefined;
    try {
      if (doc.category) {
        // doc.category may be an ObjectId or populated object
        const maybeCat = await Category.findById(doc.category).lean();
        if (maybeCat && maybeCat.slug) catKey = maybeCat.slug;
      }
    } catch (e) {
      // ignore
    }
    const resolvedDef = categoryFilters[catKey] || categoryFilters['default'] || [];

    // Infer more values from name/slug/tags/specifications using filter definitions
    const inferredFromName = inferFromNameTags(doc, resolvedDef);
    Object.assign(inferred, inferredFromName);

    // If there are keys that are missing in existing but present in inferred -> candidate
    const missingKeys = Object.keys(inferred).filter(k => existing[k] === undefined);
    if (missingKeys.length === 0) continue;

    console.log(`Product ${doc._id} (${doc.slug}) missing ${missingKeys.length} categoryFilters keys`);
    console.log('  sample keys:', missingKeys.slice(0, 5));
    // show a small sample of inferred values for review
    missingKeys.slice(0, 5).forEach((k) => {
      console.log('    ->', k, ':', JSON.stringify(inferred[k]));
    });

    if (sampleOnly) {
      // if sampleOnly, just show the first N products and exit
      console.log('Sample mode enabled; exiting after first sample');
      break;
    }

    if (apply) {
      const updated = { ...existing };
      missingKeys.forEach((k) => {
        updated[k] = inferred[k];
      });
      await Products.updateOne({ _id: doc._id }, { $set: { categoryFilters: updated } });
      console.log(`  Applied update for ${doc._id}`);
      changed++;
    } else {
      // dry-run: accumulate counts only, no writes
    }
  }

  console.log('Processed', processed, 'products. Changed:', changed);
  process.exit(0);
}

run().catch(err => {
  console.error(err);
  process.exit(2);
});
