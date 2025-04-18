const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const userSchema = new Schema({
  email: {
    type: String,
    required: true,
  },
  password: {
    type: String,
    required: true,
  },
  firstName: {
    type: String,
    required: true,
  },
  lastName: {
    type: String,
    required: true,
  },
  status: {
    type: String,
    default: 'I am new!',
  },
  moviesSeen: [{ type: Schema.Types.ObjectId, ref: 'Movie' }],
  leagues: [{ type: Schema.Types.ObjectId, ref: 'League' }],
});

module.exports = mongoose.model('User', userSchema);
