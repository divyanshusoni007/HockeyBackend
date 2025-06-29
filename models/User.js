const mongoose = require('mongoose');

const UserSchema = new mongoose.Schema({
  user_id: { type: Number, unique: true, required: true },
  first_name: { type: String, required: true },
  last_name: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  password_hash: { type: String, required: true },
  date_of_birth: { type: Date },
  gender: { type: String, enum: ['M', 'F', 'O'] },
  phone_number: { type: String },
  address: { type: String },
  position: { type: String },
  join_date: { type: Date },
  jersey_number: { type: Number },
  weight_kg: { type: Number },
  height_cm: { type: Number },
  role_id: { type: Number },
  player_bio: { type: String }
});

module.exports = mongoose.model('User', UserSchema);
