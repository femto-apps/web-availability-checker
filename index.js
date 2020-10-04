const config = require('@femto-apps/config')
const session = require('express-session')
const cookieParser = require('cookie-parser')
const bodyParser = require('body-parser')
const RedisStore = require('connect-redis')(session)
const mongoose = require('mongoose')
const express = require('express')
const morgan = require('morgan')
const redis = require('redis')
const dateformat = require('dateformat')
const authenticationConsumer = require('@femto-apps/authentication-consumer')

const Event = require('./models/Event')
const Response = require('./models/Response')

const alphabet = '23456789abcdefghijkmnpqrstuvwxyz'

function generateShort(options) {
    if (typeof options === 'undefined') options = {}
    if (typeof options.keyLength === 'undefined') options.keyLength = 5

    let short = ''

    for (let i = 0; i < options.keyLength; i++) {
      short += alphabet[Math.floor(Math.random() * Math.floor(alphabet.length))]
    }

    return short
}

;(async () => {
    const app = express()
    const port = config.get('port')

    mongoose.connect(config.get('mongo.uri') + config.get('mongo.db'), {
        useNewUrlParser: true,
        useUnifiedTopology: true
    })
    mongoose.set('useCreateIndex', true)

    app.set('view engine', 'pug')

    app.use(express.static('public'))
    app.use(express.static('public/favicons'))
    app.use(morgan('dev'))
    app.use(bodyParser.urlencoded({ extended: true }))
    app.use(bodyParser.json())
    app.use(cookieParser(config.get('cookie.secret')))
    app.use(session({
        store: new RedisStore({
            client: redis.createClient({
                host: config.get('redis.host'),
                port: config.get('redis.port')
            })
        }),
        secret: config.get('session.secret'),
        resave: false,
        saveUninitialized: false,
        name: config.get('cookie.name'),
        cookie: {
            maxAge: config.get('cookie.maxAge')
        }
    }))

    app.use(authenticationConsumer({
        tokenService: { endpoint: config.get('tokenService.endpoint') },
        authenticationProvider: { endpoint: config.get('authenticationProvider.endpoint'), consumerId: config.get('authenticationProvider.consumerId') },
        authenticationConsumer: { endpoint: config.get('authenticationConsumer.endpoint') },
        redirect: config.get('redirect')
    }))

    app.use(async (req, res, next) => {
        req.ip = (req.headers['x-forwarded-for'] || '').split(',').pop() ||
            req.connection.remoteAddress ||
            req.socket.remoteAddress ||
            req.connection.socket.remoteAddress

        next()
    })

    app.use((req, res, next) => {
        const links = []

        if (req.user) {
            links.push({ title: 'Logout', href: res.locals.auth.getLogout(`${config.get('authenticationConsumer.endpoint')}${req.originalUrl}`) })

            res.locals.user = req.user
        } else {
            links.push({ title: 'Login', href: res.locals.auth.getLogin(`${config.get('authenticationConsumer.endpoint')}${req.originalUrl}`) })
        }

        res.locals.nav = {
            title: config.get('title.suffix'),
            links,
        }

        res.locals.session = req.session

        next()
    })

    
    app.get('/', async (req, res) => {
        res.render('index', {
            page: { title: `Availability Checker :: ${config.get('title.suffix')}` },
        })
    })

    app.post('/event', async (req, res) => {
        const weekdays = req.body.weekdays === 'on'
        const start = Date.parse(req.body.start)
        const end = Date.parse(req.body.end)
        const name = req.body.name
        const short = generateShort()

        if (start > end) {
            return res.send('Start date cannot be beyond end date.')
        }

        const event = new Event({
            weekdays, start, end, name, short
        })

        await event.save()

        res.redirect(`/event/${short}`)
    })

    app.post('/event/response/:short', async (req, res) => {
        const short = req.params.short
        const event = await Event.findOne({ short })

        if (!event) {
            res.send('Event not found.')
        }

        const name = req.body.name
        const dates = []

        for (let param in req.body) {
            if (param.startsWith('date-')) {
                const date = new Date(param.slice(5))
                let value = req.body[param]

                if (value === 'on') value = 'yes'
                if (value === 'off') value = 'no'
                if (value === 'unknown') value = 'maybe'

                dates.push([date, value])
            }
        }

        const response = new Response({
            name, dates, event: event._id
        })

        await response.save()

        res.redirect(`/event/responses/${event.short}?me=${name}`)
    })

    app.get('/event/responses/:short', async (req, res) => {
        const short = req.params.short
        const event = await Event.findOne({ short })

        if (!event) {
            res.send('Event not found.')
        }

        const responses = await Response.find({ event: event._id })

        console.log(responses)

        res.send('hello')
    })

    app.get('/event/:short', async (req, res) => {
        const short = req.params.short

        const event = await Event.findOne({ short })

        if (!event) {
            res.send('Event not found.')
        }

        const dateArray = []
        let currentDate = event.start

        while (currentDate <= event.end) {
            if (event.weekdays) {
                if (!(currentDate.getDay() === 6) && !(currentDate.getDay() === 0)) {
                    // not a weekend!
                    dateArray.push(new Date(currentDate))
                }
            } else {
                dateArray.push(new Date(currentDate))
            }

            currentDate.setDate(currentDate.getDate() + 1)
        }

        res.render('event', {
            page: { title: `${event.name} :: ${config.get('title.suffix')}` },
            event,
            dateArray,
            dateformat
        })
    })

    app.listen(port, () => console.log(`Web availability checker listening on port ${port}`))
})()