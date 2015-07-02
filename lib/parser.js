

var ast = {
    "type": "Program",
    "body": []
}

var spaceRegEx = /^[ \t\r\n\b\f]+/

module.exports = program => {

	var spaceParser = () => {
        var spaces = spaceRegEx.exec(program)
        if (spaces === null) return null
        program.trim()
        return spaces[0]
	}

	console.log(spaceParser())
    return ast
}