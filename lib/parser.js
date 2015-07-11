

var ast = {
	"type": "Program",
	"body": []
}

var spaceRegEx = /^[ \t\r\n\b\f]+/
var nullRegEx = /^null/i
var booleanRegEx = /^(true|false)/i
var numberRegEx = /^[-+]?(\d+(\.\d*)?|\.\d+)([e][+-]?\d+)?$/i
var stringRegEx = /('|").*?[^\\]\1/
var identifierRegEx = /^[a-z]*[a-z0-9_\.\*]*/i
var openParanthesesRegEx = /^\(/
var closingParanthesesRegEx = /^\)/
var operatorRegEx = /^(\*|\+|\-|\/|\%)/

module.exports = function(program) {

	var spaceParser = function() {
		var matches = spaceRegEx.exec(program)
		if (matches === null) return null
		program = program.slice(matches[0].length)
		return 1
	}

	var nullParser = function(){
		var matches = nullRegEx.exec(program)
		if(matches === null) return null
		program = program.slice(matches[0].length)
		return {"type": "literal", "value": matches[0]}
	}

	var booleanParser = function(){
		var matches = booleanRegEx.exec(program)
		if(matches === null) return null
		program = program.slice(matches[0].length)
		return {"type": "literal", "value": matches[0]}
	}

	var numberParser = function(){
		var matches = numberRegEx.exec(program)
		if(matches === null) return null
		program = program.slice(matches[0].length)
		return {"type": "literal", "value": matches[0]}
	}

	var stringParser = function(){
		var matches = stringRegEx.exec(program)
		if(matches === null) return null
		program = program.slice(matches[0].length)
		matches[0] = matches[0].slice(1,matches[0].length-1)
        return {"type": "literal", "value": matches[0]}
	}

	var identifierParser = function(){
		var matches = identifierRegEx.exec(program)
		if(matches === null) return null
		program = program.slice(matches[0].length)
		return {"type": "Identifier", "name": matches[0]}
	}

	var openParanthesesParser = function(){
		var matches = openParanthesesRegEx.exec(program)
		if(matches === null) return null
		program = program.slice(matches[0].length)
		return true
	}

	var closingParanthesesParser = function(){
		var matches = closingParanthesesRegEx.exec(program)
		if(matches === null) return null
		program = program.slice(matches[0].length)
		return true
	}

	var operatorParser = function(){
		var matches = operatorRegEx.exec(program)
		if(matches === null) return null
		program = program.slice(matches[0].length)
		return matches[0]
	}

	var elementParser = function(){
		var args = []
		spaceParser()
		while(!closingParanthesesParser()){
			if(arg = nullParser())
				args.push(arg)
			else if(arg = booleanParser())
				args.push(arg)
			else if(arg = numberParser())
				args.push(arg)
			else if(arg = stringParser())
				args.push(arg)
			else
				args.push(identifierParser())
			spaceParser()
		}
		program = program.slice(1)
		return args
	}

	var expressionParser = function(){
		program = program.slice(1)
		spaceParser()
		if(closingParanthesesParser())	return null
		if(/^\*/.exec(program))
			return binaryExpressionParser()
		if(/^function/.exec(program))
			return bodyParser()
		return {"type": "ExpressionStatement", "expression": bodyParser()}
	}
	
	var binaryExpressionParser = function(){
		var expr = {"type": "BinaryExpression"}
		if(expr.operator = operatorParser()){
			spaceParser()
			if(expr.left = identifierParser()){
				spaceParser()
				if(expr.right = identifierParser()){
					spaceParser()
					return expr
				}
			}
		}
		return null
	}

	var functionDeclarationParser = function(){
		program = program.slice("function".length)
		spaceParser()
		var expr = {"type": "FunctionDeclaration"}
		//id
		if(id = identifierParser())
			expr.id = id
		else
			throw new SyntaxError("Expecting a function name")
		spaceParser()

		//params
		if(!openParanthesesParser())
			throw new SyntaxError("Expecting '(' after " + expr.id)
		expr.params = elementParser()
		spaceParser()

		//defaults
		expr.defaults = []

		//body
		if(!openParanthesesParser())
			throw new SyntaxError("Expecting function body for " + expr.id)
		expr.body = {"type": "BlockStatement", "body": [functionBodyParser()]}
		spaceParser()

		//generator
		expr.generator = false

		//expression
		expr.expression = false

		return expr
	}

	var functionBodyParser = function(){
		if(program.indexOf('(') >= 0){
			//Not a return statement
			program = '(' + program
			return bodyParser()
		}
		else{
			//Return Statement
			program = '(' + program
			return {"type": "ReturnStatement", "argument": bodyParser()}		
		}

	}

	var bodyParser = function(){
		if(matches = /^\(/.exec(program))
			return expressionParser()
		else if(matches = /^function/.exec(program))
			return functionDeclarationParser()
		else
			return elementParser()
		return null
	}

	ast.body.push(bodyParser())
	return ast
}