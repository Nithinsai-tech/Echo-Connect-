const CallLog = require('../models/CallLog');

// @desc    Get user call history
// @route   GET /api/calls
// @access  Private
const getCallLogs = async (req, res, next) => {
  try {
    const userId = req.user._id;
    const logs = await CallLog.find({
      $or: [{ caller: userId }, { receiver: userId }]
    })
      .populate('caller', 'name email avatar')
      .populate('receiver', 'name email avatar')
      .sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      data: logs
    });
  } catch (error) {
    next(error);
  }
};

module.exports = { getCallLogs };
