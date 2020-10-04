const _ = require('lodash')

class Words {
    constructor(cards) {
        this.cards = cards
    }

    generateWord(category) {
        return _.sample(this.cards)[category]
    }
}

module.exports = Words