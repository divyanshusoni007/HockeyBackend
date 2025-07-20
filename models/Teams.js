const mongoose = require('mongoose');

const TeamSchema = new mongoose.Schema({
  team_id: { type: String },
  tournament_id:{type:String},
  team_name: { type: String, unique: true,required: true },
  city: { type: String, required: true },
  logo_url: { type: String },
});

module.exports = mongoose.model('Team', TeamSchema);
