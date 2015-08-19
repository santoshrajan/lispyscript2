/*
 * Copyright (c) 2015 Mansi Shah, Santosh Rajan
*/


var ast = {
        type: "Program",
        body: []
    }

module.exports = function(src) {

    var spaceRegEx = /^[ \t\r\n\b\f]+/,
        newLineRegEx = /\r?\n/g,
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
        line = 1
        macros = {}

    function consumer(regex, process) {
        return function() {
            var matches = regex.exec(src)
            if(!matches) return null
            src = src.slice(matches[0].length)
            spaceParser()
            if(process)    return process(matches[0])
            return matches[0]
        }
    }

    function parserFactory() {
        var parsers = arguments
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

    var spaceParser = consumer(spaceRegEx, function(val){
            var match = val.match(newLineRegEx)
            var l = (match)? match.length : 0
            line+=l
            return true
        }),
        nullParser = consumer(nullRegEx, function(){
            return {type: "Literal", value: null}
        }),
        booleanParser = consumer(booleanRegEx, function(val){
            return {type: "Literal", value: val}
        }),
        numberParser = consumer(numberRegEx, function(val){
            return {type: "Literal", value: Number(val)}
        }),
        stringParser = consumer(stringRegEx, function(val){
            return {type: "Literal", value: val.slice(1,val.length-1)}
        }),
        literalParser = parserFactory(nullParser, booleanParser, numberParser, stringParser),
        identifierParser = consumer(identifierRegEx, function(val) {
            return {type: "Identifier", name: val}
        }),
        openParanthesesParser = consumer(openParanthesesRegEx, function(val){
            return true
        }),
        closingParanthesesParser = consumer(closingParanthesesRegEx, function(val){
            return true
        }),
        operatorParser = consumer(operatorRegEx),
        varKeywordParser = consumer(varKeywordRegEx),
        functionKeywordParser = consumer(functionKeywordRegEx),
        macroKeywordParser = consumer(macroKeywordRegEx),
        fatArrowParser = consumer(fatArrowRegEx)

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
                    var temp = src
                    src = macro.params[ref].toString()
                    var refTree = elementParser()
                    src = temp
                    return refTree
                    
                }
            }
        }

        return tree
    }

    function macroCallParser() {
        var temp = src
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

        src = temp
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
            if (src[i] == '(')
                parantheses++
            if (src[i] == ')')
                parantheses--
            if (parantheses == 0)
                found = true
            i++
        }

        return src.slice(0,i)
    }

    function macroDeclarationParser() {
        if (!macroKeywordParser())    return null
        var snippet = extractExpression()
        var rest = src.slice(snippet.length)
        src = snippet
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
        while(src.length != 0){
            macro.body.push(statementParser(src.slice(0,src.length-1)))
            spaceParser()
            closingParanthesesParser()
        }
        
        src = rest
        spaceParser()

        macros[macroId.toString()] = macro
        return null
        
    }

    function combinator(expr){
        for(var i=1; i<arguments.length; i++){
            var attr = arguments[i][0]
            var parser = arguments[i][1]
            var args = arguments[i][2]
            if(Array.isArray(args)){
                var result = parser(args[0],args[1])
            }
            else
                var result = parser()

            if(attr){
                expr[attr] = result
            }
        }
        return expr
    }

    function functionDeclarationParser() {
        if (!functionKeywordParser())    return null
        var snippet = extractExpression()
        var rest = src.slice(snippet.length)
        src = snippet
        var expr = {type: "FunctionDeclaration", id: null, params: [], defaults: [], body: {type: "BlockStatement", body: []}, generator: false, expression: false}
        expr = (combinator(expr, ["id",identifierParser], ["",openParanthesesParser], ["params",argumentsParser], ["body", combinator, [{type: "BlockStatement", body: []}, ["body", functionBodyParser]]]))
        src = rest
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
        var snippet = extractExpression()
        var rest = src.slice(snippet.length)
        src = snippet
        var expr = {type: "ArrowFunctionExpression", id: null, params: [], defaults: [], body: null, generator: false, expression: false}
        expr = combinator(expr, ["", openParanthesesParser], ["params", argumentsParser], ["body", combinator, [{type: "BlockStatement"}, ["body", functionBodyParser]]])
        src = rest
        return expr
    }
    
    function extractStatements() {
        var stmts = [], openP = 0, idx = 0
        for(var i = 0; i < src.length; i++){
            if (i != 0 && openP == 0) {
                var stmt = src.slice(idx, i)
                if (stmt.length > 0)
                    stmts.push(stmt)
                idx = i
            }
            if (src[i] == '(')
                openP++
            if (src[i] == ')')
                openP--
        }
        return stmts
    }

    function functionBodyParser() {
        var stmts = []
        var expr = []
        extractStatements().forEach(function(stmt) {
            src = stmt
            spaceParser()
            if (src.length > 0)
                stmts.push(stmt)
        })
        while(stmts.length != 0){
            src = stmts.shift()
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
        while(src.length != 0){
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