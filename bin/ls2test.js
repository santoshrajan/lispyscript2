#!/usr/bin/env node

var parser = require('../lib/parser'),
    generate = require('escodegen').generate

var fjson = require('format-json')

var testCases = [
"(var a 5)",
"(function whatsX (x) (x))"
]

var expectedResult = [
"var a = 5;",
String.fromCharCode(102, 117, 110, 99, 116, 105, 111, 110, 32, 119, 104, 97, 116, 115, 88, 40, 120, 41, 32, 123, 10, 32, 32, 32, 32, 114, 101, 116, 117, 114, 110, 32, 120, 59, 10, 125)
]

testCases.forEach(function(program, i){
	result = generate(parser(program.toString()))
	console.log(result)
	// console.log(program)
	// console.log(expectedResult[i])
	// if(result === expectedResult[i])
	// 	console.log("Test "+i+" successfully passed!")
	// else
	// 	console.log("Failed")
	// for(var i=0; i<result.length; i++){
	// 	console.log(result.charCodeAt(i))
	// }

})
