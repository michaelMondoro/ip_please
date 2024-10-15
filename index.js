const jGeoIP = require('jgeoip');
const express = require('express')
const fs = require('fs')

require('dotenv').config()
const app = express()

var geoip = new jGeoIP('dbip-city.mmdb');
var asnip = new jGeoIP('dbip-asn.mmdb');

function log(msg) {
    console.log(`[ ${new Date().toLocaleString()} ] - ${msg}`)
}
function getAsn(ip) {
    let record = asnip.getRecord(ip);
    data = {}
    if (record !== null) {
        data = {
            'number': record['autonomous_system_number'],
            'org': record['autonomous_system_organization']
        }
    }
    return data;
}

function getGeo(ip) {
    let record = geoip.getRecord(ip);
    data = {err:`couldn't find info on ip: ${ip}`}
    let asn_data = getAsn(ip);
    if (record !== null) {
        data = {
            'city': record['city']['names']['en'],
            'country': record['country']['names']['en'],
            'country_code': record['country']['iso_code'],
            'coordinates': record['location'],
            'asn': asn_data
        }
    }
    return data;
}

app.get('/api/ip_please', function (req, res) {
    var ip = req.headers['x-forwarded-for'] || req.connection.remoteAddress;
    log(`GET ${req.url} :: [${ip}]`)
    if (process.env.ENV == "PROD" && !req.headers['pleaseplease']) {res.status(401).send({msg:"nope"}); return}
    if (!req.query.ip) {res.status(422).send({msg:"no 'ip' provided"}); return}

    try {
        let ip_data = getGeo(req.query.ip)
        res.status(200).send(ip_data)
    } catch (err) {
        res.status(500).send({error: err.message})
        log(`ERROR :: ${err.message}`)
    }  
})
var server = app.listen(5000, function () {
    fs.writeFileSync('ip.log','[ Starting IP API ]\n')
    console.log("Express App running at http://127.0.0.1:5000/");
    console.log(`ENV: ${process.env.ENV}`)
})

