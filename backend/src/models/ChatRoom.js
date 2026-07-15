const mongoose = require('mongoose');

const ChatRoomSchema = new mongoose.Schema(
  {
    type: {
      type: String,
      enum: ['private', 'group'],
      required: [true, 'Chat room type is required']
    },
    participants: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
      }
    ],
    groupName: {
      type: String,
      trim: true,
      default: ''
    },
    groupAvatar: {
      type: String,
      default: ''
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    groupAdmin: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    status: {
      type: String,
      enum: ['pending', 'active'],
      default: 'active'
    },
    groupDescription: {
      type: String,
      default: ''
    },
    invitedMembers: [
      {
        user: {
          type: mongoose.Schema.Types.ObjectId,
          ref: 'User'
        },
        status: {
          type: String,
          enum: ['pending', 'accepted', 'rejected'],
          default: 'pending'
        }
      }
    ],
    lastMessage: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Message',
      default: null
    }
  },
  {
    timestamps: true
  }
);

// Indexes: Optimize user room lookup queries
ChatRoomSchema.index({ participants: 1 });
ChatRoomSchema.index({ type: 1 });

module.exports = mongoose.model('ChatRoom', ChatRoomSchema);
