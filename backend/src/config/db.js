const mongoose = require('mongoose');

const connectDB = async () => {
  try {
    const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/whatsapp_chat';
    
    // Mongoose connection options for production-ready configuration
    const options = {
      autoIndex: true, // Build indexes in development/production
    };

    mongoose.connection.on('connected', () => {
      console.log('Mongoose connected to MongoDB Atlas successfully.');
    });

    mongoose.connection.on('error', (err) => {
      console.error(`Mongoose connection error: ${err.message}`);
    });

    mongoose.connection.on('disconnected', () => {
      console.warn('Mongoose connection disconnected.');
    });

    await mongoose.connect(mongoUri, options);
  } catch (error) {
    console.error(`Failed to connect to MongoDB: ${error.message}`);
    process.exit(1);
  }
};

module.exports = connectDB;
