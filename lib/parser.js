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
        restParamRegEx = /^\.\.\.[a-z]+[a-z0-9_\[\]\.\*]*/i,
        openParanthesesRegEx = /^\(/,
        closingParanthesesRegEx = /^\)/,
        operatorRegEx = /^(\*|\+|\-|\/|\%)/,
        functionKeywordRegEx = /^(\()(\s)*function/,
        macroKeywordRegEx = /^(\()(\s)*macro\b/,
        varKeywordRegEx = /^(\()?(\s)*var/,
        ifKeywordRegEx = /^\((\s)*if/,
        fatArrowRegEx = /^\(\=\>/,
        line = 1
        macros = {}

    function consumer(regex, process) {
        return function() {
            var matches = regex.exec(src)
            if(!matches) return null
            // console.info("Matched "+regex)
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
                if(result){
                    // console.info("Consumed as "+result.type)
                    return result
                }  
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
        restParamParser = consumer(restParamRegEx, function(val) {
            var temp = src
            src = val.slice(3)  //Stripping the '...'
            argument = statementParser()
            src = temp
            return {type: "RestElement", argument: argument}
        }),
        elementParser = parserFactory(literalParser, identifierParser, restParamParser),
        openParanthesesParser = consumer(openParanthesesRegEx, function(val){
            return true
        }),
        closingParanthesesParser = consumer(closingParanthesesRegEx, function(val){
            return true
        }),
        operatorParser = consumer(operatorRegEx),
        varKeywordParser = consumer(varKeywordRegEx),
        functionKeywordParser = consumer(functionKeywordRegEx),
        ifKeywordParser = consumer(ifKeywordRegEx),
        macroKeywordParser = consumer(macroKeywordRegEx),
        fatArrowParser = consumer(fatArrowRegEx)

    function argumentsParser() {
        var args = []
        spaceParser()
        if(src.length > 0){
            while(!closingParanthesesParser()){
                // console.info("Parsing args "+src)
                arg = argStatementParser()
                if (!arg)
                    throw new SyntaxError("argumentsParser : Unexpected character at line: "+line)
                args.push(arg)
                spaceParser()
            }
            spaceParser()
            if (args.length > 0)
                return args
        }
        return []
    }

    function expressionParser() {
        if (!openParanthesesParser()) return null
        // console.info("ExpressionParser "+src)
        return callExpressionParser() || binaryExpressionParser() || statementParser()
    }

    function expressionStatementParser() {
        spaceParser()
        if (closingParanthesesParser())  return null
        // console.info("ExpressionStatementParser "+src)
        return combinator({type: "ExpressionStatement"}, ["expression", expressionParser])
    }

    function macroCallParser() {
        var temp = src
        if(!openParanthesesParser()) return null
        if (macroId = identifierParser()) {
        // console.info("MacroCallParser "+src)
            if (macro = macros[macroId.name]) {
                var macroArgs = getArguments() || []
                var macroBody = macro.body
                for(param in macro.params){
                    var regex = new RegExp('~'+param.replace(/\./g,'\\.'), 'gi')
                    if(!Array.isArray(macro.params[param]))
                        val = macroArgs.shift()
                    else
                        val = macroArgs.join(" ")
                    macroBody = macroBody.replace(regex,val)
                }
                var temp = src
                src = macroBody
                var macroExpr = []
                while(src.length > 0){
                    // console.info("Parsing Macro Body "+src)
                    var rslt = statementParser()
                    if(rslt)    macroExpr.push(rslt)
                    else    throw new SyntaxError("Cannot parse macro body")
                }
                src = temp
                return macroExpr
            }
        }
        src = temp
        return null
    }

    function callExpressionParser() {
        // console.info("callExpressionParser "+src)
        return combinator({type: "CallExpression"}, ["callee", statementParser], ["arguments", argumentsParser])
    }
    
    function binaryExpressionParser() {
        // console.info("binaryExpressionParser "+src)
        return combinator({type: "BinaryExpression"}, ["operator", operatorParser], ["left", elementParser], ["right", elementParser], ["", closingParanthesesParser])
    }

    function extractExpression() {
        var found = false, parantheses = 1, i = 0
        while(!found){
            // console.info("Inside extractExpression "+src)
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

    function getArguments(){
        var args = []
        while(!closingParanthesesParser()){
            // console.info("Inside getArguments "+src)
            if(matches = /^[a-z0-9]*\b/.exec(src) || stringRegEx.exec(src)){
                args.push(matches[0])
            }
            else if(openParanthesesParser()){
                matches = [extractExpression()]
                args.push('('+matches[0])
            }
            if(matches) src = src.slice(matches[0].length)
            else    throw new SyntaxError("Unknown character at line: "+line)
            spaceParser()
        }
        return args
    }

    function macroDeclarationParser() {
        if (!macroKeywordParser())    return null
        // console.info("macroDeclarationParser "+src)
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
            if (param = identifierParser().name) {
                macro.params[param.toString()] = null
            }
        }
        macro.params["...rest"] = []

        //body
        macro.body = src.slice(0,src.length-1)

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
            if(typeof parser == "function"){
                if(Array.isArray(args)){
                    var result = parser(args[0],args[1])
                }
                else
                    var result = parser()
                if(result == null) return null
            }
            else
                result = parser

            if(attr){
                expr[attr] = result
            }
        }
        return expr
    }

    function functionDeclarationParser() {
        if (!functionKeywordParser())    return null
        // console.info("functionDeclarationParser "+src)
        var snippet = extractExpression()
        var rest = src.slice(snippet.length)
        src = snippet
        var expr = combinator({type: "FunctionDeclaration"}, ["id", identifierParser], ["",openParanthesesParser], ["params",argumentsParser], ["defaults", []], ["body", blockStatementParser], ["generator", false], ["expression", false])
        src = rest
        return expr
    }

    function variableDeclarationParser() {
        if (!varKeywordParser()) return null
        // console.info("variableDeclarationParser "+src)
        var expr = {type: "VariableDeclaration", declarations: [], kind: "var"}
        var innerExpr = combinator({type: "VariableDeclarator"}, ["id", identifierParser], ["init", argStatementParser], ["", closingParanthesesParser])
        expr.declarations.push(innerExpr)
        closingParanthesesParser()
        return expr
    }

    function blockStatementParser() {
        return combinator({type: "BlockStatement"}, ["body", functionBodyParser])
    }

    function arrowFunctionParser() {
        if (!fatArrowParser())   return null
        // console.info("arrowFunctionParser "+src)
        var snippet = extractExpression()
        var rest = src.slice(snippet.length)
        src = snippet
        var expr = combinator({type: "ArrowFunctionExpression"}, ["id", null], ["", openParanthesesParser], ["params", argumentsParser], ["defaults", []], ["body", blockStatementParser], ["generator", false], ["expression", false])
        src = rest
        return expr
    }

    function ifStatementParser() {
        if (!ifKeywordParser())   return null
        // console.info("ifStatementParser "+src)
        var snippet = extractExpression()
        var rest = src.slice(snippet.length)
        src = snippet
        var expr = combinator({type: "IfStatement"}, ["", openParanthesesParser], ["test", argStatementParser], ["", closingParanthesesParser], ["", openParanthesesParser], ["consequent", blockStatementParser], ["", openParanthesesParser], ["alternate", blockStatementParser])
        src = rest
        return expr
    }

    function functionBodyParser() {
        var stmts = []
        while(!closingParanthesesParser()){
            // console.info("Parsing Function Body "+src)
            var stmt = argStatementParser()
            stmts.push(stmt)
        }
        stmts[stmts.length-1] = {type: "ReturnStatement", argument: stmts[stmts.length-1]}

        return stmts
    }

    function statementParser() {
        // console.info("statementParser "+src)
        return ifStatementParser() || arrowFunctionParser() || macroDeclarationParser()|| functionDeclarationParser() || variableDeclarationParser() || elementParser() || macroCallParser() || expressionStatementParser()
    }

    function argStatementParser() {
        // console.info("argStatementParser "+src)
        return ifStatementParser() || arrowFunctionParser() || macroDeclarationParser()|| functionDeclarationParser() || variableDeclarationParser() || elementParser() || expressionParser()
    }

    function bodyParser() {
        var body = []
        while(src.length != 0){
            spaceParser()
            var stmt = statementParser()
            // console.info("Output: ",stmt)
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