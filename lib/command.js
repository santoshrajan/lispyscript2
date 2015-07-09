var parser = require('./parser'),
    generate = require('escodegen').generate
    fs = require('fs')

var program = fs.readFileSync(process.argv[2]),
    ast = parser(program.toString())

console.log(ast)