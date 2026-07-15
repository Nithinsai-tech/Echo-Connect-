const mongoose = require('mongoose');

const MessageSchema = new mongoose.Schema(
  {
    roomId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'ChatRoom',
      required: [true, 'Room ID is required']
    },
    senderId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Sender ID is required']
    },
    content: {
      type: String,
      trim: true,
      default: ''
    },
    type: {
      type: String,
      enum: ['text', 'image', 'file', 'video'],
      default: 'text'
    },
    mediaUrl: {
      type: String,
      default: ''
    },
    status: {
      type: String,
      enum: ['sent', 'delivered', 'seen'],
      default: 'sent'
    },
    seenBy: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
      }
    ],
    deletedFor: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
      }
    ],
    isDeletedForEveryone: {
      type: Boolean,
      default: false
    }
  },
  {
    timestamps: true
  }
);

// Indexes: Optimize query paths
// 1. Compound index on roomId and createdAt (for cursor-based sorting/pagination)
MessageSchema.index({ roomId: 1, createdAt: 1 });

// 2. Index on senderId
MessageSchema.index({ senderId: 1 });

module.exports = mongoose.model('Message', MessageSchema);
