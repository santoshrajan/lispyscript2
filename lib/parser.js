

var ast = {
	"type": "Program",
	"body": []
}

var spaceRegEx = /^[ \t\r\n\b\f]+/
var nullRegEx = /^null\b/i
var booleanRegEx = /^(true|false)\b/i
var numberRegEx = /^[-+]?(\d+(\.\d*)?|\.\d+)([e][+-]?\d+)?/i
var stringRegEx = /^('|").*?[^\\]\1/
var identifierRegEx = /^[a-z]+[a-z0-9_\.\*]*/i
var openParanthesesRegEx = /^\(/
var closingParanthesesRegEx = /^\)/
var operatorRegEx = /^(\*|\+|\-|\/|\%)/
var functionKeywordRegEx = /^(\()(\s)*function/
var varKeywordRegEx = /^(\()?(\s)*var/
var fatArrowRegEx = /^\=\>/

module.exports = function(program) {

	var spaceParser = function() {
		var matches = spaceRegEx.exec(program)
		if (matches === null) return null
		program = program.slice(matches[0].length)
		return true
	}

	var nullParser = function(){
		var matches = nullRegEx.exec(program)
		if(matches === null) return null
		program = program.slice(matches[0].length)
		return {"type": "Literal", "value": null}
	}

	var booleanParser = function(){
		var matches = booleanRegEx.exec(program)
		if(matches === null) return null
		program = program.slice(matches[0].length)
		return {"type": "Literal", "value": matches[0]}
	}

	var numberParser = function(){
		var matches = numberRegEx.exec(program)
		if(matches === null) return null
		program = program.slice(matches[0].length)
		return {"type": "Literal", "value": Number(matches[0])}
	}

	var stringParser = function(){
		var matches = stringRegEx.exec(program)
		if(matches === null) return null
		program = program.slice(matches[0].length)
		matches[0] = matches[0].slice(1,matches[0].length-1)
        return {"type": "Literal", "value": matches[0]}
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

	var varKeywordParser = function(){
		var matches = varKeywordRegEx.exec(program)
		if(matches === null) return null
		program = program.slice(matches[0].length)
		return matches[0]
	}

	var functionKeywordParser = function(){
		var matches = functionKeywordRegEx.exec(program)
		if(matches === null) return null
		program = program.slice(matches[0].length)
		return matches[0]
	}

	var fatArrowParser = function(){
		var matches = fatArrowRegEx.exec(program)
		if(matches === null) return null
		program = program.slice(matches[0].length)
		return matches[0]
	}

	var literalParser = function(){
		spaceParser()
		var lit
		if(lit = nullParser())
			return lit
		else if(lit = booleanParser())
			return lit
		else if(lit = numberParser())
			return lit
		else if(lit = stringParser())
			return lit
		else
			return null
	}

	var argumentsParser = function(){
		var args = []
		spaceParser()
		while(!closingParanthesesParser()){
			arg = elementParser()
			args.push(arg)
			spaceParser()
		}
		spaceParser()
		if(args.length > 0)
			return args
		return null
	}

	var elementParser = function(){
		return literalParser() || identifierParser()
	}

	var expressionParser = function(){
		spaceParser()
		if(closingParanthesesParser())	return null
		if(operatorRegEx.exec(program))
			return binaryExpressionParser()
		return {"type": "ExpressionStatement", "expression": bodyParser()}
	}
	
	var binaryExpressionParser = function(){
		var expr = {"type": "BinaryExpression"}
		if(expr.operator = operatorParser()){
			spaceParser()
			expr.left = elementParser() //This should probably not be an elementParser. Could also be a function call.
			if(expr.left){
				spaceParser()
				expr.right = elementParser() //same as left
				if(expr.right){
					spaceParser()
					if(closingParanthesesParser())
						return expr
				}
			}
		}
		return null
	}

	var extractExpression = function(){
		var found = false, parantheses = 1, i = 0
		while(!found){
			if(program[i] == '(')
				parantheses++
			if(program[i] == ')')
				parantheses--
			if(parantheses == 0)
				found = true
			i++
		}

		return program.slice(0,i)
	}

	var functionDeclarationParser = function(){
		var snippet = extractExpression()
		var rest = program.slice(snippet.length)
		program = snippet
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
		expr.params = argumentsParser() || []
		spaceParser() //Argumentsparser has a spaceparser at the end. so not needed here

		//defaults
		expr.defaults = []

		//body
		openParanthesesParser()
		expr.body = {"type": "BlockStatement", "body": functionBodyParser()}
		program = rest
		spaceParser()

		//generator
		expr.generator = false

		//expression
		expr.expression = false

		return expr
	}

	var variableDeclarationParser = function(){
		var expr = {"type": "VariableDeclaration", "declarations": []}
		spaceParser()
		var innerExpr = {"type": "VariableDeclarator"}
		if(innerExpr.id = identifierParser()){
			spaceParser()
			if(!closingParanthesesParser())
				if(initVal = elementParser())
					innerExpr.init = initVal
				else{
					openParanthesesParser()
					innerExpr.init = bodyParser()
					if(innerExpr.init.type == 'Identifier'){
						var child = innerExpr.init
						innerExpr.init = {"type": "CallExpression", "callee": child, "arguments": []} //Need to do this somewhere else
						closingParanthesesParser()
					}
				}
			expr.declarations.push(innerExpr)
		}
		else
			throw new SyntaxError("Invalid variable name")
		expr.kind = "var"
		spaceParser()
		closingParanthesesParser()
		return expr
	}

	var arrowFunctionParser = function(){
		spaceParser()
		var snippet = extractExpression()
		var rest = program.slice(snippet.length)
		program = snippet
		spaceParser()
		var expr = {"type": "ArrowFunctionExpression", "id": null, "params": [], "defaults": [], "body": null, "generator": false, "expression": false}

		if(!openParanthesesParser())
			throw new SyntaxError("Expecting '(' after " + expr.id)
		expr.params = argumentsParser() || []
		spaceParser()
		
		openParanthesesParser()
		expr.body = {"type": "BlockStatement", "body": functionBodyParser()}
		program = rest
		return expr
	}
	
	var functionBodyParser = function(){
		var stmts = []
		while(!closingParanthesesParser()){
			if(program.indexOf('(') >= 0){
				//Not a return statement
				stmts.push(bodyParser())
			}
			else{
				//Return Statement
				if(arg = elementParser())
					stmts.push({"type": "ReturnStatement", "argument": arg})
				else{
					program = '(' + program
					stmts.push({"type": "ReturnStatement", "argument": bodyParser()})
				}
			}
			closingParanthesesParser() //Binaryexp parser hsa this..not needed
			spaceParser()
			openParanthesesParser()
		}
		return stmts
	}

	var bodyParser = function(){
		if(fatArrowParser()){
			// console.log("Arrow")
			return arrowFunctionParser()
		}
		else if(functionKeywordParser()){
			// console.log("Function")
			return functionDeclarationParser()
		}
		else if(varKeywordParser()){
			// console.log("Var")
			return variableDeclarationParser()
		}
		else if(openParanthesesParser()){
			// console.log("expr")
			return expressionParser()
		}
		else{
			// console.log("ele")
			return elementParser()
		}
		return null
	}

	while(program.length != 0){
		spaceParser()
		ast.body.push(bodyParser())
		closingParanthesesParser() //useless for var declaration, function declaration
	}

	return ast
}