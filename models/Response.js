const mongoose = require('mongoose')

const ResponseSchema = mongoose.Schema({
  name: String,
  dates: [mongoose.Mixed],
  event: mongoose.Types.ObjectId
}, {
  timestamps: true,
  strict: false	
})

const ResponseModel = mongoose.model('Response', ResponseSchema)


module.exports = ResponseModel
