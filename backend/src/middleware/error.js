const errorHandler = (err, req, res, next) => {
  let error = { ...err };
  error.message = err.message;

  // Log to console for developer investigation
  console.error('Captured Error stack:', err.stack || err);

  // Mongoose Bad ObjectId (CastError)
  if (err.name === 'CastError') {
    const message = `Resource not found with id of ${err.value}`;
    error = { status: 404, message };
  }

  // Mongoose Duplicate Key Error (MongoServerError code 11000)
  if (err.code === 11000) {
    const message = 'Duplicate field value entered';
    error = { status: 400, message };
  }

  // Mongoose Validation Error
  if (err.name === 'ValidationError') {
    const message = Object.values(err.errors).map(val => val.message).join(', ');
    error = { status: 400, message };
  }

  // JsonWebTokenError
  if (err.name === 'JsonWebTokenError') {
    error = { status: 401, message: 'Invalid token, authorization denied' };
  }

  // TokenExpiredError
  if (err.name === 'TokenExpiredError') {
    error = { status: 401, message: 'Session token has expired' };
  }

  // Send JSON response
  res.status(error.status || 500).json({
    success: false,
    message: error.message || 'Internal Server Error'
  });
};

module.exports = errorHandler;
