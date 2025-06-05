const mongoose = require('mongoose');

const Schema = mongoose.Schema;

const leagueSchema = new Schema({
  name: {
    type: String,
    required: true,
  },
  createdBy: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
});

module.exports = mongoose.model('League', leagueSchema);
