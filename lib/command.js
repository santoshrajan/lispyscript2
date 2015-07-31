var parser = require('./parser'),
    generate = require('escodegen').generate
    fs = require('fs')

var fjson = require('format-json')

var filename = process.argv[2]

var program = fs.readFileSync(filename),
    ast = parser(program.toString())

filename = filename.slice(0,/\.ls2$/.exec(filename).index)

fs.writeFileSync(filename+'.tree', fjson.plain(ast))
fs.writeFileSync(filename+'.js', generate(ast))