const mongoose = require('mongoose');

const TeamMembersSchema = new mongoose.Schema({
  team_id: { type: String }, // team_id should be required
  user_id: { type: String }, // A user should generally only be in a team once with this method, though if they can be in multiple teams, this 'unique' might need adjustment. For adding to *a specific team*, this should be unique per team if a user can only be added once.
  phone_number: { type: String, required: true }, // Corrected type to String
  role: { type: String, default: 'Player' }, // Assuming a default role if not provided
  name: { type: String }, // Fetched from User
  profile_pic: { type: String } // Stored as String (URL)
});

module.exports = mongoose.model('TeamMembers', TeamMembersSchema);