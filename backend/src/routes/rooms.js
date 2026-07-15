const express = require('express');
const router = express.Router();
const {
  createRoom,
  getUserRooms,
  getUserGroups,
  addGroupMember,
  removeGroupMember,
  leaveGroup,
  acceptGroupInvitation,
  rejectGroupInvitation,
  updateGroupDetails,
  transferGroupAdmin,
  inviteGroupMembers
} = require('../controllers/roomController');
const { protect } = require('../middleware/auth');
const { validateCreateRoom } = require('../middleware/validate');

// Protect all room endpoints
router.use(protect);

router.route('/')
  .post(validateCreateRoom, createRoom)
  .get(getUserRooms);

// Adapter for POST /private
router.post('/private', (req, res, next) => {
  req.body.type = 'private';
  req.body.participants = [req.body.userId];
  next();
}, validateCreateRoom, createRoom);

// Adapter for POST /group
router.post('/group', (req, res, next) => {
  req.body.type = 'group';
  req.body.groupName = req.body.name;
  req.body.participants = req.body.participantIds;
  req.body.groupAvatar = req.body.avatar;
  next();
}, validateCreateRoom, createRoom);

router.get('/groups', getUserGroups);

router.route('/:roomId')
  .put(updateGroupDetails);

router.post('/:roomId/accept', acceptGroupInvitation);
router.post('/:roomId/reject', rejectGroupInvitation);
router.post('/:roomId/transfer-admin', transferGroupAdmin);
router.post('/:roomId/invite', inviteGroupMembers);

router.route('/:roomId/members')
  .post(addGroupMember)
  .delete(removeGroupMember);

router.post('/:roomId/leave', leaveGroup);

module.exports = router;
