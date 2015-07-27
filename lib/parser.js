

var ast = {
    "type": "Program",
    "body": []
}

var spaceRegEx = /^[ \t\r\n\b\f]+/
var newLineRegEx = /\r?\n/
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

    var line = 1

    var spaceParser = function() {
        var matches = spaceRegEx.exec(program)
        if (matches === null) return null
        var match = matches[0]
        while(ln = newLineRegEx.exec(match)){
            line++
            match = match.slice(ln["index"]+1)
        }
        program = program.slice(matches[0].length)
        return true
    }

    var nullParser = function() {
        var matches = nullRegEx.exec(program)
        if(matches === null) return null
        program = program.slice(matches[0].length)
        return {"type": "Literal", "value": null}
    }

    var booleanParser = function() {
        var matches = booleanRegEx.exec(program)
        if(matches === null) return null
        program = program.slice(matches[0].length)
        return {"type": "Literal", "value": matches[0]}
    }

    var numberParser = function() {
        var matches = numberRegEx.exec(program)
        if(matches === null) return null
        program = program.slice(matches[0].length)
        return {"type": "Literal", "value": Number(matches[0])}
    }

    var stringParser = function() {
        var matches = stringRegEx.exec(program)
        if(matches === null) return null
        program = program.slice(matches[0].length)
        matches[0] = matches[0].slice(1,matches[0].length-1)
        return {"type": "Literal", "value": matches[0]}
    }

    var identifierParser = function() {
        var matches = identifierRegEx.exec(program)
        if(matches === null) return null
        program = program.slice(matches[0].length)
        return {"type": "Identifier", "name": matches[0]}
    }

    var openParanthesesParser = function() {
        var matches = openParanthesesRegEx.exec(program)
        if(matches === null) return null
        program = program.slice(matches[0].length)
        return true
    }

    var closingParanthesesParser = function() {
        var matches = closingParanthesesRegEx.exec(program)
        if(matches === null) return null
        program = program.slice(matches[0].length)
        return true
    }

    var operatorParser = function() {
        var matches = operatorRegEx.exec(program)
        if(matches === null) return null
        program = program.slice(matches[0].length)
        return matches[0]
    }

    var varKeywordParser = function() {
        var matches = varKeywordRegEx.exec(program)
        if(matches === null) return null
        program = program.slice(matches[0].length)
        return matches[0]
    }

    var functionKeywordParser = function() {
        var matches = functionKeywordRegEx.exec(program)
        if(matches === null) return null
        program = program.slice(matches[0].length)
        return matches[0]
    }

    var fatArrowParser = function() {
        var matches = fatArrowRegEx.exec(program)
        if(matches === null) return null
        program = program.slice(matches[0].length)
        return matches[0]
    }

    var literalParser = function() {
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

    var argumentsParser = function() {
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

    var elementParser = function() {
        return literalParser() || identifierParser()
    }

    var expressionParser = function() {
        if(openParanthesesParser() === null)    return null
        return callExpressionParser() || binaryExpressionParser() || statementParser()
    }

    var expressionStatementParser = function() {
        spaceParser()
        if(closingParanthesesParser())  return null
        return {"type": "ExpressionStatement", "expression": expressionParser()}
    }

    var callExpressionParser = function() {
        spaceParser()
        var expr = {"type": "CallExpression"}
        if(expr.callee = identifierParser()){
            spaceParser()
            expr.arguments = argumentsParser() || []
            spaceParser()
            return expr
        }
        return null
    }
    
    var binaryExpressionParser = function() {
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

    var extractExpression = function() {
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

    var functionDeclarationParser = function() {
        if(functionKeywordParser() === null)    return null
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
        if(openParanthesesParser() === null)
            throw new SyntaxError("Expecting '(' after " + expr.id)
        expr.params = argumentsParser() || []
        spaceParser() //Argumentsparser has a spaceparser at the end. so not needed here

        //defaults
        expr.defaults = []

        //body
        expr.body = {"type": "BlockStatement", "body": functionBodyParser()}
        program = rest
        spaceParser()

        //generator
        expr.generator = false

        //expression
        expr.expression = false

        return expr
    }

    var variableDeclarationParser = function() {
        if(varKeywordParser() === null) return null
        var expr = {"type": "VariableDeclaration", "declarations": []}
        spaceParser()
        var innerExpr = {"type": "VariableDeclarator"}
        if(innerExpr.id = identifierParser()){
            spaceParser()
            if(closingParanthesesParser() === null){
                if(initVal = elementParser()){
                    innerExpr.init = initVal
                }
                else{
                    innerExpr.init = expressionParser()
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

    var arrowFunctionParser = function() {
        if(fatArrowParser() === null)   return null
        spaceParser()
        var snippet = extractExpression()
        var rest = program.slice(snippet.length)
        program = snippet
        spaceParser()
        var expr = {"type": "ArrowFunctionExpression", "id": null, "params": [], "defaults": [], "body": null, "generator": false, "expression": false}

        if(openParanthesesParser() === null)
            throw new SyntaxError("Expecting '(' after " + expr.id)
        expr.params = argumentsParser() || []
        spaceParser()
        
        expr.body = {"type": "BlockStatement", "body": functionBodyParser()}
        program = rest
        return expr
    }
    
    var extractStatements = function() {
        var stmts = [], openP = 0, idx = 0
        for(var i = 0; i < program.length; i++){
            if(i != 0 && openP == 0){
                var stmt = program.slice(idx, i)
                if(stmt.length > 0)
                    stmts.push(stmt)
                idx = i
            }
            if(program[i] == '(')
                openP++
            if(program[i] == ')')
                openP--
        }
        return stmts
    }

    var functionBodyParser = function() {
        var stmts = []
        var expr = []
        extractStatements().forEach(function(stmt) {
            program = stmt
            spaceParser()
            if(program.length > 0)
                stmts.push(stmt)
        })
        while(stmts.length != 0){
            program = stmts.shift()
            if(stmts.length > 0){
                //Not a return statement
                expr.push(statementParser())
            }
            else{
                //Return statement
                expr.push({"type": "ReturnStatement", "argument": statementParser()})
            }
        }
        return expr
    }

    var statementParser = function() {
        return arrowFunctionParser() || functionDeclarationParser() || variableDeclarationParser() || expressionParser() || elementParser()
    }

    var bodyParser = function() {
        var body = []
        while(program.length != 0){
            spaceParser()
            var stmt = statementParser()
            if(stmt === null)
                throw new SyntaxError("Cannot parse statement at line: "+line)
            body.push(stmt)
        }
        return body
    }


    ast.body = bodyParser()
    return ast
}