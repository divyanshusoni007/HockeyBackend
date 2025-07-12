const mongoose = require('mongoose');

const TeamSchema = new mongoose.Schema({
  team_id: { type: Number, unique: true, required: true },
  team_name: { type: String, unique: true,required: true },
  city: { type: String, required: true },
  state: { type: String, required: true},
  country: { type: String, required: true },
  logo_url: { type: String },
  creation_date: { type: Date},
  coach_id: { type: Number, required:true },
});

module.exports = mongoose.model('Team', TeamSchema);
