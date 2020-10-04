const mongoose = require('mongoose')

const EventSchema = mongoose.Schema({
  start: Date,
  end: Date,
  name: String,
  weekdays: Boolean,
  short: String
}, {
  timestamps: true,
  strict: false	
})

const EventModel = mongoose.model('Event', EventSchema)


module.exports = EventModel
