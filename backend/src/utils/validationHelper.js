const mongoose = require('mongoose');

const isValidObjectId = (id) => {
  return mongoose.Types.ObjectId.isValid(id);
};

const isValidEmail = (email) => {
  const emailRegex = /^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/;
  return emailRegex.test(email);
};

module.exports = {
  isValidObjectId,
  isValidEmail
};
