const mongoose = require('mongoose');

const CallLogSchema = new mongoose.Schema(
  {
    caller: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    receiver: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    type: {
      type: String,
      enum: ['voice', 'video'],
      required: true
    },
    status: {
      type: String,
      enum: ['missed', 'incoming', 'outgoing', 'rejected', 'completed'],
      required: true
    },
    duration: {
      type: Number,
      default: 0 // Duration in seconds
    },
    roomId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'ChatRoom'
    }
  },
  {
    timestamps: true
  }
);

// Optimize query paths
CallLogSchema.index({ caller: 1 });
CallLogSchema.index({ receiver: 1 });
CallLogSchema.index({ createdAt: -1 });

module.exports = mongoose.model('CallLog', CallLogSchema);
