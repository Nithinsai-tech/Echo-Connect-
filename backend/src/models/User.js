const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const UserSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Name is required'],
      trim: true,
      maxlength: [50, 'Name cannot exceed 50 characters']
    },
    email: {
      type: String,
      required: [true, 'Email is required'],
      unique: true,
      lowercase: true,
      trim: true,
      match: [/^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/, 'Please provide a valid email']
    },
    password: {
      type: String,
      required: false,
      minlength: [6, 'Password must be at least 6 characters'],
      select: false // Exclude from query results by default
    },
    googleId: {
      type: String,
      sparse: true
    },
    authProvider: {
      type: String,
      enum: ['local', 'google'],
      default: 'local'
    },
    avatar: {
      type: String,
      default: function () {
        return `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(this.name || 'default')}`;
      }
    },
    lastSeen: {
      type: Date,
      default: Date.now
    },
    refreshTokenHash: {
      type: String,
      default: null,
      select: false
    }
  },
  {
    timestamps: true
  }
);

// Hash password before saving
UserSchema.pre('save', async function (next) {
  if (!this.password || !this.isModified('password')) {
    return next();
  }
  try {
    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt);
    next();
  } catch (error) {
    next(error);
  }
});

// Compare password
UserSchema.methods.comparePassword = async function (enteredPassword) {
  return await bcrypt.compare(enteredPassword, this.password);
};

module.exports = mongoose.model('User', UserSchema);

