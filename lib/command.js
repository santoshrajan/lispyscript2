var parser = require('./parser'),
    generate = require('escodegen').generate
    fs = require('fs')

var fjson = require('format-json')

var program = fs.readFileSync(process.argv[2]),
    ast = parser(program.toString())

// console.log(fjson.plain(ast))
console.log(generate(ast))