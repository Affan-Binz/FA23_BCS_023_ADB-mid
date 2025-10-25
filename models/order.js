const mongoose = require('mongoose');

const OrderItemSchema = new mongoose.Schema({
  product: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true },
  quantity: { type: Number, required: true, min: 1 },
  price: { type: Number, required: true }
});

const OrderSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  items: [OrderItemSchema],
  totalCost: { type: Number, required: true },
}, { timestamps: true });

OrderSchema.index({ createdAt: -1 });

module.exports = mongoose.model('Order', OrderSchema);

