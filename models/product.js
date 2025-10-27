const mongoose = require('mongoose');

const ProductSchema = new mongoose.Schema({
  name: { type: String, required: true },
  description: { type: String },
  category: { type: String, index: true },
  price: { type: Number, required: true, index: true },
  brand: { type: String, index: true },
  rating: { type: Number, default: 0 },
  stock: { type: Number, default: 0 },
  purchaseCount: { type: Number, default: 0 },
}, { timestamps: true });


ProductSchema.index({ name: 'text', description: 'text' });

ProductSchema.index({ category: 1, price: 1 });
ProductSchema.index({ brand: 1, price: 1 });
ProductSchema.index({ purchaseCount: -1 });

module.exports = mongoose.model('Product', ProductSchema);
