


var spaceRegEx = /^[ \t\r\n\b\f]+/,
    newLineRegEx = /\r?\n/,
    nullRegEx = /^null\b/i,
    booleanRegEx = /^(true|false)\b/i,
    numberRegEx = /^[-+]?(\d+(\.\d*)?|\.\d+)([e][+-]?\d+)?/i,
    stringRegEx = /^('|").*?[^\\]\1/,
    identifierRegEx = /^[a-z\~]+[a-z0-9_\[\]\.\*]*/i,
    openParanthesesRegEx = /^\(/,
    closingParanthesesRegEx = /^\)/,
    operatorRegEx = /^(\*|\+|\-|\/|\%)/,
    functionKeywordRegEx = /^(\()(\s)*function/,
    macroKeywordRegEx = /^(\()(\s)*macro\b/,
    varKeywordRegEx = /^(\()?(\s)*var/,
    fatArrowRegEx = /^\=\>/,
    ast = {
        type: "Program",
        body: []
    }

module.exports = function(program) {

    var line = 1
    var macros = {}

    function spaceParser() {
        var matches = spaceRegEx.exec(program)
        if (!matches) return null
        var match = matches[0]
        while(ln = newLineRegEx.exec(match)){
            line++
            match = match.slice(ln["index"]+1)
        }
        program = program.slice(matches[0].length)
        return true
    }

    function consumer(regex, process) {
        return function() {
            var matches = regex.exec(program)
            if(!matches) return null
            program = program.slice(matches[0].length)
            if(typeof process == "function")    return process(matches[0])
            return matches[0]
        }
    }

    function parserFactory(parsers) {
        return function() {
            for(index in parsers){
                var parser = parsers[index]
                spaceParser()
                var result = parser()
                if(result)  return result
            }
            return null
        }
    }

    var nullParser = consumer(nullRegEx, function(val){return {type: "Literal", value: null}})
    var booleanParser = consumer(booleanRegEx, function(val){return {type: "Literal", value: val}})
    var numberParser = consumer(numberRegEx, function(val){return {type: "Literal", value: Number(val)}})
    var stringParser = consumer(stringRegEx, function(val){return {type: "Literal", value: val.slice(1,val.length-1)}})
    var literalParser = parserFactory([nullParser, booleanParser, numberParser, stringParser])
    var identifierParser = consumer(identifierRegEx, function(val) {return {type: "Identifier", name: val}})
    var openParanthesesParser = consumer(openParanthesesRegEx, function(val){return true})
    var closingParanthesesParser = consumer(closingParanthesesRegEx, function(val){return true})
    var operatorParser = consumer(operatorRegEx)
    var varKeywordParser = consumer(varKeywordRegEx)
    var functionKeywordParser = consumer(functionKeywordRegEx)
    var macroKeywordParser = consumer(macroKeywordRegEx)
    var fatArrowParser = consumer(fatArrowRegEx)

    function argumentsParser() {
        var args = []
        spaceParser()
        while(!closingParanthesesParser()){
            arg = argStatementParser()
            if (!arg)
                throw new SyntaxError("argumentsParser : Unexpected character at line: "+line)
            args.push(arg)
            spaceParser()
        }
        spaceParser()
        if (args.length > 0)
            return args
        return null
    }

    function elementParser() {
        return literalParser() || identifierParser()
    }

    function expressionParser() {
        if (!openParanthesesParser()) return null
        return callExpressionParser() || binaryExpressionParser() || statementParser()
    }

    function expressionStatementParser() {
        spaceParser()
        if (closingParanthesesParser())  return null
        return {type: "ExpressionStatement", expression: expressionParser()}
    }

    function dereferencer(macro, tree) {
        for(objs in tree){
            if (typeof tree[objs] == "object") {
                if (Array.isArray(tree[objs])) {
                    tree[objs].forEach(function(t){
                        tree[objs] = [dereferencer(macro, t)]
                    })
                }
                else{
                    tree[objs] = dereferencer(macro, tree[objs])
                }
            }

            if (tree[objs] == "Identifier") {
                if (tilde = /^\~.*\b/.exec(tree.name)) {
                    var ref = tilde[0].slice(1)
                    var temp = program
                    program = macro.params[ref].toString()
                    var refTree = elementParser()
                    program = temp
                    return refTree
                    
                }
            }
        }

        return tree
    }

    function macroCallParser() {
        var temp = program
        if(!openParanthesesParser()) return null
        spaceParser()
        var expr = {}
        if (expr.callee = identifierParser()) {
            spaceParser()
            expr.arguments = argumentsParser() || []
            if (macroCopy = macros[expr.callee.name.toString()]) {
                var macro = JSON.parse(JSON.stringify(macroCopy))
                var macroName = expr.callee.name
                var args = expr.arguments.map(function(arg){
                    if(arg.value){
                        if (typeof arg.value == "string")    return '"'+arg.value+'"'
                        return arg.value
                    }
                    return arg.name
                })
                for(param in macro.params){
                    if (param != "rest")
                        macro.params[param] = args.shift()
                }
                macro.params.rest = args
                var macroExpr = dereferencer(macro, macro.body)
                return macroExpr
            }
        }

        program = temp
        return null
    }
    function callExpressionParser() {
        spaceParser()
        var expr = {type: "CallExpression"}
        if (expr.callee = identifierParser()) {
            spaceParser()
            expr.arguments = argumentsParser() || []
            spaceParser()
            return expr
        }
        return null
    }
    
    function binaryExpressionParser() {
        var expr = {type: "BinaryExpression"}
        if (expr.operator = operatorParser()) {
            spaceParser()
            expr.left = elementParser() //This should probably not be an elementParser. Could also be a function call.
            if (expr.left) {
                spaceParser()
                expr.right = elementParser() //same as left
                if (expr.right) {
                    spaceParser()
                    if (closingParanthesesParser())
                        return expr
                }
            }
        }
        return null
    }

    function extractExpression() {
        var found = false, parantheses = 1, i = 0
        while(!found){
            if (program[i] == '(')
                parantheses++
            if (program[i] == ')')
                parantheses--
            if (parantheses == 0)
                found = true
            i++
        }

        return program.slice(0,i)
    }

    function macroDeclarationParser() {
        if (!macroKeywordParser())    return null
        var snippet = extractExpression()
        var rest = program.slice(snippet.length)
        program = snippet
        spaceParser()

        //id
        if (id = identifierParser())
            macroId = id.name
        else
            throw new SyntaxError("Expecting a macro identifier")
        spaceParser()

        //params
        if (!openParanthesesParser())
            throw new SyntaxError("Expecting '(' after " + macroId)

        var macro = {}
        macro.params = {}
        while(!closingParanthesesParser()){
            if (param = identifierParser()) {
                var paramName = param.name
                // param[paramName.toString()] = null
                macro.params[paramName.toString()] = null
            }
            spaceParser()
        }
        macro.params["rest"] = []
        spaceParser()

        //body
        macro.body = []

        //Not very desirable, might go in infinite loop
        while(program.length != 0){
            macro.body.push(statementParser(program.slice(0,program.length-1)))
            spaceParser()
            closingParanthesesParser()
        }
        
        program = rest
        spaceParser()

        macros[macroId.toString()] = macro
        return null
        
    }

    function functionDeclarationParser() {
        if (!functionKeywordParser())    return null
        var snippet = extractExpression()
        var rest = program.slice(snippet.length)
        program = snippet
        spaceParser()
        var expr = {type: "FunctionDeclaration"}

        //id
        if (id = identifierParser())
            expr.id = id
        else
            throw new SyntaxError("Expecting a function name")
        spaceParser()

        //params
        if (!openParanthesesParser())
            throw new SyntaxError("Expecting '(' after " + expr.id)
        expr.params = argumentsParser() || []
        spaceParser() //Argumentsparser has a spaceParser at the end. so not needed here

        //defaults
        expr.defaults = []

        //body
        expr.body = {type: "BlockStatement", body: functionBodyParser()}
        program = rest
        spaceParser()

        //generator
        expr.generator = false

        //expression
        expr.expression = false

        return expr
    }

    function variableDeclarationParser() {
        if (!varKeywordParser()) return null
        var expr = {type: "VariableDeclaration", declarations: []}
        spaceParser()
        var innerExpr = {type: "VariableDeclarator"}
        if (innerExpr.id = identifierParser()) {
            spaceParser()
            if (!closingParanthesesParser()) {
                if (initVal = elementParser()) {
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

    function arrowFunctionParser() {
        if (!fatArrowParser())   return null
        spaceParser()
        var snippet = extractExpression()
        var rest = program.slice(snippet.length)
        program = snippet
        spaceParser()
        var expr = {type: "ArrowFunctionExpression", id: null, params: [], defaults: [], body: null, generator: false, expression: false}

        if (!openParanthesesParser())
            throw new SyntaxError("Expecting '(' after " + expr.id)
        expr.params = argumentsParser() || []
        spaceParser()
        
        expr.body = {type: "BlockStatement", body: functionBodyParser()}
        program = rest
        return expr
    }
    
    function extractStatements() {
        var stmts = [], openP = 0, idx = 0
        for(var i = 0; i < program.length; i++){
            if (i != 0 && openP == 0) {
                var stmt = program.slice(idx, i)
                if (stmt.length > 0)
                    stmts.push(stmt)
                idx = i
            }
            if (program[i] == '(')
                openP++
            if (program[i] == ')')
                openP--
        }
        return stmts
    }

    function functionBodyParser() {
        var stmts = []
        var expr = []
        extractStatements().forEach(function(stmt) {
            program = stmt
            spaceParser()
            if (program.length > 0)
                stmts.push(stmt)
        })
        while(stmts.length != 0){
            program = stmts.shift()
            if (stmts.length > 0) {
                //Not a return statement
                expr.push(statementParser())
            }
            else{
                //Return statement
                expr.push({type: "ReturnStatement", argument: argStatementParser()})
            }
        }
        return expr
    }

    function statementParser() {
        return arrowFunctionParser() || macroDeclarationParser()|| functionDeclarationParser() || variableDeclarationParser() || elementParser() || macroCallParser() || expressionStatementParser()
    }

    // Have to figure out a way to remove this function
    function argStatementParser() {
        return arrowFunctionParser() || macroDeclarationParser()|| functionDeclarationParser() || variableDeclarationParser() || elementParser() || expressionParser()
    }

    function bodyParser() {
        var body = []
        while(program.length != 0){
            spaceParser()
            var stmt = statementParser()
            if (!stmt)
                throw new SyntaxError("Cannot parse statement at line: " + line)
            if(Array.isArray(stmt))
                stmt.forEach(function(s){body.push(s)})
            else
                body.push(stmt)
            
        }
        return body
    }


    ast.body = bodyParser()
    return ast
}